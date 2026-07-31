import { z } from "zod";

export * from "./product-config";

export const languages = ["zh-CN", "en"] as const;
export type Language = (typeof languages)[number];
export const themeModes = ["light", "dark"] as const;
export type ThemeMode = (typeof themeModes)[number];
export const gameTypes = ["texas-holdem", "avalon"] as const;
export type GameType = (typeof gameTypes)[number];
export type RoomMode = "chips-only" | "chips-and-cards";
export type SuitColorPreset = "standard" | "high-contrast";
export type HandCategory =
  | "high-card"
  | "one-pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush";
export type RoomStatus = "waiting" | "in_progress" | "paused" | "closing" | "closed";
export const avalonRoles = [
  "merlin",
  "percival",
  "loyal-servant",
  "assassin",
  "morgana",
  "mordred",
  "oberon",
  "minion"
] as const;
export type AvalonRole = (typeof avalonRoles)[number];
export type AvalonAlignment = "good" | "evil";
export type AvalonRecognitionMode = "automatic" | "manual";
export type AvalonOberonRule = "original" | "dized";
export type AvalonRoleSource = "preset" | "custom";
export type AvalonPlayerCount = 5 | 6 | 7 | 8 | 9 | 10;
export type AvalonPhase =
  | "role-confirmation"
  | "manual-night"
  | "team-proposal"
  | "team-vote"
  | "mission"
  | "assassination"
  | "complete"
  | "void";
export type AvalonMissionChoice = "success" | "fail";
export type AvalonNightStepCode =
  | "all-close-eyes"
  | "evil-recognize"
  | "evil-close-eyes"
  | "merlin-recognize-original"
  | "merlin-recognize-dized"
  | "merlin-close-eyes"
  | "percival-recognize"
  | "percival-close-eyes"
  | "all-open-eyes";
export type AvalonWinReason =
  | "three-failed-missions"
  | "five-rejected-teams"
  | "merlin-assassinated"
  | "merlin-survived";

export interface AvalonParticipant {
  accountId: string;
  position: number;
}

export interface AvalonMissionRule {
  teamSize: number;
  failThreshold: number;
}

export interface AvalonConfigSnapshot {
  recognitionMode: AvalonRecognitionMode;
  oberonRule: AvalonOberonRule;
  roles: AvalonRole[];
  stake: number;
}

export interface AvalonNightStep {
  index: number;
  code: AvalonNightStepCode;
}

export interface AvalonKnowledge {
  role: AvalonRole;
  visibleEvilAccountIds: string[];
  percivalCandidateAccountIds: string[];
  evilAllyAccountIds: string[];
}

export interface AvalonVoteHistoryEntry {
  missionNumber: number;
  attempt: number;
  leaderAccountId: string;
  teamAccountIds: string[];
  votes: Array<{ accountId: string; approve: boolean }>;
  approved: boolean;
}

export interface AvalonMissionHistoryEntry {
  missionNumber: number;
  leaderAccountId: string;
  teamAccountIds: string[];
  successCount: number;
  failCount: number;
  succeeded: boolean;
}

export type AvalonOutcome =
  | {
      status: "settled";
      winningAlignment: AvalonAlignment;
      reason: AvalonWinReason;
      assassinationTargetAccountId?: string;
    }
  | {
      status: "void";
      reason: "voided";
    };

export interface AvalonGameState {
  gameNumber: number;
  phase: AvalonPhase;
  config: AvalonConfigSnapshot;
  participants: AvalonParticipant[];
  roleAssignments: Record<string, AvalonRole>;
  startingLeaderIndex: number;
  currentLeaderIndex: number;
  missionIndex: number;
  rejectionCount: number;
  proposedTeamAccountIds: string[];
  votes: Record<string, boolean>;
  missionChoices: Record<string, AvalonMissionChoice>;
  voteHistory: AvalonVoteHistoryEntry[];
  missionHistory: AvalonMissionHistoryEntry[];
  roleConfirmedAccountIds: string[];
  nightSteps: AvalonNightStep[];
  nightStepIndex: number;
  assassinationTargetAccountId?: string;
  outcome?: AvalonOutcome;
  version: number;
}

export interface AvalonRolePresets {
  5: AvalonRole[];
  6: AvalonRole[];
  7: AvalonRole[];
  8: AvalonRole[];
  9: AvalonRole[];
  10: AvalonRole[];
}

export interface AvalonSettings {
  defaultRecognitionMode: AvalonRecognitionMode;
  defaultOberonRule: AvalonOberonRule;
  defaultStake: number;
  rolePresets: AvalonRolePresets;
}

export type HandPhase =
  | "waiting"
  | "blinds"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown"
  | "distribution"
  | "complete"
  | "void";

export interface Account {
  id: string;
  username: string;
  normalizedUsername: string;
  avatar: string;
  language: Language;
  theme: ThemeMode;
  volume: number;
  updatedAt: number;
}

export interface Season {
  id: string;
  name: string;
  baseScore: number;
  status: "current" | "historical";
  startedAt: number;
  endedAt?: number;
}

export interface SeasonAsset {
  accountId: string;
  score: number;
  inGame: boolean;
  frozenScore: number | null;
}

export interface LeaderboardSnapshot {
  accountId: string;
  username: string;
  avatar: string;
  score: number;
  rank: number;
  anonymized?: boolean;
  anonymousNumber?: number;
}

export interface HistoricalSeason {
  season: Season;
  entries: LeaderboardSnapshot[];
}

export interface Seat {
  accountId: string;
  position: number;
  connected: boolean;
  buyIn: number;
  frozenLeaderboardScore: number;
  tableChips: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
}

export interface AvalonRoomMember {
  accountId: string;
  position: number;
  connected: boolean;
}

export interface Pot {
  amount: number;
  eligibleAccountIds: string[];
}

export interface Card {
  rank: string;
  suit: "clubs" | "diamonds" | "hearts" | "spades";
}

export interface PokerState {
  handNumber: number;
  phase: HandPhase;
  mode: RoomMode;
  dealerPosition: number;
  smallBlindAccountId: string;
  bigBlindAccountId: string;
  blindPostedAccountIds: string[];
  handStartConfirmedAccountIds: string[];
  actingAccountId: string | null;
  communityCards: Card[];
  holeCards: Record<string, Card[]>;
  deck: Card[];
  players: Array<{
    accountId: string;
    position: number;
    stack: number;
    roundBet: number;
    totalBet: number;
    folded: boolean;
    allIn: boolean;
  }>;
  actedAccountIds: string[];
  raiseLockedAccountIds: string[];
  readyAccountIds: string[];
  denominations: number[];
  pots: Pot[];
  currentBet: number;
  minimumRaise: number;
  smallBlind: number;
  bigBlind: number;
  version: number;
  lastAction?: {
    accountId: string;
    kind: string;
    amount: number;
    version: number;
    reversible: boolean;
  };
  undoSnapshot?: string;
  settlementSnapshot?: string;
  advanceDeadline?: number;
  pausedAdvanceRemainingMs?: number;
  departedAccountIds?: string[];
}

export interface RoomConfig {
  mode: RoomMode;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  hostTransferTimeoutSeconds: number;
}

export type AvalonRoomRoleSelection =
  | {
      roleSource: "preset";
      rolePresets: AvalonRolePresets;
    }
  | {
      roleSource: "custom";
      roles: AvalonRole[];
    };

export type AvalonRoomConfig = {
  recognitionMode: AvalonRecognitionMode;
  oberonRule: AvalonOberonRule;
  stake: number;
  hostTransferTimeoutSeconds: number;
} & AvalonRoomRoleSelection;

interface BaseRoom {
  id: string;
  name: string;
  status: RoomStatus;
  hostAccountId: string;
  waitingReadyAccountIds: string[];
  version: number;
  createdAt: number;
  hostDisconnectDeadline?: number;
}

export interface PokerRoom extends BaseRoom {
  gameType: "texas-holdem";
  config: RoomConfig;
  seats: Seat[];
  poker?: PokerState;
}

export interface AvalonRoom extends BaseRoom {
  gameType: "avalon";
  config: AvalonRoomConfig;
  seats: AvalonRoomMember[];
  avalon?: AvalonGameState;
}

export type Room = PokerRoom | AvalonRoom;

export interface AssetLine {
  id: string;
  groupId: string;
  seasonId: string;
  accountId?: string;
  roomId?: string;
  handNumber?: number;
  source: string;
  destination: string;
  amount: number;
  reason: string;
  reversalOf?: string;
  createdAt: number;
}

export interface HandResultSummary {
  id: string;
  seasonId: string;
  roomId: string;
  handNumber: number;
  mode: RoomMode;
  outcome: "settled" | "void";
  participantAccountIds: string[];
  payouts: Array<{ accountId: string; amount: number }>;
  playerResults?: Array<{
    accountId: string;
    username: string;
    avatar: string;
    chipDelta: number;
    endingChips?: number;
    anonymized?: boolean;
    anonymousNumber?: number;
  }>;
  showdown?: {
    communityCards: Card[];
    players: Array<{
      accountId: string;
      cards: Card[];
      handCategory: HandCategory;
      winner: boolean;
      anonymized?: boolean;
      anonymousNumber?: number;
    }>;
  };
  completedAt: number;
  reversedAt?: number;
}

interface AvalonResultBase {
  id: string;
  seasonId: string;
  roomId: string;
  gameNumber: number;
  participantAccountIds: string[];
  voteHistory: AvalonVoteHistoryEntry[];
  missionHistory: AvalonMissionHistoryEntry[];
  completedAt: number;
  reversedAt?: number;
}

export interface AvalonSettledPlayerResult {
  accountId: string;
  username: string;
  avatar: string;
  role: AvalonRole;
  alignment: AvalonAlignment;
  scoreDelta: number;
  endingScore: number;
  anonymized?: boolean;
  anonymousNumber?: number;
}

export type AvalonResultSummary =
  | (AvalonResultBase & {
      outcome: "settled";
      winningAlignment: AvalonAlignment;
      reason: AvalonWinReason;
      assassinationTargetAccountId?: string;
      playerResults: AvalonSettledPlayerResult[];
    })
  | (AvalonResultBase & {
      outcome: "void";
    });

export interface RetiredIdentity {
  publicId: string;
  anonymousNumber: number;
  retiredAt: number;
}

export interface PlatformParticipationFact {
  resultId: string;
  gameType: string;
  seasonId: string;
  participantAccountIds: string[];
  valid: boolean;
  reversed: boolean;
}

export interface AccountManagementSummary {
  id: string;
  username: string;
  avatar: string;
}

export interface UsernameLookupResult {
  version: number;
  normalizedUsername: string;
  username: string;
  exists: boolean;
}

export interface PlatformDataDeletionResult {
  kind: "account" | "accounts" | "season" | "seasons";
  deletedIds: string[];
  protectedIds: string[];
  selfDeleted: boolean;
  noOp: boolean;
}

export interface GlobalSettings {
  defaultLanguage: Language;
  defaultTheme: ThemeMode;
  defaultHostTransferTimeoutSeconds: number;
  poker: Omit<RoomConfig, "mode" | "hostTransferTimeoutSeconds"> & {
    suitColorPreset: SuitColorPreset;
    denominations: number[];
  };
  avalon: AvalonSettings;
}

export interface AdminProjection {
  version: number;
  accounts: AccountManagementSummary[];
  currentSeason: Season;
  historicalSeasons: Season[];
  settings: GlobalSettings;
}

export interface PlatformSnapshot {
  version: number;
  accounts: Record<string, Account>;
  seasons: Season[];
  seasonAssets: Record<string, SeasonAsset>;
  historicalSeasons: HistoricalSeason[];
  rooms: Record<string, Room>;
  leases: Record<string, { connectionId: string; acquiredAt: number }>;
  ledger: AssetLine[];
  handResults: HandResultSummary[];
  avalonResults: AvalonResultSummary[];
  retiredIdentities: Record<string, RetiredIdentity>;
  settings: GlobalSettings;
}

export interface CommandEnvelope<T = unknown> {
  commandId: string;
  connectionId?: string;
  aggregateId: string;
  expectedVersion: number;
  type: string;
  payload: T;
}

export interface CommandResult<T = unknown> {
  status: "accepted" | "rejected" | "replayed";
  code: string;
  version: number;
  data?: T;
  params?: Record<string, string | number>;
}

export const commandEnvelopeSchema = z.object({
  commandId: z.string().min(8).max(128),
  connectionId: z.string().min(8).max(128).optional(),
  aggregateId: z.string().min(1).max(128),
  expectedVersion: z.number().int().safe().nonnegative(),
  type: z.string().min(1).max(64),
  payload: z.unknown()
});

export interface PublicSeatProjection {
  accountId: string;
  username: string;
  avatar: string;
  position: number;
  connected: boolean;
  tableChips: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  role: "member" | "participant" | "spectator";
}

export interface AvalonPublicMemberProjection {
  accountId: string;
  username: string;
  avatar: string;
  position: number;
  connected: boolean;
  role: "member" | "participant" | "spectator";
}

interface LobbyRoomProjectionBase {
  id: string;
  name: string;
  gameType: GameType;
  status: RoomStatus;
  hostAccountId: string;
  seatCount: number;
  maxSeats: number;
  createdAt: number;
}

export interface PokerLobbyRoomProjection extends LobbyRoomProjectionBase {
  gameType: "texas-holdem";
  mode: RoomMode;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  seats: PublicSeatProjection[];
}

export interface AvalonLobbyRoomProjection extends LobbyRoomProjectionBase {
  gameType: "avalon";
  recognitionMode: AvalonRecognitionMode;
  oberonRule: AvalonOberonRule;
  stake: number;
  seats: AvalonPublicMemberProjection[];
}

export type LobbyRoomProjection =
  | PokerLobbyRoomProjection
  | AvalonLobbyRoomProjection;

export interface LobbyProjection {
  version: number;
  rooms: LobbyRoomProjection[];
  leaderboard: LeaderboardSnapshot[];
  historicalSeasons: HistoricalSeason[];
  currentSeason: Season;
  accounts: AccountManagementSummary[];
  settings: GlobalSettings;
  accountRoomId?: string;
}

interface RoomProjectionBase {
  platformVersion: number;
  id: string;
  name: string;
  gameType: GameType;
  status: RoomStatus;
  hostAccountId: string;
  version: number;
  createdAt: number;
  viewerRole: "member" | "participant" | "spectator" | "display";
}

export interface PokerRoomProjection extends RoomProjectionBase {
  gameType: "texas-holdem";
  mode: RoomMode;
  config: RoomConfig;
  suitColorPreset: SuitColorPreset;
  seats: PublicSeatProjection[];
  effectiveDenominations: number[];
  potTotal: number;
  phase?: HandPhase;
  actingAccountId?: string | null;
  pokerVersion?: number;
  currentBet?: number;
  minimumRaise?: number;
  raiseLockedAccountIds?: string[];
  handNumber?: number;
  dealerPosition?: number;
  smallBlindAccountId?: string;
  bigBlindAccountId?: string;
  blindPostedAccountIds?: string[];
  handStartConfirmedAccountIds?: string[];
  pendingHandStartAccountIds?: string[];
  lastAction?: {
    accountId: string;
    kind: string;
    amount: number;
    version: number;
    reversible: boolean;
  };
  pots?: Pot[];
  lastResult?: {
    handNumber: number;
    outcome: "settled" | "void";
    participantAccountIds: string[];
    payouts: Array<{ accountId: string; amount: number }>;
    playerResults?: Array<{
      accountId: string;
      username: string;
      avatar: string;
      chipDelta: number;
      endingChips?: number;
      anonymized?: boolean;
      anonymousNumber?: number;
    }>;
    showdown?: {
      communityCards: Card[];
      players: Array<{
        accountId: string;
        cards: Card[];
        handCategory: HandCategory;
        winner: boolean;
        anonymized?: boolean;
        anonymousNumber?: number;
      }>;
    };
  };
  communityCards?: Array<Card | { hidden: true }>;
  ownHoleCards?: Card[];
  readyAccountIds?: string[];
  advanceDeadline?: number;
}

export interface AvalonRoomProjection extends RoomProjectionBase {
  gameType: "avalon";
  config: AvalonRoomConfig;
  seats: AvalonPublicMemberProjection[];
  readyAccountIds: string[];
  avalonVersion?: number;
  gameNumber?: number;
  phase?: AvalonPhase;
  participantAccountIds: string[];
  roleConfirmedAccountIds: string[];
  currentLeaderAccountId?: string;
  currentMissionNumber?: number;
  currentMissionRule?: AvalonMissionRule;
  proposedTeamAccountIds: string[];
  voteSubmittedAccountIds: string[];
  missionSubmittedAccountIds: string[];
  rejectionCount: number;
  voteHistory: AvalonVoteHistoryEntry[];
  missionHistory: AvalonMissionHistoryEntry[];
  nightSteps: AvalonNightStep[];
  nightStepIndex?: number;
  ownKnowledge?: AvalonKnowledge;
  ownRoleConfirmed?: boolean;
  ownVoteSubmitted?: boolean;
  ownMissionSubmitted?: boolean;
  assassinationCandidates?: AvalonPublicMemberProjection[];
  revealedRoles?: Array<{
    accountId: string;
    role: AvalonRole;
    alignment: AvalonAlignment;
  }>;
  outcome?: AvalonOutcome;
  lastResult?: AvalonResultSummary;
}

export type RoomProjection = PokerRoomProjection | AvalonRoomProjection;

export const publicCardKeys = new Set(["rank", "suit"]);

export function assertNoPrivateCards(value: unknown): void {
  const text = JSON.stringify(value);
  if (text.includes("holeCards") || text.includes('"deck"')) {
    throw new Error("PRIVATE_STATE_EXPOSED");
  }
}

export function assertNoAvalonSecrets(value: unknown): void {
  visit(value);

  function visit(candidate: unknown): void {
    if (!candidate || typeof candidate !== "object") return;
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    for (const [key, nested] of Object.entries(
      candidate as Record<string, unknown>
    )) {
      if (
        key === "roleAssignments" ||
        key === "missionChoices" ||
        (key === "votes" && !Array.isArray(nested))
      ) {
        throw new Error("AVALON_PRIVATE_STATE_EXPOSED");
      }
      visit(nested);
    }
  }
}
