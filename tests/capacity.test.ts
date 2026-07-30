import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { chromium, type Page } from "playwright";
import { buildApp } from "../apps/server/src/app";
import type { RoomProjection } from "@party/contracts";
import { initialSnapshot, PlatformDomain } from "@party/domain";
import { PlatformStore } from "@party/persistence";
import {
  command,
  defaultAvalonRoomConfig,
  defaultRoomConfig,
  requireAvalonProjection,
  requirePokerProjection,
  temporaryDatabase
} from "@party/test-support";

describe("target household capacity", () => {
  it("keeps 15 accounts, two active rooms and multiple displays isolated", () => {
    const domain = new PlatformDomain(initialSnapshot());
    const accounts = Array.from({ length: 15 }, (_, index) =>
      domain.enterAccount(`player-${String(index + 1).padStart(2, "0")}`, index % 2 ? "🦊" : "🐼")
    );
    const first = domain.createRoom(accounts[0]!.id, "Table A", defaultRoomConfig);
    const second = domain.createAvalonRoom(
      accounts[7]!.id,
      "Avalon B",
      defaultAvalonRoomConfig
    );
    accounts.slice(0, 7).forEach((account) => domain.joinRoom(first.id, account.id, 2_000));
    accounts
      .slice(8, 14)
      .forEach((account) => domain.joinAvalonRoom(second.id, account.id));
    accounts
      .slice(8, 14)
      .forEach((account) =>
        domain.setAvalonReady(second.id, account.id, true)
      );
    domain.startRoom(first.id, accounts[0]!.id);
    domain.startAvalonGame(second.id, accounts[7]!.id, {
      confirmUnready: false,
      randomInt: () => 0
    });

    const firstDisplay = requirePokerProjection(
      domain.projectRoom(first.id, { display: true })
    );
    const firstDisplayTwo = requirePokerProjection(
      domain.projectRoom(first.id, { display: true })
    );
    const secondDisplay = requireAvalonProjection(
      domain.projectRoom(second.id, { display: true })
    );
    const firstIds = new Set(firstDisplay.seats.map((seat) => seat.accountId));
    const secondIds = new Set(secondDisplay.seats.map((seat) => seat.accountId));
    expect(firstDisplayTwo).toEqual(firstDisplay);
    expect([...firstIds].some((id) => secondIds.has(id))).toBe(false);
    expect(firstDisplay.communityCards).toBeDefined();
    expect(secondDisplay.phase).toBe("role-confirmation");
    expect(JSON.stringify([firstDisplay, secondDisplay])).not.toContain(
      "holeCards"
    );
    expect(JSON.stringify(secondDisplay)).not.toContain("roleAssignments");
    expect(JSON.stringify(secondDisplay)).not.toContain("ownKnowledge");
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

  it("keeps growing season and management projections bounded at household scale", () => {
    let now = 1_000;
    const domain = new PlatformDomain(initialSnapshot(now), () => ++now);
    const accounts = Array.from({ length: 15 }, (_, index) =>
      domain.enterAccount(`history-player-${index + 1}`)
    );
    for (let season = 0; season < 20; season += 1) {
      domain.recordHandResult(
        `archived-room-${season}`,
        1,
        "chips-only",
        [],
        "settled",
        accounts.map((account) => account.id)
      );
      domain.startSeason(`Season ${season + 2}`, 10_000);
    }
    const lobby = domain.lobbyProjection(accounts[0]!.id);
    expect(lobby.accounts).toHaveLength(15);
    expect(lobby.historicalSeasons).toHaveLength(20);
    expect(
      lobby.historicalSeasons.every(
        (historical) => historical.entries.length === 15
      )
    ).toBe(true);
    expect(lobby.leaderboard).toEqual([]);

    const accountDeletion = domain.deleteAccounts(
      accounts.slice(1).map((account) => account.id)
    );
    expect(accountDeletion.deletedIds).toHaveLength(14);
    expect(domain.lobbyProjection(accounts[0]!.id).accounts).toHaveLength(1);
    const seasonDeletion = domain.deleteHistoricalSeasons(
      domain.state.seasons
        .filter((season) => season.status === "historical")
        .map((season) => season.id)
    );
    expect(seasonDeletion.deletedIds).toHaveLength(20);
    expect(domain.state.historicalSeasons).toEqual([]);
    domain.validateInvariants();
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
          await postJson(`${baseUrl}/api/register`, {
            commandId: randomUUID(),
            username: `live-player-${String(index + 1).padStart(2, "0")}`,
            avatar: index % 2 ? "🦊" : "🐼",
            language: "zh-CN",
            theme: "dark"
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
          gameType: "texas-holdem",
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
            gameType: "texas-holdem",
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
          gameType: "avalon",
          name: "Avalon B",
          config: {
            recognitionMode: "automatic",
            oberonRule: "original",
            stake: 100,
            hostTransferTimeoutSeconds: 60,
            roleSource: "preset"
          }
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
            gameType: "avalon",
            roomId: roomB.data.id
          }
        });
        version = joined.version;
      }

      for (let index = 1; index < 7; index += 1) {
        const ready = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
          commandId: randomUUID(),
          connectionId: entered[index]!.data.connectionId,
          aggregateId: roomA.data.id,
          expectedVersion: version,
          type: "poker.ready",
          payload: {
            accountId: entered[index]!.data.account.id,
            roomId: roomA.data.id,
            ready: true
          }
        });
        version = ready.version;
      }
      for (let index = 8; index < 14; index += 1) {
        const ready = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
          commandId: randomUUID(),
          connectionId: entered[index]!.data.connectionId,
          aggregateId: roomB.data.id,
          expectedVersion: version,
          type: "avalon.ready",
          payload: {
            accountId: entered[index]!.data.account.id,
            roomId: roomB.data.id,
            ready: true
          }
        });
        version = ready.version;
      }

      const startedA = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
        commandId: randomUUID(),
        connectionId: entered[0]!.data.connectionId,
        aggregateId: roomA.data.id,
        expectedVersion: version,
        type: "room.start",
        payload: {
          accountId: entered[0]!.data.account.id,
          gameType: "texas-holdem",
          roomId: roomA.data.id
        }
      });
      const startedAProjection = requirePokerProjection(startedA.data);
      version = startedA.version;
      const startedB = await postJson<RoomProjection>(`${baseUrl}/api/command`, {
        commandId: randomUUID(),
        connectionId: entered[7]!.data.connectionId,
        aggregateId: roomB.data.id,
        expectedVersion: version,
        type: "avalon.start",
        payload: {
          accountId: entered[7]!.data.account.id,
          roomId: roomB.data.id,
          confirmUnready: false
        }
      });
      requireAvalonProjection(startedB.data);
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
        (entry) =>
          entry.data.account.id === startedAProjection.actingAccountId
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
          pokerVersion: startedAProjection.pokerVersion,
          action: { kind: "call" }
        }
      });
      expect(requirePokerProjection(action.data).potTotal).toBe(250);

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
        const projection = requirePokerProjection(
          messages.find((message) => message.type === "projection")
            ?.data as RoomProjection
        );
        expect(projection.id).toBe(roomA.data.id);
        expect(projection.potTotal).toBe(250);
        expect(projection.ownHoleCards).toHaveLength(2);
        expect(projection.effectiveDenominations.length).toBeLessThanOrEqual(16);
      }
      for (const page of accountPages.slice(7, 14)) {
        const messages = await capacityMessages(page);
        const projection = requireAvalonProjection(
          messages.find((message) => message.type === "projection")
            ?.data as RoomProjection
        );
        expect(projection.id).toBe(roomB.data.id);
        expect(projection.phase).toBe("role-confirmation");
        expect(projection.ownKnowledge).toBeDefined();
        expect(JSON.stringify(projection)).not.toContain("roleAssignments");
      }
      expect(
        (await capacityMessages(accountPages[14]!)).some(
          (message) => message.type === "lobby"
        )
      ).toBe(true);
      for (const [index, page] of displayPages.entries()) {
        const data = (await capacityMessages(page)).find(
          (message) => message.type === "projection"
        )?.data as RoomProjection;
        expect(data.id).toBe(index < 2 ? roomA.data.id : roomB.data.id);
        if (index < 2) {
          const projection = requirePokerProjection(data);
          expect(projection.ownHoleCards).toBeUndefined();
          expect(JSON.stringify(projection)).not.toContain("holeCards");
        } else {
          const projection = requireAvalonProjection(data);
          expect(projection.ownKnowledge).toBeUndefined();
          expect(JSON.stringify(projection)).not.toContain("roleAssignments");
        }
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
