import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
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
    expect(settledProjection.json().phase).toBe("distribution");
    await new Promise((resolve) => setTimeout(resolve, 3_200));
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

  it("keeps zero-stack seats seated, requires a top-up, and starts the next hand with funded players", () => {
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

    const rejected = dispatch(store, {
      commandId: "next-hand-needs-top-up",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 0,
      type: "poker.next-hand",
      payload: { accountId: alice.id, roomId: room.id }
    });
    expect(rejected.code).toBe("PLAYER_NEEDS_TOP_UP");

    const topUp = dispatch(store, {
      commandId: "top-up-funded-player",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 0,
      type: "room.top-up",
      payload: { accountId: bob.id, roomId: room.id, amount: 1_000 }
    });
    expect(topUp.status).toBe("accepted");

    const nextHand = dispatch(store, {
      commandId: "next-hand-after-top-up",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 1,
      type: "poker.next-hand",
      payload: { accountId: alice.id, roomId: room.id }
    });
    expect(nextHand.status).toBe("accepted");
    const persistedRoom = store.load().rooms[room.id]!;
    expect(persistedRoom.seats).toHaveLength(3);
    expect(persistedRoom.poker?.players.map((player) => player.accountId)).toEqual([
      alice.id,
      bob.id
    ]);
    expect(persistedRoom.poker?.dealerPosition).toBe(1);
    expect(persistedRoom.seats.find((seat) => seat.accountId === cara.id)?.tableChips).toBe(0);
    new PlatformDomain(store.load()).validateInvariants();

    const sittingOutState = store.load();
    sittingOutState.rooms[room.id]!.poker!.phase = "complete";
    store.save(sittingOutState);
    const topUpSittingOutPlayer = dispatch(store, {
      commandId: "top-up-sitting-out-player",
      connectionId: caraConnection,
      aggregateId: room.id,
      expectedVersion: 2,
      type: "room.top-up",
      payload: { accountId: cara.id, roomId: room.id, amount: 1_000 }
    });
    expect(topUpSittingOutPlayer.status).toBe("accepted");
    expect(store.load().rooms[room.id]?.seats.find(
      (seat) => seat.accountId === cara.id
    )?.tableChips).toBe(1_000);
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
