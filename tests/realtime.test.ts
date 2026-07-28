import { describe, expect, it } from "vitest";
import { PlatformDomain, initialSnapshot } from "@party/domain";
import { act, createPokerState } from "@party/poker";
import { defaultRoomConfig } from "@party/test-support";

describe("role projections and realtime concurrency", () => {
  it("sends each player only their cards and sends displays no private cards", () => {
    const domain = new PlatformDomain(initialSnapshot());
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const cara = domain.enterAccount("Cara");
    const room = domain.createRoom(alice.id, "Cards", defaultRoomConfig);
    domain.joinRoom(room.id, alice.id, 2_000);
    domain.joinRoom(room.id, bob.id, 2_000);
    domain.startRoom(room.id, alice.id);
    room.poker = createPokerState({
      players: room.seats.map((seat) => ({
        accountId: seat.accountId,
        position: seat.position,
        stack: seat.tableChips
      })),
      mode: "chips-and-cards",
      smallBlind: 50,
      bigBlind: 100,
      deck: deterministicDeck()
    });
    domain.joinRoom(room.id, cara.id, 2_000);

    const aliceProjection = domain.projectRoom(room.id, { accountId: alice.id });
    const bobProjection = domain.projectRoom(room.id, { accountId: bob.id });
    const caraProjection = domain.projectRoom(room.id, { accountId: cara.id });
    const displayProjection = domain.projectRoom(room.id, { display: true });
    expect(aliceProjection.viewerRole).toBe("participant");
    expect(caraProjection.viewerRole).toBe("spectator");
    expect(aliceProjection.ownHoleCards).toHaveLength(2);
    expect(bobProjection.ownHoleCards).toHaveLength(2);
    expect(aliceProjection.ownHoleCards).not.toEqual(bobProjection.ownHoleCards);
    expect(displayProjection.ownHoleCards).toBeUndefined();
    expect(caraProjection.ownHoleCards).toBeUndefined();
    expect(JSON.stringify(caraProjection)).not.toContain("holeCards");
    expect(JSON.stringify(displayProjection)).not.toContain("holeCards");
    expect(displayProjection.communityCards).toHaveLength(5);
  });

  it("omits all community-card slots in chips-only mode", () => {
    const domain = new PlatformDomain(initialSnapshot());
    const alice = domain.enterAccount("Alice");
    const room = domain.createRoom(alice.id, "Physical cards", {
      ...defaultRoomConfig,
      mode: "chips-only"
    });
    domain.joinRoom(room.id, alice.id, 2_000);
    room.poker = createPokerState({
      players: [
        { accountId: alice.id, position: 0, stack: 2_000 },
        { accountId: "offline-opponent", position: 1, stack: 2_000 }
      ],
      mode: "chips-only",
      smallBlind: 50,
      bigBlind: 100,
      deck: []
    });
    const projection = domain.projectRoom(room.id, { display: true });
    expect(projection.communityCards).toBeUndefined();
    expect(JSON.stringify(projection)).not.toContain("hidden");
  });

  it("projects deleted players only through anonymous public history", () => {
    const domain = new PlatformDomain(initialSnapshot(), () => 1_000);
    const alice = domain.enterAccount("Alice", "🦊");
    const bob = domain.enterAccount("Bob", "🐼");
    domain.recordHandResult(
      "closed-room",
      1,
      "chips-and-cards",
      [{ accountId: alice.id, amount: 100 }],
      "settled",
      [alice.id, bob.id],
      {
        chipDeltas: [
          { accountId: alice.id, amount: 100, endingChips: 2_100 },
          { accountId: bob.id, amount: -100, endingChips: 1_900 }
        ],
        showdown: {
          communityCards: deterministicDeck().slice(0, 5),
          players: [
            {
              accountId: alice.id,
              cards: deterministicDeck().slice(5, 7),
              handCategory: "one-pair",
              winner: true
            }
          ]
        }
      }
    );
    domain.startSeason("Next", 10_000);
    domain.deleteAccount(alice.id, bob.id);

    const lobby = domain.lobbyProjection(bob.id);
    const encoded = JSON.stringify(lobby);
    expect(encoded).not.toContain(alice.id);
    expect(encoded).not.toContain("Alice");
    expect(encoded).not.toContain("retiredIdentities");
    expect(lobby.historicalSeasons[0]?.entries[0]).toMatchObject({
      anonymized: true,
      anonymousNumber: 1
    });
  });

  it("accepts only the first command against one poker version", () => {
    const state = createPokerState({
      players: [
        { accountId: "alice", position: 0, stack: 1_000 },
        { accountId: "bob", position: 1, stack: 1_000 }
      ],
      mode: "chips-only",
      smallBlind: 10,
      bigBlind: 20,
      deck: []
    });
    const actor = state.actingAccountId!;
    act(state, actor, { kind: "call" }, 0);
    expect(() => act(state, state.actingAccountId!, { kind: "check" }, 0)).toThrowError(
      "STALE_VERSION"
    );
  });
});

function deterministicDeck() {
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const suits = ["clubs", "diamonds", "hearts", "spades"] as const;
  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
}
