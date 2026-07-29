import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Card } from "@party/contracts";
import { buildApp, dispatch, dispatchAdmin } from "../apps/server/src/app";
import { initialSnapshot, PlatformDomain } from "@party/domain";
import { PlatformStore } from "@party/persistence";
import { createPokerState } from "@party/poker";
import { defaultRoomConfig, temporaryDatabase } from "@party/test-support";

describe("server", () => {
  it("keeps lookup read-only, registers create-only, and enters only existing accounts", async () => {
    const app = await buildApp({ databasePath: temporaryDatabase() });
    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);
    const lookup = await app.inject({
      method: "POST",
      url: "/api/account/lookup",
      payload: { username: "  小明  " }
    });
    expect(lookup.json()).toMatchObject({
      username: "小明",
      normalizedUsername: "小明",
      exists: false,
      version: 0
    });
    const beforeRegistration = await app.inject({
      method: "GET",
      url: "/api/admin/state"
    });
    expect(beforeRegistration.json().accounts).toEqual([]);

    const response = await registerThroughApi(app, "小明", "🐼", "en", "light");
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.account.username).toBe("小明");
    expect(body.data.account).toMatchObject({
      language: "en",
      theme: "light",
      volume: 100
    });
    expect(body.data.connectionId).toBeTypeOf("string");
    expect(JSON.stringify(body)).not.toContain("password");

    const collision = await registerThroughApi(
      app,
      " 小明 ",
      "🦊",
      "zh-CN",
      "dark"
    );
    expect(collision.statusCode).toBe(409);
    expect(collision.json().code).toBe("USERNAME_TAKEN");

    const entered = await app.inject({
      method: "POST",
      url: "/api/enter",
      payload: {
        commandId: "enter-existing-xiaoming",
        username: "小明"
      }
    });
    expect(entered.statusCode).toBe(200);
    expect(entered.json().data.account).toMatchObject({
      id: body.data.account.id,
      language: "en",
      theme: "light",
      volume: 100
    });
    const invalidProfile = await sendCommand(app, {
      commandId: "invalid-atomic-profile-save",
      connectionId: entered.json().data.connectionId,
      aggregateId: "platform",
      expectedVersion: entered.json().version,
      type: "account.profile",
      payload: {
        accountId: body.data.account.id,
        username: "Renamed",
        avatar: "🦊",
        language: "zh-CN",
        theme: "dark",
        volume: 101
      }
    });
    expect(invalidProfile.statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/account/lookup",
          payload: { username: "Renamed" }
        })
      ).json().exists
    ).toBe(false);
    const savedProfile = await sendCommand(app, {
      commandId: "valid-atomic-profile-save",
      connectionId: entered.json().data.connectionId,
      aggregateId: "platform",
      expectedVersion: entered.json().version,
      type: "account.profile",
      payload: {
        accountId: body.data.account.id,
        username: "小明",
        avatar: "🦊",
        language: "zh-CN",
        theme: "dark",
        volume: 0
      }
    });
    expect(savedProfile.statusCode).toBe(200);
    expect(savedProfile.json().data).toMatchObject({
      username: "小明",
      avatar: "🦊",
      language: "zh-CN",
      theme: "dark",
      volume: 0
    });
    const missing = await app.inject({
      method: "POST",
      url: "/api/enter",
      payload: {
        commandId: "enter-missing-account",
        username: "不存在"
      }
    });
    expect(missing.statusCode).toBe(409);
    expect(missing.json().code).toBe("ACCOUNT_NOT_FOUND");
    await app.close();
  });

  it("runs validated room commands, protects private projections, and persists settlement evidence", async () => {
    const databasePath = temporaryDatabase();
    const app = await buildApp({ databasePath });
    const aliceEnter = await registerThroughApi(app, "Alice", "🦊");
    const alice = aliceEnter.json().data;
    const bobEnter = await registerThroughApi(app, "Bob", "🐼");
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

    const ready = await sendCommand(app, {
      commandId: "command-ready-bob",
      connectionId: bob.connectionId,
      aggregateId: roomId,
      expectedVersion: version,
      type: "poker.ready",
      payload: {
        accountId: bob.account.id,
        roomId,
        ready: true
      }
    });
    expect(ready.statusCode).toBe(200);
    version = ready.json().version;

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
    expect(duplicateStart.json().code).toBe("HAND_IN_PROGRESS");

    const unauthorizedRemove = await sendCommand(app, {
      commandId: "command-unauthorized-remove",
      connectionId: bob.connectionId,
      aggregateId: roomId,
      expectedVersion: version,
      type: "room.remove",
      payload: {
        accountId: bob.account.id,
        roomId,
        targetAccountId: alice.account.id
      }
    });
    expect(unauthorizedRemove.statusCode).toBe(409);
    expect(unauthorizedRemove.json().code).toBe("HOST_ONLY");

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
        .lastResult.playerResults.every(
          (player: { endingChips?: number }) =>
            Number.isInteger(player.endingChips) && (player.endingChips ?? -1) >= 0
        )
    ).toBe(true);
    expect(
      settledProjection
        .json()
        .lastResult.playerResults.reduce(
          (sum: number, player: { endingChips: number }) => sum + player.endingChips,
          0
        )
    ).toBe(4_000);
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

  it("keeps settlement open after readiness until the host explicitly starts selected players", () => {
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

    const topUp = dispatch(store, {
      commandId: "top-up-funded-player",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 0,
      type: "room.top-up",
      payload: { accountId: bob.id, roomId: room.id, amount: 1_000 }
    });
    expect(topUp.status).toBe("accepted");

    const bobReady = dispatch(store, {
      commandId: "bob-ready",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 1,
      type: "poker.ready",
      payload: {
        accountId: bob.id,
        roomId: room.id,
        pokerVersion: 0,
        ready: true
      }
    });
    expect(bobReady.status).toBe("accepted");
    expect(store.load().rooms[room.id]?.poker?.phase).toBe("complete");

    const topUpSittingOutPlayer = dispatch(store, {
      commandId: "top-up-zero-stack-player",
      connectionId: caraConnection,
      aggregateId: room.id,
      expectedVersion: 2,
      type: "room.top-up",
      payload: { accountId: cara.id, roomId: room.id, amount: 1_000 }
    });
    expect(topUpSittingOutPlayer.status).toBe("accepted");

    const caraReady = dispatch(store, {
      commandId: "cara-ready",
      connectionId: caraConnection,
      aggregateId: room.id,
      expectedVersion: 3,
      type: "poker.ready",
      payload: {
        accountId: cara.id,
        roomId: room.id,
        pokerVersion: 1,
        ready: true
      }
    });
    expect(caraReady.status).toBe("accepted");
    expect(store.load().rooms[room.id]?.poker?.phase).toBe("complete");

    const started = dispatch(store, {
      commandId: "host-starts-next-hand",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 4,
      type: "room.start",
      payload: {
        accountId: alice.id,
        roomId: room.id,
        pokerVersion: 2
      }
    });
    expect(started.status).toBe("accepted");
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

  it("requires waiting-room readiness and confirmation, then keeps active joiners spectating", () => {
    const store = new PlatformStore(temporaryDatabase());
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const cara = domain.enterAccount("Cara");
    const dave = domain.enterAccount("Dave");
    const aliceConnection = domain.acquireLease(alice.id);
    const bobConnection = domain.acquireLease(bob.id);
    domain.acquireLease(cara.id);
    const daveConnection = domain.acquireLease(dave.id);
    const room = domain.createRoom(alice.id, "Ready", defaultRoomConfig);
    domain.joinRoom(room.id, alice.id, 2_000);
    domain.joinRoom(room.id, bob.id, 2_000);
    domain.joinRoom(room.id, cara.id, 2_000);
    store.save(state);

    const ready = dispatch(store, {
      commandId: "waiting-ready",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 0,
      type: "poker.ready",
      payload: {
        accountId: bob.id,
        roomId: room.id,
        ready: true
      }
    });
    expect(ready.status).toBe("accepted");
    expect((ready.data as { readyAccountIds: string[] }).readyAccountIds).toEqual([
      bob.id
    ]);

    const cancelReady = dispatch(store, {
      commandId: "waiting-cancel-ready",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 1,
      type: "poker.ready",
      payload: {
        accountId: bob.id,
        roomId: room.id,
        ready: false
      }
    });
    expect(cancelReady.status).toBe("accepted");
    const readyAgain = dispatch(store, {
      commandId: "waiting-ready-again",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 2,
      type: "poker.ready",
      payload: {
        accountId: bob.id,
        roomId: room.id,
        ready: true
      }
    });
    expect(readyAgain.status).toBe("accepted");

    const needsConfirmation = dispatch(store, {
      commandId: "start-with-unready-member",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 3,
      type: "room.start",
      payload: {
        accountId: alice.id,
        roomId: room.id
      }
    });
    expect(needsConfirmation.code).toBe(
      "UNREADY_PLAYERS_REQUIRE_CONFIRMATION"
    );
    expect(store.load().rooms[room.id]?.status).toBe("waiting");

    const started = dispatch(store, {
      commandId: "confirm-start-with-unready-member",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 3,
      type: "room.start",
      payload: {
        accountId: alice.id,
        roomId: room.id,
        confirmUnready: true
      }
    });
    expect(started.status).toBe("accepted");
    expect(
      store.load().rooms[room.id]?.poker?.players.map((player) => player.accountId)
    ).toEqual([alice.id, bob.id]);

    const joined = dispatch(store, {
      commandId: "active-room-join",
      connectionId: daveConnection,
      aggregateId: room.id,
      expectedVersion: 4,
      type: "room.join",
      payload: {
        accountId: dave.id,
        roomId: room.id,
        buyIn: 2_000
      }
    });
    expect(joined.status).toBe("accepted");
    expect(joined.data).toMatchObject({
      viewerRole: "spectator"
    });
    expect((joined.data as { ownHoleCards?: Card[] }).ownHoleCards).toBeUndefined();
    const persisted = store.load();
    expect(
      persisted.rooms[room.id]?.poker?.players.some(
        (player) => player.accountId === dave.id
      )
    ).toBe(false);
    expect(persisted.rooms[room.id]?.seats).toHaveLength(4);
    new PlatformDomain(persisted).validateInvariants();
    store.close();
  });

  it("atomically removes an active host and transfers ownership to the online member", () => {
    const store = new PlatformStore(temporaryDatabase());
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const aliceConnection = domain.acquireLease(alice.id);
    domain.acquireLease(bob.id);
    const room = domain.createRoom(alice.id, "Host exit", defaultRoomConfig);
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

    const left = dispatch(store, {
      commandId: "active-host-leaves",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 0,
      type: "room.leave",
      payload: {
        accountId: alice.id,
        roomId: room.id,
        confirmed: true
      }
    });
    expect(left.status).toBe("accepted");
    expect(left.data).toMatchObject({
      left: true,
      hostAccountId: bob.id
    });
    const persisted = store.load();
    expect(persisted.rooms[room.id]?.hostAccountId).toBe(bob.id);
    expect(
      persisted.rooms[room.id]?.seats.some((seat) => seat.accountId === alice.id)
    ).toBe(false);
    expect(persisted.rooms[room.id]?.poker?.phase).toBe("showdown");
    expect(persisted.seasonAssets[alice.id]?.score).toBe(9_950);
    new PlatformDomain(persisted).validateInvariants();
    store.close();
  });

  it("closes and refunds the room when a leaving host has no online successor", () => {
    const store = new PlatformStore(temporaryDatabase());
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const aliceConnection = domain.acquireLease(alice.id);
    domain.acquireLease(bob.id);
    const room = domain.createRoom(alice.id, "Close on exit", defaultRoomConfig);
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
    domain.disconnect(room.id, bob.id);
    store.save(state);

    const left = dispatch(store, {
      commandId: "host-leaves-without-successor",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 0,
      type: "room.leave",
      payload: {
        accountId: alice.id,
        roomId: room.id,
        confirmed: true
      }
    });
    expect(left.status).toBe("accepted");
    expect(left.data).toMatchObject({ left: true, closed: true });
    const persisted = store.load();
    expect(persisted.rooms[room.id]).toBeUndefined();
    expect(persisted.seasonAssets[alice.id]?.score).toBe(10_000);
    expect(persisted.seasonAssets[bob.id]?.score).toBe(10_000);
    new PlatformDomain(persisted).validateInvariants();
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
        playerResults: Array<{
          accountId: string;
          chipDelta: number;
          endingChips: number;
        }>;
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
        expect.objectContaining({
          accountId: alice.id,
          chipDelta: 200,
          endingChips: 2_200
        }),
        expect.objectContaining({
          accountId: bob.id,
          chipDelta: -100,
          endingChips: 1_900
        }),
        expect.objectContaining({
          accountId: cara.id,
          chipDelta: -100,
          endingChips: 1_900
        })
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

  it("lets the host remove an online acting player without stalling the hand", () => {
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
    store.save(state);

    const removed = dispatch(store, {
      commandId: "remove-online-actor",
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

  it("deletes an open-room account set atomically, transfers the selected host, and safely closes the last room", () => {
    const store = new PlatformStore(temporaryDatabase());
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const cara = domain.enterAccount("Cara");
    domain.acquireLease(alice.id);
    domain.acquireLease(bob.id);
    domain.acquireLease(cara.id);
    const room = domain.createRoom(alice.id, "Admin removal", defaultRoomConfig);
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
    const bobCommitted = room.poker.players.find(
      (player) => player.accountId === bob.id
    )!.totalBet;
    expect(bobCommitted).toBeGreaterThan(0);
    store.save(state);

    const removeBobEnvelope = {
      commandId: "admin-remove-active-bob",
      aggregateId: "platform",
      expectedVersion: 0,
      type: "admin.accounts.delete",
      payload: { accountIds: [bob.id, bob.id] }
    };
    const removedBob = dispatchAdmin(store, removeBobEnvelope);
    expect(removedBob.status).toBe("accepted");
    expect(removedBob.data).toMatchObject({
      deletedIds: [bob.id],
      protectedIds: [],
      selfDeleted: false
    });
    let persisted = store.load();
    expect(persisted.accounts[bob.id]).toBeUndefined();
    expect(persisted.leases[bob.id]).toBeUndefined();
    expect(
      persisted.rooms[room.id]?.seats.some(
        (seat) => seat.accountId === bob.id
      )
    ).toBe(false);
    expect(
      persisted.rooms[room.id]?.poker?.players.find(
        (player) => player.accountId === bob.id
      )
    ).toMatchObject({
      folded: true,
      stack: 0,
      totalBet: bobCommitted
    });
    expect(dispatchAdmin(store, removeBobEnvelope).status).toBe("replayed");
    new PlatformDomain(persisted).validateInvariants();

    const removedHost = dispatchAdmin(store, {
      commandId: "admin-remove-active-host",
      aggregateId: "platform",
      expectedVersion: 1,
      type: "admin.accounts.delete",
      payload: { accountIds: [alice.id] }
    });
    expect(removedHost.status).toBe("accepted");
    persisted = store.load();
    expect(persisted.accounts[alice.id]).toBeUndefined();
    expect(persisted.rooms[room.id]?.hostAccountId).toBe(cara.id);
    expect(persisted.rooms[room.id]?.seats.map((seat) => seat.accountId)).toEqual([
      cara.id
    ]);
    new PlatformDomain(persisted).validateInvariants();

    const removedLast = dispatchAdmin(store, {
      commandId: "admin-remove-final-account",
      aggregateId: "platform",
      expectedVersion: 2,
      type: "admin.accounts.delete",
      payload: { accountIds: [cara.id] }
    });
    expect(removedLast.status).toBe("accepted");
    persisted = store.load();
    expect(persisted.accounts).toEqual({});
    expect(persisted.seasonAssets).toEqual({});
    expect(persisted.leases).toEqual({});
    expect(persisted.rooms).toEqual({});
    expect(
      persisted.ledger
        .filter((line) => line.destination === "asset-retirement")
        .reduce((sum, line) => sum + line.amount, 0)
    ).toBe(30_000);
    expect(JSON.stringify(persisted.handResults)).not.toContain(`"${bob.id}"`);
    expect(JSON.stringify(persisted.handResults)).not.toContain(`"${alice.id}"`);
    expect(JSON.stringify(persisted.handResults)).not.toContain(`"${cara.id}"`);
    new PlatformDomain(persisted).validateInvariants();
    store.close();
  });

  it("uses the new seat buy-in after a completed-hand player leaves and rejoins", () => {
    const store = new PlatformStore(temporaryDatabase());
    const state = initialSnapshot(1_000);
    const domain = new PlatformDomain(state, () => 1_000);
    const alice = domain.enterAccount("Alice");
    const bob = domain.enterAccount("Bob");
    const aliceConnection = domain.acquireLease(alice.id);
    const bobConnection = domain.acquireLease(bob.id);
    const room = domain.createRoom(alice.id, "Rejoin", defaultRoomConfig);
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
    room.poker.players[0]!.stack = 1_800;
    room.poker.players[0]!.roundBet = 0;
    room.poker.players[0]!.totalBet = 0;
    room.poker.players[1]!.stack = 2_200;
    room.poker.players[1]!.roundBet = 0;
    room.poker.players[1]!.totalBet = 0;
    room.poker.pots = [];
    room.seats.find((seat) => seat.accountId === alice.id)!.tableChips = 1_800;
    room.seats.find((seat) => seat.accountId === bob.id)!.tableChips = 2_200;
    store.save(state);

    const left = dispatch(store, {
      commandId: "completed-leave",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 0,
      type: "room.leave",
      payload: { accountId: bob.id, roomId: room.id }
    });
    expect(left.status).toBe("accepted");

    const joined = dispatch(store, {
      commandId: "completed-rejoin",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 1,
      type: "room.join",
      payload: { accountId: bob.id, roomId: room.id, buyIn: 3_000 }
    });
    expect(joined.status).toBe("accepted");
    expect(
      (joined.data as { seats: Array<{ accountId: string; tableChips: number; role: string }> })
        .seats.find((seat) => seat.accountId === bob.id)
    ).toMatchObject({ tableChips: 3_000, role: "member" });

    const ready = dispatch(store, {
      commandId: "completed-rejoin-ready",
      connectionId: bobConnection,
      aggregateId: room.id,
      expectedVersion: 2,
      type: "poker.ready",
      payload: {
        accountId: bob.id,
        roomId: room.id,
        pokerVersion: 0,
        ready: true
      }
    });
    expect(ready.status).toBe("accepted");
    const started = dispatch(store, {
      commandId: "completed-rejoin-start",
      connectionId: aliceConnection,
      aggregateId: room.id,
      expectedVersion: 3,
      type: "room.start",
      payload: {
        accountId: alice.id,
        roomId: room.id,
        pokerVersion: 1
      }
    });
    expect(started.status).toBe("accepted");
    const persisted = store.load();
    const bobPlayer = persisted.rooms[room.id]?.poker?.players.find(
      (player) => player.accountId === bob.id
    );
    expect((bobPlayer?.stack ?? 0) + (bobPlayer?.totalBet ?? 0)).toBe(3_000);
    new PlatformDomain(persisted).validateInvariants();
    store.close();
  });

  it("validates and replays anonymous account deletion while invalidating the deleted lease", async () => {
    const databasePath = temporaryDatabase();
    const app = await buildApp({ databasePath });
    const aliceEnter = await registerThroughApi(app, "Alice", "🦊");
    const alice = aliceEnter.json().data;
    const bobEnter = await registerThroughApi(app, "Bob", "🐼");
    const bob = bobEnter.json().data;
    const version = bobEnter.json().version as number;
    const payload = {
      commandId: "delete-account-alice",
      aggregateId: "platform",
      expectedVersion: version,
      type: "admin.accounts.delete",
      payload: {
        accountIds: [alice.account.id]
      }
    };

    const rejectedPlayerCommand = await sendCommand(app, payload);
    expect(rejectedPlayerCommand.statusCode).toBe(400);

    const deleted = await sendAdminCommand(app, payload);
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().data).toMatchObject({
      deletedIds: [alice.account.id],
      selfDeleted: false
    });
    const replayed = await sendAdminCommand(app, payload);
    expect(replayed.json().status).toBe("replayed");
    const stale = await sendAdminCommand(app, {
      ...payload,
      commandId: "delete-account-alice-again"
    });
    expect(stale.json().code).toBe("STALE_VERSION");
    const deletedState = await app.inject({
      method: "GET",
      url:
        `/api/state?accountId=${alice.account.id}` +
        `&connectionId=${encodeURIComponent(alice.connectionId)}`
    });
    expect(deletedState.statusCode).toBe(403);
    const lobby = await app.inject({
      method: "GET",
      url:
        `/api/state?accountId=${bob.account.id}` +
        `&connectionId=${encodeURIComponent(bob.connectionId)}`
    });
    expect(lobby.json().accounts.map((account: { id: string }) => account.id)).toEqual([
      bob.account.id
    ]);
    expect(JSON.stringify(lobby.json())).not.toContain("retiredIdentities");
    const adminState = await app.inject({
      method: "GET",
      url: "/api/admin/state"
    });
    expect(adminState.json().accounts.map((account: { id: string }) => account.id)).toEqual([
      bob.account.id
    ]);
    expect(JSON.stringify(adminState.json())).not.toContain("connectionId");
    expect(JSON.stringify(adminState.json())).not.toContain("ledger");
    expect(JSON.stringify(adminState.json())).not.toContain("holeCards");
    await app.close();
  });

  it("keeps global settings and season lifecycle behind the versioned anonymous admin boundary", async () => {
    const app = await buildApp({ databasePath: temporaryDatabase() });
    const settingsCommand = {
      commandId: "admin-save-global-settings",
      aggregateId: "platform",
      expectedVersion: 0,
      type: "admin.settings.update",
      payload: {
        settings: {
          defaultLanguage: "en",
          defaultTheme: "light",
          defaultHostTransferTimeoutSeconds: 45,
          poker: {
            smallBlind: 25,
            bigBlind: 50,
            minBuyIn: 1_000,
            maxBuyIn: 12_000,
            suitColorPreset: "high-contrast",
            denominations: [1, 5, 25, 100]
          }
        }
      }
    };

    expect((await sendCommand(app, settingsCommand)).statusCode).toBe(400);
    const saved = await sendAdminCommand(app, settingsCommand);
    expect(saved.statusCode).toBe(200);
    expect(saved.json().data).toMatchObject({
      defaultLanguage: "en",
      defaultTheme: "light",
      defaultHostTransferTimeoutSeconds: 45
    });
    expect((await sendAdminCommand(app, settingsCommand)).json().status).toBe(
      "replayed"
    );

    const started = await sendAdminCommand(app, {
      commandId: "admin-start-next-season",
      aggregateId: "platform",
      expectedVersion: 1,
      type: "admin.season.start",
      payload: { name: "Season 2", baseScore: 5_000 }
    });
    expect(started.statusCode).toBe(200);
    const stateAfterStart = (
      await app.inject({ method: "GET", url: "/api/admin/state" })
    ).json();
    expect(stateAfterStart.currentSeason).toMatchObject({
      name: "Season 2",
      baseScore: 5_000,
      status: "current"
    });
    expect(stateAfterStart.historicalSeasons).toHaveLength(1);
    const historicalSeasonId = stateAfterStart.historicalSeasons[0].id as string;

    const currentRejected = await sendAdminCommand(app, {
      commandId: "admin-delete-current-season",
      aggregateId: "platform",
      expectedVersion: 2,
      type: "admin.seasons.delete",
      payload: { seasonIds: [stateAfterStart.currentSeason.id] }
    });
    expect(currentRejected.statusCode).toBe(409);
    expect(currentRejected.json().code).toBe("CURRENT_SEASON_PROTECTED");
    const emptyRejected = await sendAdminCommand(app, {
      commandId: "admin-delete-empty-seasons",
      aggregateId: "platform",
      expectedVersion: 2,
      type: "admin.seasons.delete",
      payload: { seasonIds: [] }
    });
    expect(emptyRejected.statusCode).toBe(400);

    const deleted = await sendAdminCommand(app, {
      commandId: "admin-delete-history",
      aggregateId: "platform",
      expectedVersion: 2,
      type: "admin.seasons.delete",
      payload: { seasonIds: [historicalSeasonId] }
    });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().data).toMatchObject({
      deletedIds: [historicalSeasonId],
      protectedIds: [stateAfterStart.currentSeason.id]
    });
    const finalState = (
      await app.inject({ method: "GET", url: "/api/admin/state" })
    ).json();
    expect(finalState.version).toBe(3);
    expect(finalState.historicalSeasons).toEqual([]);
    await app.close();
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

async function sendAdminCommand(
  app: FastifyInstance,
  payload: Record<string, unknown>
) {
  return await app.inject({
    method: "POST",
    url: "/api/admin/command",
    payload
  });
}

let registrationSequence = 0;

async function registerThroughApi(
  app: FastifyInstance,
  username: string,
  avatar: string,
  language: "zh-CN" | "en" = "zh-CN",
  theme: "light" | "dark" = "dark"
) {
  registrationSequence += 1;
  return await app.inject({
    method: "POST",
    url: "/api/register",
    payload: {
      commandId: `register-account-${registrationSequence}`,
      username,
      avatar,
      language,
      theme
    }
  });
}

function showdownCards(input: string): Card[] {
  const suits = { C: "clubs", D: "diamonds", H: "hearts", S: "spades" } as const;
  return input.split(" ").map((token) => ({
    rank: token[0]!,
    suit: suits[token[1] as keyof typeof suits]
  }));
}
