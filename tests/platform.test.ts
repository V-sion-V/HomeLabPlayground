import { describe, expect, it } from "vitest";
import { PlatformDomain, initialSnapshot } from "@party/domain";
import { PlatformStore } from "@party/persistence";
import { createPokerState } from "@party/poker";
import { command, defaultRoomConfig, temporaryDatabase } from "@party/test-support";

describe("platform domain", () => {
  it("normalizes accounts, issues the season asset once, and replaces leases", () => {
    const domain = new PlatformDomain(initialSnapshot());
    const first = domain.enterAccount("  Alice  ", "🦊");
    const same = domain.enterAccount("alice", "🐼");
    expect(same.id).toBe(first.id);
    expect(domain.state.seasonAssets[first.id]?.score).toBe(10_000);
    expect(domain.state.ledger).toHaveLength(1);
    const oldLease = domain.acquireLease(first.id);
    const newLease = domain.acquireLease(first.id);
    expect(newLease).not.toBe(oldLease);
    expect(() => domain.assertLease(first.id, oldLease)).toThrowError("STALE_CONNECTION");
  });

  it("enforces room occupancy, buy-in transfer, frozen leaderboard and host transfer", () => {
    const domain = new PlatformDomain(initialSnapshot());
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const room = domain.createRoom(alice.id, "Friday", defaultRoomConfig);
    domain.joinRoom(room.id, alice.id, 2_000);
    domain.joinRoom(room.id, bob.id, 2_000);
    expect(domain.state.seasonAssets[alice.id]?.score).toBe(8_000);
    expect(domain.currentLeaderboard().find((entry) => entry.accountId === alice.id)?.score).toBe(
      10_000
    );
    expect(() => domain.createRoom(alice.id, "Other", defaultRoomConfig)).toThrowError(
      "ALREADY_IN_ROOM"
    );
    domain.transferHost(room.id, alice.id, bob.id);
    expect(room.hostAccountId).toBe(bob.id);
    domain.closeRoom(room.id);
    expect(domain.state.seasonAssets[alice.id]?.score).toBe(10_000);
    expect(domain.state.seasonAssets[alice.id]?.frozenScore).toBeNull();
  });

  it("archives immutable profiles and atomically starts a new season only without rooms", () => {
    const domain = new PlatformDomain(initialSnapshot(), () => 1_000);
    const alice = domain.enterAccount("Alice", "🦊");
    const room = domain.createRoom(alice.id, "Blocked", defaultRoomConfig);
    expect(() => domain.startSeason("Summer", 20_000)).toThrowError("ROOMS_MUST_CLOSE");
    domain.closeRoom(room.id);
    domain.startSeason("Summer", 20_000);
    domain.updateProfile(alice.id, "Alice 2", "🐼");
    expect(domain.currentSeason.name).toBe("Summer");
    expect(domain.state.seasonAssets[alice.id]?.score).toBe(20_000);
    expect(domain.state.historicalSeasons[0]?.entries[0]?.username).toBe("Alice");
  });

  it("transfers a disconnected host after the durable deadline and closes an empty-online room", () => {
    let now = 1_000;
    const domain = new PlatformDomain(initialSnapshot(now), () => now, (() => {
      let id = 0;
      return () => `id-${++id}`;
    })());
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const room = domain.createRoom(alice.id, "Timeout", {
      ...defaultRoomConfig,
      hostTransferTimeoutSeconds: 30
    });
    domain.joinRoom(room.id, alice.id, 2_000);
    domain.joinRoom(room.id, bob.id, 2_000);
    domain.disconnect(room.id, alice.id);
    expect(room.hostDisconnectDeadline).toBe(31_000);
    expect(domain.resolveHostTimeout(room.id, (ids) => ids[0]!)).toBe(room);
    now = 31_000;
    expect(domain.resolveHostTimeout(room.id, (ids) => ids[0]!)?.hostAccountId).toBe(bob.id);

    domain.disconnect(room.id, bob.id);
    now = 61_000;
    domain.resolveHostTimeout(room.id, (ids) => ids[0]!);
    expect(domain.state.rooms[room.id]).toBeUndefined();
    expect(domain.state.seasonAssets[alice.id]?.score).toBe(10_000);
    expect(domain.state.seasonAssets[bob.id]?.score).toBe(10_000);
    domain.validateInvariants();
  });

  it("freezes and restores an automatic poker deadline while the host pauses the room", () => {
    let now = 1_000;
    const domain = new PlatformDomain(initialSnapshot(now), () => now);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const room = domain.createRoom(alice.id, "Pause", defaultRoomConfig);
    domain.joinRoom(room.id, alice.id, 2_000);
    domain.joinRoom(room.id, bob.id, 2_000);
    domain.startRoom(room.id, alice.id);
    room.poker = createPokerState({
      players: room.seats.map((seat) => ({
        accountId: seat.accountId,
        position: seat.position,
        stack: seat.tableChips
      })),
      mode: room.config.mode,
      smallBlind: room.config.smallBlind,
      bigBlind: room.config.bigBlind
    });
    room.poker.advanceDeadline = 4_000;

    domain.pauseRoom(room.id, alice.id);
    expect(room.poker.advanceDeadline).toBeUndefined();
    expect(room.poker.pausedAdvanceRemainingMs).toBe(3_000);

    now = 2_000;
    domain.resumeRoom(room.id, alice.id);
    expect(room.poker.pausedAdvanceRemainingMs).toBeUndefined();
    expect(room.poker.advanceDeadline).toBe(5_000);
  });

  it("records void results and links reverse poker ledger lines to their originals", () => {
    const domain = new PlatformDomain(initialSnapshot(), () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const room = domain.createRoom(alice.id, "Evidence", defaultRoomConfig);
    domain.joinRoom(room.id, alice.id, 2_000);
    domain.joinRoom(room.id, bob.id, 2_000);
    domain.startRoom(room.id, alice.id);
    room.poker = createPokerState({
      players: room.seats.map((seat) => ({
        accountId: seat.accountId,
        position: seat.position,
        stack: seat.tableChips
      })),
      mode: room.config.mode,
      smallBlind: room.config.smallBlind,
      bigBlind: room.config.bigBlind
    });

    domain.recordPokerMovement(
      room.id,
      alice.id,
      100,
      "table-to-pot",
      "poker-call",
      1
    );
    const originalIds = domain.state.ledger
      .filter((line) => line.reason === "poker-call")
      .map((line) => line.id);
    domain.recordPokerMovement(
      room.id,
      alice.id,
      100,
      "pot-to-table",
      "poker-call-undo",
      1,
      "poker-call"
    );
    const reverseLines = domain.state.ledger.filter(
      (line) => line.reason === "poker-call-undo"
    );
    expect(reverseLines).toHaveLength(2);
    expect(reverseLines.every((line) => originalIds.includes(line.reversalOf ?? ""))).toBe(
      true
    );

    domain.closeRoom(room.id);
    expect(domain.state.handResults).toHaveLength(1);
    expect(domain.state.handResults[0]).toMatchObject({
      roomId: room.id,
      handNumber: 1,
      outcome: "void"
    });
    expect(domain.state.handResults[0]?.payouts.map((entry) => entry.amount)).toEqual([
      50,
      100
    ]);
    domain.validateInvariants();
  });
});

describe("SQLite command boundary", () => {
  it("persists state, replays commands, rejects stale versions and rolls back failures", () => {
    const filename = temporaryDatabase();
    const store = new PlatformStore(filename);
    const enter = command(0, "account.enter", { username: "Alice" });
    const accepted = store.execute(enter, (domain) => domain.enterAccount("Alice"));
    expect(accepted.status).toBe("accepted");
    const replayed = store.execute(enter, () => {
      throw new Error("must not execute");
    });
    expect(replayed.status).toBe("replayed");
    const stale = store.execute(command(0, "noop", {}), () => true);
    expect(stale.code).toBe("STALE_VERSION");
    const before = store.load();
    expect(() =>
      store.execute(command(before.version, "failure", {}), (domain) => {
        domain.enterAccount("Bob");
        throw new Error("fault injection");
      })
    ).toThrowError("fault injection");
    expect(Object.values(store.load().accounts).map((account) => account.username)).toEqual([
      "Alice"
    ]);
    store.close();

    const reopened = new PlatformStore(filename);
    expect(Object.values(reopened.load().accounts)[0]?.username).toBe("Alice");
    reopened.close();
  });

  it("restores durable scheduled actions", () => {
    const filename = temporaryDatabase();
    const store = new PlatformStore(filename);
    store.schedule("timer-1", "room-1", "host-transfer", 100, { version: 3 });
    store.close();
    const reopened = new PlatformStore(filename);
    expect(reopened.due(100)).toEqual([
      {
        id: "timer-1",
        roomId: "room-1",
        kind: "host-transfer",
        deadline: 100,
        payload: { version: 3 }
      }
    ]);
    reopened.close();
  });

  it("normalizes legacy snapshots and marks every persisted player disconnected on restart", () => {
    const filename = temporaryDatabase();
    const store = new PlatformStore(filename);
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const room = domain.createRoom(alice.id, "Restart", defaultRoomConfig);
    domain.joinRoom(room.id, alice.id, 2_000);
    domain.joinRoom(room.id, bob.id, 2_000);
    domain.recordHandResult(room.id, 1, "chips-only", [{ accountId: alice.id, amount: 50 }]);
    delete (room as unknown as { createdAt?: number }).createdAt;
    delete (
      state.handResults[0] as unknown as {
        outcome?: "settled" | "void";
      }
    ).outcome;
    delete (
      state.handResults[0] as unknown as {
        participantAccountIds?: string[];
      }
    ).participantAccountIds;
    for (const seat of room.seats) {
      delete (seat as unknown as { buyIn?: number }).buyIn;
      delete (
        seat as unknown as { frozenLeaderboardScore?: number }
      ).frozenLeaderboardScore;
    }
    store.save(state);

    const recovered = store.recoverAfterRestart();
    expect(recovered.version).toBe(1);
    expect(recovered.rooms[room.id]?.createdAt).toBe(0);
    expect(recovered.rooms[room.id]?.seats.every((seat) => !seat.connected)).toBe(true);
    expect(recovered.rooms[room.id]?.hostDisconnectDeadline).toBeTypeOf("number");
    expect(recovered.handResults[0]?.outcome).toBe("settled");
    expect(recovered.handResults[0]?.participantAccountIds).toEqual([alice.id]);
    expect(recovered.rooms[room.id]?.seats[0]?.buyIn).toBe(2_000);
    expect(recovered.rooms[room.id]?.seats[0]?.frozenLeaderboardScore).toBe(10_000);

    const recoveredAgain = store.recoverAfterRestart();
    expect(recoveredAgain.version).toBe(1);
    store.close();
  });
});
