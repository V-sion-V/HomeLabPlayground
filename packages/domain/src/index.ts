import { randomBytes, randomUUID } from "node:crypto";
import type {
  Account,
  AssetLine,
  GlobalSettings,
  HistoricalSeason,
  LobbyProjection,
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
    handResults: [],
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
  ) {
    state.handResults ??= [];
  }

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
    if (seat && !seat.connected) {
      seat.connected = true;
      if (room?.hostAccountId === accountId) delete room.hostDisconnectDeadline;
      if (room) room.version += 1;
    } else if (room?.hostAccountId === accountId) {
      delete room.hostDisconnectDeadline;
    }
    return connectionId;
  }

  assertLease(accountId: string, connectionId: string): void {
    if (this.state.leases[accountId]?.connectionId !== connectionId) {
      throw new DomainError("STALE_CONNECTION");
    }
  }

  updateSettings(settings: GlobalSettings): GlobalSettings {
    if (!["zh-CN", "en"].includes(settings.defaultLanguage)) {
      throw new DomainError("INVALID_LANGUAGE");
    }
    this.validateRoomConfig({
      mode: "chips-and-cards",
      hostTransferTimeoutSeconds: settings.defaultHostTransferTimeoutSeconds,
      ...settings.poker
    });
    this.state.settings = structuredClone(settings);
    return this.state.settings;
  }

  lobbyProjection(accountId?: string): LobbyProjection {
    return {
      version: this.state.version,
      rooms: Object.values(this.state.rooms)
        .map((room) => {
          const projection = this.projectRoom(room.id, { display: true });
          return {
            id: room.id,
            name: room.name,
            mode: room.config.mode,
            status: room.status,
            hostAccountId: room.hostAccountId,
            seatCount: room.seats.length,
            maxSeats: 10,
            smallBlind: room.config.smallBlind,
            bigBlind: room.config.bigBlind,
            minBuyIn: room.config.minBuyIn,
            maxBuyIn: room.config.maxBuyIn,
            seats: projection.seats
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
      leaderboard: this.currentLeaderboard(),
      historicalSeasons: structuredClone(this.state.historicalSeasons),
      currentSeason: structuredClone(this.currentSeason),
      settings: structuredClone(this.state.settings),
      accountRoomId: accountId ? this.roomForAccount(accountId)?.id : undefined
    };
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

  pauseRoom(roomId: string, hostAccountId: string): Room {
    const room = this.requireRoom(roomId);
    if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
    if (room.status !== "in_progress") throw new DomainError("ROOM_NOT_IN_PROGRESS");
    room.status = "paused";
    room.version += 1;
    return room;
  }

  resumeRoom(roomId: string, hostAccountId: string): Room {
    const room = this.requireRoom(roomId);
    if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
    if (room.status !== "paused") throw new DomainError("ROOM_NOT_PAUSED");
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

  topUp(roomId: string, accountId: string, amount: number): Room {
    const room = this.requireRoom(roomId);
    const seat = room.seats.find((candidate) => candidate.accountId === accountId);
    if (!seat) throw new DomainError("PLAYER_NOT_IN_ROOM");
    if (room.poker && !["complete", "waiting", "void"].includes(room.poker.phase)) {
      throw new DomainError("HAND_IN_PROGRESS");
    }
    if (!Number.isInteger(amount) || amount <= 0) throw new DomainError("INVALID_AMOUNT");
    const currentStack =
      room.poker?.players.find((player) => player.accountId === accountId)?.stack ??
      seat.tableChips;
    if (currentStack + amount > room.config.maxBuyIn) throw new DomainError("BUY_IN_LIMIT");
    if (this.requireAsset(accountId).score < amount) throw new DomainError("INSUFFICIENT_SCORE");
    this.transfer(accountId, room.id, amount, "top-up");
    seat.tableChips = currentStack + amount;
    const pokerPlayer = room.poker?.players.find((player) => player.accountId === accountId);
    if (pokerPlayer) pokerPlayer.stack += amount;
    room.version += 1;
    return room;
  }

  leaveRoom(roomId: string, accountId: string, forced = false): Room | undefined {
    const room = this.requireRoom(roomId);
    const seatIndex = room.seats.findIndex((candidate) => candidate.accountId === accountId);
    if (seatIndex < 0) throw new DomainError("PLAYER_NOT_IN_ROOM");
    if (room.hostAccountId === accountId && room.seats.length > 1 && !forced) {
      throw new DomainError("TRANSFER_HOST_FIRST");
    }
    const pokerPlayer = room.poker?.players.find((player) => player.accountId === accountId);
    const handActive =
      room.poker && !["complete", "waiting", "void"].includes(room.poker.phase);
    if (handActive && !forced) throw new DomainError("HAND_IN_PROGRESS");
    if (pokerPlayer && handActive) pokerPlayer.folded = true;
    const refundable = pokerPlayer?.stack ?? room.seats[seatIndex]!.tableChips;
    if (refundable > 0) this.transfer(room.id, accountId, refundable, forced ? "player-removed" : "leave-room");
    if (pokerPlayer) pokerPlayer.stack = 0;
    const asset = this.requireAsset(accountId);
    asset.inGame = false;
    asset.frozenScore = null;
    room.seats.splice(seatIndex, 1);
    room.seats.forEach((seat, position) => {
      seat.position = position;
    });
    if (room.seats.length === 0) {
      delete this.state.rooms[roomId];
      return undefined;
    }
    if (room.hostAccountId === accountId) room.hostAccountId = room.seats[0]!.accountId;
    room.version += 1;
    return room;
  }

  disconnect(roomId: string, accountId: string): void {
    const room = this.requireRoom(roomId);
    const seat = room.seats.find((candidate) => candidate.accountId === accountId);
    if (!seat || !seat.connected) return;
    seat.connected = false;
    if (room.hostAccountId === accountId) {
      room.hostDisconnectDeadline =
        this.now() + room.config.hostTransferTimeoutSeconds * 1_000;
    }
    room.version += 1;
  }

  connect(accountId: string): Room | undefined {
    const room = this.roomForAccount(accountId);
    const seat = room?.seats.find((candidate) => candidate.accountId === accountId);
    if (!room || !seat) return room;
    if (!seat.connected || room.hostDisconnectDeadline) {
      seat.connected = true;
      if (room.hostAccountId === accountId) delete room.hostDisconnectDeadline;
      room.version += 1;
    }
    return room;
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
    const pokerPlayers = new Map(
      room.poker?.players.map((player) => [player.accountId, player]) ?? []
    );
    const accountIds = new Set([
      ...room.seats.map((seat) => seat.accountId),
      ...pokerPlayers.keys()
    ]);
    for (const accountId of accountIds) {
      const seat = room.seats.find((candidate) => candidate.accountId === accountId);
      const pokerPlayer = pokerPlayers.get(accountId);
      const handActive =
        room.poker && !["complete", "waiting", "void"].includes(room.poker.phase);
      const refundable = pokerPlayer
        ? pokerPlayer.stack + (handActive ? pokerPlayer.totalBet : 0)
        : (seat?.tableChips ?? 0) + (seat?.currentBet ?? 0);
      if (refundable > 0) this.transfer(room.id, accountId, refundable, "room-close");
      if (seat) {
        seat.tableChips = 0;
        seat.currentBet = 0;
      }
      const asset = this.requireAsset(accountId);
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
    const pokerPlayers = new Map(
      room.poker?.players.map((player) => [player.accountId, player]) ?? []
    );
    const projection: RoomProjection = {
      platformVersion: this.state.version,
      id: room.id,
      name: room.name,
      mode: room.config.mode,
      status: room.status,
      hostAccountId: room.hostAccountId,
      config: structuredClone(room.config),
      version: room.version,
      seats: room.seats.map((seat) => {
        const account = this.requireAccount(seat.accountId);
        const pokerPlayer = pokerPlayers.get(seat.accountId);
        return {
          accountId: seat.accountId,
          username: account.username,
          avatar: account.avatar,
          position: seat.position,
          connected: seat.connected,
          tableChips: pokerPlayer?.stack ?? seat.tableChips,
          currentBet: pokerPlayer?.roundBet ?? seat.currentBet,
          folded: pokerPlayer?.folded ?? seat.folded,
          allIn: pokerPlayer?.allIn ?? seat.allIn
        };
      }),
      potTotal: room.poker?.pots.reduce((sum, pot) => sum + pot.amount, 0) ?? 0,
      phase: room.poker?.phase,
      actingAccountId: room.poker?.actingAccountId,
      pokerVersion: room.poker?.version,
      currentBet: room.poker?.currentBet,
      minimumRaise: room.poker?.minimumRaise,
      handNumber: room.poker?.handNumber,
      dealerPosition: room.poker?.dealerPosition,
      lastAction: room.poker?.lastAction
        ? {
            accountId: room.poker.lastAction.accountId,
            kind: room.poker.lastAction.kind,
            amount: room.poker.lastAction.amount,
            version: room.poker.lastAction.version,
            reversible: room.poker.lastAction.reversible
          }
        : undefined,
      pots: room.poker?.pots.map((pot) => ({
        amount: pot.amount,
        eligibleAccountIds: [...pot.eligibleAccountIds]
      })),
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
    const issued = this.state.ledger
      .filter(
        (line) =>
          line.seasonId === this.currentSeason.id && line.source === "season-issuance"
      )
      .reduce((sum, line) => sum + line.amount, 0);
    const accountTotal = Object.values(this.state.seasonAssets).reduce(
      (sum, asset) => sum + asset.score,
      0
    );
    const tableTotal = Object.values(this.state.rooms).reduce((sum, room) => {
      if (!room.poker) {
        return sum + room.seats.reduce((roomSum, seat) => roomSum + seat.tableChips, 0);
      }
      return (
        sum +
        room.poker.players.reduce(
          (roomSum, player) => roomSum + player.stack + player.totalBet,
          0
        )
      );
    }, 0);
    if (accountTotal + tableTotal !== issued) {
      throw new DomainError("ASSET_CONSERVATION_FAILED");
    }
  }

  recordPokerMovement(
    roomId: string,
    accountId: string,
    amount: number,
    direction: "table-to-pot" | "pot-to-table",
    reason: string,
    handNumber: number
  ): void {
    if (!Number.isInteger(amount) || amount <= 0) return;
    const table = `table:${roomId}:${accountId}`;
    const pot = `pot:${roomId}:${handNumber}`;
    this.recordMovementPair({
      accountId,
      roomId,
      handNumber,
      source: direction === "table-to-pot" ? table : pot,
      destination: direction === "table-to-pot" ? pot : table,
      amount,
      reason
    });
  }

  recordHandResult(
    roomId: string,
    handNumber: number,
    mode: Room["config"]["mode"],
    payouts: Array<{ accountId: string; amount: number }>
  ): void {
    this.state.handResults.push({
      id: this.id(),
      seasonId: this.currentSeason.id,
      roomId,
      handNumber,
      mode,
      payouts: structuredClone(payouts),
      completedAt: this.now()
    });
  }

  reverseHandResult(roomId: string, handNumber: number): void {
    const result = [...this.state.handResults]
      .reverse()
      .find(
        (candidate) =>
          candidate.roomId === roomId &&
          candidate.handNumber === handNumber &&
          candidate.reversedAt === undefined
      );
    if (!result) throw new DomainError("HAND_RESULT_NOT_FOUND");
    result.reversedAt = this.now();
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
  }

  private recordMovementPair(input: {
    accountId: string;
    roomId: string;
    handNumber: number;
    source: string;
    destination: string;
    amount: number;
    reason: string;
  }): void {
    const groupId = this.id();
    const common = {
      groupId,
      seasonId: this.currentSeason.id,
      accountId: input.accountId,
      roomId: input.roomId,
      handNumber: input.handNumber,
      amount: input.amount,
      reason: input.reason,
      createdAt: this.now()
    };
    this.state.ledger.push(
      {
        id: this.id(),
        ...common,
        source: input.source,
        destination: `clearing:${groupId}`
      },
      {
        id: this.id(),
        ...common,
        source: `clearing:${groupId}`,
        destination: input.destination
      }
    );
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

  roomForAccount(accountId: string): Room | undefined {
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
