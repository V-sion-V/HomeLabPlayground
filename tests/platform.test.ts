import { describe, expect, it } from "vitest";
import type { PokerRoom } from "@party/contracts";
import { DEFAULT_DENOMINATIONS, fallbackAvatar } from "@party/contracts";
import { PlatformDomain, initialSnapshot } from "@party/domain";
import { PlatformStore } from "@party/persistence";
import {
  confirmHandStart,
  createPokerState,
  postBlind
} from "@party/poker";
import {
  command,
  defaultRoomConfig,
  requirePokerProjection,
  requirePokerRoom,
  temporaryDatabase
} from "@party/test-support";

function completePokerHandStart(
  domain: PlatformDomain,
  room: PokerRoom
): void {
  const poker = room.poker;
  if (!poker) throw new Error("Poker state is required");
  for (const accountId of [
    poker.smallBlindAccountId,
    poker.bigBlindAccountId
  ]) {
    const amount = postBlind(poker, accountId, poker.version, 1_000);
    domain.recordPokerMovement(
      room.id,
      accountId,
      amount,
      "table-to-pot",
      "blind",
      poker.handNumber
    );
  }
  for (const player of poker.players) {
    confirmHandStart(poker, player.accountId, poker.version, 1_000);
  }
}

describe("platform domain", () => {
  it("splits username lookup, existing entry, and create-only registration", () => {
    const domain = new PlatformDomain(initialSnapshot());
    expect(domain.lookupUsername("  Alice  ")).toMatchObject({
      username: "Alice",
      normalizedUsername: "alice",
      exists: false,
      version: 0
    });
    expect(Object.keys(domain.state.accounts)).toHaveLength(0);
    expect(() => domain.enterExistingAccount("Alice")).toThrowError(
      "ACCOUNT_NOT_FOUND"
    );
    const first = domain.registerAccount("  Alice  ", "🦊", "en", "light");
    expect(first).toMatchObject({
      username: "Alice",
      normalizedUsername: "alice",
      language: "en",
      theme: "light",
      volume: 100
    });
    expect(domain.lookupUsername("alice").exists).toBe(true);
    expect(domain.enterExistingAccount("ALICE").id).toBe(first.id);
    expect(() =>
      domain.registerAccount("alice", "🐼", "zh-CN", "dark")
    ).toThrowError("USERNAME_TAKEN");
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

  it("supports signed season scores and poker overdraft while keeping game assets nonnegative", () => {
    const domain = new PlatformDomain(initialSnapshot(), () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    domain.startSeason("Debt season", -100);
    domain.recordHandResult(
      "signed-result",
      1,
      "chips-only",
      [],
      "settled",
      [alice.id, bob.id]
    );
    expect(
      domain.currentLeaderboard().map(({ username, score }) => ({
        username,
        score
      }))
    ).toEqual([
      { username: "Alice", score: -100 },
      { username: "Bob", score: -100 }
    ]);

    const room = domain.createRoom(alice.id, "Overdraft", defaultRoomConfig);
    domain.joinRoom(room.id, alice.id, 2_000);
    expect(domain.state.seasonAssets[alice.id]?.score).toBe(-2_100);
    expect(room.seats[0]?.tableChips).toBe(2_000);
    domain.topUp(room.id, alice.id, 1_000);
    expect(domain.state.seasonAssets[alice.id]?.score).toBe(-3_100);
    expect(room.seats[0]?.tableChips).toBe(3_000);
    domain.validateInvariants();

    domain.closeRoom(room.id);
    expect(domain.state.seasonAssets[alice.id]?.score).toBe(-100);
    domain.deleteAccounts([alice.id]);
    expect(
      domain.state.ledger.some(
        (line) =>
          line.accountId === alice.id &&
          line.source === "liability-retirement" &&
          line.destination === `account:${alice.id}` &&
          line.amount === 100
      )
    ).toBe(true);
    domain.validateInvariants();
    expect(() =>
      domain.startSeason("Unsafe", Number.MAX_SAFE_INTEGER + 1)
    ).toThrowError("INVALID_BASE_SCORE");
  });

  it("rolls back a command whose signed aggregate would overflow the safe-integer range", () => {
    const store = new PlatformStore(temporaryDatabase());
    const season = store.execute(
      command(0, "test.start-season", {}, "platform"),
      (domain) => domain.startSeason("Maximum", Number.MAX_SAFE_INTEGER)
    );
    expect(season.status).toBe("accepted");
    const first = store.execute(
      command(season.version, "test.register-first", {}, "platform"),
      (domain) =>
        domain.registerAccount("Alice", "🦊", "zh-CN", "dark")
    );
    expect(first.status).toBe("accepted");
    const before = structuredClone(store.load());
    const overflow = store.execute(
      command(first.version, "test.register-second", {}, "platform"),
      (domain) =>
        domain.registerAccount("Bob", "🐼", "zh-CN", "dark")
    );
    expect(overflow).toMatchObject({
      status: "rejected",
      code: "SAFE_INTEGER_OVERFLOW",
      version: first.version
    });
    expect(store.load()).toEqual(before);
    store.close();
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

    const result = domain.deleteAccounts([alice.id, alice.id]);
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
    expect(domain.deleteAccounts([replacement.id, bob.id])).toMatchObject({
      deletedIds: [bob.id, replacement.id].sort(),
      protectedIds: [],
      selfDeleted: false,
      noOp: false
    });
    expect(Object.keys(domain.state.accounts)).toEqual([]);
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
      domain.deleteHistoricalSeasons([currentSeasonId])
    ).toThrowError("CURRENT_SEASON_PROTECTED");
    domain.deleteHistoricalSeasons([firstSeasonId]);
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

    const deleted = domain.deleteHistoricalSeasons([secondSeasonId]);
    expect(deleted.deletedIds).toEqual([secondSeasonId]);
    expect(deleted.protectedIds).toEqual([currentSeasonId]);
    expect(domain.state.seasons).toHaveLength(1);
    expect(domain.state.historicalSeasons).toEqual([]);
    expect(() => domain.deleteHistoricalSeasons([])).toThrowError(
      "EMPTY_SELECTION"
    );
    domain.validateInvariants();
  });

  it("keeps account preferences out of administrative and public account summaries", () => {
    const domain = new PlatformDomain(initialSnapshot());
    const alice = domain.registerAccount("Alice", "🦊", "en", "light");
    domain.updateProfile(alice.id, "Alice", "🦊", "en", "light", 37);

    expect(domain.adminProjection()).toMatchObject({
      version: 0,
      accounts: [{ id: alice.id, username: "Alice", avatar: "🦊" }],
      settings: {
        defaultLanguage: "zh-CN",
        defaultTheme: "dark"
      }
    });
    expect(Object.keys(domain.adminProjection().accounts[0]!).sort()).toEqual([
      "avatar",
      "id",
      "username"
    ]);
    expect(Object.keys(domain.lobbyProjection().accounts[0]!).sort()).toEqual([
      "avatar",
      "id",
      "username"
    ]);
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

  it("normalizes an old paused hand without replaying its start and closes it safely", () => {
    const source = new PlatformDomain(initialSnapshot(), () => 1_000);
    const alice = source.enterAccount("Alice");
    const bob = source.enterAccount("Bob");
    const room = source.createRoom(alice.id, "Legacy pause", defaultRoomConfig);
    source.joinRoom(room.id, alice.id, 2_000);
    source.joinRoom(room.id, bob.id, 2_000);
    source.startRoom(room.id, alice.id);
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
    completePokerHandStart(source, room);
    source.pauseRoom(room.id, alice.id);
    const cardsBefore = structuredClone(room.poker.holeCards);
    const stacksBefore = room.poker.players.map((player) => ({
      accountId: player.accountId,
      stack: player.stack,
      totalBet: player.totalBet
    }));
    const blindLedgerBefore = source.state.ledger.filter(
      (line) => line.reason === "blind"
    ).length;
    delete (
      room.poker as {
        smallBlindAccountId?: string;
      }
    ).smallBlindAccountId;
    delete (
      room.poker as {
        bigBlindAccountId?: string;
      }
    ).bigBlindAccountId;
    delete (
      room.poker as {
        blindPostedAccountIds?: string[];
      }
    ).blindPostedAccountIds;
    delete (
      room.poker as {
        handStartConfirmedAccountIds?: string[];
      }
    ).handStartConfirmedAccountIds;

    const recovered = new PlatformDomain(
      structuredClone(source.state),
      () => 2_000
    );
    const recoveredRoom = requirePokerRoom(recovered.state.rooms[room.id]);
    expect(recoveredRoom.status).toBe("paused");
    expect(recoveredRoom.poker?.phase).toBe("preflop");
    expect(recoveredRoom.poker?.actingAccountId).toBe(alice.id);
    expect(recoveredRoom.poker?.holeCards).toEqual(cardsBefore);
    expect(
      recoveredRoom.poker?.players.map((player) => ({
        accountId: player.accountId,
        stack: player.stack,
        totalBet: player.totalBet
      }))
    ).toEqual(stacksBefore);
    expect(
      recovered.state.ledger.filter((line) => line.reason === "blind")
    ).toHaveLength(blindLedgerBefore);

    recovered.closeRoom(room.id);
    expect(recovered.state.rooms[room.id]).toBeUndefined();
    expect(recovered.state.seasonAssets[alice.id]?.score).toBe(10_000);
    expect(recovered.state.seasonAssets[bob.id]?.score).toBe(10_000);
    recovered.validateInvariants();
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
    completePokerHandStart(domain, room);

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
    expect(() =>
      domain.updateProfile(alice.id, "Alice", "🦊", "en", "light", 50.5)
    ).toThrowError("INVALID_VOLUME");
    expect(domain.state.accounts[alice.id]).toMatchObject({
      username: "Alice",
      language: "zh-CN",
      theme: "dark",
      volume: 100
    });
    domain.updateProfile(alice.id, "Alice", "🦊", "en", "light", 0);
    expect(domain.state.accounts[alice.id]).toMatchObject({
      language: "en",
      theme: "light",
      volume: 0
    });
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
    expect(
      requirePokerProjection(
        domain.projectRoom(room.id, { display: true })
      ).effectiveDenominations
    ).toEqual(DEFAULT_DENOMINATIONS);
    room.poker.phase = "complete";
    expect(
      requirePokerProjection(
        domain.projectRoom(room.id, { display: true })
      ).effectiveDenominations
    ).toEqual([1, 5, 100]);
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
    const projection = requirePokerProjection(
      domain.projectRoom(room.id, { accountId: cara.id })
    );
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

    const afterLeave = requirePokerProjection(
      domain.projectRoom(room.id, { accountId: alice.id })
    );
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
    const afterRejoin = requirePokerProjection(
      domain.projectRoom(room.id, { accountId: alice.id })
    );
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

  it("rolls back a blind and its ledger together after a persistence fault", () => {
    const filename = temporaryDatabase();
    const store = new PlatformStore(filename);
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const room = domain.createRoom(alice.id, "Atomic blind", defaultRoomConfig);
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
    store.save(state);
    const envelope = command(
      0,
      "poker.blind.post",
      {
        accountId: bob.id,
        roomId: room.id,
        pokerVersion: 0
      },
      room.id
    );

    expect(() =>
      store.execute(envelope, (transactionDomain) => {
        const transactionRoom = requirePokerRoom(
          transactionDomain.state.rooms[room.id]
        );
        const poker = transactionRoom.poker!;
        const amount = postBlind(
          poker,
          poker.bigBlindAccountId,
          poker.version,
          1_000
        );
        transactionDomain.recordPokerMovement(
          room.id,
          poker.bigBlindAccountId,
          amount,
          "table-to-pot",
          "blind",
          poker.handNumber
        );
        throw new Error("fault after blind and ledger");
      })
    ).toThrowError("fault after blind and ledger");

    let persisted = store.load();
    let persistedPoker = requirePokerRoom(persisted.rooms[room.id]).poker!;
    expect(persisted.version).toBe(0);
    expect(persistedPoker.version).toBe(0);
    expect(persistedPoker.blindPostedAccountIds).toEqual([]);
    expect(persistedPoker.players.map((player) => player.stack)).toEqual([
      2_000,
      2_000
    ]);
    expect(persisted.ledger.some((line) => line.reason === "blind")).toBe(false);

    const accepted = store.execute(envelope, (transactionDomain) => {
      const transactionRoom = requirePokerRoom(
        transactionDomain.state.rooms[room.id]
      );
      const poker = transactionRoom.poker!;
      const amount = postBlind(
        poker,
        poker.bigBlindAccountId,
        poker.version,
        1_000
      );
      transactionDomain.recordPokerMovement(
        room.id,
        poker.bigBlindAccountId,
        amount,
        "table-to-pot",
        "blind",
        poker.handNumber
      );
      return { amount };
    });
    expect(accepted).toMatchObject({
      status: "accepted",
      data: { amount: 100 }
    });
    expect(
      store.execute(envelope, () => {
        throw new Error("replay must not execute");
      }).status
    ).toBe("replayed");
    persisted = store.load();
    persistedPoker = requirePokerRoom(persisted.rooms[room.id]).poker!;
    expect(persistedPoker.blindPostedAccountIds).toEqual([bob.id]);
    expect(
      persisted.ledger.filter(
        (line) =>
          line.reason === "blind" &&
          line.source === `table:${room.id}:${bob.id}`
      )
    ).toHaveLength(1);
    new PlatformDomain(persisted).validateInvariants();
    store.close();
  });

  it("preserves partial hand-start cards, blind, and confirmations across restart", () => {
    const filename = temporaryDatabase();
    const store = new PlatformStore(filename);
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const cara = domain.enterAccount("Cara");
    domain.acquireLease(alice.id);
    domain.acquireLease(bob.id);
    domain.acquireLease(cara.id);
    const room = domain.createRoom(alice.id, "Restart opening", defaultRoomConfig);
    domain.joinRoom(room.id, alice.id, 2_000);
    domain.joinRoom(room.id, bob.id, 2_000);
    domain.joinRoom(room.id, cara.id, 2_000);
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
    const blindAmount = postBlind(
      room.poker,
      bob.id,
      room.poker.version,
      1_000
    );
    domain.recordPokerMovement(
      room.id,
      bob.id,
      blindAmount,
      "table-to-pot",
      "blind",
      room.poker.handNumber
    );
    confirmHandStart(room.poker, alice.id, room.poker.version, 1_000);
    const cardsBefore = structuredClone(room.poker.holeCards);
    const deckBefore = structuredClone(room.poker.deck);
    store.save(state);
    store.close();

    const reopened = new PlatformStore(filename);
    const recovered = reopened.recoverAfterRestart();
    const recoveredRoom = requirePokerRoom(recovered.rooms[room.id]);
    expect(recoveredRoom.poker).toMatchObject({
      phase: "blinds",
      actingAccountId: null,
      blindPostedAccountIds: [bob.id],
      handStartConfirmedAccountIds: [alice.id],
      version: 2
    });
    expect(recoveredRoom.poker?.holeCards).toEqual(cardsBefore);
    expect(recoveredRoom.poker?.deck).toEqual(deckBefore);
    expect(
      requirePokerProjection(
        new PlatformDomain(recovered).projectRoom(room.id, { display: true })
      ).pendingHandStartAccountIds
    ).toEqual([bob.id, cara.id]);
    expect(recoveredRoom.seats.every((seat) => !seat.connected)).toBe(true);
    expect(recovered.leases).toEqual({});
    expect(
      recovered.ledger.filter(
        (line) =>
          line.reason === "blind" &&
          line.source === `table:${room.id}:${bob.id}`
      )
    ).toHaveLength(1);
    new PlatformDomain(recovered).validateInvariants();
    reopened.close();
  });

  it("normalizes legacy snapshots and marks every persisted player disconnected on restart", () => {
    const filename = temporaryDatabase();
    const store = new PlatformStore(filename);
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const aliceLease = domain.acquireLease(alice.id);
    domain.acquireLease(bob.id);
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
    state.accounts[bob.id]!.language = "en";
    state.accounts[bob.id]!.theme = "light";
    state.accounts[bob.id]!.volume = 42;
    state.settings.defaultLanguage = "en";
    delete (
      state.settings as {
        defaultTheme?: string;
      }
    ).defaultTheme;
    delete (
      state.accounts[alice.id] as {
        language?: string;
      }
    ).language;
    delete (
      state.accounts[alice.id] as {
        theme?: string;
      }
    ).theme;
    delete (
      state.accounts[alice.id] as {
        volume?: number;
      }
    ).volume;
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
      room.poker as {
        smallBlindAccountId?: string;
      }
    ).smallBlindAccountId;
    delete (
      room.poker as {
        bigBlindAccountId?: string;
      }
    ).bigBlindAccountId;
    delete (
      room.poker as {
        blindPostedAccountIds?: string[];
      }
    ).blindPostedAccountIds;
    delete (
      room.poker as {
        handStartConfirmedAccountIds?: string[];
      }
    ).handStartConfirmedAccountIds;
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
    const recoveredRoom = requirePokerRoom(recovered.rooms[room.id]);
    expect(recovered.version).toBe(1);
    expect(recovered.rooms[room.id]?.createdAt).toBe(0);
    expect(recovered.rooms[room.id]?.seats.every((seat) => !seat.connected)).toBe(true);
    expect(recovered.leases).toEqual({});
    expect(() =>
      new PlatformDomain(recovered).assertLease(alice.id, aliceLease)
    ).toThrowError("STALE_CONNECTION");
    expect(recovered.rooms[room.id]?.hostDisconnectDeadline).toBeTypeOf("number");
    expect(recovered.handResults[0]?.outcome).toBe("settled");
    expect(recovered.handResults[0]?.participantAccountIds).toEqual([alice.id]);
    expect(recoveredRoom.seats[0]?.buyIn).toBe(2_000);
    expect(recoveredRoom.seats[0]?.frozenLeaderboardScore).toBe(10_000);
    expect(recovered.settings.poker.suitColorPreset).toBe("standard");
    expect(recovered.settings.defaultTheme).toBe("dark");
    expect(recovered.accounts[alice.id]).toMatchObject({
      language: "en",
      theme: "dark",
      volume: 100
    });
    expect(recovered.accounts[bob.id]).toMatchObject({
      language: "en",
      theme: "light",
      volume: 42
    });
    expect(recovered.settings.poker.denominations).toEqual(DEFAULT_DENOMINATIONS);
    expect(recoveredRoom.poker?.denominations).toEqual(
      DEFAULT_DENOMINATIONS
    );
    expect(recoveredRoom.poker?.departedAccountIds).toEqual([]);
    expect(recoveredRoom.poker?.smallBlindAccountId).toBe(alice.id);
    expect(recoveredRoom.poker?.bigBlindAccountId).toBe(bob.id);
    expect(recoveredRoom.poker?.blindPostedAccountIds).toEqual([
      alice.id,
      bob.id
    ]);
    expect(recoveredRoom.poker?.handStartConfirmedAccountIds).toEqual([
      alice.id,
      bob.id
    ]);
    expect(recovered.retiredIdentities).toEqual({});
    expect(recovered.rooms[room.id]?.waitingReadyAccountIds).toEqual([]);
    expect(recoveredRoom.poker?.readyAccountIds).toEqual([]);
    expect(recoveredRoom.poker?.advanceDeadline).toBeUndefined();
    expect(recovered.accounts[alice.id]?.avatar).toBe(fallbackAvatar);
    expect(recovered.historicalSeasons[0]?.entries[0]?.avatar).toBe(
      "legacy-avatar"
    );

    const recoveredAgain = store.recoverAfterRestart();
    expect(recoveredAgain.version).toBe(1);
    store.close();
  });
});
