import { describe, expect, it } from "vitest";
import { PlatformDomain, initialSnapshot } from "@party/domain";
import { PlatformStore } from "@party/persistence";
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
});
