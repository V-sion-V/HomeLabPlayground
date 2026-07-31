import { describe, expect, it } from "vitest";
import { PlatformDomain, initialSnapshot } from "@party/domain";
import {
  createPokerState,
  postBlind
} from "@party/poker";
import {
  currentAvalonLeader,
  currentAvalonMissionRule
} from "@party/avalon";
import {
  defaultAvalonRoomConfig,
  defaultRoomConfig,
  requireAvalonProjection,
  requirePokerProjection
} from "@party/test-support";

describe("role projections and realtime concurrency", () => {
  it("isolates active Avalon roles, knowledge, votes, and observers", () => {
    const domain = new PlatformDomain(initialSnapshot());
    const accounts = Array.from({ length: 6 }, (_, index) =>
      domain.enterAccount(`Avalon viewer ${index + 1}`)
    );
    const room = domain.createAvalonRoom(
      accounts[0]!.id,
      "Projection Camelot",
      defaultAvalonRoomConfig
    );
    for (const account of accounts.slice(1, 5)) {
      domain.joinAvalonRoom(room.id, account.id);
      domain.setAvalonReady(room.id, account.id, true);
    }
    domain.startAvalonGame(room.id, accounts[0]!.id, {
      confirmUnready: false,
      randomInt: () => 0
    });
    domain.joinAvalonRoom(room.id, accounts[5]!.id);

    for (const account of accounts.slice(0, 5)) {
      const projection = requireAvalonProjection(
        domain.projectRoom(room.id, { accountId: account.id })
      );
      expect(projection.viewerRole).toBe("participant");
      expect(projection.ownKnowledge?.role).toBe(
        room.avalon?.roleAssignments[account.id]
      );
      expect(JSON.stringify(projection)).not.toContain("roleAssignments");
    }
    const spectator = requireAvalonProjection(
      domain.projectRoom(room.id, { accountId: accounts[5]!.id })
    );
    const display = requireAvalonProjection(
      domain.projectRoom(room.id, { display: true })
    );
    expect(spectator.viewerRole).toBe("spectator");
    expect(spectator.ownKnowledge).toBeUndefined();
    expect(display.viewerRole).toBe("display");
    expect(display.ownKnowledge).toBeUndefined();
    expect(display.participantAccountIds).toHaveLength(5);

    for (const account of accounts.slice(0, 5)) {
      domain.confirmAvalonRole(
        room.id,
        account.id,
        room.avalon!.version
      );
    }
    const state = room.avalon!;
    const team = state.participants
      .slice(0, currentAvalonMissionRule(state).teamSize)
      .map((participant) => participant.accountId);
    domain.proposeAvalonTeam(
      room.id,
      currentAvalonLeader(state),
      team,
      state.version
    );
    domain.castAvalonVote(
      room.id,
      accounts[0]!.id,
      true,
      room.avalon!.version
    );
    const partial = requireAvalonProjection(
      domain.projectRoom(room.id, { display: true })
    );
    expect(partial.voteSubmittedAccountIds).toEqual([accounts[0]!.id]);
    expect(partial.voteHistory).toEqual([]);
    expect(JSON.stringify(partial)).not.toContain('"approve"');
    expect(JSON.stringify(partial)).not.toContain("votes");
  });

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

    const aliceProjection = requirePokerProjection(
      domain.projectRoom(room.id, { accountId: alice.id })
    );
    const bobProjection = requirePokerProjection(
      domain.projectRoom(room.id, { accountId: bob.id })
    );
    const caraProjection = requirePokerProjection(
      domain.projectRoom(room.id, { accountId: cara.id })
    );
    const displayProjection = requirePokerProjection(
      domain.projectRoom(room.id, { display: true })
    );
    expect(aliceProjection.viewerRole).toBe("participant");
    expect(caraProjection.viewerRole).toBe("spectator");
    expect(aliceProjection.ownHoleCards).toHaveLength(2);
    expect(bobProjection.ownHoleCards).toHaveLength(2);
    expect(aliceProjection.ownHoleCards).not.toEqual(bobProjection.ownHoleCards);
    expect(displayProjection.ownHoleCards).toBeUndefined();
    expect(caraProjection.ownHoleCards).toBeUndefined();
    expect(aliceProjection.pendingHandStartAccountIds).toEqual([
      alice.id,
      bob.id
    ]);
    expect(bobProjection.pendingHandStartAccountIds).toEqual(
      aliceProjection.pendingHandStartAccountIds
    );
    expect(caraProjection.pendingHandStartAccountIds).toEqual(
      aliceProjection.pendingHandStartAccountIds
    );
    expect(displayProjection.pendingHandStartAccountIds).toEqual(
      aliceProjection.pendingHandStartAccountIds
    );
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
    const projection = requirePokerProjection(
      domain.projectRoom(room.id, { display: true })
    );
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
    domain.deleteAccounts([alice.id]);

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

  it("accepts only the first hand-start command against one poker version", () => {
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
    postBlind(state, state.bigBlindAccountId, 0);
    expect(() =>
      postBlind(state, state.smallBlindAccountId, 0)
    ).toThrowError("STALE_VERSION");
    expect(state.blindPostedAccountIds).toEqual([state.bigBlindAccountId]);
    expect(
      state.players.find(
        (player) => player.accountId === state.smallBlindAccountId
      )?.stack
    ).toBe(1_000);
  });
});

function deterministicDeck() {
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const suits = ["clubs", "diamonds", "hearts", "spades"] as const;
  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
}
