import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../apps/server/src/app";
import { PlatformStore } from "@party/persistence";
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
    await app.close();
    const reopened = new PlatformStore(databasePath);
    const state = reopened.load();
    expect(state.rooms[roomId]?.poker?.phase).toBe("complete");
    expect(state.handResults).toHaveLength(1);
    expect(state.ledger.some((line) => line.reason === "settlement")).toBe(true);
    new (await import("@party/domain")).PlatformDomain(state).validateInvariants();
    reopened.close();
  }, 10_000);
});

async function sendCommand(app: FastifyInstance, payload: Record<string, unknown>) {
  return await app.inject({
    method: "POST",
    url: "/api/command",
    payload
  });
}
