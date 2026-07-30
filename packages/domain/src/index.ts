import { randomBytes, randomUUID } from "node:crypto";
import type {
  Account,
  AdminProjection,
  AssetLine,
  AvalonMissionChoice,
  AvalonResultSummary,
  AvalonRole,
  AvalonRoom,
  AvalonRoomConfig,
  AvalonRoomProjection,
  Card,
  GlobalSettings,
  HandCategory,
  HistoricalSeason,
  Language,
  LobbyProjection,
  PlatformDataDeletionResult,
  PlatformParticipationFact,
  PlatformSnapshot,
  PokerRoom,
  PokerRoomProjection,
  Room,
  RoomConfig,
  RoomMode,
  RoomProjection,
  SeasonAsset,
  ThemeMode,
  UsernameLookupResult
} from "@party/contracts";
import {
  assertNoAvalonSecrets,
  assertNoPrivateCards,
  DEFAULT_DENOMINATIONS,
  fallbackAvatar,
  isSelectableAvatar,
  selectableAvatars
} from "@party/contracts";
import {
  DEFAULT_AVALON_ROLE_PRESETS,
  AvalonRuleError,
  advanceAvalonNight as advanceAvalonNightState,
  assassinateInAvalon as assassinateInAvalonState,
  avalonAlignmentForRole,
  avalonKnowledgeFor,
  castAvalonVote as castAvalonVoteState,
  confirmAvalonRole as confirmAvalonRoleState,
  createAvalonGame,
  currentAvalonLeader,
  currentAvalonMissionRule,
  normalizeAvalonRoles,
  proposeAvalonTeam as proposeAvalonTeamState,
  restartAvalonNight as restartAvalonNightState,
  submitAvalonMission as submitAvalonMissionState,
  voidAvalonGame as voidAvalonGameState,
  type AvalonRandomInt
} from "@party/avalon";

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

export function normalizeDenominations(input: readonly number[]): number[] {
  if (
    input.length < 1 ||
    input.length > 16 ||
    input.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
    new Set(input).size !== input.length ||
    !input.includes(1)
  ) {
    throw new DomainError("INVALID_DENOMINATIONS");
  }
  return [...input].sort((left, right) => left - right);
}

function checkedAdd(left: number, right: number): number {
  const result = left + right;
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    !Number.isSafeInteger(result)
  ) {
    throw new DomainError("SAFE_INTEGER_OVERFLOW");
  }
  return result;
}

function checkedSubtract(left: number, right: number): number {
  const result = left - right;
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    !Number.isSafeInteger(result)
  ) {
    throw new DomainError("SAFE_INTEGER_OVERFLOW");
  }
  return result;
}

function checkedMultiply(left: number, right: number): number {
  const result = left * right;
  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    !Number.isSafeInteger(result)
  ) {
    throw new DomainError("SAFE_INTEGER_OVERFLOW");
  }
  return result;
}

function checkedSum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total = checkedAdd(total, value);
  return total;
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
    avalonResults: [],
    retiredIdentities: {},
    settings: {
      defaultLanguage: "zh-CN",
      defaultTheme: "dark",
      defaultHostTransferTimeoutSeconds: 60,
      poker: {
        smallBlind: 50,
        bigBlind: 100,
        minBuyIn: 2_000,
        maxBuyIn: 20_000,
        suitColorPreset: "standard",
        denominations: [...DEFAULT_DENOMINATIONS]
      },
      avalon: {
        defaultRecognitionMode: "automatic",
        defaultOberonRule: "original",
        defaultStake: 100,
        rolePresets: structuredClone(DEFAULT_AVALON_ROLE_PRESETS)
      }
    }
  };
}

export class PlatformDomain {
  private normalizedPersistedState = false;

  constructor(
    public readonly state: PlatformSnapshot,
    private readonly now: () => number = Date.now,
    private readonly id: () => string = randomUUID
  ) {
    const legacySettings = state.settings as GlobalSettings & {
      defaultTheme?: ThemeMode;
    };
    if (legacySettings.defaultTheme === undefined) {
      legacySettings.defaultTheme = "dark";
      this.normalizedPersistedState = true;
    }
    const legacyPokerSettings = state.settings.poker as typeof state.settings.poker & {
      suitColorPreset?: GlobalSettings["poker"]["suitColorPreset"];
    };
    if (!legacyPokerSettings.suitColorPreset) {
      legacyPokerSettings.suitColorPreset = "standard";
      this.normalizedPersistedState = true;
    }
    if (!Array.isArray(legacyPokerSettings.denominations)) {
      legacyPokerSettings.denominations = [...DEFAULT_DENOMINATIONS];
      this.normalizedPersistedState = true;
    } else {
      const normalizedDenominations = normalizeDenominations(
        legacyPokerSettings.denominations
      );
      if (
        normalizedDenominations.some(
          (value, index) => value !== legacyPokerSettings.denominations[index]
        )
      ) {
        legacyPokerSettings.denominations = normalizedDenominations;
        this.normalizedPersistedState = true;
      }
    }
    const legacySettingsWithAvalon = state.settings as GlobalSettings & {
      avalon?: GlobalSettings["avalon"];
    };
    if (!legacySettingsWithAvalon.avalon) {
      legacySettingsWithAvalon.avalon = {
        defaultRecognitionMode: "automatic",
        defaultOberonRule: "original",
        defaultStake: 100,
        rolePresets: structuredClone(DEFAULT_AVALON_ROLE_PRESETS)
      };
      this.normalizedPersistedState = true;
    }
    for (const account of Object.values(state.accounts)) {
      const legacyAccount = account as Account & {
        language?: Language;
        theme?: ThemeMode;
        volume?: number;
      };
      let migratedAccount = false;
      if (legacyAccount.language === undefined) {
        legacyAccount.language = state.settings.defaultLanguage;
        migratedAccount = true;
      }
      if (legacyAccount.theme === undefined) {
        legacyAccount.theme = state.settings.defaultTheme;
        migratedAccount = true;
      }
      if (legacyAccount.volume === undefined) {
        legacyAccount.volume = 100;
        migratedAccount = true;
      }
      if (!isSelectableAvatar(account.avatar) && account.avatar !== fallbackAvatar) {
        account.avatar = fallbackAvatar;
        migratedAccount = true;
      }
      if (migratedAccount) {
        account.updatedAt = this.now();
        this.normalizedPersistedState = true;
      }
    }
    if (!Array.isArray(state.handResults)) {
      state.handResults = [];
      this.normalizedPersistedState = true;
    }
    const legacyStateWithAvalon = state as PlatformSnapshot & {
      avalonResults?: AvalonResultSummary[];
    };
    if (!Array.isArray(legacyStateWithAvalon.avalonResults)) {
      legacyStateWithAvalon.avalonResults = [];
      this.normalizedPersistedState = true;
    }
    if (!state.retiredIdentities || typeof state.retiredIdentities !== "object") {
      state.retiredIdentities = {};
      this.normalizedPersistedState = true;
    }
    for (const result of state.handResults) {
      const legacyResult = result as typeof result & {
        outcome?: "settled" | "void";
      };
      if (!legacyResult.outcome) {
        legacyResult.outcome = "settled";
        this.normalizedPersistedState = true;
      }
      const legacyParticipants = result as typeof result & {
        participantAccountIds?: string[];
      };
      if (!Array.isArray(legacyParticipants.participantAccountIds)) {
        legacyParticipants.participantAccountIds = [
          ...new Set(result.payouts.map((payout) => payout.accountId))
        ];
        this.normalizedPersistedState = true;
      }
    }
    for (const room of Object.values(state.rooms)) {
      const legacyTypedRoom = room as unknown as {
        gameType?: "texas-holdem" | "avalon";
      };
      if (!legacyTypedRoom.gameType) {
        legacyTypedRoom.gameType = "texas-holdem";
        this.normalizedPersistedState = true;
      }
      if (!Number.isFinite(room.createdAt)) {
        room.createdAt = 0;
        this.normalizedPersistedState = true;
      }
      if (room.gameType === "texas-holdem") {
        for (const seat of room.seats) {
          const legacySeat = seat as typeof seat & {
            buyIn?: number;
            frozenLeaderboardScore?: number;
          };
          if (!Number.isFinite(legacySeat.buyIn)) {
            legacySeat.buyIn = seat.tableChips;
            this.normalizedPersistedState = true;
          }
          if (!Number.isFinite(legacySeat.frozenLeaderboardScore)) {
            legacySeat.frozenLeaderboardScore =
              state.seasonAssets[seat.accountId]?.frozenScore ??
              state.seasonAssets[seat.accountId]?.score ??
              0;
            this.normalizedPersistedState = true;
          }
        }
      }
      const legacyRoom = room as typeof room & {
        waitingReadyAccountIds?: string[];
      };
      if (!Array.isArray(legacyRoom.waitingReadyAccountIds)) {
        legacyRoom.waitingReadyAccountIds = [];
        this.normalizedPersistedState = true;
      }
      if (
        room.gameType === "texas-holdem" &&
        room.poker &&
        !Array.isArray(room.poker.raiseLockedAccountIds)
      ) {
        room.poker.raiseLockedAccountIds = [];
        this.normalizedPersistedState = true;
      }
      if (
        room.gameType === "texas-holdem" &&
        room.poker &&
        !Array.isArray(room.poker.readyAccountIds)
      ) {
        room.poker.readyAccountIds = [];
        this.normalizedPersistedState = true;
      }
      if (
        room.gameType === "texas-holdem" &&
        room.poker &&
        !Array.isArray(room.poker.denominations)
      ) {
        room.poker.denominations = [...DEFAULT_DENOMINATIONS];
        this.normalizedPersistedState = true;
      } else if (room.gameType === "texas-holdem" && room.poker) {
        const normalizedDenominations = normalizeDenominations(
          room.poker.denominations
        );
        if (
          normalizedDenominations.some(
            (value, index) => value !== room.poker?.denominations[index]
          )
        ) {
          room.poker.denominations = normalizedDenominations;
          this.normalizedPersistedState = true;
        }
      }
      if (
        room.gameType === "texas-holdem" &&
        room.poker &&
        !Array.isArray(room.poker.departedAccountIds)
      ) {
        room.poker.departedAccountIds = [];
        this.normalizedPersistedState = true;
      }
      if (
        room.gameType === "texas-holdem" &&
        room.poker?.phase === "complete" &&
        room.poker.advanceDeadline !== undefined
      ) {
        delete room.poker.advanceDeadline;
        delete room.poker.pausedAdvanceRemainingMs;
        this.normalizedPersistedState = true;
      }
    }
  }

  get currentSeason() {
    const season = this.state.seasons.find((candidate) => candidate.status === "current");
    if (!season) throw new DomainError("NO_CURRENT_SEASON");
    return season;
  }

  lookupUsername(username: string): UsernameLookupResult {
    const normalizedUsername = normalizeUsername(username);
    const normalizedDisplayUsername = username.normalize("NFKC").trim();
    return {
      version: this.state.version,
      normalizedUsername,
      username: normalizedDisplayUsername,
      exists: Object.values(this.state.accounts).some(
        (account) => account.normalizedUsername === normalizedUsername
      )
    };
  }

  findAccountByUsername(username: string): Account | undefined {
    const normalizedUsername = normalizeUsername(username);
    return Object.values(this.state.accounts).find(
      (account) => account.normalizedUsername === normalizedUsername
    );
  }

  enterExistingAccount(username: string): Account {
    const account = this.findAccountByUsername(username);
    if (!account) throw new DomainError("ACCOUNT_NOT_FOUND");
    return account;
  }

  registerAccount(
    username: string,
    avatar: string,
    language: Language,
    theme: ThemeMode
  ): Account {
    const normalizedUsername = normalizeUsername(username);
    const existing = Object.values(this.state.accounts).find(
      (account) => account.normalizedUsername === normalizedUsername
    );
    if (existing) throw new DomainError("USERNAME_TAKEN");
    if (!isSelectableAvatar(avatar)) throw new DomainError("INVALID_AVATAR");
    this.validateAccountPreferences(language, theme, 100);
    const account: Account = {
      id: this.id(),
      username: username.normalize("NFKC").trim(),
      normalizedUsername,
      avatar,
      language,
      theme,
      volume: 100,
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

  enterAccount(username: string, avatar = selectableAvatars[0]!): Account {
    return (
      this.findAccountByUsername(username) ??
      this.registerAccount(
        username,
        avatar,
        this.state.settings.defaultLanguage,
        this.state.settings.defaultTheme
      )
    );
  }

  updateProfile(
    accountId: string,
    username: string,
    avatar: string,
    language?: Language,
    theme?: ThemeMode,
    volume?: number
  ): Account {
    const account = this.requireAccount(accountId);
    const nextLanguage = language ?? account.language;
    const nextTheme = theme ?? account.theme;
    const nextVolume = volume ?? account.volume;
    const normalizedUsername = normalizeUsername(username);
    const duplicate = Object.values(this.state.accounts).find(
      (candidate) =>
        candidate.id !== accountId && candidate.normalizedUsername === normalizedUsername
    );
    if (duplicate) throw new DomainError("USERNAME_TAKEN");
    if (!isSelectableAvatar(avatar)) throw new DomainError("INVALID_AVATAR");
    this.validateAccountPreferences(nextLanguage, nextTheme, nextVolume);
    account.username = username.normalize("NFKC").trim();
    account.normalizedUsername = normalizedUsername;
    account.avatar = avatar;
    account.language = nextLanguage;
    account.theme = nextTheme;
    account.volume = nextVolume;
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
    if (!["light", "dark"].includes(settings.defaultTheme)) {
      throw new DomainError("INVALID_THEME");
    }
    if (!["standard", "high-contrast"].includes(settings.poker.suitColorPreset)) {
      throw new DomainError("INVALID_SUIT_COLOR_PRESET");
    }
    this.validateRoomConfig({
      mode: "chips-and-cards",
      hostTransferTimeoutSeconds: settings.defaultHostTransferTimeoutSeconds,
      ...settings.poker
    });
    const avalon = this.normalizeAvalonSettings(settings.avalon);
    this.state.settings = structuredClone({
      ...settings,
      poker: {
        ...settings.poker,
        denominations: normalizeDenominations(settings.poker.denominations)
      },
      avalon
    });
    return this.state.settings;
  }

  lobbyProjection(accountId?: string): LobbyProjection {
    return {
      version: this.state.version,
      rooms: Object.values(this.state.rooms)
        .map((room) => {
          const projection = this.projectRoom(room.id, { display: true });
          if (
            room.gameType === "avalon" &&
            projection.gameType === "avalon"
          ) {
            return {
              id: room.id,
              name: room.name,
              gameType: "avalon" as const,
              status: room.status,
              hostAccountId: room.hostAccountId,
              seatCount: room.seats.length,
              maxSeats: 10,
              recognitionMode: room.config.recognitionMode,
              oberonRule: room.config.oberonRule,
              stake: room.config.stake,
              createdAt: room.createdAt,
              seats: projection.seats
            };
          }
          if (
            room.gameType !== "texas-holdem" ||
            projection.gameType !== "texas-holdem"
          ) {
            throw new DomainError("ROOM_GAME_TYPE_MISMATCH");
          }
          return {
            id: room.id,
            name: room.name,
            gameType: "texas-holdem" as const,
            mode: room.config.mode,
            status: room.status,
            hostAccountId: room.hostAccountId,
            seatCount: room.seats.length,
            maxSeats: 10,
            smallBlind: room.config.smallBlind,
            bigBlind: room.config.bigBlind,
            minBuyIn: room.config.minBuyIn,
            maxBuyIn: room.config.maxBuyIn,
            createdAt: room.createdAt,
            seats: projection.seats
          };
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
      leaderboard: this.currentLeaderboard(),
      historicalSeasons: structuredClone(this.state.historicalSeasons),
      currentSeason: structuredClone(this.currentSeason),
      accounts: Object.values(this.state.accounts)
        .map(({ id, username, avatar }) => ({ id, username, avatar }))
        .sort((left, right) => left.username.localeCompare(right.username)),
      settings: structuredClone(this.state.settings),
      accountRoomId: accountId ? this.roomForAccount(accountId)?.id : undefined
    };
  }

  adminProjection(): AdminProjection {
    return {
      version: this.state.version,
      accounts: Object.values(this.state.accounts)
        .map(({ id, username, avatar }) => ({ id, username, avatar }))
        .sort((left, right) => left.username.localeCompare(right.username)),
      currentSeason: structuredClone(this.currentSeason),
      historicalSeasons: this.state.seasons
        .filter((season) => season.status === "historical")
        .map((season) => structuredClone(season))
        .sort((left, right) => right.startedAt - left.startedAt),
      settings: structuredClone(this.state.settings)
    };
  }

  createRoom(accountId: string, name: string, config: RoomConfig): PokerRoom {
    this.requireAccount(accountId);
    if (this.roomForAccount(accountId)) throw new DomainError("ALREADY_IN_ROOM");
    this.validateRoomConfig(config);
    const room: PokerRoom = {
      id: this.id(),
      name: name.trim() || "Texas Hold'em",
      gameType: "texas-holdem",
      status: "waiting",
      hostAccountId: accountId,
      config: structuredClone(config),
      seats: [],
      waitingReadyAccountIds: [],
      version: 0,
      createdAt: this.now()
    };
    this.state.rooms[room.id] = room;
    return room;
  }

  createAvalonRoom(
    accountId: string,
    name: string,
    config: AvalonRoomConfig
  ): AvalonRoom {
    this.requireAccount(accountId);
    if (this.roomForAccount(accountId)) throw new DomainError("ALREADY_IN_ROOM");
    const normalizedConfig = this.normalizeAvalonRoomConfig(config);
    const room: AvalonRoom = {
      id: this.id(),
      name: name.trim() || "Avalon",
      gameType: "avalon",
      status: "waiting",
      hostAccountId: accountId,
      config: normalizedConfig,
      seats: [
        {
          accountId,
          position: 0,
          connected: true
        }
      ],
      waitingReadyAccountIds: [],
      version: 0,
      createdAt: this.now()
    };
    this.state.rooms[room.id] = room;
    return room;
  }

  joinRoom(roomId: string, accountId: string, buyIn: number): PokerRoom {
    const room = this.requirePokerRoom(roomId);
    if (!["waiting", "in_progress", "paused"].includes(room.status)) {
      throw new DomainError("ROOM_NOT_JOINABLE");
    }
    if (room.seats.length >= 10) throw new DomainError("ROOM_FULL");
    if (this.roomForAccount(accountId)) throw new DomainError("ALREADY_IN_ROOM");
    if (
      !Number.isSafeInteger(buyIn) ||
      buyIn < room.config.minBuyIn ||
      buyIn > room.config.maxBuyIn
    ) {
      throw new DomainError("INVALID_BUY_IN");
    }
    const asset = this.requireAsset(accountId);
    const occupiedPositions = new Set(room.seats.map((seat) => seat.position));
    const position = Array.from({ length: 10 }, (_, index) => index).find(
      (candidate) => !occupiedPositions.has(candidate)
    );
    if (position === undefined) throw new DomainError("ROOM_FULL");
    room.seats.push({
      accountId,
      position,
      connected: true,
      buyIn,
      frozenLeaderboardScore: asset.score,
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

  joinAvalonRoom(roomId: string, accountId: string): AvalonRoom {
    const room = this.requireAvalonRoom(roomId);
    if (!["waiting", "in_progress", "paused"].includes(room.status)) {
      throw new DomainError("ROOM_NOT_JOINABLE");
    }
    if (room.seats.length >= 10) throw new DomainError("ROOM_FULL");
    if (this.roomForAccount(accountId)) throw new DomainError("ALREADY_IN_ROOM");
    this.requireAccount(accountId);
    const occupiedPositions = new Set(room.seats.map((seat) => seat.position));
    const position = Array.from({ length: 10 }, (_, index) => index).find(
      (candidate) => !occupiedPositions.has(candidate)
    );
    if (position === undefined) throw new DomainError("ROOM_FULL");
    room.seats.push({ accountId, position, connected: true });
    room.version += 1;
    return room;
  }

  startRoom(roomId: string, hostAccountId: string): PokerRoom {
    const room = this.requirePokerRoom(roomId);
    if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
    if (room.status !== "waiting") throw new DomainError("ROOM_ALREADY_STARTED");
    if (room.seats.length < 2) throw new DomainError("NOT_ENOUGH_PLAYERS");
    room.status = "in_progress";
    room.version += 1;
    return room;
  }

  setReady(
    roomId: string,
    accountId: string,
    ready: boolean,
    expectedPokerVersion?: number
  ): PokerRoom {
    const room = this.requirePokerRoom(roomId);
    const seat = room.seats.find((candidate) => candidate.accountId === accountId);
    if (!seat) throw new DomainError("PLAYER_NOT_IN_ROOM");
    if (room.hostAccountId === accountId) {
      throw new DomainError("HOST_READY_IMPLICIT");
    }
    const waiting = room.status === "waiting";
    const complete = room.poker?.phase === "complete";
    if (!waiting && !complete) throw new DomainError("HAND_IN_PROGRESS");
    if (complete && room.poker?.version !== expectedPokerVersion) {
      throw new DomainError("STALE_VERSION");
    }
    if (!seat.connected) throw new DomainError("PLAYER_OFFLINE");
    if (ready && this.roomMemberStack(room, accountId) <= 0) {
      throw new DomainError("PLAYER_NEEDS_TOP_UP");
    }
    const current = waiting
      ? room.waitingReadyAccountIds
      : (room.poker?.readyAccountIds ?? []);
    const contains = current.includes(accountId);
    if (contains === ready) return room;
    const next = ready
      ? [...current, accountId]
      : current.filter((candidate) => candidate !== accountId);
    if (waiting) {
      room.waitingReadyAccountIds = next;
    } else if (room.poker) {
      room.poker.readyAccountIds = next;
      room.poker.version += 1;
    }
    room.version += 1;
    return room;
  }

  updateAvalonRoomConfig(
    roomId: string,
    hostAccountId: string,
    config: AvalonRoomConfig,
    expectedAvalonVersion?: number
  ): AvalonRoom {
    const room = this.requireAvalonRoom(roomId);
    if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
    this.assertAvalonIntermission(room, expectedAvalonVersion);
    room.config = this.normalizeAvalonRoomConfig(config);
    room.waitingReadyAccountIds = [];
    room.version += 1;
    return room;
  }

  setAvalonReady(
    roomId: string,
    accountId: string,
    ready: boolean,
    expectedAvalonVersion?: number
  ): AvalonRoom {
    const room = this.requireAvalonRoom(roomId);
    const seat = room.seats.find((candidate) => candidate.accountId === accountId);
    if (!seat) throw new DomainError("PLAYER_NOT_IN_ROOM");
    if (room.hostAccountId === accountId) {
      throw new DomainError("HOST_READY_IMPLICIT");
    }
    this.assertAvalonIntermission(room, expectedAvalonVersion);
    if (!seat.connected) throw new DomainError("PLAYER_OFFLINE");
    const contains = room.waitingReadyAccountIds.includes(accountId);
    if (contains === ready) return room;
    room.waitingReadyAccountIds = ready
      ? [...room.waitingReadyAccountIds, accountId]
      : room.waitingReadyAccountIds.filter(
          (candidate) => candidate !== accountId
        );
    room.version += 1;
    return room;
  }

  startAvalonGame(
    roomId: string,
    hostAccountId: string,
    options: {
      expectedAvalonVersion?: number;
      confirmUnready: boolean;
      randomInt: AvalonRandomInt;
    }
  ): AvalonRoom {
    const room = this.requireAvalonRoom(roomId);
    if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
    this.assertAvalonIntermission(room, options.expectedAvalonVersion);
    if (room.status === "paused") throw new DomainError("ROOM_PAUSED");
    const hostSeat = room.seats.find(
      (seat) => seat.accountId === hostAccountId
    );
    if (!hostSeat) throw new DomainError("PLAYER_NOT_IN_ROOM");
    if (!hostSeat.connected) throw new DomainError("PLAYER_OFFLINE");

    const ready = new Set(room.waitingReadyAccountIds);
    const selected = room.seats
      .filter(
        (seat) =>
          seat.accountId === hostAccountId ||
          (seat.connected && ready.has(seat.accountId))
      )
      .sort((left, right) => left.position - right.position);
    if (selected.length < 5 || selected.length > 10) {
      throw new DomainError("INVALID_AVALON_PLAYER_COUNT");
    }
    const selectedIds = new Set(selected.map((seat) => seat.accountId));
    const unreadyMembers = room.seats.filter(
      (seat) => !selectedIds.has(seat.accountId)
    );
    if (unreadyMembers.length > 0 && !options.confirmUnready) {
      throw new DomainError("UNREADY_PLAYERS_REQUIRE_CONFIRMATION");
    }

    const configuredRoles =
      room.config.roleSource === "preset"
        ? room.config.rolePresets[
            selected.length as keyof typeof room.config.rolePresets
          ]
        : room.config.roles;
    if (!configuredRoles) throw new DomainError("INVALID_AVALON_ROLE_CONFIG");
    for (const seat of selected) {
      checkedSubtract(this.requireAsset(seat.accountId).score, room.config.stake);
    }

    const previousGameNumber = room.avalon?.gameNumber ?? 0;
    const game = this.translateAvalonError(() =>
      createAvalonGame({
        gameNumber: checkedAdd(previousGameNumber, 1),
        participants: selected.map((seat) => ({
          accountId: seat.accountId,
          position: seat.position
        })),
        recognitionMode: room.config.recognitionMode,
        oberonRule: room.config.oberonRule,
        roles: configuredRoles,
        stake: room.config.stake,
        randomInt: options.randomInt
      })
    );
    for (const seat of selected) {
      const asset = this.requireAsset(seat.accountId);
      asset.inGame = true;
      asset.frozenScore = asset.score;
      this.transfer(
        seat.accountId,
        room.id,
        room.config.stake,
        "avalon-stake"
      );
    }
    room.avalon = game;
    room.waitingReadyAccountIds = [];
    room.status = "in_progress";
    room.version += 1;
    return room;
  }

  confirmAvalonRole(
    roomId: string,
    accountId: string,
    expectedAvalonVersion: number
  ): AvalonRoom {
    return this.applyAvalonTransition(roomId, (state) =>
      confirmAvalonRoleState(state, accountId, expectedAvalonVersion)
    );
  }

  advanceAvalonNight(
    roomId: string,
    hostAccountId: string,
    expectedAvalonVersion: number
  ): AvalonRoom {
    const room = this.requireAvalonRoom(roomId);
    if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
    return this.applyAvalonTransition(roomId, (state) =>
      advanceAvalonNightState(state, expectedAvalonVersion)
    );
  }

  restartAvalonNight(
    roomId: string,
    hostAccountId: string,
    expectedAvalonVersion: number
  ): AvalonRoom {
    const room = this.requireAvalonRoom(roomId);
    if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
    return this.applyAvalonTransition(roomId, (state) =>
      restartAvalonNightState(state, expectedAvalonVersion)
    );
  }

  proposeAvalonTeam(
    roomId: string,
    accountId: string,
    teamAccountIds: readonly string[],
    expectedAvalonVersion: number
  ): AvalonRoom {
    return this.applyAvalonTransition(roomId, (state) =>
      proposeAvalonTeamState(
        state,
        accountId,
        teamAccountIds,
        expectedAvalonVersion
      )
    );
  }

  castAvalonVote(
    roomId: string,
    accountId: string,
    approve: boolean,
    expectedAvalonVersion: number
  ): AvalonRoom {
    return this.applyAvalonTransition(roomId, (state) =>
      castAvalonVoteState(state, accountId, approve, expectedAvalonVersion)
    );
  }

  submitAvalonMission(
    roomId: string,
    accountId: string,
    choice: AvalonMissionChoice,
    expectedAvalonVersion: number
  ): AvalonRoom {
    return this.applyAvalonTransition(roomId, (state) =>
      submitAvalonMissionState(
        state,
        accountId,
        choice,
        expectedAvalonVersion
      )
    );
  }

  assassinateInAvalon(
    roomId: string,
    accountId: string,
    targetAccountId: string,
    expectedAvalonVersion: number
  ): AvalonRoom {
    return this.applyAvalonTransition(roomId, (state) =>
      assassinateInAvalonState(
        state,
        accountId,
        targetAccountId,
        expectedAvalonVersion
      )
    );
  }

  voidAvalonRound(
    roomId: string,
    expectedAvalonVersion?: number
  ): AvalonRoom {
    const room = this.requireAvalonRoom(roomId);
    const state = room.avalon;
    if (!state || ["complete", "void"].includes(state.phase)) return room;
    if (
      expectedAvalonVersion !== undefined &&
      state.version !== expectedAvalonVersion
    ) {
      throw new DomainError("STALE_AVALON_VERSION");
    }
    const next = this.translateAvalonError(() =>
      voidAvalonGameState(state, state.version)
    );
    for (const participant of next.participants) {
      this.transfer(
        room.id,
        participant.accountId,
        next.config.stake,
        "avalon-void-refund"
      );
      const asset = this.requireAsset(participant.accountId);
      asset.inGame = false;
      asset.frozenScore = null;
    }
    room.avalon = next;
    this.recordAvalonResult(room);
    room.waitingReadyAccountIds = [];
    room.version += 1;
    return room;
  }

  readyAccountIdsForRoom(room: Room): string[] {
    if (room.gameType === "avalon") {
      if (
        room.status === "waiting" ||
        ["complete", "void"].includes(room.avalon?.phase ?? "void")
      ) {
        return [
          room.hostAccountId,
          ...room.waitingReadyAccountIds.filter(
            (accountId) => accountId !== room.hostAccountId
          )
        ];
      }
      return [];
    }
    if (room.status === "waiting") return [...room.waitingReadyAccountIds];
    if (room.poker?.phase === "complete") return [...room.poker.readyAccountIds];
    return [];
  }

  roomMemberStack(room: PokerRoom, accountId: string): number {
    const seat = room.seats.find((candidate) => candidate.accountId === accountId);
    if (!seat) return 0;
    if (
      room.poker &&
      !["waiting", "complete", "void"].includes(room.poker.phase) &&
      !room.poker.departedAccountIds?.includes(accountId)
    ) {
      return (
        room.poker.players.find((player) => player.accountId === accountId)?.stack ??
        seat.tableChips
      );
    }
    return seat.tableChips;
  }

  effectiveDenominations(room: PokerRoom): number[] {
    const handActive = Boolean(
      room.poker && !["waiting", "complete", "void"].includes(room.poker.phase)
    );
    return [
      ...(handActive && room.poker
        ? room.poker.denominations
        : this.state.settings.poker.denominations)
    ];
  }

  pauseRoom(roomId: string, hostAccountId: string): Room {
    const room = this.requireRoom(roomId);
    if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
    if (room.status !== "in_progress") throw new DomainError("ROOM_NOT_IN_PROGRESS");
    if (
      room.gameType === "texas-holdem" &&
      room.poker?.advanceDeadline !== undefined
    ) {
      room.poker.pausedAdvanceRemainingMs = Math.max(
        0,
        room.poker.advanceDeadline - this.now()
      );
      delete room.poker.advanceDeadline;
    }
    room.status = "paused";
    room.version += 1;
    return room;
  }

  resumeRoom(roomId: string, hostAccountId: string): Room {
    const room = this.requireRoom(roomId);
    if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
    if (room.status !== "paused") throw new DomainError("ROOM_NOT_PAUSED");
    if (
      room.gameType === "texas-holdem" &&
      room.poker?.pausedAdvanceRemainingMs !== undefined
    ) {
      room.poker.advanceDeadline = this.now() + room.poker.pausedAdvanceRemainingMs;
      delete room.poker.pausedAdvanceRemainingMs;
    }
    room.status = "in_progress";
    room.version += 1;
    return room;
  }

  transferHost(roomId: string, fromAccountId: string, toAccountId: string): Room {
    const room = this.requireRoom(roomId);
    if (room.hostAccountId !== fromAccountId) throw new DomainError("HOST_ONLY");
    const target = room.seats.find((seat) => seat.accountId === toAccountId);
    if (!target) {
      throw new DomainError("PLAYER_NOT_IN_ROOM");
    }
    if (!target.connected) throw new DomainError("TARGET_OFFLINE");
    room.hostAccountId = toAccountId;
    delete room.hostDisconnectDeadline;
    room.version += 1;
    return room;
  }

  topUp(roomId: string, accountId: string, amount: number): PokerRoom {
    const room = this.requirePokerRoom(roomId);
    const seat = room.seats.find((candidate) => candidate.accountId === accountId);
    if (!seat) throw new DomainError("PLAYER_NOT_IN_ROOM");
    if (room.poker && !["complete", "waiting", "void"].includes(room.poker.phase)) {
      throw new DomainError("HAND_IN_PROGRESS");
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new DomainError("INVALID_AMOUNT");
    }
    const currentStack = this.roomMemberStack(room, accountId);
    const nextStack = checkedAdd(currentStack, amount);
    if (nextStack > room.config.maxBuyIn) throw new DomainError("BUY_IN_LIMIT");
    this.transfer(accountId, room.id, amount, "top-up");
    seat.buyIn = checkedAdd(seat.buyIn, amount);
    seat.tableChips = nextStack;
    const pokerPlayer =
      room.poker && !room.poker.departedAccountIds?.includes(accountId)
        ? room.poker.players.find((player) => player.accountId === accountId)
        : undefined;
    if (pokerPlayer) pokerPlayer.stack = checkedAdd(pokerPlayer.stack, amount);
    room.version += 1;
    return room;
  }

  leaveRoom(
    roomId: string,
    accountId: string,
    forced = false,
    nextHostAccountId?: string
  ): Room | undefined {
    const room = this.requireRoom(roomId);
    const seatIndex = room.seats.findIndex((candidate) => candidate.accountId === accountId);
    if (seatIndex < 0) throw new DomainError("PLAYER_NOT_IN_ROOM");
    const leavingHost = room.hostAccountId === accountId;
    if (leavingHost && room.seats.length > 1 && !forced) {
      throw new DomainError("TRANSFER_HOST_FIRST");
    }
    if (leavingHost && nextHostAccountId) {
      const nextHost = room.seats.find(
        (seat) => seat.accountId === nextHostAccountId && seat.accountId !== accountId
      );
      if (!nextHost) throw new DomainError("PLAYER_NOT_IN_ROOM");
      if (!nextHost.connected) throw new DomainError("TARGET_OFFLINE");
    }
    if (room.gameType === "avalon") {
      const activeParticipant = Boolean(
        room.avalon &&
          !["complete", "void"].includes(room.avalon.phase) &&
          room.avalon.participants.some(
            (participant) => participant.accountId === accountId
          )
      );
      if (activeParticipant) this.voidAvalonRound(room.id);
      room.waitingReadyAccountIds = room.waitingReadyAccountIds.filter(
        (candidate) => candidate !== accountId
      );
      room.seats.splice(seatIndex, 1);
      const asset = this.state.seasonAssets[accountId];
      if (asset) {
        asset.inGame = false;
        asset.frozenScore = null;
      }
      if (room.seats.length === 0) {
        delete this.state.rooms[roomId];
        return undefined;
      }
      if (leavingHost) {
        const nextHost =
          room.seats.find((seat) => seat.accountId === nextHostAccountId) ??
          room.seats[0]!;
        room.hostAccountId = nextHost.accountId;
      }
      room.version += 1;
      return room;
    }
    const pokerPlayer = room.poker?.players.find((player) => player.accountId === accountId);
    const handActive =
      room.poker && !["complete", "waiting", "void"].includes(room.poker.phase);
    if (handActive && pokerPlayer && !forced) throw new DomainError("HAND_IN_PROGRESS");
    if (pokerPlayer && handActive) pokerPlayer.folded = true;
    const pokerPlayerIsCurrent = Boolean(
      pokerPlayer && !room.poker?.departedAccountIds?.includes(accountId)
    );
    const refundable = pokerPlayerIsCurrent
      ? pokerPlayer!.stack
      : room.seats[seatIndex]!.tableChips;
    if (refundable > 0) this.transfer(room.id, accountId, refundable, forced ? "player-removed" : "leave-room");
    if (pokerPlayerIsCurrent && pokerPlayer) pokerPlayer.stack = 0;
    const asset = this.requireAsset(accountId);
    asset.inGame = false;
    asset.frozenScore = null;
    room.waitingReadyAccountIds = room.waitingReadyAccountIds.filter(
      (candidate) => candidate !== accountId
    );
    if (room.poker) {
      room.poker.readyAccountIds = room.poker.readyAccountIds.filter(
        (candidate) => candidate !== accountId
      );
      if (room.poker.phase === "complete" && pokerPlayer) {
        room.poker.departedAccountIds = [
          ...new Set([...(room.poker.departedAccountIds ?? []), accountId])
        ];
      }
    }
    room.seats.splice(seatIndex, 1);
    if (room.seats.length === 0) {
      delete this.state.rooms[roomId];
      return undefined;
    }
    if (leavingHost) {
      const nextHost =
        room.seats.find((seat) => seat.accountId === nextHostAccountId) ??
        room.seats[0]!;
      room.hostAccountId = nextHost.accountId;
    }
    room.version += 1;
    return room;
  }

  disconnect(roomId: string, accountId: string): void {
    const room = this.requireRoom(roomId);
    const seat = room.seats.find((candidate) => candidate.accountId === accountId);
    if (!seat || !seat.connected) return;
    seat.connected = false;
    if (
      room.gameType === "texas-holdem" &&
      room.poker?.readyAccountIds.includes(accountId)
    ) {
      room.poker.readyAccountIds = room.poker.readyAccountIds.filter(
        (candidate) => candidate !== accountId
      );
      room.poker.version += 1;
    }
    if (room.waitingReadyAccountIds.includes(accountId)) {
      room.waitingReadyAccountIds = room.waitingReadyAccountIds.filter(
        (candidate) => candidate !== accountId
      );
    }
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

  recoverAfterRestart(): boolean {
    let changed = this.normalizedPersistedState;
    this.normalizedPersistedState = false;
    if (Object.keys(this.state.leases).length > 0) {
      this.state.leases = {};
      changed = true;
    }
    for (const room of Object.values(this.state.rooms)) {
      let roomChanged = false;
      if (room.waitingReadyAccountIds.length > 0) {
        room.waitingReadyAccountIds = [];
        roomChanged = true;
      }
      if (
        room.gameType === "texas-holdem" &&
        room.poker &&
        room.poker.readyAccountIds.length > 0
      ) {
        room.poker.readyAccountIds = [];
        room.poker.version += 1;
        roomChanged = true;
      }
      for (const seat of room.seats) {
        if (seat.connected) {
          seat.connected = false;
          roomChanged = true;
        }
      }
      const hostSeat = room.seats.find(
        (seat) => seat.accountId === room.hostAccountId
      );
      if (hostSeat && room.hostDisconnectDeadline === undefined) {
        room.hostDisconnectDeadline =
          this.now() + room.config.hostTransferTimeoutSeconds * 1_000;
        roomChanged = true;
      }
      if (roomChanged) {
        room.version += 1;
        changed = true;
      }
    }
    return changed;
  }

  closeRoom(roomId: string): void {
    const room = this.requireRoom(roomId);
    if (room.gameType === "avalon") {
      if (
        room.avalon &&
        !["complete", "void"].includes(room.avalon.phase)
      ) {
        this.voidAvalonRound(room.id);
      }
      for (const seat of room.seats) {
        const asset = this.state.seasonAssets[seat.accountId];
        if (asset) {
          asset.inGame = false;
          asset.frozenScore = null;
        }
      }
      room.status = "closed";
      room.version += 1;
      delete this.state.rooms[roomId];
      return;
    }
    const departedAccountIds = new Set(room.poker?.departedAccountIds ?? []);
    const pokerPlayers = new Map(
      room.poker?.players
        .filter((player) => !departedAccountIds.has(player.accountId))
        .map((player) => [player.accountId, player]) ?? []
    );
    const accountIds = new Set([
      ...room.seats.map((seat) => seat.accountId),
      ...pokerPlayers.keys()
    ]);
    const handActive = Boolean(
      room.poker && !["complete", "waiting", "void"].includes(room.poker.phase)
    );
    if (room.poker && handActive) {
      this.recordHandResult(
        room.id,
        room.poker.handNumber,
        room.config.mode,
        room.poker.players
          .map((player) => ({
            accountId: player.accountId,
            amount: player.totalBet
          }))
          .filter((refund) => refund.amount > 0),
        "void",
        room.poker.players.map((player) => player.accountId)
      );
    }
    for (const accountId of accountIds) {
      const seat = room.seats.find((candidate) => candidate.accountId === accountId);
      const pokerPlayer = pokerPlayers.get(accountId);
      const refundable = pokerPlayer
        ? pokerPlayer.stack + (handActive ? pokerPlayer.totalBet : 0)
        : (seat?.tableChips ?? 0) + (seat?.currentBet ?? 0);
      const account = this.state.accounts[accountId];
      if (refundable > 0 && account) {
        this.transfer(room.id, accountId, refundable, "room-close");
      } else if (refundable > 0) {
        const lineId = this.id();
        this.state.ledger.push({
          id: lineId,
          groupId: lineId,
          seasonId: this.currentSeason.id,
          accountId,
          roomId,
          source: `table:${roomId}:${accountId}`,
          destination: "asset-retirement",
          amount: refundable,
          reason: "deleted-account-room-close",
          createdAt: this.now()
        });
      }
      if (seat) {
        seat.tableChips = 0;
        seat.currentBet = 0;
      }
      const asset = this.state.seasonAssets[accountId];
      if (asset) {
        asset.inGame = false;
        asset.frozenScore = null;
      }
    }
    room.status = "closed";
    room.version += 1;
    delete this.state.rooms[roomId];
  }

  startSeason(name: string | undefined, baseScore: number): void {
    if (Object.keys(this.state.rooms).length > 0) throw new DomainError("ROOMS_MUST_CLOSE");
    if (!Number.isSafeInteger(baseScore)) throw new DomainError("INVALID_BASE_SCORE");
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
    const eligibleAccountIds = new Set(
      this.participationFacts()
        .filter(
          (fact) =>
            fact.seasonId === this.currentSeason.id &&
            fact.valid &&
            !fact.reversed
        )
        .flatMap((fact) => fact.participantAccountIds)
    );
    return Object.values(this.state.accounts)
      .filter((account) => eligibleAccountIds.has(account.id))
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
      .sort((left, right) =>
        left.score === right.score
          ? left.username.localeCompare(right.username)
          : left.score > right.score
            ? -1
            : 1
      )
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  participationFacts(): PlatformParticipationFact[] {
    return [
      ...this.state.handResults.map((result) => ({
        resultId: result.id,
        gameType: "texas-holdem",
        seasonId: result.seasonId,
        participantAccountIds: [...result.participantAccountIds],
        valid: result.outcome !== "void",
        reversed: result.reversedAt !== undefined
      })),
      ...this.state.avalonResults.map((result) => ({
        resultId: result.id,
        gameType: "avalon",
        seasonId: result.seasonId,
        participantAccountIds: [...result.participantAccountIds],
        valid: result.outcome === "settled",
        reversed: result.reversedAt !== undefined
      }))
    ];
  }

  validateAccountDeletionTargets(accountIds: readonly string[]): string[] {
    const targets = [...new Set(accountIds)].sort();
    if (targets.length === 0) throw new DomainError("EMPTY_SELECTION");
    for (const accountId of targets) this.requireAccount(accountId);
    return targets;
  }

  deleteAccounts(accountIds: readonly string[]): PlatformDataDeletionResult {
    const targets = this.validateAccountDeletionTargets(accountIds);
    if (
      Object.values(this.state.rooms).some((room) =>
        room.seats.some((seat) => targets.includes(seat.accountId))
      )
    ) {
      throw new DomainError("ACCOUNT_STILL_IN_ROOM");
    }
    for (const targetAccountId of targets) {
      this.deleteAccountInternal(targetAccountId);
    }
    return {
      kind: targets.length === 1 ? "account" : "accounts",
      deletedIds: targets,
      protectedIds: [],
      selfDeleted: false,
      noOp: false
    };
  }

  deleteHistoricalSeasons(seasonIds: readonly string[]): PlatformDataDeletionResult {
    this.assertNoOpenRooms();
    const targets = [...new Set(seasonIds)].sort();
    if (targets.length === 0) throw new DomainError("EMPTY_SELECTION");
    if (targets.includes(this.currentSeason.id)) {
      throw new DomainError("CURRENT_SEASON_PROTECTED");
    }
    for (const seasonId of targets) {
      if (!this.state.seasons.some((season) => season.id === seasonId)) {
        throw new DomainError("SEASON_NOT_FOUND");
      }
    }
    this.deleteHistoricalSeasonsInternal(new Set(targets));
    return {
      kind: targets.length === 1 ? "season" : "seasons",
      deletedIds: targets,
      protectedIds: [this.currentSeason.id],
      selfDeleted: false,
      noOp: false
    };
  }

  projectRoom(roomId: string, viewer?: { accountId?: string; display?: boolean }): RoomProjection {
    const room = this.requireRoom(roomId);
    return room.gameType === "avalon"
      ? this.projectAvalonRoom(room, viewer)
      : this.projectPokerRoom(room, viewer);
  }

  private projectPokerRoom(
    room: PokerRoom,
    viewer?: { accountId?: string; display?: boolean }
  ): PokerRoomProjection {
    const departedAccountIds = new Set(room.poker?.departedAccountIds ?? []);
    const pokerPlayers = new Map(
      room.poker?.players.map((player) => [player.accountId, player]) ?? []
    );
    const handActive = Boolean(
      room.poker && !["waiting", "complete", "void"].includes(room.poker.phase)
    );
    const viewerSeat = viewer?.accountId
      ? room.seats.find((seat) => seat.accountId === viewer.accountId)
      : undefined;
    if (!viewer?.display && viewer?.accountId && !viewerSeat) {
      throw new DomainError("PLAYER_NOT_IN_ROOM");
    }
    const viewerRole = viewer?.display
      ? "display"
      : handActive && viewer?.accountId
        ? pokerPlayers.has(viewer.accountId)
          ? "participant"
          : "spectator"
        : "member";
    const projection: PokerRoomProjection = {
      platformVersion: this.state.version,
      id: room.id,
      name: room.name,
      gameType: "texas-holdem",
      mode: room.config.mode,
      status: room.status,
      hostAccountId: room.hostAccountId,
      config: structuredClone(room.config),
      suitColorPreset: this.state.settings.poker.suitColorPreset,
      version: room.version,
      createdAt: room.createdAt,
      seats: [...room.seats]
        .sort((left, right) => left.position - right.position)
        .map((seat) => {
        const account = this.requireAccount(seat.accountId);
        const pokerPlayer = room.poker?.departedAccountIds?.includes(seat.accountId)
          ? undefined
          : pokerPlayers.get(seat.accountId);
        return {
          accountId: seat.accountId,
          username: account.username,
          avatar: account.avatar,
          position: seat.position,
          connected: seat.connected,
          tableChips: pokerPlayer?.stack ?? seat.tableChips,
          currentBet: pokerPlayer?.roundBet ?? seat.currentBet,
          folded: pokerPlayer?.folded ?? seat.folded,
          allIn: pokerPlayer?.allIn ?? seat.allIn,
          role: room.poker
            ? pokerPlayer
              ? "participant"
              : handActive
                ? "spectator"
                : "member"
            : "member"
        };
        }),
      viewerRole,
      effectiveDenominations: this.effectiveDenominations(room),
      potTotal: room.poker?.pots.reduce((sum, pot) => sum + pot.amount, 0) ?? 0,
      phase: room.poker?.phase,
      actingAccountId: room.poker?.actingAccountId,
      pokerVersion: room.poker?.version,
      currentBet: room.poker?.currentBet,
      minimumRaise: room.poker?.minimumRaise,
      raiseLockedAccountIds: room.poker
        ? [...room.poker.raiseLockedAccountIds]
        : undefined,
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
      readyAccountIds: this.readyAccountIdsForRoom(room),
      advanceDeadline: room.poker?.advanceDeadline
    };
    const lastResult = [...this.state.handResults]
      .reverse()
      .find(
        (result) =>
          result.roomId === room.id &&
          result.reversedAt === undefined &&
          result.handNumber === room.poker?.handNumber
      );
    if (lastResult) {
      projection.lastResult = {
        handNumber: lastResult.handNumber,
        outcome: lastResult.outcome,
        participantAccountIds: lastResult.participantAccountIds.filter(
          (accountId) => !departedAccountIds.has(accountId)
        ),
        payouts: structuredClone(
          lastResult.payouts.filter(
            (payout) => !departedAccountIds.has(payout.accountId)
          )
        ),
        playerResults: lastResult.playerResults
          ? structuredClone(
              lastResult.playerResults.filter(
                (player) => !departedAccountIds.has(player.accountId)
              )
            )
          : undefined,
        showdown: lastResult.showdown
          ? {
              communityCards: structuredClone(lastResult.showdown.communityCards),
              players: structuredClone(
                lastResult.showdown.players.filter(
                  (player) => !departedAccountIds.has(player.accountId)
                )
              )
            }
          : undefined
      };
    }
    if (room.config.mode === "chips-and-cards") {
      const cards = room.poker?.communityCards ?? [];
      projection.communityCards = [
        ...cards,
        ...Array.from({ length: Math.max(0, 5 - cards.length) }, () => ({ hidden: true }) as const)
      ];
      if (
        !viewer?.display &&
        viewer?.accountId &&
        handActive &&
        pokerPlayers.has(viewer.accountId)
      ) {
        projection.ownHoleCards = room.poker?.holeCards[viewer.accountId] ?? [];
      }
    }
    assertNoPrivateCards(projection);
    return projection;
  }

  private projectAvalonRoom(
    room: AvalonRoom,
    viewer?: { accountId?: string; display?: boolean }
  ): AvalonRoomProjection {
    const state = room.avalon;
    const viewerSeat = viewer?.accountId
      ? room.seats.find((seat) => seat.accountId === viewer.accountId)
      : undefined;
    if (!viewer?.display && viewer?.accountId && !viewerSeat) {
      throw new DomainError("PLAYER_NOT_IN_ROOM");
    }
    const participantIds = new Set(
      state?.participants.map((participant) => participant.accountId) ?? []
    );
    const roundPubliclyActive = Boolean(state && state.phase !== "void");
    const viewerRole = viewer?.display
      ? "display"
      : viewer?.accountId && roundPubliclyActive
        ? participantIds.has(viewer.accountId)
          ? "participant"
          : "spectator"
        : "member";
    const projection: AvalonRoomProjection = {
      platformVersion: this.state.version,
      id: room.id,
      name: room.name,
      gameType: "avalon",
      status: room.status,
      hostAccountId: room.hostAccountId,
      config: structuredClone(room.config),
      version: room.version,
      createdAt: room.createdAt,
      seats: [...room.seats]
        .sort((left, right) => left.position - right.position)
        .map((seat) => {
          const account = this.requireAccount(seat.accountId);
          return {
            accountId: seat.accountId,
            username: account.username,
            avatar: account.avatar,
            position: seat.position,
            connected: seat.connected,
            role: state && state.phase !== "void"
              ? participantIds.has(seat.accountId)
                ? "participant" as const
                : "spectator" as const
              : "member" as const
          };
        }),
      viewerRole,
      readyAccountIds: this.readyAccountIdsForRoom(room),
      participantAccountIds:
        state && state.phase !== "void"
          ? state.participants.map((participant) => participant.accountId)
          : [],
      roleConfirmedAccountIds:
        state && state.phase !== "void"
          ? [...state.roleConfirmedAccountIds]
          : [],
      proposedTeamAccountIds:
        state && !["complete", "void"].includes(state.phase)
          ? [...state.proposedTeamAccountIds]
          : [],
      voteSubmittedAccountIds:
        state && state.phase === "team-vote"
          ? state.participants
              .map((participant) => participant.accountId)
              .filter((accountId) => Object.hasOwn(state.votes, accountId))
          : [],
      missionSubmittedAccountIds:
        state && state.phase === "mission"
          ? state.proposedTeamAccountIds.filter((accountId) =>
              Object.hasOwn(state.missionChoices, accountId)
            )
          : [],
      rejectionCount: state?.rejectionCount ?? 0,
      voteHistory: structuredClone(state?.voteHistory ?? []),
      missionHistory: structuredClone(state?.missionHistory ?? []),
      nightSteps:
        state?.config.recognitionMode === "manual"
          ? structuredClone(state.nightSteps)
          : []
    };
    if (state) {
      projection.avalonVersion = state.version;
      projection.gameNumber = state.gameNumber;
      projection.phase = state.phase;
      projection.nightStepIndex =
        state.phase === "manual-night" ? state.nightStepIndex : undefined;
      projection.outcome = state.outcome
        ? structuredClone(state.outcome)
        : undefined;
      if (!["complete", "void"].includes(state.phase)) {
        projection.currentLeaderAccountId = currentAvalonLeader(state);
        projection.currentMissionNumber = state.missionIndex + 1;
        projection.currentMissionRule = structuredClone(
          currentAvalonMissionRule(state)
        );
      }
      if (
        !viewer?.display &&
        viewer?.accountId &&
        participantIds.has(viewer.accountId) &&
        !["complete", "void"].includes(state.phase)
      ) {
        projection.ownKnowledge = this.translateAvalonError(() =>
          avalonKnowledgeFor(state, viewer.accountId!)
        );
        projection.ownRoleConfirmed =
          state.roleConfirmedAccountIds.includes(viewer.accountId);
        projection.ownVoteSubmitted = Object.hasOwn(
          state.votes,
          viewer.accountId
        );
        projection.ownMissionSubmitted = Object.hasOwn(
          state.missionChoices,
          viewer.accountId
        );
        if (
          state.phase === "assassination" &&
          state.roleAssignments[viewer.accountId] === "assassin"
        ) {
          projection.assassinationCandidates = projection.seats.filter(
            (seat) =>
              participantIds.has(seat.accountId) &&
              seat.accountId !== viewer.accountId
          );
        }
      }
      projection.lastResult = [...this.state.avalonResults]
        .reverse()
        .find(
          (result) =>
            result.roomId === room.id &&
            result.gameNumber === state.gameNumber &&
            result.reversedAt === undefined
        );
      if (projection.lastResult) {
        projection.lastResult = structuredClone(projection.lastResult);
      }
      if (state.phase === "complete") {
        projection.revealedRoles =
          projection.lastResult?.outcome === "settled"
            ? projection.lastResult.playerResults.map((player) => ({
                accountId: player.accountId,
                role: player.role,
                alignment: player.alignment
              }))
            : state.participants.map((participant) => {
                const role = state.roleAssignments[participant.accountId]!;
                return {
                  accountId: participant.accountId,
                  role,
                  alignment: avalonAlignmentForRole(role)
                };
              });
      }
    }
    assertNoAvalonSecrets(projection);
    return projection;
  }

  validateInvariants(): void {
    normalizeDenominations(this.state.settings.poker.denominations);
    if (!["zh-CN", "en"].includes(this.state.settings.defaultLanguage)) {
      throw new DomainError("INVALID_LANGUAGE");
    }
    if (!["light", "dark"].includes(this.state.settings.defaultTheme)) {
      throw new DomainError("INVALID_THEME");
    }
    this.validateRoomConfig({
      mode: "chips-and-cards",
      hostTransferTimeoutSeconds:
        this.state.settings.defaultHostTransferTimeoutSeconds,
      ...this.state.settings.poker
    });
    this.normalizeAvalonSettings(this.state.settings.avalon);
    const normalized = new Set<string>();
    for (const account of Object.values(this.state.accounts)) {
      if (normalized.has(account.normalizedUsername)) throw new DomainError("DUPLICATE_USERNAME");
      normalized.add(account.normalizedUsername);
      if (!isSelectableAvatar(account.avatar) && account.avatar !== fallbackAvatar) {
        throw new DomainError("INVALID_AVATAR");
      }
      this.validateAccountPreferences(
        account.language,
        account.theme,
        account.volume
      );
    }
    for (const season of this.state.seasons) {
      if (!Number.isSafeInteger(season.baseScore)) {
        throw new DomainError("INVALID_BASE_SCORE");
      }
    }
    for (const historical of this.state.historicalSeasons) {
      for (const entry of historical.entries) {
        if (!Number.isSafeInteger(entry.score)) {
          throw new DomainError("INVALID_SCORE");
        }
      }
    }
    for (const asset of Object.values(this.state.seasonAssets)) {
      if (
        !Number.isSafeInteger(asset.score) ||
        (asset.frozenScore !== null &&
          !Number.isSafeInteger(asset.frozenScore))
      ) {
        throw new DomainError("INVALID_SCORE");
      }
      if (!this.state.accounts[asset.accountId]) {
        throw new DomainError("ORPHANED_ASSET");
      }
    }
    const occupancy = new Set<string>();
    for (const room of Object.values(this.state.rooms)) {
      if (!room.seats.some((seat) => seat.accountId === room.hostAccountId)) {
        throw new DomainError("HOST_NOT_IN_ROOM");
      }
      const memberIds = new Set(room.seats.map((seat) => seat.accountId));
      if (
        room.waitingReadyAccountIds.some(
          (accountId) => !memberIds.has(accountId)
        )
      ) {
        throw new DomainError("READY_PLAYER_NOT_IN_ROOM");
      }
      for (const seat of room.seats) {
        if (!this.state.accounts[seat.accountId]) {
          throw new DomainError("ACCOUNT_NOT_FOUND");
        }
        if (
          !Number.isSafeInteger(seat.position) ||
          seat.position < 0 ||
          occupancy.has(seat.accountId)
        ) {
          throw new DomainError(
            occupancy.has(seat.accountId)
              ? "MULTIPLE_ROOM_OCCUPANCY"
              : "INVALID_SEAT"
          );
        }
        occupancy.add(seat.accountId);
      }
      if (room.gameType === "texas-holdem") {
        if (
          room.poker?.readyAccountIds.some(
            (accountId) => !memberIds.has(accountId)
          )
        ) {
          throw new DomainError("READY_PLAYER_NOT_IN_ROOM");
        }
        this.validateRoomConfig(room.config);
        if (room.poker) normalizeDenominations(room.poker.denominations);
        if (room.poker) {
        const nonnegativePokerValues = [
          room.poker.currentBet,
          room.poker.minimumRaise,
          room.poker.smallBlind,
          room.poker.bigBlind,
          ...room.poker.pots.map((pot) => pot.amount),
          ...room.poker.players.flatMap((player) => [
            player.stack,
            player.roundBet,
            player.totalBet
          ])
        ];
        if (
          nonnegativePokerValues.some(
            (value) => !Number.isSafeInteger(value) || value < 0
          )
        ) {
          throw new DomainError("NEGATIVE_ASSET");
        }
        }
        for (const seat of room.seats) {
        if (
          !Number.isSafeInteger(seat.buyIn) ||
          seat.buyIn < 0 ||
          !Number.isSafeInteger(seat.frozenLeaderboardScore) ||
          !Number.isSafeInteger(seat.tableChips) ||
          seat.tableChips < 0 ||
          !Number.isSafeInteger(seat.currentBet) ||
          seat.currentBet < 0
        ) {
          throw new DomainError("NEGATIVE_ASSET");
        }
        }
        continue;
      }

      this.normalizeAvalonRoomConfig(room.config);
      const state = room.avalon;
      if (!state) continue;
      const participantIds = state.participants.map(
        (participant) => participant.accountId
      );
      const activeRound = !["complete", "void"].includes(state.phase);
      if (
        (activeRound &&
          participantIds.some((accountId) => !memberIds.has(accountId))) ||
        new Set(participantIds).size !== participantIds.length ||
        Object.keys(state.roleAssignments).length !== participantIds.length ||
        participantIds.some(
          (accountId) => state.roleAssignments[accountId] === undefined
        ) ||
        !Number.isSafeInteger(state.version) ||
        state.version < 0 ||
        !Number.isSafeInteger(state.gameNumber) ||
        state.gameNumber <= 0 ||
        !Number.isSafeInteger(state.config.stake) ||
        state.config.stake < 2
      ) {
        throw new DomainError("INVALID_AVALON_STATE");
      }
      this.translateAvalonError(() =>
        normalizeAvalonRoles(participantIds.length, state.config.roles)
      );
      if (
        Object.keys(state.votes).some(
          (accountId) => !participantIds.includes(accountId)
        ) ||
        Object.keys(state.missionChoices).some(
          (accountId) => !state.proposedTeamAccountIds.includes(accountId)
        )
      ) {
        throw new DomainError("INVALID_AVALON_STATE");
      }
    }
    if (
      this.state.ledger.some(
        (line) => !Number.isSafeInteger(line.amount) || line.amount < 0
      )
    ) {
      throw new DomainError("INVALID_LEDGER_AMOUNT");
    }
    const currentLedger = this.state.ledger.filter(
      (line) => line.seasonId === this.currentSeason.id
    );
    const issuedAssets = checkedSum(
      currentLedger
        .filter((line) => line.source === "season-issuance")
        .map((line) => line.amount)
    );
    const issuedLiabilities = checkedSum(
      currentLedger
        .filter((line) => line.destination === "season-liability-issuance")
        .map((line) => line.amount)
    );
    const retiredAssets = checkedSum(
      currentLedger
        .filter((line) => line.destination === "asset-retirement")
        .map((line) => line.amount)
    );
    const retiredLiabilities = checkedSum(
      currentLedger
        .filter((line) => line.source === "liability-retirement")
        .map((line) => line.amount)
    );
    const accountTotal = checkedSum(
      Object.values(this.state.seasonAssets).map((asset) => asset.score)
    );
    const tableTotal = checkedSum(Object.values(this.state.rooms).map((room) => {
      if (room.gameType === "avalon") {
        return room.avalon &&
          !["complete", "void"].includes(room.avalon.phase)
          ? checkedMultiply(
              room.avalon.config.stake,
              room.avalon.participants.length
            )
          : 0;
      }
      if (!room.poker) {
        return checkedSum(room.seats.map((seat) => seat.tableChips));
      }
      const participatingAccountIds = new Set(
        room.poker.players
          .filter(
            (player) =>
              !room.poker?.departedAccountIds?.includes(player.accountId)
          )
          .map((player) => player.accountId)
      );
      return checkedAdd(
        checkedSum(
          room.poker.players.map((player) =>
            checkedAdd(player.stack, player.totalBet)
          )
        ),
        checkedSum(
          room.seats
            .filter((seat) => !participatingAccountIds.has(seat.accountId))
            .map((seat) => checkedAdd(seat.tableChips, seat.currentBet))
        )
      );
    }));
    const expectedManagedTotal = checkedAdd(
      checkedSubtract(
        checkedSubtract(issuedAssets, issuedLiabilities),
        retiredAssets
      ),
      retiredLiabilities
    );
    if (checkedAdd(accountTotal, tableTotal) !== expectedManagedTotal) {
      throw new DomainError("ASSET_CONSERVATION_FAILED");
    }
  }

  recordPokerMovement(
    roomId: string,
    accountId: string,
    amount: number,
    direction: "table-to-pot" | "pot-to-table",
    reason: string,
    handNumber: number,
    reversesReason?: string
  ): void {
    if (!Number.isSafeInteger(amount) || amount <= 0) return;
    const table = `table:${roomId}:${accountId}`;
    const pot = `pot:${roomId}:${handNumber}`;
    this.recordMovementPair({
      accountId,
      roomId,
      handNumber,
      source: direction === "table-to-pot" ? table : pot,
      destination: direction === "table-to-pot" ? pot : table,
      amount,
      reason,
      reversesReason
    });
  }

  recordHandResult(
    roomId: string,
    handNumber: number,
    mode: RoomMode,
    payouts: Array<{ accountId: string; amount: number }>,
    outcome: "settled" | "void" = "settled",
    participantAccountIds: string[] = payouts.map((payout) => payout.accountId),
    details?: {
      chipDeltas: Array<{
        accountId: string;
        amount: number;
        endingChips: number;
      }>;
      showdown?: {
        communityCards: Card[];
        players: Array<{
          accountId: string;
          cards: Card[];
          handCategory: HandCategory;
          winner: boolean;
        }>;
      };
    }
  ): void {
    this.state.handResults.push({
      id: this.id(),
      seasonId: this.currentSeason.id,
      roomId,
      handNumber,
      mode,
      outcome,
      participantAccountIds: [
        ...new Set(
          participantAccountIds.map(
            (accountId) =>
              this.state.retiredIdentities[accountId]?.publicId ?? accountId
          )
        )
      ],
      payouts: payouts.map((payout) => ({
        ...structuredClone(payout),
        accountId:
          this.state.retiredIdentities[payout.accountId]?.publicId ??
          payout.accountId
      })),
      playerResults: details?.chipDeltas.map((delta) => {
        const account = this.state.accounts[delta.accountId];
        const retiredIdentity = this.state.retiredIdentities[delta.accountId];
        if (!account && !retiredIdentity) {
          throw new DomainError("ACCOUNT_NOT_FOUND");
        }
        return {
          accountId: retiredIdentity?.publicId ?? delta.accountId,
          username: account?.username ?? `Anonymous ${retiredIdentity!.anonymousNumber}`,
          avatar: account?.avatar ?? fallbackAvatar,
          chipDelta: delta.amount,
          endingChips: delta.endingChips,
          anonymized: account ? undefined : true,
          anonymousNumber: account ? undefined : retiredIdentity!.anonymousNumber
        };
      }),
      showdown: details?.showdown
        ? {
            communityCards: structuredClone(details.showdown.communityCards),
            players: details.showdown.players.map((player) => {
              const retiredIdentity =
                this.state.retiredIdentities[player.accountId];
              return {
                ...structuredClone(player),
                accountId: retiredIdentity?.publicId ?? player.accountId,
                anonymized: retiredIdentity ? true : undefined,
                anonymousNumber: retiredIdentity?.anonymousNumber
              };
            })
          }
        : undefined,
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
    if (!Number.isSafeInteger(amount)) {
      throw new DomainError("INVALID_AMOUNT");
    }
    if (amount === 0) return;
    const absoluteAmount = Math.abs(amount);
    const line: AssetLine = {
      id: this.id(),
      groupId: this.id(),
      seasonId: this.currentSeason.id,
      accountId,
      source: amount > 0 ? "season-issuance" : `account:${accountId}`,
      destination:
        amount > 0
          ? `account:${accountId}`
          : "season-liability-issuance",
      amount: absoluteAmount,
      reason,
      createdAt: this.now()
    };
    this.state.ledger.push(line);
  }

  private transfer(source: string, destination: string, amount: number, reason: string): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new DomainError("INVALID_AMOUNT");
    }
    const sourceAsset = this.state.accounts[source]
      ? this.requireAsset(source)
      : undefined;
    const destinationAsset = this.state.accounts[destination]
      ? this.requireAsset(destination)
      : undefined;
    const nextSourceScore = sourceAsset
      ? checkedSubtract(sourceAsset.score, amount)
      : undefined;
    const nextDestinationScore = destinationAsset
      ? checkedAdd(destinationAsset.score, amount)
      : undefined;
    const groupId = this.id();
    if (sourceAsset && nextSourceScore !== undefined) {
      sourceAsset.score = nextSourceScore;
    }
    if (destinationAsset && nextDestinationScore !== undefined) {
      destinationAsset.score = nextDestinationScore;
    }
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
    reversesReason?: string;
  }): void {
    const groupId = this.id();
    const alreadyReversed = new Set(
      this.state.ledger
        .map((line) => line.reversalOf)
        .filter((id): id is string => Boolean(id))
    );
    const originalLine = input.reversesReason
      ? [...this.state.ledger]
          .reverse()
          .find(
            (line) =>
              line.seasonId === this.currentSeason.id &&
              line.accountId === input.accountId &&
              line.roomId === input.roomId &&
              line.handNumber === input.handNumber &&
              line.reason === input.reversesReason &&
              line.reversalOf === undefined &&
              !alreadyReversed.has(line.id)
          )
      : undefined;
    const originalPair = originalLine
      ? this.state.ledger.filter((line) => line.groupId === originalLine.groupId)
      : [];
    const sourceReversalOf = originalPair.find(
      (line) => line.destination === input.source
    )?.id;
    const destinationReversalOf = originalPair.find(
      (line) => line.source === input.destination
    )?.id;
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
        destination: `clearing:${groupId}`,
        reversalOf: sourceReversalOf
      },
      {
        id: this.id(),
        ...common,
        source: `clearing:${groupId}`,
        destination: input.destination,
        reversalOf: destinationReversalOf
      }
    );
  }

  private normalizeAvalonSettings(
    settings: GlobalSettings["avalon"]
  ): GlobalSettings["avalon"] {
    if (
      !settings ||
      !["automatic", "manual"].includes(settings.defaultRecognitionMode) ||
      !["original", "dized"].includes(settings.defaultOberonRule) ||
      !Number.isSafeInteger(settings.defaultStake) ||
      settings.defaultStake < 2
    ) {
      throw new DomainError("INVALID_AVALON_SETTINGS");
    }
    const rolePresets = {
      5: this.normalizeAvalonPreset(5, settings.rolePresets?.[5]),
      6: this.normalizeAvalonPreset(6, settings.rolePresets?.[6]),
      7: this.normalizeAvalonPreset(7, settings.rolePresets?.[7]),
      8: this.normalizeAvalonPreset(8, settings.rolePresets?.[8]),
      9: this.normalizeAvalonPreset(9, settings.rolePresets?.[9]),
      10: this.normalizeAvalonPreset(10, settings.rolePresets?.[10])
    };
    return {
      defaultRecognitionMode: settings.defaultRecognitionMode,
      defaultOberonRule: settings.defaultOberonRule,
      defaultStake: settings.defaultStake,
      rolePresets
    };
  }

  private normalizeAvalonPreset(
    playerCount: 5 | 6 | 7 | 8 | 9 | 10,
    roles: readonly AvalonRole[] | undefined
  ): AvalonRole[] {
    if (!Array.isArray(roles)) {
      throw new DomainError("INVALID_AVALON_ROLE_CONFIG");
    }
    return this.translateAvalonError(() =>
      normalizeAvalonRoles(playerCount, roles)
    );
  }

  private normalizeAvalonRoomConfig(
    config: AvalonRoomConfig
  ): AvalonRoomConfig {
    if (
      !["automatic", "manual"].includes(config.recognitionMode) ||
      !["original", "dized"].includes(config.oberonRule) ||
      !Number.isSafeInteger(config.stake) ||
      config.stake < 2 ||
      !Number.isSafeInteger(config.hostTransferTimeoutSeconds) ||
      config.hostTransferTimeoutSeconds <= 0
    ) {
      throw new DomainError("INVALID_AVALON_ROOM_CONFIG");
    }
    if (config.roleSource === "preset") {
      return {
        recognitionMode: config.recognitionMode,
        oberonRule: config.oberonRule,
        stake: config.stake,
        hostTransferTimeoutSeconds: config.hostTransferTimeoutSeconds,
        roleSource: "preset",
        rolePresets: {
          5: this.normalizeAvalonPreset(5, config.rolePresets?.[5]),
          6: this.normalizeAvalonPreset(6, config.rolePresets?.[6]),
          7: this.normalizeAvalonPreset(7, config.rolePresets?.[7]),
          8: this.normalizeAvalonPreset(8, config.rolePresets?.[8]),
          9: this.normalizeAvalonPreset(9, config.rolePresets?.[9]),
          10: this.normalizeAvalonPreset(10, config.rolePresets?.[10])
        }
      };
    }
    if (config.roleSource !== "custom" || !Array.isArray(config.roles)) {
      throw new DomainError("INVALID_AVALON_ROOM_CONFIG");
    }
    const validForSomePlayerCount = [5, 6, 7, 8, 9, 10].some(
      (playerCount) => {
        try {
          normalizeAvalonRoles(playerCount, config.roles);
          return true;
        } catch {
          return false;
        }
      }
    );
    if (!validForSomePlayerCount) {
      throw new DomainError("INVALID_AVALON_ROLE_CONFIG");
    }
    return {
      recognitionMode: config.recognitionMode,
      oberonRule: config.oberonRule,
      stake: config.stake,
      hostTransferTimeoutSeconds: config.hostTransferTimeoutSeconds,
      roleSource: "custom",
      roles: [...config.roles]
    };
  }

  private assertAvalonIntermission(
    room: AvalonRoom,
    expectedAvalonVersion?: number
  ): void {
    const firstGame = room.status === "waiting" && !room.avalon;
    const completedGame = Boolean(
      room.avalon && ["complete", "void"].includes(room.avalon.phase)
    );
    if (!firstGame && !completedGame) {
      throw new DomainError("AVALON_GAME_IN_PROGRESS");
    }
    if (
      room.avalon &&
      (
        expectedAvalonVersion === undefined ||
        room.avalon.version !== expectedAvalonVersion
      )
    ) {
      throw new DomainError("STALE_AVALON_VERSION");
    }
  }

  private applyAvalonTransition(
    roomId: string,
    transitionState: (
      state: NonNullable<AvalonRoom["avalon"]>
    ) => NonNullable<AvalonRoom["avalon"]>
  ): AvalonRoom {
    const room = this.requireAvalonRoom(roomId);
    if (room.status === "paused") throw new DomainError("ROOM_PAUSED");
    if (room.status !== "in_progress" || !room.avalon) {
      throw new DomainError("AVALON_NOT_STARTED");
    }
    const wasComplete = room.avalon.phase === "complete";
    const next = this.translateAvalonError(() =>
      transitionState(room.avalon!)
    );
    room.avalon = next;
    if (!wasComplete && next.phase === "complete") {
      this.settleAvalonGame(room);
    }
    room.version += 1;
    return room;
  }

  private settleAvalonGame(room: AvalonRoom): void {
    const state = room.avalon;
    if (
      !state ||
      state.phase !== "complete" ||
      state.outcome?.status !== "settled"
    ) {
      throw new DomainError("INVALID_AVALON_STATE");
    }
    if (
      this.state.avalonResults.some(
        (result) =>
          result.roomId === room.id &&
          result.gameNumber === state.gameNumber &&
          result.reversedAt === undefined
      )
    ) {
      throw new DomainError("AVALON_RESULT_ALREADY_RECORDED");
    }
    const deltas = this.avalonSettlementDeltas(state);
    const payouts = state.participants
      .map((participant) => {
        const delta = deltas.get(participant.accountId)!;
        return {
          accountId: participant.accountId,
          amount:
            delta > 0
              ? checkedAdd(state.config.stake, delta)
              : 0
        };
      })
      .filter((payout) => payout.amount > 0);
    const escrowTotal = checkedMultiply(
      state.config.stake,
      state.participants.length
    );
    if (checkedSum(payouts.map((payout) => payout.amount)) !== escrowTotal) {
      throw new DomainError("ASSET_CONSERVATION_FAILED");
    }
    for (const payout of payouts) {
      checkedAdd(this.requireAsset(payout.accountId).score, payout.amount);
    }
    for (const payout of payouts) {
      this.transfer(
        room.id,
        payout.accountId,
        payout.amount,
        "avalon-settlement"
      );
    }
    for (const participant of state.participants) {
      const asset = this.requireAsset(participant.accountId);
      asset.inGame = false;
      asset.frozenScore = null;
    }
    this.recordAvalonResult(room, deltas);
  }

  private avalonSettlementDeltas(
    state: NonNullable<AvalonRoom["avalon"]>
  ): Map<string, number> {
    const outcome = state.outcome;
    if (outcome?.status !== "settled") {
      throw new DomainError("INVALID_AVALON_STATE");
    }
    const winners = state.participants.filter((participant) => {
      const role = state.roleAssignments[participant.accountId];
      return (
        role !== undefined &&
        avalonAlignmentForRole(role) === outcome.winningAlignment
      );
    });
    const losers = state.participants.filter(
      (participant) => !winners.includes(participant)
    );
    if (winners.length === 0 || losers.length === 0) {
      throw new DomainError("INVALID_AVALON_STATE");
    }
    const loserPool = checkedMultiply(state.config.stake, losers.length);
    const share = Math.floor(loserPool / winners.length);
    const remainder = loserPool % winners.length;
    const deltas = new Map<string, number>();
    losers.forEach((participant) =>
      deltas.set(participant.accountId, -state.config.stake)
    );
    winners.forEach((participant, index) =>
      deltas.set(
        participant.accountId,
        checkedAdd(share, index < remainder ? 1 : 0)
      )
    );
    if (checkedSum(deltas.values()) !== 0) {
      throw new DomainError("ASSET_CONSERVATION_FAILED");
    }
    return deltas;
  }

  private recordAvalonResult(
    room: AvalonRoom,
    deltas?: Map<string, number>
  ): void {
    const state = room.avalon;
    if (!state?.outcome) throw new DomainError("INVALID_AVALON_STATE");
    if (
      this.state.avalonResults.some(
        (result) =>
          result.roomId === room.id &&
          result.gameNumber === state.gameNumber &&
          result.reversedAt === undefined
      )
    ) {
      throw new DomainError("AVALON_RESULT_ALREADY_RECORDED");
    }
    const common = {
      id: this.id(),
      seasonId: this.currentSeason.id,
      roomId: room.id,
      gameNumber: state.gameNumber,
      participantAccountIds: state.participants.map(
        (participant) => participant.accountId
      ),
      voteHistory: structuredClone(state.voteHistory),
      missionHistory: structuredClone(state.missionHistory),
      completedAt: this.now()
    };
    if (state.outcome.status === "void") {
      this.state.avalonResults.push({
        ...common,
        outcome: "void"
      });
      return;
    }
    if (!deltas) throw new DomainError("INVALID_AVALON_STATE");
    this.state.avalonResults.push({
      ...common,
      outcome: "settled",
      winningAlignment: state.outcome.winningAlignment,
      reason: state.outcome.reason,
      assassinationTargetAccountId:
        state.outcome.assassinationTargetAccountId,
      playerResults: state.participants.map((participant) => {
        const account = this.requireAccount(participant.accountId);
        const role = state.roleAssignments[participant.accountId]!;
        return {
          accountId: participant.accountId,
          username: account.username,
          avatar: account.avatar,
          role,
          alignment: avalonAlignmentForRole(role),
          scoreDelta: deltas.get(participant.accountId)!,
          endingScore: this.requireAsset(participant.accountId).score
        };
      })
    });
  }

  private translateAvalonError<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof AvalonRuleError) {
        throw new DomainError(error.code);
      }
      throw error;
    }
  }

  private assertNoOpenRooms(): void {
    if (Object.keys(this.state.rooms).length > 0) {
      throw new DomainError("ROOMS_MUST_CLOSE");
    }
  }

  private deleteAccountInternal(accountId: string): void {
    this.requireAccount(accountId);
    const asset = this.requireAsset(accountId);
    const anonymousNumber =
      Math.max(
        0,
        ...Object.values(this.state.retiredIdentities).map(
          (identity) => identity.anonymousNumber
        )
      ) + 1;
    const identity = {
      publicId: `retired:${this.id()}`,
      anonymousNumber,
      retiredAt: this.now()
    };
    this.state.retiredIdentities[accountId] = identity;
    if (asset.score !== 0) {
      const lineId = this.id();
      this.state.ledger.push({
        id: lineId,
        groupId: lineId,
        seasonId: this.currentSeason.id,
        accountId,
        source:
          asset.score > 0
            ? `account:${accountId}`
            : "liability-retirement",
        destination:
          asset.score > 0
            ? "asset-retirement"
            : `account:${accountId}`,
        amount: Math.abs(asset.score),
        reason: "account-retired",
        createdAt: this.now()
      });
    }
    for (const historical of this.state.historicalSeasons) {
      for (const entry of historical.entries) {
        if (entry.accountId !== accountId) continue;
        entry.accountId = identity.publicId;
        entry.username = `Deleted player ${anonymousNumber}`;
        entry.avatar = fallbackAvatar;
        entry.anonymized = true;
        entry.anonymousNumber = anonymousNumber;
      }
    }
    for (const result of this.state.handResults) {
      result.participantAccountIds = result.participantAccountIds.map((candidate) =>
        candidate === accountId ? identity.publicId : candidate
      );
      result.payouts = result.payouts.map((payout) =>
        payout.accountId === accountId
          ? { ...payout, accountId: identity.publicId }
          : payout
      );
      result.playerResults = result.playerResults?.map((player) =>
        player.accountId === accountId
          ? {
              ...player,
              accountId: identity.publicId,
              username: `Deleted player ${anonymousNumber}`,
              avatar: fallbackAvatar,
              anonymized: true,
              anonymousNumber
            }
          : player
      );
      result.showdown = result.showdown
        ? {
            ...result.showdown,
            players: result.showdown.players.map((player) =>
              player.accountId === accountId
                ? {
                    ...player,
                    accountId: identity.publicId,
                    anonymized: true,
                    anonymousNumber
                  }
                : player
            )
          }
        : undefined;
    }
    for (const result of this.state.avalonResults) {
      result.participantAccountIds = result.participantAccountIds.map(
        (candidate) =>
          candidate === accountId ? identity.publicId : candidate
      );
      if (result.outcome === "settled") {
        result.playerResults = result.playerResults.map((player) =>
          player.accountId === accountId
            ? {
                ...player,
                accountId: identity.publicId,
                username: `Deleted player ${anonymousNumber}`,
                avatar: fallbackAvatar,
                anonymized: true,
                anonymousNumber
              }
            : player
        );
        if (result.assassinationTargetAccountId === accountId) {
          result.assassinationTargetAccountId = identity.publicId;
        }
      }
      result.voteHistory = result.voteHistory.map((vote) => ({
        ...vote,
        leaderAccountId:
          vote.leaderAccountId === accountId
            ? identity.publicId
            : vote.leaderAccountId,
        teamAccountIds: vote.teamAccountIds.map((candidate) =>
          candidate === accountId ? identity.publicId : candidate
        ),
        votes: vote.votes.map((entry) => ({
          ...entry,
          accountId:
            entry.accountId === accountId ? identity.publicId : entry.accountId
        }))
      }));
      result.missionHistory = result.missionHistory.map((mission) => ({
        ...mission,
        leaderAccountId:
          mission.leaderAccountId === accountId
            ? identity.publicId
            : mission.leaderAccountId,
        teamAccountIds: mission.teamAccountIds.map((candidate) =>
          candidate === accountId ? identity.publicId : candidate
        )
      }));
    }
    delete this.state.leases[accountId];
    delete this.state.seasonAssets[accountId];
    delete this.state.accounts[accountId];
  }

  private deleteHistoricalSeasonsInternal(seasonIds: Set<string>): void {
    if (seasonIds.size === 0) return;
    this.state.seasons = this.state.seasons.filter(
      (season) => !seasonIds.has(season.id)
    );
    this.state.historicalSeasons = this.state.historicalSeasons.filter(
      (historical) => !seasonIds.has(historical.season.id)
    );
    this.state.handResults = this.state.handResults.filter(
      (result) => !seasonIds.has(result.seasonId)
    );
    this.state.avalonResults = this.state.avalonResults.filter(
      (result) => !seasonIds.has(result.seasonId)
    );
    this.state.ledger = this.state.ledger.filter(
      (line) => !seasonIds.has(line.seasonId)
    );
    const referencedPublicIds = new Set<string>();
    for (const historical of this.state.historicalSeasons) {
      for (const entry of historical.entries) {
        referencedPublicIds.add(entry.accountId);
      }
    }
    for (const result of this.state.handResults) {
      result.participantAccountIds.forEach((accountId) =>
        referencedPublicIds.add(accountId)
      );
      result.payouts.forEach((payout) =>
        referencedPublicIds.add(payout.accountId)
      );
      result.playerResults?.forEach((player) =>
        referencedPublicIds.add(player.accountId)
      );
      result.showdown?.players.forEach((player) =>
        referencedPublicIds.add(player.accountId)
      );
    }
    for (const result of this.state.avalonResults) {
      result.participantAccountIds.forEach((accountId) =>
        referencedPublicIds.add(accountId)
      );
      result.voteHistory.forEach((vote) => {
        referencedPublicIds.add(vote.leaderAccountId);
        vote.teamAccountIds.forEach((accountId) =>
          referencedPublicIds.add(accountId)
        );
        vote.votes.forEach((entry) =>
          referencedPublicIds.add(entry.accountId)
        );
      });
      result.missionHistory.forEach((mission) => {
        referencedPublicIds.add(mission.leaderAccountId);
        mission.teamAccountIds.forEach((accountId) =>
          referencedPublicIds.add(accountId)
        );
      });
      if (result.outcome === "settled") {
        result.playerResults.forEach((player) =>
          referencedPublicIds.add(player.accountId)
        );
        if (result.assassinationTargetAccountId) {
          referencedPublicIds.add(result.assassinationTargetAccountId);
        }
      }
    }
    for (const [accountId, identity] of Object.entries(
      this.state.retiredIdentities
    )) {
      const ledgerReferenced = this.state.ledger.some(
        (line) => line.accountId === accountId
      );
      if (!ledgerReferenced && !referencedPublicIds.has(identity.publicId)) {
        delete this.state.retiredIdentities[accountId];
      }
    }
  }

  private validateAccountPreferences(
    language: Language,
    theme: ThemeMode,
    volume: number
  ): void {
    if (!["zh-CN", "en"].includes(language)) {
      throw new DomainError("INVALID_LANGUAGE");
    }
    if (!["light", "dark"].includes(theme)) {
      throw new DomainError("INVALID_THEME");
    }
    if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
      throw new DomainError("INVALID_VOLUME");
    }
  }

  private validateRoomConfig(config: RoomConfig): void {
    const integers = [
      config.smallBlind,
      config.bigBlind,
      config.minBuyIn,
      config.maxBuyIn,
      config.hostTransferTimeoutSeconds
    ];
    if (integers.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
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

  private requirePokerRoom(roomId: string): PokerRoom {
    const room = this.requireRoom(roomId);
    if (room.gameType !== "texas-holdem") {
      throw new DomainError("WRONG_GAME_TYPE");
    }
    return room;
  }

  private requireAvalonRoom(roomId: string): AvalonRoom {
    const room = this.requireRoom(roomId);
    if (room.gameType !== "avalon") {
      throw new DomainError("WRONG_GAME_TYPE");
    }
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
