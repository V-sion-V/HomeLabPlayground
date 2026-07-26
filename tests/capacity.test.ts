import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { chromium, type Page } from "playwright";
import { buildApp } from "../apps/server/src/app";
import type { RoomProjection } from "@party/contracts";
import { initialSnapshot, PlatformDomain } from "@party/domain";
import { PlatformStore } from "@party/persistence";
import { command, defaultRoomConfig, temporaryDatabase } from "@party/test-support";

describe("target household capacity", () => {
  it("keeps 15 accounts, two active rooms and multiple displays isolated", () => {
    const domain = new PlatformDomain(initialSnapshot());
    const accounts = Array.from({ length: 15 }, (_, index) =>
      domain.enterAccount(`player-${String(index + 1).padStart(2, "0")}`, index % 2 ? "🦊" : "🐼")
    );
    const first = domain.createRoom(accounts[0]!.id, "Table A", defaultRoomConfig);
    const second = domain.createRoom(accounts[7]!.id, "Table B", {
      ...defaultRoomConfig,
      mode: "chips-only"
    });
    accounts.slice(0, 7).forEach((account) => domain.joinRoom(first.id, account.id, 2_000));
    accounts.slice(7, 14).forEach((account) => domain.joinRoom(second.id, account.id, 2_000));
    domain.startRoom(first.id, accounts[0]!.id);
    domain.startRoom(second.id, accounts[7]!.id);

    const firstDisplay = domain.projectRoom(first.id, { display: true });
    const firstDisplayTwo = domain.projectRoom(first.id, { display: true });
    const secondDisplay = domain.projectRoom(second.id, { display: true });
    const firstIds = new Set(firstDisplay.seats.map((seat) => seat.accountId));
    const secondIds = new Set(secondDisplay.seats.map((seat) => seat.accountId));
    expect(firstDisplayTwo).toEqual(firstDisplay);
    expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
    expect(firstDisplay.communityCards).toBeDefined();
    expect(secondDisplay.communityCards).toBeUndefined();
    expect(JSON.stringify([firstDisplay, secondDisplay])).not.toContain("holeCards");
    expect(Object.keys(domain.state.accounts)).toHaveLength(15);
    domain.validateInvariants();
  });

  it("does not double-confirm a command under repeated delivery", () => {
    const store = new PlatformStore(temporaryDatabase());
    const envelope = command(0, "account.enter", { username: "player-01" });
    const first = store.execute(envelope, (domain) => domain.enterAccount("player-01"));
    const second = store.execute(envelope, (domain) => domain.enterAccount("must-not-run"));
    expect(first.status).toBe("accepted");
    expect(second.status).toBe("replayed");
    expect(Object.keys(store.load().accounts)).toHaveLength(1);
    store.close();
  });

  it("synchronizes 15 live accounts, two rooms, and multiple displays without cross-room data", async () => {
    const app = await buildApp({ databasePath: temporaryDatabase() });
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address();
      if (!address || typeof address === "string") throw new Error("Server did not bind TCP");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const wsUrl = `ws://127.0.0.1:${address.port}/ws`;
      const entered: Array<{
        version: number;
        data: { account: { id: string }; connectionId: string };
      }> = [];
      for (let index = 0; index < 15; index += 1) {
        entered.push(
          await postJson(`${baseUrl}/api/enter`, {
            username: `live-player-${String(index + 1).padStart(2, "0")}`,
            avatar: index % 2 ? "🦊" : "🐼"
          })
        );
      }

      let version = entered.at(-1)!.version;
      const roomA = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
        commandId: randomUUID(),
        connectionId: entered[0]!.data.connectionId,
        aggregateId: "platform",
        expectedVersion: version,
        type: "room.create",
        payload: {
          accountId: entered[0]!.data.account.id,
          name: "Live A",
          config: defaultRoomConfig,
          buyIn: 2_000
        }
      });
      version = roomA.version;
      for (let index = 1; index < 7; index += 1) {
        const joined = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
          commandId: randomUUID(),
          connectionId: entered[index]!.data.connectionId,
          aggregateId: roomA.data.id,
          expectedVersion: version,
          type: "room.join",
          payload: {
            accountId: entered[index]!.data.account.id,
            roomId: roomA.data.id,
            buyIn: 2_000
          }
        });
        version = joined.version;
      }

      const roomB = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
        commandId: randomUUID(),
        connectionId: entered[7]!.data.connectionId,
        aggregateId: "platform",
        expectedVersion: version,
        type: "room.create",
        payload: {
          accountId: entered[7]!.data.account.id,
          name: "Live B",
          config: { ...defaultRoomConfig, mode: "chips-only" },
          buyIn: 2_000
        }
      });
      version = roomB.version;
      for (let index = 8; index < 14; index += 1) {
        const joined = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
          commandId: randomUUID(),
          connectionId: entered[index]!.data.connectionId,
          aggregateId: roomB.data.id,
          expectedVersion: version,
          type: "room.join",
          payload: {
            accountId: entered[index]!.data.account.id,
            roomId: roomB.data.id,
            buyIn: 2_000
          }
        });
        version = joined.version;
      }

      const startedA = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
        commandId: randomUUID(),
        connectionId: entered[0]!.data.connectionId,
        aggregateId: roomA.data.id,
        expectedVersion: version,
        type: "room.start",
        payload: { accountId: entered[0]!.data.account.id, roomId: roomA.data.id }
      });
      version = startedA.version;
      const startedB = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
        commandId: randomUUID(),
        connectionId: entered[7]!.data.connectionId,
        aggregateId: roomB.data.id,
        expectedVersion: version,
        type: "room.start",
        payload: { accountId: entered[7]!.data.account.id, roomId: roomB.data.id }
      });
      version = startedB.version;

      browser = await chromium.launch();
      const accountPages = await Promise.all(
        entered.map(() => browser!.newPage())
      );
      for (let index = 0; index < accountPages.length; index += 1) {
        const roomId =
          index < 7 ? roomA.data.id : index < 14 ? roomB.data.id : undefined;
        await subscribe(accountPages[index]!, baseUrl, wsUrl, {
          type: roomId ? "subscription.room" : "subscription.lobby",
          payload: roomId
            ? {
                roomId,
                accountId: entered[index]!.data.account.id,
                connectionId: entered[index]!.data.connectionId
              }
            : {
                accountId: entered[index]!.data.account.id,
                connectionId: entered[index]!.data.connectionId
              }
        });
      }
      const displayPages = await Promise.all(
        Array.from({ length: 4 }, () => browser!.newPage())
      );
      for (let index = 0; index < displayPages.length; index += 1) {
        await subscribe(displayPages[index]!, baseUrl, wsUrl, {
          type: "subscription.room",
          payload: {
            roomId: index < 2 ? roomA.data.id : roomB.data.id,
            display: true
          }
        });
      }
      await Promise.all(
        [...accountPages, ...displayPages].map((page) =>
          page.evaluate(() => {
            const state = globalThis as typeof globalThis & {
              capacityMessages?: unknown[];
            };
            state.capacityMessages = [];
          })
        )
      );

      const actorIndex = entered.findIndex(
        (entry) => entry.data.account.id === startedA.data.actingAccountId
      );
      expect(actorIndex).toBeGreaterThanOrEqual(0);
      const action = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
        commandId: randomUUID(),
        connectionId: entered[actorIndex]!.data.connectionId,
        aggregateId: roomA.data.id,
        expectedVersion: version,
        type: "poker.action",
        payload: {
          accountId: entered[actorIndex]!.data.account.id,
          roomId: roomA.data.id,
          pokerVersion: startedA.data.pokerVersion,
          action: { kind: "call" }
        }
      });
      expect(action.data.potTotal).toBe(250);

      await Promise.all(
        [...accountPages, ...displayPages].map((page) =>
          page.waitForFunction(() => {
            const state = globalThis as typeof globalThis & {
              capacityMessages?: Array<{ type?: string }>;
            };
            return (state.capacityMessages ?? []).some(
              (message) => message.type === "projection" || message.type === "lobby"
            );
          })
        )
      );

      for (const page of accountPages.slice(0, 7)) {
        const messages = await capacityMessages(page);
        const projection = messages.find(
          (message) => message.type === "projection"
        )?.data as RoomProjection;
        expect(projection.id).toBe(roomA.data.id);
        expect(projection.potTotal).toBe(250);
        expect(projection.ownHoleCards).toHaveLength(2);
      }
      for (const page of accountPages.slice(7, 14)) {
        const messages = await capacityMessages(page);
        expect(
          messages
            .filter((message) => message.type === "projection")
            .every((message) => (message.data as RoomProjection).id === roomB.data.id)
        ).toBe(true);
      }
      expect(
        (await capacityMessages(accountPages[14]!)).some(
          (message) => message.type === "lobby"
        )
      ).toBe(true);
      for (const [index, page] of displayPages.entries()) {
        const projection = (await capacityMessages(page)).find(
          (message) => message.type === "projection"
        )?.data as RoomProjection;
        expect(projection.id).toBe(index < 2 ? roomA.data.id : roomB.data.id);
        expect(projection.ownHoleCards).toBeUndefined();
        expect(JSON.stringify(projection)).not.toContain("holeCards");
      }
    } finally {
      await browser?.close();
      await app.close();
    }
  }, 30_000);
});

interface CapacityMessage {
  type?: string;
  data?: unknown;
}

async function postJson<T = unknown>(
  url: string,
  payload: unknown
): Promise<{ status: string; version: number; data: T }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = (await response.json()) as {
    status: string;
    version: number;
    data: T;
    code?: string;
  };
  if (!response.ok || result.status === "rejected") {
    throw new Error(result.code ?? `HTTP_${response.status}`);
  }
  return result;
}

async function subscribe(
  page: Page,
  baseUrl: string,
  wsUrl: string,
  subscription: { type: string; payload: Record<string, unknown> }
): Promise<void> {
  await page.goto(`${baseUrl}/healthz`);
  await page.evaluate(
    ({ socketUrl, message }) =>
      new Promise<void>((resolve, reject) => {
        const state = globalThis as typeof globalThis & {
          capacitySocket?: WebSocket;
          capacityMessages?: CapacityMessage[];
        };
        state.capacityMessages = [];
        const socket = new WebSocket(socketUrl);
        state.capacitySocket = socket;
        socket.addEventListener("open", () => socket.send(JSON.stringify(message)));
        socket.addEventListener("error", () => reject(new Error("WEBSOCKET_FAILED")));
        socket.addEventListener("message", (event) => {
          const received = JSON.parse(String(event.data)) as CapacityMessage;
          state.capacityMessages?.push(received);
          if (received.type === "projection" || received.type === "lobby") resolve();
        });
      }),
    { socketUrl: wsUrl, message: subscription }
  );
}

async function capacityMessages(page: Page): Promise<CapacityMessage[]> {
  return await page.evaluate(() => {
    const state = globalThis as typeof globalThis & {
      capacityMessages?: CapacityMessage[];
    };
    return state.capacityMessages ?? [];
  });
}
