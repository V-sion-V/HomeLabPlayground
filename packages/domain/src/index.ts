import { randomBytes, randomUUID } from "node:crypto";
import type {
  Account,
  AssetLine,
  HistoricalSeason,
  PlatformSnapshot,
  Room,
  RoomConfig,
  RoomProjection,
  SeasonAsset
} from "@party/contracts";
import { assertNoPrivateCards } from "@party/contracts";

export class DomainError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message);
  }
}

export function normalizeUsername(input: string): string {
  const normalized = input.normalize("NFKC").trim().toLocaleLowerCase("und");
  if (normalized.length < 1 || [...normalized].length > 32) {
    throw new DomainError("INVALID_USERNAME");
  }
  return normalized;
}

export function initialSnapshot(now = Date.now()): PlatformSnapshot {
  return {
    version: 0,
    accounts: {},
    seasons: [
      {
        id: randomUUID(),
        name: "赛季 1",
        baseScore: 10_000,
        status: "current",
        startedAt: now
      }
    ],
    seasonAssets: {},
    historicalSeasons: [],
    rooms: {},
    leases: {},
    ledger: [],
    settings: {
      defaultLanguage: "zh-CN",
      defaultHostTransferTimeoutSeconds: 60,
      poker: { smallBlind: 50, bigBlind: 100, minBuyIn: 2_000, maxBuyIn: 20_000 }
    }
  };
}

export class PlatformDomain {
  constructor(
    public readonly state: PlatformSnapshot,
    private readonly now: () => number = Date.now,
    private readonly id: () => string = randomUUID
  ) {}

  get currentSeason() {
    const season = this.state.seasons.find((candidate) => candidate.status === "current");
    if (!season) throw new DomainError("NO_CURRENT_SEASON");
    return season;
  }

  enterAccount(username: string, avatar = "🙂"): Account {
    const normalizedUsername = normalizeUsername(username);
    const existing = Object.values(this.state.accounts).find(
      (account) => account.normalizedUsername === normalizedUsername
    );
    if (existing) return existing;
    const account: Account = {
      id: this.id(),
      username: username.normalize("NFKC").trim(),
      normalizedUsername,
      avatar,
      updatedAt: this.now()
    };
    this.state.accounts[account.id] = account;
    this.state.seasonAssets[account.id] = {
      accountId: account.id,
      score: this.currentSeason.baseScore,
      inGame: false,
      frozenScore: null
    };
    this.issue(account.id, this.currentSeason.baseScore, "account-created");
    return account;
  }

  updateProfile(accountId: string, username: string, avatar: string): Account {
    const account = this.requireAccount(accountId);
    const normalizedUsername = normalizeUsername(username);
    const duplicate = Object.values(this.state.accounts).find(
      (candidate) =>
        candidate.id !== accountId && candidate.normalizedUsername === normalizedUsername
    );
    if (duplicate) throw new DomainError("USERNAME_TAKEN");
    account.username = username.normalize("NFKC").trim();
    account.normalizedUsername = normalizedUsername;
    account.avatar = avatar;
    account.updatedAt = this.now();
    return account;
  }

  acquireLease(accountId: string): string {
    this.requireAccount(accountId);
    const connectionId = randomBytes(24).toString("base64url");
    this.state.leases[accountId] = { connectionId, acquiredAt: this.now() };
    const room = this.roomForAccount(accountId);
    const seat = room?.seats.find((candidate) => candidate.accountId === accountId);
    if (seat) seat.connected = true;
    return connectionId;
  }

  assertLease(accountId: string, connectionId: string): void {
    if (this.state.leases[accountId]?.connectionId !== connectionId) {
      throw new DomainError("STALE_CONNECTION");
    }
  }

  createRoom(accountId: string, name: string, config: RoomConfig): Room {
    this.requireAccount(accountId);
    if (this.roomForAccount(accountId)) throw new DomainError("ALREADY_IN_ROOM");
    this.validateRoomConfig(config);
    const room: Room = {
      id: this.id(),
      name: name.trim() || "Texas Hold'em",
      gameType: "texas-holdem",
      status: "waiting",
      hostAccountId: accountId,
      config: structuredClone(config),
      seats: [],
      version: 0
    };
    this.state.rooms[room.id] = room;
    return room;
  }

  joinRoom(roomId: string, accountId: string, buyIn: number): Room {
    const room = this.requireRoom(roomId);
    if (room.status !== "waiting") throw new DomainError("ROOM_ALREADY_STARTED");
    if (room.seats.length >= 10) throw new DomainError("ROOM_FULL");
    if (this.roomForAccount(accountId)) throw new DomainError("ALREADY_IN_ROOM");
    if (!Number.isInteger(buyIn) || buyIn < room.config.minBuyIn || buyIn > room.config.maxBuyIn) {
      throw new DomainError("INVALID_BUY_IN");
    }
    const asset = this.requireAsset(accountId);
    if (asset.score < buyIn) throw new DomainError("INSUFFICIENT_SCORE");
    const position = room.seats.length;
    room.seats.push({
      accountId,
      position,
      connected: true,
      tableChips: buyIn,
      currentBet: 0,
      folded: false,
      allIn: false
    });
    asset.inGame = true;
    asset.frozenScore = asset.score;
    this.transfer(accountId, room.id, buyIn, "buy-in");
    room.version += 1;
    return room;
  }

  startRoom(roomId: string, hostAccountId: string): Room {
    const room = this.requireRoom(roomId);
    if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
    if (room.seats.length < 2) throw new DomainError("NOT_ENOUGH_PLAYERS");
    room.status = "in_progress";
    room.version += 1;
    return room;
  }

  transferHost(roomId: string, fromAccountId: string, toAccountId: string): Room {
    const room = this.requireRoom(roomId);
    if (room.hostAccountId !== fromAccountId) throw new DomainError("HOST_ONLY");
    if (!room.seats.some((seat) => seat.accountId === toAccountId)) {
      throw new DomainError("PLAYER_NOT_IN_ROOM");
    }
    room.hostAccountId = toAccountId;
    delete room.hostDisconnectDeadline;
    room.version += 1;
    return room;
  }

  disconnect(roomId: string, accountId: string): void {
    const room = this.requireRoom(roomId);
    const seat = room.seats.find((candidate) => candidate.accountId === accountId);
    if (seat) seat.connected = false;
    if (room.hostAccountId === accountId) {
      room.hostDisconnectDeadline =
        this.now() + room.config.hostTransferTimeoutSeconds * 1_000;
    }
  }

  resolveHostTimeout(roomId: string, pick: (ids: string[]) => string): Room | undefined {
    const room = this.requireRoom(roomId);
    if (!room.hostDisconnectDeadline || room.hostDisconnectDeadline > this.now()) return room;
    const candidates = room.seats
      .filter((seat) => seat.connected && seat.accountId !== room.hostAccountId)
      .map((seat) => seat.accountId);
    if (candidates.length === 0) {
      this.closeRoom(roomId);
      return undefined;
    }
    const chosen = pick(candidates);
    if (!candidates.includes(chosen)) throw new DomainError("INVALID_HOST_CANDIDATE");
    room.hostAccountId = chosen;
    delete room.hostDisconnectDeadline;
    room.version += 1;
    return room;
  }

  closeRoom(roomId: string): void {
    const room = this.requireRoom(roomId);
    for (const seat of room.seats) {
      const refundable = seat.tableChips + seat.currentBet;
      if (refundable > 0) this.transfer(room.id, seat.accountId, refundable, "room-close");
      seat.tableChips = 0;
      seat.currentBet = 0;
      const asset = this.requireAsset(seat.accountId);
      asset.inGame = false;
      asset.frozenScore = null;
    }
    room.status = "closed";
    room.version += 1;
    delete this.state.rooms[roomId];
  }

  startSeason(name: string | undefined, baseScore: number): void {
    if (Object.keys(this.state.rooms).length > 0) throw new DomainError("ROOMS_MUST_CLOSE");
    if (!Number.isInteger(baseScore) || baseScore < 0) throw new DomainError("INVALID_BASE_SCORE");
    const previous = this.currentSeason;
    const entries = this.currentLeaderboard();
    previous.status = "historical";
    previous.endedAt = this.now();
    const historical: HistoricalSeason = { season: structuredClone(previous), entries };
    this.state.historicalSeasons.push(historical);
    const nextNumber = this.state.seasons.length + 1;
    const next = {
      id: this.id(),
      name: name?.trim() || `赛季 ${nextNumber}`,
      baseScore,
      status: "current" as const,
      startedAt: this.now()
    };
    this.state.seasons.push(next);
    this.state.seasonAssets = {};
    for (const account of Object.values(this.state.accounts)) {
      this.state.seasonAssets[account.id] = {
        accountId: account.id,
        score: baseScore,
        inGame: false,
        frozenScore: null
      };
      this.issue(account.id, baseScore, "new-season");
    }
  }

  currentLeaderboard() {
    return Object.values(this.state.accounts)
      .map((account) => {
        const asset = this.requireAsset(account.id);
        return {
          accountId: account.id,
          username: account.username,
          avatar: account.avatar,
          score: asset.frozenScore ?? asset.score,
          rank: 0
        };
      })
      .sort((left, right) => right.score - left.score || left.username.localeCompare(right.username))
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  projectRoom(roomId: string, viewer?: { accountId?: string; display?: boolean }): RoomProjection {
    const room = this.requireRoom(roomId);
    const projection: RoomProjection = {
      id: room.id,
      name: room.name,
      mode: room.config.mode,
      status: room.status,
      hostAccountId: room.hostAccountId,
      version: room.version,
      seats: room.seats.map((seat) => {
        const account = this.requireAccount(seat.accountId);
        return {
          accountId: seat.accountId,
          username: account.username,
          avatar: account.avatar,
          position: seat.position,
          connected: seat.connected,
          tableChips: seat.tableChips,
          currentBet: seat.currentBet,
          folded: seat.folded,
          allIn: seat.allIn
        };
      }),
      potTotal: room.poker?.pots.reduce((sum, pot) => sum + pot.amount, 0) ?? 0,
      phase: room.poker?.phase,
      actingAccountId: room.poker?.actingAccountId,
      advanceDeadline: room.poker?.advanceDeadline
    };
    if (room.config.mode === "chips-and-cards") {
      const cards = room.poker?.communityCards ?? [];
      projection.communityCards = [
        ...cards,
        ...Array.from({ length: Math.max(0, 5 - cards.length) }, () => ({ hidden: true }) as const)
      ];
      if (!viewer?.display && viewer?.accountId) {
        projection.ownHoleCards = room.poker?.holeCards[viewer.accountId] ?? [];
      }
    }
    assertNoPrivateCards(projection);
    return projection;
  }

  validateInvariants(): void {
    const normalized = new Set<string>();
    for (const account of Object.values(this.state.accounts)) {
      if (normalized.has(account.normalizedUsername)) throw new DomainError("DUPLICATE_USERNAME");
      normalized.add(account.normalizedUsername);
    }
    for (const asset of Object.values(this.state.seasonAssets)) {
      if (!Number.isInteger(asset.score) || asset.score < 0) {
        throw new DomainError("NEGATIVE_ASSET");
      }
    }
    const occupancy = new Set<string>();
    for (const room of Object.values(this.state.rooms)) {
      for (const seat of room.seats) {
        if (occupancy.has(seat.accountId)) throw new DomainError("MULTIPLE_ROOM_OCCUPANCY");
        occupancy.add(seat.accountId);
        if (seat.tableChips < 0 || seat.currentBet < 0) throw new DomainError("NEGATIVE_ASSET");
      }
    }
  }

  private issue(accountId: string, amount: number, reason: string): void {
    const line: AssetLine = {
      id: this.id(),
      groupId: this.id(),
      seasonId: this.currentSeason.id,
      accountId,
      source: "season-issuance",
      destination: `account:${accountId}`,
      amount,
      reason,
      createdAt: this.now()
    };
    this.state.ledger.push(line);
  }

  private transfer(source: string, destination: string, amount: number, reason: string): void {
    if (!Number.isInteger(amount) || amount < 0) throw new DomainError("INVALID_AMOUNT");
    const groupId = this.id();
    if (this.state.accounts[source]) this.requireAsset(source).score -= amount;
    if (this.state.accounts[destination]) this.requireAsset(destination).score += amount;
    const common = {
      groupId,
      seasonId: this.currentSeason.id,
      amount,
      reason,
      createdAt: this.now()
    };
    this.state.ledger.push(
      {
        id: this.id(),
        ...common,
        accountId: this.state.accounts[source] ? source : undefined,
        roomId: this.state.rooms[source] ? source : this.state.rooms[destination] ? destination : undefined,
        source: `asset:${source}`,
        destination: `clearing:${groupId}`
      },
      {
        id: this.id(),
        ...common,
        accountId: this.state.accounts[destination] ? destination : undefined,
        roomId: this.state.rooms[source] ? source : this.state.rooms[destination] ? destination : undefined,
        source: `clearing:${groupId}`,
        destination: `asset:${destination}`
      }
    );
    this.validateInvariants();
  }

  private validateRoomConfig(config: RoomConfig): void {
    const integers = [
      config.smallBlind,
      config.bigBlind,
      config.minBuyIn,
      config.maxBuyIn,
      config.hostTransferTimeoutSeconds
    ];
    if (integers.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new DomainError("INVALID_ROOM_CONFIG");
    }
    if (config.smallBlind >= config.bigBlind || config.minBuyIn > config.maxBuyIn) {
      throw new DomainError("INVALID_ROOM_CONFIG");
    }
  }

  private roomForAccount(accountId: string): Room | undefined {
    return Object.values(this.state.rooms).find((room) =>
      room.seats.some((seat) => seat.accountId === accountId)
    );
  }

  private requireRoom(roomId: string): Room {
    const room = this.state.rooms[roomId];
    if (!room) throw new DomainError("ROOM_NOT_FOUND");
    return room;
  }

  private requireAccount(accountId: string): Account {
    const account = this.state.accounts[accountId];
    if (!account) throw new DomainError("ACCOUNT_NOT_FOUND");
    return account;
  }

  private requireAsset(accountId: string): SeasonAsset {
    const asset = this.state.seasonAssets[accountId];
    if (!asset) throw new DomainError("ASSET_NOT_FOUND");
    return asset;
  }
}
