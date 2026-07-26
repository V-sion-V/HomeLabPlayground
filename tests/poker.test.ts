import { describe, expect, it } from "vitest";
import type { Card } from "@party/contracts";
import {
  act,
  advancePhase,
  calculatePots,
  createPokerState,
  evaluateSeven,
  legalActions,
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

  it("manual mode validates winners, splits odd chips, and reverses settlement", () => {
    const state = createPokerState({
      players,
      mode: "chips-only",
      smallBlind: 10,
      bigBlind: 20,
      deck: []
    });
    state.pots = [{ amount: 101, eligibleAccountIds: ["alice", "bob"] }];
    const before = state.players.map((player) => player.stack);
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

  it("ranks standard hands deterministically", () => {
    const straightFlush = cards("AS KS QS JS TS 2D 3C");
    const quads = cards("AH AD AC AS KD 2C 3D");
    const fullHouse = cards("KH KD KC 2S 2D 3C 4H");
    expect(evaluateSeven(straightFlush)).toBeGreaterThan(evaluateSeven(quads));
    expect(evaluateSeven(quads)).toBeGreaterThan(evaluateSeven(fullHouse));
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
