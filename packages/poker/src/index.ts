import { randomInt } from "node:crypto";
import type {
  Card,
  HandCategory,
  HandPhase,
  PokerState,
  Pot,
  RoomMode
} from "@party/contracts";
import { DomainError } from "@party/domain";

const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
const suits = ["clubs", "diamonds", "hearts", "spades"] as const;

export interface PokerPlayerInput {
  accountId: string;
  position: number;
  stack: number;
}

export type PokerAction =
  | { kind: "fold" }
  | { kind: "check" }
  | { kind: "call" }
  | { kind: "bet"; amount: number }
  | { kind: "raise"; amount: number }
  | { kind: "all-in" };

export function createDeck(): Card[] {
  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
}

export function shuffleDeck(
  deck: Card[] = createDeck(),
  random: (maxExclusive: number) => number = randomInt
): Card[] {
  const shuffled = [...deck];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = random(index + 1);
    [shuffled[index], shuffled[swap]] = [shuffled[swap]!, shuffled[index]!];
  }
  return shuffled;
}

export function createPokerState(options: {
  players: PokerPlayerInput[];
  mode: RoomMode;
  smallBlind: number;
  bigBlind: number;
  dealerPosition?: number;
  deck?: Card[];
  now?: number;
}): PokerState {
  if (options.players.length < 2 || options.players.length > 10) {
    throw new DomainError("INVALID_PLAYER_COUNT");
  }
  const orderedPlayers = [...options.players].sort(
    (left, right) => left.position - right.position
  );
  if (
    new Set(orderedPlayers.map((player) => player.position)).size !==
    orderedPlayers.length
  ) {
    throw new DomainError("INVALID_SEAT_POSITIONS");
  }
  if (
    options.dealerPosition !== undefined &&
    !orderedPlayers.some(
      (player) => player.position === options.dealerPosition
    )
  ) {
    throw new DomainError("INVALID_DEALER_POSITION");
  }
  const state: PokerState = {
    handNumber: 1,
    phase: "blinds",
    mode: options.mode,
    dealerPosition: options.dealerPosition ?? orderedPlayers[0]!.position,
    actingAccountId: null,
    communityCards: [],
    holeCards: {},
    deck: options.deck ? [...options.deck] : shuffleDeck(),
    players: orderedPlayers.map((player) => ({
      ...player,
      roundBet: 0,
      totalBet: 0,
      folded: false,
      allIn: false
    })),
    actedAccountIds: [],
    raiseLockedAccountIds: [],
    readyAccountIds: [],
    pots: [],
    currentBet: 0,
    minimumRaise: options.bigBlind,
    smallBlind: options.smallBlind,
    bigBlind: options.bigBlind,
    version: 0
  };
  postBlinds(state);
  if (state.mode === "chips-and-cards") dealHoleCards(state);
  state.phase = "preflop";
  state.actingAccountId = nextActiveAccount(state, bigBlindPlayerIndex(state));
  if (state.actingAccountId === null) {
    state.advanceDeadline = (options.now ?? Date.now()) + 3_000;
  }
  return state;
}

export function legalActions(state: PokerState, accountId: string) {
  const player = requireActingPlayer(state, accountId);
  const callAmount = Math.min(state.currentBet - player.roundBet, player.stack);
  const raiseLocked = state.raiseLockedAccountIds.includes(accountId);
  return {
    canFold: true,
    canCheck: callAmount === 0,
    callAmount,
    minimumRaiseTo: state.currentBet + state.minimumRaise,
    maximumTo: player.roundBet + player.stack,
    canRaise: !raiseLocked && player.roundBet + player.stack > state.currentBet,
    canAllIn:
      player.stack > 0 &&
      (!raiseLocked || player.roundBet + player.stack <= state.currentBet)
  };
}

export function act(
  state: PokerState,
  accountId: string,
  action: PokerAction,
  expectedVersion = state.version,
  now = Date.now()
): PokerState {
  if (expectedVersion !== state.version) throw new DomainError("STALE_VERSION");
  const before = JSON.stringify(withoutUndo(state));
  const player = requireActingPlayer(state, accountId);
  const legal = legalActions(state, accountId);
  const previouslyActed = [...state.actedAccountIds];
  let committed = 0;
  switch (action.kind) {
    case "fold":
      player.folded = true;
      break;
    case "check":
      if (!legal.canCheck) throw new DomainError("CANNOT_CHECK");
      break;
    case "call":
      committed = commit(player, legal.callAmount);
      break;
    case "bet":
    case "raise": {
      if (state.raiseLockedAccountIds.includes(accountId)) {
        throw new DomainError("RAISE_NOT_REOPENED");
      }
      if (!Number.isInteger(action.amount)) throw new DomainError("INVALID_BET");
      if (action.amount <= state.currentBet || action.amount > legal.maximumTo) {
        throw new DomainError("INVALID_BET");
      }
      const raiseSize = action.amount - state.currentBet;
      const isAllIn = action.amount === legal.maximumTo;
      if (raiseSize < state.minimumRaise && !isAllIn) throw new DomainError("MINIMUM_RAISE");
      committed = commit(player, action.amount - player.roundBet);
      if (raiseSize >= state.minimumRaise) {
        state.minimumRaise = raiseSize;
        state.raiseLockedAccountIds = [];
      }
      state.currentBet = action.amount;
      if (raiseSize < state.minimumRaise) {
        updateRaiseLocksAfterShortRaise(state, accountId, previouslyActed);
      }
      state.actedAccountIds = [accountId];
      break;
    }
    case "all-in": {
      if (
        state.raiseLockedAccountIds.includes(accountId) &&
        player.roundBet + player.stack > state.currentBet
      ) {
        throw new DomainError("RAISE_NOT_REOPENED");
      }
      committed = commit(player, player.stack);
      if (player.roundBet > state.currentBet) {
        const raiseSize = player.roundBet - state.currentBet;
        if (raiseSize >= state.minimumRaise) {
          state.minimumRaise = raiseSize;
          state.raiseLockedAccountIds = [];
        }
        state.currentBet = player.roundBet;
        if (raiseSize < state.minimumRaise) {
          updateRaiseLocksAfterShortRaise(state, accountId, previouslyActed);
        }
        state.actedAccountIds = [accountId];
      }
      break;
    }
  }
  if (!state.actedAccountIds.includes(accountId)) state.actedAccountIds.push(accountId);
  state.pots = calculatePots(state.players);
  state.version += 1;
  state.lastAction = {
    accountId,
    kind: action.kind,
    amount: committed,
    version: state.version,
    reversible: true
  };
  state.undoSnapshot = before;

  if (remainingUnfolded(state).length === 1) {
    state.phase = "showdown";
    state.actingAccountId = null;
    state.advanceDeadline = now + 3_000;
    return state;
  }
  if (roundComplete(state)) {
    state.actingAccountId = null;
    state.advanceDeadline = now + 3_000;
  } else {
    state.actingAccountId = nextActiveAccount(
      state,
      state.players.findIndex((candidate) => candidate.accountId === accountId)
    );
  }
  return state;
}

export function undoLastAction(
  state: PokerState,
  accountId: string,
  expectedVersion = state.version
): PokerState {
  if (expectedVersion !== state.version) throw new DomainError("STALE_VERSION");
  if (
    state.lastAction?.accountId !== accountId ||
    !state.lastAction.reversible ||
    !state.undoSnapshot
  ) {
    throw new DomainError("UNDO_NOT_AVAILABLE");
  }
  return JSON.parse(state.undoSnapshot) as PokerState;
}

export function forceFold(
  state: PokerState,
  accountId: string,
  now = Date.now()
): PokerState {
  const player = requirePlayer(state, accountId);
  const playerIndex = state.players.findIndex(
    (candidate) => candidate.accountId === accountId
  );
  player.folded = true;
  state.raiseLockedAccountIds = state.raiseLockedAccountIds.filter(
    (candidate) => candidate !== accountId
  );
  state.pots = calculatePots(state.players);
  state.version += 1;
  state.lastAction = {
    accountId,
    kind: "forced-fold",
    amount: 0,
    version: state.version,
    reversible: false
  };
  delete state.undoSnapshot;

  if (remainingUnfolded(state).length === 1) {
    state.phase = "showdown";
    state.actingAccountId = null;
    state.advanceDeadline = now + 3_000;
    return state;
  }
  if (state.actingAccountId === accountId) {
    if (roundComplete(state)) {
      state.actingAccountId = null;
      state.advanceDeadline = now + 3_000;
    } else {
      state.actingAccountId = nextActiveAccount(state, playerIndex);
    }
  }
  return state;
}

export function advancePhase(
  state: PokerState,
  now = Date.now(),
  expectedVersion = state.version
): PokerState {
  if (expectedVersion !== state.version) throw new DomainError("STALE_VERSION");
  if (!state.advanceDeadline || state.advanceDeadline > now) {
    throw new DomainError("ADVANCE_NOT_DUE");
  }
  state.lastAction = state.lastAction
    ? { ...state.lastAction, reversible: false }
    : undefined;
  delete state.undoSnapshot;
  delete state.advanceDeadline;
  for (const player of state.players) player.roundBet = 0;
  state.currentBet = 0;
  state.actedAccountIds = [];
  state.raiseLockedAccountIds = [];
  const nextPhase: Partial<Record<HandPhase, HandPhase>> = {
    preflop: "flop",
    flop: "turn",
    turn: "river",
    river: "showdown"
  };
  state.phase = nextPhase[state.phase] ?? "showdown";
  if (state.mode === "chips-and-cards") {
    const target = state.phase === "flop" ? 3 : state.phase === "turn" ? 4 : state.phase === "river" ? 5 : 5;
    while (state.communityCards.length < target) {
      const card = state.deck.shift();
      if (!card) throw new DomainError("DECK_EXHAUSTED");
      state.communityCards.push(card);
    }
  }
  state.version += 1;
  if (state.phase === "showdown") {
    state.actingAccountId = null;
    state.advanceDeadline = now + 3_000;
  } else {
    state.actingAccountId = nextActiveAccount(
      state,
      state.players.findIndex((player) => player.position === state.dealerPosition)
    );
    if (state.actingAccountId === null) {
      state.advanceDeadline = now + 3_000;
    }
  }
  return state;
}

export function calculatePots(
  players: PokerState["players"]
): Pot[] {
  const levels = [...new Set(players.map((player) => player.totalBet).filter((amount) => amount > 0))]
    .sort((left, right) => left - right);
  const pots: Pot[] = [];
  let previous = 0;
  for (const level of levels) {
    const contributors = players.filter((player) => player.totalBet >= level);
    const contribution = level - previous;
    const amount = contribution * contributors.length;
    if (amount > 0) {
      const eligibleAccountIds = contributors
        .filter((player) => !player.folded)
        .map((player) => player.accountId);
      if (eligibleAccountIds.length > 0) {
        pots.push({ amount, eligibleAccountIds });
      } else {
        for (const contributor of contributors) {
          pots.push({
            amount: contribution,
            eligibleAccountIds: [contributor.accountId]
          });
        }
      }
    }
    previous = level;
  }
  return pots;
}

export function settleManual(
  state: PokerState,
  winnersByPot: string[][],
  expectedVersion = state.version
): PokerState {
  if (state.mode !== "chips-only") throw new DomainError("MANUAL_WINNER_NOT_ALLOWED");
  if (expectedVersion !== state.version) throw new DomainError("STALE_VERSION");
  if (state.phase !== "showdown") throw new DomainError("INVALID_PHASE");
  if (winnersByPot.length !== state.pots.length) throw new DomainError("WINNER_REQUIRED");
  const orderedWinners = state.pots.map((pot, index) => {
    const winners = winnersByPot[index] ?? [];
    if (
      winners.length < 1 ||
      new Set(winners).size !== winners.length ||
      winners.some((winner) => !pot.eligibleAccountIds.includes(winner))
    ) {
      throw new DomainError("INELIGIBLE_WINNER");
    }
    return [...winners].sort(
      (left, right) =>
        requirePlayer(state, left).position - requirePlayer(state, right).position
    );
  });
  state.settlementSnapshot = JSON.stringify(withoutSettlement(state));
  state.pots.forEach((pot, index) => {
    const ordered = orderedWinners[index]!;
    const share = Math.floor(pot.amount / ordered.length);
    let remainder = pot.amount % ordered.length;
    for (const accountId of ordered) {
      const player = requirePlayer(state, accountId);
      player.stack += share + (remainder > 0 ? 1 : 0);
      remainder -= remainder > 0 ? 1 : 0;
    }
  });
  state.pots = [];
  for (const player of state.players) {
    player.totalBet = 0;
    player.roundBet = 0;
  }
  state.phase = "complete";
  state.version += 1;
  return state;
}

export function settleAutomatically(state: PokerState): PokerState {
  if (state.mode !== "chips-and-cards") throw new DomainError("AUTOMATIC_WINNER_NOT_ALLOWED");
  if (state.phase !== "showdown") throw new DomainError("INVALID_PHASE");
  const winnersByPot = state.pots.map((pot) => {
    if (pot.eligibleAccountIds.length === 1) return [...pot.eligibleAccountIds];
    if (state.communityCards.length !== 5) throw new DomainError("BOARD_INCOMPLETE");
    const eligible = pot.eligibleAccountIds.map((accountId) => ({
      accountId,
      score: evaluateSeven([
        ...(state.holeCards[accountId] ?? []),
        ...state.communityCards
      ])
    }));
    const best = eligible.reduce((value, entry) => Math.max(value, entry.score), -1);
    return eligible.filter((entry) => entry.score === best).map((entry) => entry.accountId);
  });
  const manualMode = state.mode;
  state.mode = "chips-only";
  settleManual(state, winnersByPot);
  state.mode = manualMode;
  return state;
}

export function undoSettlement(state: PokerState): PokerState {
  if (state.phase !== "complete" || !state.settlementSnapshot) {
    throw new DomainError("SETTLEMENT_UNDO_NOT_AVAILABLE");
  }
  return JSON.parse(state.settlementSnapshot) as PokerState;
}

export function evaluateSeven(cards: Card[]): number {
  if (cards.length < 5 || cards.length > 7) throw new DomainError("INVALID_HAND");
  let best = 0;
  for (const combination of chooseFive(cards)) {
    best = Math.max(best, evaluateFive(combination));
  }
  return best;
}

export function handCategoryFromScore(score: number): HandCategory {
  const categories: HandCategory[] = [
    "high-card",
    "one-pair",
    "two-pair",
    "three-of-a-kind",
    "straight",
    "flush",
    "full-house",
    "four-of-a-kind",
    "straight-flush"
  ];
  return categories[Math.floor(score / 15 ** 5)] ?? "high-card";
}

function evaluateFive(cards: Card[]): number {
  const values = cards.map((card) => ranks.indexOf(card.rank as (typeof ranks)[number]) + 2);
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const groups = [...counts.entries()].sort(
    ([leftValue, leftCount], [rightValue, rightCount]) =>
      rightCount - leftCount || rightValue - leftValue
  );
  const flush = cards.every((card) => card.suit === cards[0]?.suit);
  const unique = [...new Set(values)].sort((left, right) => right - left);
  if (unique[0] === 14) unique.push(1);
  let straightHigh = 0;
  for (let index = 0; index <= unique.length - 5; index += 1) {
    if (unique[index]! - unique[index + 4]! === 4) {
      straightHigh = unique[index]!;
      break;
    }
  }
  const encode = (category: number, kickers: number[]) =>
    kickers.reduce((score, kicker) => score * 15 + kicker, category);
  if (flush && straightHigh) return encode(8, [straightHigh, 0, 0, 0, 0]);
  if (groups[0]?.[1] === 4) return encode(7, [groups[0][0], groups[1]![0], 0, 0, 0]);
  if (groups[0]?.[1] === 3 && groups[1]?.[1] === 2) {
    return encode(6, [groups[0][0], groups[1][0], 0, 0, 0]);
  }
  if (flush) return encode(5, [...values].sort((a, b) => b - a));
  if (straightHigh) return encode(4, [straightHigh, 0, 0, 0, 0]);
  if (groups[0]?.[1] === 3) {
    return encode(3, [groups[0][0], ...groups.slice(1).map(([value]) => value), 0, 0].slice(0, 5));
  }
  if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    return encode(2, [groups[0][0], groups[1][0], groups[2]![0], 0, 0]);
  }
  if (groups[0]?.[1] === 2) {
    return encode(1, [groups[0][0], ...groups.slice(1).map(([value]) => value), 0].slice(0, 5));
  }
  return encode(0, [...values].sort((a, b) => b - a));
}

function chooseFive(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  for (let a = 0; a < cards.length - 4; a += 1)
    for (let b = a + 1; b < cards.length - 3; b += 1)
      for (let c = b + 1; c < cards.length - 2; c += 1)
        for (let d = c + 1; d < cards.length - 1; d += 1)
          for (let e = d + 1; e < cards.length; e += 1)
            result.push([cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!]);
  return result;
}

function postBlinds(state: PokerState): void {
  const dealerIndex = state.players.findIndex(
    (player) => player.position === state.dealerPosition
  );
  const smallIndex = state.players.length === 2 ? dealerIndex : nextIndex(state, dealerIndex);
  const bigIndex = nextIndex(state, smallIndex);
  commit(state.players[smallIndex]!, state.smallBlind);
  commit(state.players[bigIndex]!, state.bigBlind);
  state.currentBet = state.bigBlind;
  state.pots = calculatePots(state.players);
}

function updateRaiseLocksAfterShortRaise(
  state: PokerState,
  raiserAccountId: string,
  previouslyActed: string[]
): void {
  const candidates = new Set([
    ...state.raiseLockedAccountIds,
    ...previouslyActed.filter((accountId) => accountId !== raiserAccountId)
  ]);
  state.raiseLockedAccountIds = [...candidates].filter((accountId) => {
    const player = requirePlayer(state, accountId);
    return (
      !player.folded &&
      !player.allIn &&
      state.currentBet - player.roundBet < state.minimumRaise
    );
  });
}

function dealHoleCards(state: PokerState): void {
  for (let round = 0; round < 2; round += 1) {
    for (const player of state.players) {
      const card = state.deck.shift();
      if (!card) throw new DomainError("DECK_EXHAUSTED");
      (state.holeCards[player.accountId] ??= []).push(card);
    }
  }
}

function commit(player: PokerState["players"][number], requested: number): number {
  const amount = Math.min(requested, player.stack);
  if (!Number.isInteger(amount) || amount < 0) throw new DomainError("INVALID_BET");
  player.stack -= amount;
  player.roundBet += amount;
  player.totalBet += amount;
  player.allIn = player.stack === 0;
  return amount;
}

function roundComplete(state: PokerState): boolean {
  const actionable = state.players.filter((player) => !player.folded && !player.allIn);
  return (
    actionable.every((player) => player.roundBet === state.currentBet) &&
    actionable.every((player) => state.actedAccountIds.includes(player.accountId))
  );
}

function nextActiveAccount(state: PokerState, fromIndex: number, includeStart = false): string | null {
  for (let offset = includeStart ? 0 : 1; offset <= state.players.length; offset += 1) {
    const player = state.players[(fromIndex + offset + state.players.length) % state.players.length]!;
    if (!player.folded && !player.allIn) return player.accountId;
  }
  return null;
}

function nextIndex(state: PokerState, fromIndex: number): number {
  return (fromIndex + 1) % state.players.length;
}

function bigBlindPlayerIndex(state: PokerState): number {
  const dealerIndex = state.players.findIndex(
    (player) => player.position === state.dealerPosition
  );
  const smallIndex = state.players.length === 2 ? dealerIndex : nextIndex(state, dealerIndex);
  return nextIndex(state, smallIndex);
}

function remainingUnfolded(state: PokerState) {
  return state.players.filter((player) => !player.folded);
}

function requireActingPlayer(state: PokerState, accountId: string) {
  if (state.actingAccountId !== accountId) throw new DomainError("WRONG_ACTOR");
  return requirePlayer(state, accountId);
}

function requirePlayer(state: PokerState, accountId: string) {
  const player = state.players.find((candidate) => candidate.accountId === accountId);
  if (!player) throw new DomainError("PLAYER_NOT_FOUND");
  return player;
}

function withoutUndo(state: PokerState): PokerState {
  const copy = structuredClone(state);
  delete copy.undoSnapshot;
  delete copy.settlementSnapshot;
  return copy;
}

function withoutSettlement(state: PokerState): PokerState {
  const copy = structuredClone(state);
  delete copy.settlementSnapshot;
  return copy;
}
