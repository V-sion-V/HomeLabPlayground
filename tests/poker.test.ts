import { describe, expect, it } from "vitest";
import type { Card } from "@party/contracts";
import {
  act,
  advancePhase,
  calculatePots,
  createPokerState,
  evaluateSeven,
  forceFold,
  handCategoryFromScore,
  legalActions,
  settleAutomatically,
  settleManual,
  undoLastAction,
  undoSettlement
} from "@party/poker";

const players = [
  { accountId: "alice", position: 0, stack: 1_000 },
  { accountId: "bob", position: 1, stack: 500 },
  { accountId: "cara", position: 2, stack: 200 }
];

describe("Texas hold'em engine", () => {
  it("stores a per-hand denomination snapshot without sharing the caller array", () => {
    const denominations = [1, 20, 100];
    const state = createPokerState({
      players,
      mode: "chips-only",
      smallBlind: 10,
      bigBlind: 20,
      denominations,
      deck: []
    });
    denominations.push(500);
    expect(state.denominations).toEqual([1, 20, 100]);
  });

  it("posts blinds, enforces the actor and minimum raise, and supports atomic undo", () => {
    const state = createPokerState({
      players,
      mode: "chips-only",
      smallBlind: 10,
      bigBlind: 20,
      deck: []
    });
    expect(state.actingAccountId).toBe("alice");
    expect(legalActions(state, "alice").callAmount).toBe(20);
    expect(() => act(state, "bob", { kind: "call" })).toThrowError("WRONG_ACTOR");
    expect(() => act(state, "alice", { kind: "raise", amount: 30 })).toThrowError(
      "MINIMUM_RAISE"
    );
    const after = act(state, "alice", { kind: "raise", amount: 40 });
    expect(after.version).toBe(1);
    const restored = undoLastAction(after, "alice", 1);
    expect(restored.version).toBe(0);
    expect(restored.players.find((player) => player.accountId === "alice")?.stack).toBe(1_000);
    expect(() => undoLastAction(after, "alice", 0)).toThrowError("STALE_VERSION");
  });

  it("keeps the full big blind as the opening wager when the big blind is short", () => {
    const state = createPokerState({
      players: [
        { accountId: "alice", position: 0, stack: 1_000 },
        { accountId: "bob", position: 1, stack: 50 }
      ],
      mode: "chips-only",
      smallBlind: 10,
      bigBlind: 100,
      deck: []
    });
    expect(state.currentBet).toBe(100);
    expect(state.players.find((player) => player.accountId === "bob")).toMatchObject({
      roundBet: 50,
      allIn: true
    });
    expect(legalActions(state, "alice").callAmount).toBe(90);
    act(state, "alice", { kind: "call" });
    expect(state.pots).toEqual([
      { amount: 100, eligibleAccountIds: ["alice", "bob"] },
      { amount: 50, eligibleAccountIds: ["alice"] }
    ]);
  });

  it("builds main and side pots from uneven all-ins", () => {
    const pots = calculatePots([
      { ...players[0]!, roundBet: 0, totalBet: 500, folded: false, allIn: false },
      { ...players[1]!, roundBet: 0, totalBet: 300, folded: false, allIn: true },
      { ...players[2]!, roundBet: 0, totalBet: 100, folded: false, allIn: true }
    ]);
    expect(pots.map((pot) => pot.amount)).toEqual([300, 400, 200]);
    expect(pots[0]?.eligibleAccountIds).toEqual(["alice", "bob", "cara"]);
    expect(pots[2]?.eligibleAccountIds).toEqual(["alice"]);
  });

  it("returns unmatched excess when every contributor to that layer has folded", () => {
    const pots = calculatePots([
      { ...players[0]!, roundBet: 0, totalBet: 500, folded: true, allIn: false },
      { ...players[1]!, roundBet: 0, totalBet: 300, folded: false, allIn: true },
      { ...players[2]!, roundBet: 0, totalBet: 300, folded: false, allIn: true }
    ]);
    expect(pots).toEqual([
      { amount: 900, eligibleAccountIds: ["bob", "cara"] },
      { amount: 200, eligibleAccountIds: ["alice"] }
    ]);
    expect(pots.reduce((total, pot) => total + pot.amount, 0)).toBe(1_100);
  });

  it("manual mode validates winners, splits odd chips, and reverses settlement", () => {
    const state = createPokerState({
      players,
      mode: "chips-only",
      smallBlind: 10,
      bigBlind: 20,
      deck: []
    });
    state.pots = [{ amount: 101, eligibleAccountIds: ["alice", "bob"] }];
    state.phase = "showdown";
    const before = state.players.map((player) => player.stack);
    expect(() => settleManual(state, [["alice", "alice"]])).toThrowError(
      "INELIGIBLE_WINNER"
    );
    expect(state.players.map((player) => player.stack)).toEqual(before);
    settleManual(state, [["alice", "bob"]]);
    expect(state.players[0]?.stack).toBe(before[0]! + 51);
    expect(state.players[1]?.stack).toBe(before[1]! + 50);
    const restored = undoSettlement(state);
    expect(restored.pots[0]?.amount).toBe(101);
  });

  it("deals private cards once and waits three seconds before automatic board advance", () => {
    const deck = fixedDeck();
    const state = createPokerState({
      players: players.slice(0, 2),
      mode: "chips-and-cards",
      smallBlind: 10,
      bigBlind: 20,
      deck
    });
    expect(state.holeCards.alice).toHaveLength(2);
    const first = state.actingAccountId!;
    act(state, first, { kind: "call" }, state.version, 1_000);
    const second = state.actingAccountId!;
    act(state, second, { kind: "check" }, state.version, 1_000);
    expect(state.advanceDeadline).toBe(4_000);
    expect(() => advancePhase(state, 3_999)).toThrowError("ADVANCE_NOT_DUE");
    advancePhase(state, 4_000);
    expect(state.phase).toBe("flop");
    expect(state.communityCards).toHaveLength(3);
  });

  it("awards every pot immediately when all opponents fold before the board completes", () => {
    const state = createPokerState({
      players: players.slice(0, 2),
      mode: "chips-and-cards",
      smallBlind: 10,
      bigBlind: 20,
      deck: fixedDeck()
    });
    act(state, state.actingAccountId!, { kind: "fold" });
    expect(state.communityCards).toHaveLength(0);
    expect(state.phase).toBe("showdown");
    expect(() => settleAutomatically(state)).not.toThrow();
    expect(state.phase).toBe("complete");
    expect(state.pots).toHaveLength(0);
  });

  it("runs out every board phase on durable three-second deadlines when nobody can act", () => {
    const state = createPokerState({
      players: [
        { accountId: "alice", position: 0, stack: 10 },
        { accountId: "bob", position: 1, stack: 20 }
      ],
      mode: "chips-and-cards",
      smallBlind: 10,
      bigBlind: 20,
      deck: fixedDeck(),
      now: 1_000
    });
    expect(state.actingAccountId).toBeNull();
    expect(state.advanceDeadline).toBe(4_000);

    advancePhase(state, 4_000);
    expect(state.phase).toBe("flop");
    expect(state.communityCards).toHaveLength(3);
    expect(state.advanceDeadline).toBe(7_000);

    advancePhase(state, 7_000);
    expect(state.phase).toBe("turn");
    expect(state.advanceDeadline).toBe(10_000);

    advancePhase(state, 10_000);
    expect(state.phase).toBe("river");
    expect(state.advanceDeadline).toBe(13_000);

    advancePhase(state, 13_000);
    expect(state.phase).toBe("showdown");
    expect(state.communityCards).toHaveLength(5);
    expect(state.advanceDeadline).toBe(16_000);
  });

  it("force-folds a removed acting player and hands action to the next eligible seat", () => {
    const state = createPokerState({
      players,
      mode: "chips-only",
      smallBlind: 10,
      bigBlind: 20,
      deck: []
    });
    expect(state.actingAccountId).toBe("alice");
    forceFold(state, "alice", 1_000);
    expect(state.players.find((player) => player.accountId === "alice")?.folded).toBe(true);
    expect(state.actingAccountId).toBe("bob");
    expect(state.lastAction).toMatchObject({
      accountId: "alice",
      kind: "forced-fold",
      reversible: false
    });
    expect(state.undoSnapshot).toBeUndefined();
  });

  it("does not reopen raising for a player who already acted before a short all-in", () => {
    const state = createPokerState({
      players: [
        { accountId: "alice", position: 0, stack: 1_000 },
        { accountId: "bob", position: 1, stack: 30 },
        { accountId: "cara", position: 2, stack: 1_000 }
      ],
      mode: "chips-only",
      smallBlind: 10,
      bigBlind: 20,
      deck: []
    });
    act(state, "alice", { kind: "call" });
    act(state, "bob", { kind: "all-in" });
    act(state, "cara", { kind: "call" });

    expect(state.actingAccountId).toBe("alice");
    expect(legalActions(state, "alice")).toMatchObject({
      callAmount: 10,
      canRaise: false,
      canAllIn: false
    });
    expect(() =>
      act(state, "alice", { kind: "raise", amount: 60 })
    ).toThrowError("RAISE_NOT_REOPENED");
  });

  it("reopens raising after cumulative short all-ins equal a full raise", () => {
    const state = createPokerState({
      players: [
        { accountId: "alice", position: 0, stack: 1_000 },
        { accountId: "bob", position: 1, stack: 30 },
        { accountId: "cara", position: 2, stack: 40 },
        { accountId: "dan", position: 3, stack: 1_000 }
      ],
      mode: "chips-only",
      smallBlind: 10,
      bigBlind: 20,
      deck: []
    });
    act(state, "dan", { kind: "call" });
    act(state, "alice", { kind: "call" });
    act(state, "bob", { kind: "all-in" });
    expect(state.raiseLockedAccountIds).toEqual(
      expect.arrayContaining(["dan", "alice"])
    );
    act(state, "cara", { kind: "all-in" });

    expect(state.actingAccountId).toBe("dan");
    expect(legalActions(state, "dan")).toMatchObject({
      callAmount: 20,
      minimumRaiseTo: 60,
      canRaise: true
    });
    expect(state.raiseLockedAccountIds).not.toContain("dan");
    expect(state.raiseLockedAccountIds).not.toContain("alice");
  });

  it("evaluates and distributes automatic main and side pots independently", () => {
    const state = createPokerState({
      players,
      mode: "chips-and-cards",
      smallBlind: 10,
      bigBlind: 20,
      deck: fixedDeck()
    });
    state.phase = "showdown";
    state.communityCards = cards("2C 3D 4H 9S KC");
    state.holeCards = {
      alice: cards("AS AD"),
      bob: cards("QS QD"),
      cara: cards("5S 6S")
    };
    state.players.forEach((player) => {
      player.stack = 0;
      player.roundBet = 0;
      player.totalBet = 0;
    });
    state.pots = [
      { amount: 300, eligibleAccountIds: ["alice", "bob", "cara"] },
      { amount: 400, eligibleAccountIds: ["alice", "bob"] }
    ];

    settleAutomatically(state);
    expect(state.players.find((player) => player.accountId === "cara")?.stack).toBe(300);
    expect(state.players.find((player) => player.accountId === "alice")?.stack).toBe(400);
    expect(state.players.find((player) => player.accountId === "bob")?.stack).toBe(0);
  });

  it("accepts ten seats and rejects a table larger than the product limit", () => {
    const tenPlayers = Array.from({ length: 10 }, (_, position) => ({
      accountId: `player-${position}`,
      position,
      stack: 1_000
    }));
    expect(
      createPokerState({
        players: tenPlayers,
        mode: "chips-only",
        smallBlind: 10,
        bigBlind: 20,
        deck: []
      }).players
    ).toHaveLength(10);
    expect(() =>
      createPokerState({
        players: [
          ...tenPlayers,
          { accountId: "player-10", position: 10, stack: 1_000 }
        ],
        mode: "chips-only",
        smallBlind: 10,
        bigBlind: 20,
        deck: []
      })
    ).toThrowError("INVALID_PLAYER_COUNT");
  });

  it("ranks standard hands deterministically", () => {
    const straightFlush = cards("AS KS QS JS TS 2D 3C");
    const quads = cards("AH AD AC AS KD 2C 3D");
    const fullHouse = cards("KH KD KC 2S 2D 3C 4H");
    expect(evaluateSeven(straightFlush)).toBeGreaterThan(evaluateSeven(quads));
    expect(evaluateSeven(quads)).toBeGreaterThan(evaluateSeven(fullHouse));
    expect(handCategoryFromScore(evaluateSeven(straightFlush))).toBe("straight-flush");
    expect(handCategoryFromScore(evaluateSeven(quads))).toBe("four-of-a-kind");
    expect(handCategoryFromScore(evaluateSeven(fullHouse))).toBe("full-house");
  });
});

function fixedDeck(): Card[] {
  return cards(
    "AS KH QD JC TS 9H 8D 7C 6S 5H 4D 3C 2S AH KD QC JS TH 9D 8C 7S 6H 5D 4C 3S 2H AD KC QH JD TC 9S 8H 7D 6C 5S 4H 3D 2C AC KS QD JH TD 9C 8S 7H"
  );
}

function cards(input: string): Card[] {
  const suitNames = { C: "clubs", D: "diamonds", H: "hearts", S: "spades" } as const;
  return input.split(" ").map((token) => ({
    rank: token[0]!,
    suit: suitNames[token[1] as keyof typeof suitNames]
  }));
}
