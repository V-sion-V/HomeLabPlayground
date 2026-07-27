import { z } from "zod";

export const languages = ["zh-CN", "en"] as const;
export type Language = (typeof languages)[number];
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
}

export interface RoomConfig {
  mode: RoomMode;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  hostTransferTimeoutSeconds: number;
}

export interface Room {
  id: string;
  name: string;
  gameType: "texas-holdem";
  status: RoomStatus;
  hostAccountId: string;
  config: RoomConfig;
  seats: Seat[];
  version: number;
  createdAt: number;
  hostDisconnectDeadline?: number;
  poker?: PokerState;
}

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
  completedAt: number;
  reversedAt?: number;
}

export interface GlobalSettings {
  defaultLanguage: Language;
  defaultHostTransferTimeoutSeconds: number;
  poker: Omit<RoomConfig, "mode" | "hostTransferTimeoutSeconds"> & {
    suitColorPreset: SuitColorPreset;
  };
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
  expectedVersion: z.number().int().nonnegative(),
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
}

export interface LobbyRoomProjection {
  id: string;
  name: string;
  mode: RoomMode;
  status: RoomStatus;
  hostAccountId: string;
  seatCount: number;
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  createdAt: number;
  seats: PublicSeatProjection[];
}

export interface LobbyProjection {
  version: number;
  rooms: LobbyRoomProjection[];
  leaderboard: LeaderboardSnapshot[];
  historicalSeasons: HistoricalSeason[];
  currentSeason: Season;
  settings: GlobalSettings;
  accountRoomId?: string;
}

export interface RoomProjection {
  platformVersion: number;
  id: string;
  name: string;
  mode: RoomMode;
  status: RoomStatus;
  hostAccountId: string;
  config: RoomConfig;
  suitColorPreset: SuitColorPreset;
  version: number;
  createdAt: number;
  seats: PublicSeatProjection[];
  potTotal: number;
  phase?: HandPhase;
  actingAccountId?: string | null;
  pokerVersion?: number;
  currentBet?: number;
  minimumRaise?: number;
  raiseLockedAccountIds?: string[];
  handNumber?: number;
  dealerPosition?: number;
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
  };
  communityCards?: Array<Card | { hidden: true }>;
  ownHoleCards?: Card[];
  readyAccountIds?: string[];
  advanceDeadline?: number;
}

export const publicCardKeys = new Set(["rank", "suit"]);

export function assertNoPrivateCards(value: unknown): void {
  const text = JSON.stringify(value);
  if (text.includes("holeCards") || text.includes('"deck"')) {
    throw new Error("PRIVATE_STATE_EXPOSED");
  }
}
