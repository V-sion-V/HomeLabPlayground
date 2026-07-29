import { describe, expect, it } from "vitest";
import { DEFAULT_DENOMINATIONS, fallbackAvatar } from "@party/contracts";
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
    expect(domain.currentLeaderboard()).toEqual([]);
    domain.recordHandResult(
      room.id,
      1,
      room.config.mode,
      [],
      "settled",
      [alice.id, bob.id]
    );
    expect(
      domain.currentLeaderboard().find((entry) => entry.accountId === alice.id)
        ?.score
    ).toBe(10_000);
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
    domain.recordHandResult(
      room.id,
      1,
      room.config.mode,
      [],
      "settled",
      [alice.id]
    );
    domain.closeRoom(room.id);
    domain.startSeason("Summer", 20_000);
    domain.updateProfile(alice.id, "Alice 2", "🐼");
    expect(domain.currentSeason.name).toBe("Summer");
    expect(domain.state.seasonAssets[alice.id]?.score).toBe(20_000);
    expect(domain.state.historicalSeasons[0]?.entries[0]?.username).toBe("Alice");
  });

  it("derives current and archived leaderboards only from valid participation facts", () => {
    const domain = new PlatformDomain(initialSnapshot(), () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const cara = domain.enterAccount("Cara");
    domain.recordHandResult("room-1", 1, "chips-only", [], "void", [
      alice.id
    ]);
    expect(domain.currentLeaderboard()).toEqual([]);

    domain.recordHandResult("room-1", 2, "chips-only", [], "settled", [
      bob.id,
      cara.id
    ]);
    const reversedId = domain.state.handResults.at(-1)!.id;
    domain.reverseHandResult("room-1", 2);
    expect(domain.state.handResults.at(-1)?.id).toBe(reversedId);
    expect(domain.currentLeaderboard()).toEqual([]);

    domain.recordHandResult("room-1", 3, "chips-only", [], "settled", [
      alice.id,
      cara.id
    ]);
    expect(
      domain.currentLeaderboard().map((entry) => entry.accountId).sort()
    ).toEqual([alice.id, cara.id].sort());
    domain.startSeason("Next", 5_000);
    expect(
      domain.state.historicalSeasons[0]?.entries.map((entry) => entry.accountId).sort()
    ).toEqual([alice.id, cara.id].sort());
    expect(domain.currentLeaderboard()).toEqual([]);
  });

  it("atomically retires accounts, anonymizes retained history, and permits independent username reuse", () => {
    const domain = new PlatformDomain(initialSnapshot(), () => 2_000);
    const alice = domain.enterAccount("Alice", "🦊");
    const bob = domain.enterAccount("Bob", "🐼");
    domain.acquireLease(alice.id);
    domain.recordHandResult("room-old", 1, "chips-only", [], "settled", [
      alice.id,
      bob.id
    ], {
      chipDeltas: [
        { accountId: alice.id, amount: 0, endingChips: 10_000 },
        { accountId: bob.id, amount: 0, endingChips: 10_000 }
      ]
    });
    domain.startSeason("Current", 10_000);
    domain.recordHandResult("room-current", 1, "chips-only", [], "settled", [
      alice.id,
      bob.id
    ]);

    const result = domain.deleteAccount(alice.id, bob.id);
    expect(result).toMatchObject({
      deletedIds: [alice.id],
      selfDeleted: false,
      noOp: false
    });
    expect(domain.state.accounts[alice.id]).toBeUndefined();
    expect(domain.state.seasonAssets[alice.id]).toBeUndefined();
    expect(domain.state.leases[alice.id]).toBeUndefined();
    expect(domain.state.ledger.some((line) =>
      line.accountId === alice.id && line.destination === "asset-retirement"
    )).toBe(true);
    const anonymous = domain.state.retiredIdentities[alice.id]!;
    expect(anonymous.publicId).not.toBe(alice.id);
    expect(
      domain.state.historicalSeasons[0]?.entries.find(
        (entry) => entry.accountId === anonymous.publicId
      )
    ).toMatchObject({
      anonymized: true,
      anonymousNumber: anonymous.anonymousNumber,
      avatar: fallbackAvatar
    });
    expect(JSON.stringify(domain.state.handResults)).not.toContain(`"${alice.id}"`);
    expect(JSON.stringify(domain.lobbyProjection(bob.id))).not.toContain("Alice");
    expect(() => domain.assertLease(alice.id, "anything")).toThrowError(
      "STALE_CONNECTION"
    );
    domain.validateInvariants();

    const replacement = domain.enterAccount("Alice", "🐼");
    expect(replacement.id).not.toBe(alice.id);
    expect(domain.currentLeaderboard().some((entry) =>
      entry.accountId === replacement.id
    )).toBe(false);
    expect(
      domain.deleteOtherAccounts(bob.id)
    ).toMatchObject({
      protectedIds: [bob.id],
      selfDeleted: false
    });
    expect(Object.keys(domain.state.accounts)).toEqual([bob.id]);
    domain.validateInvariants();
  });

  it("protects the current season and deletes historical season data as one domain operation", () => {
    const domain = new PlatformDomain(initialSnapshot(), () => 3_000);
    const alice = domain.enterAccount("Alice");
    domain.recordHandResult("room-1", 1, "chips-only", [], "settled", [alice.id]);
    const firstSeasonId = domain.currentSeason.id;
    domain.startSeason("Second", 8_000);
    domain.recordHandResult("room-2", 1, "chips-only", [], "settled", [alice.id]);
    const secondSeasonId = domain.currentSeason.id;
    domain.startSeason("Third", 6_000);
    const currentSeasonId = domain.currentSeason.id;

    expect(() =>
      domain.deleteHistoricalSeason(currentSeasonId, alice.id)
    ).toThrowError("CURRENT_SEASON_PROTECTED");
    domain.deleteHistoricalSeason(firstSeasonId, alice.id);
    expect(domain.state.seasons.some((season) => season.id === firstSeasonId)).toBe(
      false
    );
    expect(
      domain.state.handResults.some((result) => result.seasonId === firstSeasonId)
    ).toBe(false);
    expect(
      domain.state.ledger.some((line) => line.seasonId === firstSeasonId)
    ).toBe(false);
    expect(domain.currentSeason.id).toBe(currentSeasonId);

    const deleted = domain.deleteAllHistoricalSeasons(alice.id);
    expect(deleted.deletedIds).toEqual([secondSeasonId]);
    expect(domain.state.seasons).toHaveLength(1);
    expect(domain.state.historicalSeasons).toEqual([]);
    expect(domain.deleteAllHistoricalSeasons(alice.id).noOp).toBe(true);
    domain.validateInvariants();
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

  it("validates configured avatars and denominations while preserving hand snapshots", () => {
    const domain = new PlatformDomain(initialSnapshot());
    expect(() => domain.enterAccount("Invalid", fallbackAvatar)).toThrowError(
      "INVALID_AVATAR"
    );
    const alice = domain.enterAccount("Alice", "🦊");
    const bob = domain.enterAccount("Bob", "🐼");
    expect(() => domain.updateProfile(alice.id, "Alice", "🙂")).toThrowError(
      "INVALID_AVATAR"
    );
    const room = domain.createRoom(alice.id, "Snapshots", defaultRoomConfig);
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
      bigBlind: room.config.bigBlind,
      denominations: DEFAULT_DENOMINATIONS
    });

    domain.updateSettings({
      ...domain.state.settings,
      poker: {
        ...domain.state.settings.poker,
        denominations: [100, 1, 5]
      }
    });
    expect(domain.state.settings.poker.denominations).toEqual([1, 5, 100]);
    expect(domain.projectRoom(room.id, { display: true }).effectiveDenominations).toEqual(
      DEFAULT_DENOMINATIONS
    );
    room.poker.phase = "complete";
    expect(domain.projectRoom(room.id, { display: true }).effectiveDenominations).toEqual([
      1,
      5,
      100
    ]);
    expect(() =>
      domain.updateSettings({
        ...domain.state.settings,
        poker: {
          ...domain.state.settings.poker,
          denominations: [5, 5]
        }
      })
    ).toThrowError("INVALID_DENOMINATIONS");
  });

  it("keeps active-hand joiners as spectators without private cards", () => {
    const domain = new PlatformDomain(initialSnapshot());
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const cara = domain.enterAccount("Cara");
    const room = domain.createRoom(alice.id, "Watch", defaultRoomConfig);
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

    domain.joinRoom(room.id, cara.id, 2_000);
    const projection = domain.projectRoom(room.id, { accountId: cara.id });
    expect(projection.viewerRole).toBe("spectator");
    expect(projection.seats.find((seat) => seat.accountId === cara.id)?.role).toBe(
      "spectator"
    );
    expect(projection.ownHoleCards).toBeUndefined();
    expect(room.poker.players.some((player) => player.accountId === cara.id)).toBe(false);
    domain.leaveRoom(room.id, cara.id);
    expect(domain.state.seasonAssets[cara.id]?.score).toBe(10_000);
    domain.validateInvariants();
  });

  it("filters departed players from live settlement projections without rewriting history", () => {
    const domain = new PlatformDomain(initialSnapshot(), () => 1_000);
    const alice = domain.enterAccount("Alice", "🦊");
    const bob = domain.enterAccount("Bob", "🐼");
    const room = domain.createRoom(alice.id, "Settlement projection", defaultRoomConfig);
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
    room.poker.phase = "complete";
    const cards = room.poker.deck.slice(0, 9);
    domain.recordHandResult(
      room.id,
      room.poker.handNumber,
      room.config.mode,
      [
        { accountId: alice.id, amount: 100 },
        { accountId: bob.id, amount: 0 }
      ],
      "settled",
      [alice.id, bob.id],
      {
        chipDeltas: [
          { accountId: alice.id, amount: 100, endingChips: 2_100 },
          { accountId: bob.id, amount: -100, endingChips: 1_900 }
        ],
        showdown: {
          communityCards: cards.slice(0, 5),
          players: [
            {
              accountId: alice.id,
              cards: cards.slice(5, 7),
              handCategory: "high-card",
              winner: true
            },
            {
              accountId: bob.id,
              cards: cards.slice(7, 9),
              handCategory: "high-card",
              winner: false
            }
          ]
        }
      }
    );

    domain.leaveRoom(room.id, bob.id);

    const durableResult = domain.state.handResults.at(-1)!;
    expect(durableResult.participantAccountIds).toEqual([alice.id, bob.id]);
    expect(durableResult.playerResults?.map((player) => player.accountId)).toEqual([
      alice.id,
      bob.id
    ]);
    expect(durableResult.showdown?.players.map((player) => player.accountId)).toEqual([
      alice.id,
      bob.id
    ]);

    const afterLeave = domain.projectRoom(room.id, { accountId: alice.id });
    expect(afterLeave.lastResult?.participantAccountIds).toEqual([alice.id]);
    expect(afterLeave.lastResult?.payouts.map((payout) => payout.accountId)).toEqual([
      alice.id
    ]);
    expect(afterLeave.lastResult?.playerResults?.map((player) => player.accountId)).toEqual([
      alice.id
    ]);
    expect(afterLeave.lastResult?.showdown?.players.map((player) => player.accountId)).toEqual([
      alice.id
    ]);

    domain.joinRoom(room.id, bob.id, 3_000);
    const afterRejoin = domain.projectRoom(room.id, { accountId: alice.id });
    expect(afterRejoin.seats.find((seat) => seat.accountId === bob.id)).toMatchObject({
      tableChips: 3_000,
      role: "member"
    });
    expect(
      afterRejoin.lastResult?.participantAccountIds.includes(bob.id)
    ).toBe(false);
    expect(
      afterRejoin.lastResult?.playerResults?.some((player) => player.accountId === bob.id)
    ).toBe(false);
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
    room.poker.phase = "complete";
    room.poker.readyAccountIds = [alice.id];
    room.poker.advanceDeadline = 9_000;
    domain.recordHandResult(room.id, 1, "chips-only", [{ accountId: alice.id, amount: 50 }]);
    state.accounts[alice.id]!.avatar = "legacy-avatar";
    state.historicalSeasons.push({
      season: {
        id: "historical-season",
        name: "Historical",
        baseScore: 10_000,
        status: "historical",
        startedAt: 0,
        endedAt: 1
      },
      entries: [
        {
          accountId: alice.id,
          username: "Alice",
          avatar: "legacy-avatar",
          score: 10_000,
          rank: 1
        }
      ]
    });
    delete (
      state.settings.poker as {
        suitColorPreset?: string;
      }
    ).suitColorPreset;
    delete (
      state.settings.poker as {
        denominations?: number[];
      }
    ).denominations;
    delete (
      room.poker as {
        denominations?: number[];
      }
    ).denominations;
    delete (
      room.poker as {
        departedAccountIds?: string[];
      }
    ).departedAccountIds;
    delete (
      state as {
        retiredIdentities?: Record<string, unknown>;
      }
    ).retiredIdentities;
    delete (
      room as {
        waitingReadyAccountIds?: string[];
      }
    ).waitingReadyAccountIds;
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
    expect(recovered.settings.poker.suitColorPreset).toBe("standard");
    expect(recovered.settings.poker.denominations).toEqual(DEFAULT_DENOMINATIONS);
    expect(recovered.rooms[room.id]?.poker?.denominations).toEqual(
      DEFAULT_DENOMINATIONS
    );
    expect(recovered.rooms[room.id]?.poker?.departedAccountIds).toEqual([]);
    expect(recovered.retiredIdentities).toEqual({});
    expect(recovered.rooms[room.id]?.waitingReadyAccountIds).toEqual([]);
    expect(recovered.rooms[room.id]?.poker?.readyAccountIds).toEqual([]);
    expect(recovered.rooms[room.id]?.poker?.advanceDeadline).toBeUndefined();
    expect(recovered.accounts[alice.id]?.avatar).toBe(fallbackAvatar);
    expect(recovered.historicalSeasons[0]?.entries[0]?.avatar).toBe(
      "legacy-avatar"
    );

    const recoveredAgain = store.recoverAfterRestart();
    expect(recoveredAgain.version).toBe(1);
    store.close();
  });
});
