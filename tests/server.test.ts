import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Card } from "@party/contracts";
import { buildApp, dispatch } from "../apps/server/src/app";
import { initialSnapshot, PlatformDomain } from "@party/domain";
import { PlatformStore } from "@party/persistence";
import { createPokerState } from "@party/poker";
import { defaultRoomConfig, temporaryDatabase } from "@party/test-support";

describe("server", () => {
  it("starts with a temporary database and enters an account without a password", async () => {
    const app = await buildApp({ databasePath: temporaryDatabase() });
    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);
    const response = await app.inject({
      method: "POST",
      url: "/api/enter",
      payload: { username: "小明", avatar: "🐼" }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.account.username).toBe("小明");
    expect(body.data.connectionId).toBeTypeOf("string");
    expect(JSON.stringify(body)).not.toContain("password");
    await app.close();
  });

  it("runs validated room commands, protects private projections, and persists settlement evidence", async () => {
    const databasePath = temporaryDatabase();
    const app = await buildApp({ databasePath });
    const aliceEnter = await app.inject({
      method: "POST",
      url: "/api/enter",
      payload: { username: "Alice", avatar: "🦊" }
    });
    const alice = aliceEnter.json().data;
    const bobEnter = await app.inject({
      method: "POST",
      url: "/api/enter",
      payload: { username: "Bob", avatar: "🐼" }
    });
    const bob = bobEnter.json().data;
    let version = bobEnter.json().version as number;

    const create = await sendCommand(app, {
      commandId: "command-create-room",
      connectionId: alice.connectionId,
      aggregateId: "platform",
      expectedVersion: version,
      type: "room.create",
      payload: {
        accountId: alice.account.id,
        name: "Private table",
        config: defaultRoomConfig,
        buyIn: 2_000
      }
    });
    expect(create.statusCode).toBe(200);
    const roomId = create.json().data.id as string;
    version = create.json().version;

    const missingLease = await app.inject({
      method: "GET",
      url: `/api/room/${roomId}?accountId=${alice.account.id}`
    });
    expect(missingLease.statusCode).toBe(403);

    const join = await sendCommand(app, {
      commandId: "command-join-room",
      connectionId: bob.connectionId,
      aggregateId: roomId,
      expectedVersion: version,
      type: "room.join",
      payload: { accountId: bob.account.id, roomId, buyIn: 2_000 }
    });
    expect(join.statusCode).toBe(200);
    version = join.json().version;

    const start = await sendCommand(app, {
      commandId: "command-start-room",
      connectionId: alice.connectionId,
      aggregateId: roomId,
      expectedVersion: version,
      type: "room.start",
      payload: { accountId: alice.account.id, roomId }
    });
    expect(start.statusCode).toBe(200);
    version = start.json().version;

    const duplicateStart = await sendCommand(app, {
      commandId: "command-duplicate-start",
      connectionId: alice.connectionId,
      aggregateId: roomId,
      expectedVersion: version,
      type: "room.start",
      payload: { accountId: alice.account.id, roomId }
    });
    expect(duplicateStart.statusCode).toBe(409);
    expect(duplicateStart.json().code).toBe("ROOM_ALREADY_STARTED");

    const removeConnected = await sendCommand(app, {
      commandId: "command-remove-connected",
      connectionId: alice.connectionId,
      aggregateId: roomId,
      expectedVersion: version,
      type: "room.remove",
      payload: {
        accountId: alice.account.id,
        roomId,
        targetAccountId: bob.account.id
      }
    });
    expect(removeConnected.statusCode).toBe(409);
    expect(removeConnected.json().code).toBe("PLAYER_STILL_CONNECTED");

    const privateProjection = await app.inject({
      method: "GET",
      url:
        `/api/room/${roomId}?accountId=${alice.account.id}` +
        `&connectionId=${encodeURIComponent(alice.connectionId)}`
    });
    expect(privateProjection.json().ownHoleCards).toHaveLength(2);
    const displayProjection = await app.inject({
      method: "GET",
      url: `/api/room/${roomId}?display=1`
    });
    expect(displayProjection.json().ownHoleCards).toBeUndefined();
    expect(JSON.stringify(displayProjection.json())).not.toContain("holeCards");

    const fold = await sendCommand(app, {
      commandId: "command-fold-hand",
      connectionId: alice.connectionId,
      aggregateId: roomId,
      expectedVersion: version,
      type: "poker.action",
      payload: {
        accountId: alice.account.id,
        roomId,
        pokerVersion: 0,
        action: { kind: "fold" }
      }
    });
    expect(fold.statusCode).toBe(200);
    version = fold.json().version;

    const invalid = await sendCommand(app, {
      commandId: "command-invalid-payload",
      connectionId: alice.connectionId,
      aggregateId: roomId,
      expectedVersion: version,
      type: "room.top-up",
      payload: { accountId: alice.account.id, roomId, amount: "lots" }
    });
    expect(invalid.statusCode).toBe(400);

    await new Promise((resolve) => setTimeout(resolve, 3_200));
    const settledProjection = await app.inject({
      method: "GET",
      url: `/api/room/${roomId}?display=1`
    });
    expect(settledProjection.json().lastResult).toMatchObject({
      handNumber: 1,
      outcome: "settled"
    });
    expect(settledProjection.json().lastResult.playerResults).toHaveLength(2);
    expect(
      settledProjection
        .json()
        .lastResult.playerResults.reduce(
          (sum: number, player: { chipDelta: number }) => sum + player.chipDelta,
          0
        )
    ).toBe(0);
    expect(settledProjection.json().lastResult.showdown).toBeUndefined();
    expect(settledProjection.json().phase).toBe("distribution");
    await new Promise((resolve) => setTimeout(resolve, 3_200));
    const completedProjection = await app.inject({
      method: "GET",
      url: `/api/room/${roomId}?display=1`
    });
    expect(completedProjection.json().phase).toBe("complete");
    expect(completedProjection.json().advanceDeadline).toBeUndefined();
    await app.close();

    const restartedApp = await buildApp({ databasePath });
    const restartedProjection = await restartedApp.inject({
      method: "GET",
      url: `/api/room/${roomId}?display=1`
    });
    expect(
      restartedProjection.json().seats.every((seat: { connected: boolean }) => !seat.connected)
    ).toBe(true);
    await restartedApp.close();

    const reopened = new PlatformStore(databasePath);
    const state = reopened.load();
    expect(state.rooms[roomId]?.poker?.phase).toBe("complete");
    expect(state.handResults).toHaveLength(1);
    expect(state.handResults[0]?.participantAccountIds).toEqual(
      expect.arrayContaining([alice.account.id, bob.account.id])
    );
    expect(state.ledger.some((line) => line.reason === "settlement")).toBe(true);
    new (await import("@party/domain")).PlatformDomain(state).validateInvariants();
    reopened.close();
  }, 15_000);

  it("keeps the settlement open until every seated player is funded, connected, and ready", () => {
    const databasePath = temporaryDatabase();
    const store = new PlatformStore(databasePath);
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const cara = domain.enterAccount("Cara");
    const aliceConnection = domain.acquireLease(alice.id);
    const bobConnection = domain.acquireLease(bob.id);
    const caraConnection = domain.acquireLease(cara.id);
    const room = domain.createRoom(alice.id, "Stacks", defaultRoomConfig);
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
    room.poker.phase = "complete";
    room.poker.pots = [];
    room.poker.actingAccountId = null;
    delete room.poker.advanceDeadline;
    for (const player of room.poker.players) {
      player.stack = player.accountId === alice.id ? 6_000 : 0;
      player.roundBet = 0;
      player.totalBet = 0;
      player.allIn = player.stack === 0;
    }
    store.save(state);

    const aliceReady = dispatch(store, {
      commandId: "alice-ready",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 0,
      type: "poker.ready",
      payload: {
        accountId: alice.id,
        roomId: room.id,
        pokerVersion: 0
      }
    });
    expect(aliceReady.status).toBe("accepted");
    expect(store.load().rooms[room.id]?.poker?.phase).toBe("complete");

    const topUp = dispatch(store, {
      commandId: "top-up-funded-player",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 1,
      type: "room.top-up",
      payload: { accountId: bob.id, roomId: room.id, amount: 1_000 }
    });
    expect(topUp.status).toBe("accepted");

    const bobReady = dispatch(store, {
      commandId: "bob-ready",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 2,
      type: "poker.ready",
      payload: {
        accountId: bob.id,
        roomId: room.id,
        pokerVersion: 1
      }
    });
    expect(bobReady.status).toBe("accepted");
    expect(store.load().rooms[room.id]?.poker?.phase).toBe("complete");

    const topUpSittingOutPlayer = dispatch(store, {
      commandId: "top-up-zero-stack-player",
      connectionId: caraConnection,
      aggregateId: room.id,
      expectedVersion: 3,
      type: "room.top-up",
      payload: { accountId: cara.id, roomId: room.id, amount: 1_000 }
    });
    expect(topUpSittingOutPlayer.status).toBe("accepted");

    const caraReady = dispatch(store, {
      commandId: "cara-ready",
      connectionId: caraConnection,
      aggregateId: room.id,
      expectedVersion: 4,
      type: "poker.ready",
      payload: {
        accountId: cara.id,
        roomId: room.id,
        pokerVersion: 2
      }
    });
    expect(caraReady.status).toBe("accepted");
    const persistedRoom = store.load().rooms[room.id]!;
    expect(persistedRoom.seats).toHaveLength(3);
    expect(persistedRoom.poker?.players.map((player) => player.accountId)).toEqual([
      alice.id,
      bob.id,
      cara.id
    ]);
    expect(persistedRoom.poker?.handNumber).toBe(2);
    expect(persistedRoom.poker?.dealerPosition).toBe(1);
    expect(persistedRoom.poker?.readyAccountIds).toEqual([]);
    new PlatformDomain(store.load()).validateInvariants();
    store.close();
  });

  it("publishes only actual showdown cards with winner hand types and signed chip deltas", () => {
    const store = new PlatformStore(temporaryDatabase());
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice", "🦊");
    const bob = domain.enterAccount("Bob", "🐼");
    const cara = domain.enterAccount("Cara", "🐯");
    const room = domain.createRoom(alice.id, "Showdown", defaultRoomConfig);
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
      mode: "chips-and-cards",
      smallBlind: room.config.smallBlind,
      bigBlind: room.config.bigBlind,
      deck: showdownCards(
        "2C 3D 4H 9S KC AS AD QS QD 5S 6S 7C 8C TC JC QC KH KD AH"
      )
    });
    room.poker.phase = "showdown";
    room.poker.actingAccountId = null;
    room.poker.communityCards = showdownCards("2C 3D 4H 9S KC");
    room.poker.holeCards = {
      [alice.id]: showdownCards("AS AD"),
      [bob.id]: showdownCards("QS QD"),
      [cara.id]: showdownCards("5S 6S")
    };
    for (const player of room.poker.players) {
      player.stack = 1_900;
      player.roundBet = 0;
      player.totalBet = 100;
      player.folded = player.accountId === cara.id;
      player.allIn = false;
    }
    room.poker.pots = [{
      amount: 300,
      eligibleAccountIds: [alice.id, bob.id]
    }];
    delete room.poker.advanceDeadline;
    store.save(state);

    const settled = dispatch(store, {
      commandId: "automatic-showdown",
      aggregateId: room.id,
      expectedVersion: 0,
      type: "system.poker.settle",
      payload: {
        roomId: room.id,
        pokerVersion: room.poker.version
      }
    });
    expect(settled.status).toBe("accepted");
    const projection = settled.data as {
      lastResult: {
        playerResults: Array<{ accountId: string; chipDelta: number }>;
        showdown: {
          players: Array<{
            accountId: string;
            cards: Card[];
            handCategory: string;
            winner: boolean;
          }>;
        };
      };
    };
    expect(projection.lastResult.playerResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: alice.id, chipDelta: 200 }),
        expect.objectContaining({ accountId: bob.id, chipDelta: -100 }),
        expect.objectContaining({ accountId: cara.id, chipDelta: -100 })
      ])
    );
    expect(projection.lastResult.showdown.players).toHaveLength(2);
    expect(projection.lastResult.showdown.players.map((player) => player.accountId)).toEqual([
      alice.id,
      bob.id
    ]);
    expect(projection.lastResult.showdown.players[0]).toMatchObject({
      accountId: alice.id,
      cards: showdownCards("AS AD"),
      handCategory: "one-pair",
      winner: true
    });
    expect(JSON.stringify(projection.lastResult.showdown)).not.toContain(cara.id);
    new PlatformDomain(store.load()).validateInvariants();
    store.close();
  });

  it("lets the host remove a disconnected acting player without stalling the hand", () => {
    const store = new PlatformStore(temporaryDatabase());
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const cara = domain.enterAccount("Cara");
    domain.acquireLease(alice.id);
    const bobConnection = domain.acquireLease(bob.id);
    domain.acquireLease(cara.id);
    const room = domain.createRoom(alice.id, "Removal", defaultRoomConfig);
    domain.joinRoom(room.id, alice.id, 2_000);
    domain.joinRoom(room.id, bob.id, 2_000);
    domain.joinRoom(room.id, cara.id, 2_000);
    domain.transferHost(room.id, alice.id, bob.id);
    domain.startRoom(room.id, bob.id);
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
    expect(room.poker.actingAccountId).toBe(alice.id);
    domain.disconnect(room.id, alice.id);
    store.save(state);

    const removed = dispatch(store, {
      commandId: "remove-disconnected-actor",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 0,
      type: "room.remove",
      payload: {
        accountId: bob.id,
        roomId: room.id,
        targetAccountId: alice.id
      }
    });
    expect(removed.status).toBe("accepted");
    const persisted = store.load();
    expect(persisted.rooms[room.id]?.seats.some((seat) => seat.accountId === alice.id)).toBe(
      false
    );
    expect(persisted.rooms[room.id]?.poker?.actingAccountId).toBe(bob.id);
    expect(persisted.seasonAssets[alice.id]?.score).toBe(10_000);
    new PlatformDomain(persisted).validateInvariants();
    store.close();
  });

  it("reverses a chips-only settlement with version checks and linked ledger lines", () => {
    const store = new PlatformStore(temporaryDatabase());
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const aliceConnection = domain.acquireLease(alice.id);
    domain.acquireLease(bob.id);
    const room = domain.createRoom(alice.id, "Manual", {
      ...defaultRoomConfig,
      mode: "chips-only"
    });
    domain.joinRoom(room.id, alice.id, 2_000);
    domain.joinRoom(room.id, bob.id, 2_000);
    domain.startRoom(room.id, alice.id);
    room.poker = createPokerState({
      players: room.seats.map((seat) => ({
        accountId: seat.accountId,
        position: seat.position,
        stack: seat.tableChips
      })),
      mode: "chips-only",
      smallBlind: room.config.smallBlind,
      bigBlind: room.config.bigBlind,
      deck: []
    });
    room.poker.phase = "showdown";
    room.poker.actingAccountId = null;
    delete room.poker.advanceDeadline;
    store.save(state);

    const settled = dispatch(store, {
      commandId: "manual-settlement",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 0,
      type: "poker.settle",
      payload: {
        accountId: alice.id,
        roomId: room.id,
        pokerVersion: 0,
        winnersByPot: room.poker.pots.map((pot) => [pot.eligibleAccountIds[0]!])
      }
    });
    expect(settled.status).toBe("accepted");
    expect((settled.data as { phase: string }).phase).toBe("distribution");

    const distributing = store.load();
    distributing.rooms[room.id]!.poker!.advanceDeadline = Date.now() - 1;
    store.save(distributing);
    const completed = dispatch(store, {
      commandId: "complete-distribution",
      aggregateId: room.id,
      expectedVersion: 1,
      type: "system.poker.complete-distribution",
      payload: {
        roomId: room.id,
        pokerVersion: distributing.rooms[room.id]!.poker!.version
      }
    });
    expect(completed.status).toBe("accepted");

    const staleUndo = dispatch(store, {
      commandId: "stale-settlement-undo",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 2,
      type: "poker.undo-settlement",
      payload: {
        accountId: alice.id,
        roomId: room.id,
        pokerVersion: 1
      }
    });
    expect(staleUndo.code).toBe("STALE_VERSION");

    const undone = dispatch(store, {
      commandId: "settlement-undo",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 2,
      type: "poker.undo-settlement",
      payload: {
        accountId: alice.id,
        roomId: room.id,
        pokerVersion: (completed.data as { pokerVersion: number }).pokerVersion
      }
    });
    expect(undone.status).toBe("accepted");
    const restored = store.load();
    expect(restored.rooms[room.id]?.poker?.phase).toBe("showdown");
    expect(restored.handResults[0]?.reversedAt).toBeTypeOf("number");
    const reversalLines = restored.ledger.filter(
      (line) => line.reason === "settlement-undo"
    );
    expect(reversalLines.length).toBeGreaterThan(0);
    expect(reversalLines.every((line) => Boolean(line.reversalOf))).toBe(true);
    expect(new PlatformDomain(restored).projectRoom(room.id, { display: true }).lastResult).toBeUndefined();
    new PlatformDomain(restored).validateInvariants();
    store.close();
  });
});

async function sendCommand(app: FastifyInstance, payload: Record<string, unknown>) {
  return await app.inject({
    method: "POST",
    url: "/api/command",
    payload
  });
}

function showdownCards(input: string): Card[] {
  const suits = { C: "clubs", D: "diamonds", H: "hearts", S: "spades" } as const;
  return input.split(" ").map((token) => ({
    rank: token[0]!,
    suit: suits[token[1] as keyof typeof suits]
  }));
}
