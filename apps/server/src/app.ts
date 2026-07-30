import { randomInt, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import {
  avalonRoles,
  commandEnvelopeSchema,
  type CommandEnvelope,
  type GlobalSettings,
  type AvalonRoomConfig,
  type PokerRoom,
  type Room
} from "@party/contracts";
import { DomainError, PlatformDomain } from "@party/domain";
import { PlatformStore } from "@party/persistence";
import {
  act,
  advancePhase,
  createPokerState,
  evaluateSeven,
  forceFold,
  handCategoryFromScore,
  settleAutomatically,
  settleManual,
  undoLastAction,
  undoSettlement
} from "@party/poker";

export interface AppOptions {
  databasePath: string;
  staticRoot?: string;
  logger?: boolean;
}

interface SocketLike {
  readyState: number;
  send(data: string): void;
  on(event: string, listener: (...args: any[]) => void): void;
}

interface Subscriber {
  socket: SocketLike;
  accountId?: string;
  connectionId?: string;
  roomId?: string;
  display: boolean;
  lobby: boolean;
}

const accountPayload = {
  accountId: z.string().min(1).max(128)
};
const roomPayload = {
  ...accountPayload,
  roomId: z.string().min(1).max(128).optional()
};
const safePositiveIntegerSchema = z.number().int().safe().positive();
const safeNonnegativeIntegerSchema = z.number().int().safe().nonnegative();
const safeIntegerSchema = z.number().int().safe();
const roomConfigSchema = z.object({
  mode: z.enum(["chips-only", "chips-and-cards"]),
  smallBlind: safePositiveIntegerSchema,
  bigBlind: safePositiveIntegerSchema,
  minBuyIn: safePositiveIntegerSchema,
  maxBuyIn: safePositiveIntegerSchema,
  hostTransferTimeoutSeconds: safePositiveIntegerSchema
});
const avalonRoleSchema = z.enum(avalonRoles);
const avalonRolePresetsSchema = z.object({
  5: z.array(avalonRoleSchema).min(2).max(10),
  6: z.array(avalonRoleSchema).min(2).max(10),
  7: z.array(avalonRoleSchema).min(2).max(10),
  8: z.array(avalonRoleSchema).min(2).max(10),
  9: z.array(avalonRoleSchema).min(2).max(10),
  10: z.array(avalonRoleSchema).min(2).max(10)
});
const avalonRoomConfigInputSchema = z.discriminatedUnion("roleSource", [
  z.object({
    recognitionMode: z.enum(["automatic", "manual"]),
    oberonRule: z.enum(["original", "dized"]),
    stake: safePositiveIntegerSchema.min(2),
    hostTransferTimeoutSeconds: safePositiveIntegerSchema,
    roleSource: z.literal("preset")
  }),
  z.object({
    recognitionMode: z.enum(["automatic", "manual"]),
    oberonRule: z.enum(["original", "dized"]),
    stake: safePositiveIntegerSchema.min(2),
    hostTransferTimeoutSeconds: safePositiveIntegerSchema,
    roleSource: z.literal("custom"),
    roles: z.array(avalonRoleSchema).min(2).max(10)
  })
]);
const pokerActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fold") }),
  z.object({ kind: z.literal("check") }),
  z.object({ kind: z.literal("call") }),
  z.object({ kind: z.literal("all-in") }),
  z.object({ kind: z.literal("bet"), amount: safePositiveIntegerSchema }),
  z.object({ kind: z.literal("raise"), amount: safePositiveIntegerSchema })
]);
const globalSettingsSchema = z.object({
  defaultLanguage: z.enum(["zh-CN", "en"]),
  defaultTheme: z.enum(["light", "dark"]),
  defaultHostTransferTimeoutSeconds: safePositiveIntegerSchema,
  poker: roomConfigSchema
    .omit({ mode: true, hostTransferTimeoutSeconds: true })
    .extend({
      suitColorPreset: z.enum(["standard", "high-contrast"]),
      denominations: z.array(safePositiveIntegerSchema).min(1).max(16)
    }),
  avalon: z.object({
    defaultRecognitionMode: z.enum(["automatic", "manual"]),
    defaultOberonRule: z.enum(["original", "dized"]),
    defaultStake: safePositiveIntegerSchema.min(2),
    rolePresets: avalonRolePresetsSchema
  })
});
const commandPayloadSchemas: Record<string, z.ZodTypeAny> = {
  "account.profile": z.object({
    ...accountPayload,
    username: z.string().min(1).max(64),
    avatar: z.string().min(1).max(16),
    language: z.enum(["zh-CN", "en"]),
    theme: z.enum(["light", "dark"]),
    volume: safeNonnegativeIntegerSchema.max(100)
  }),
  "room.create": z.discriminatedUnion("gameType", [
    z.object({
      ...accountPayload,
      gameType: z.literal("texas-holdem"),
      name: z.string().max(80),
      config: roomConfigSchema,
      buyIn: safePositiveIntegerSchema
    }),
    z.object({
      ...accountPayload,
      gameType: z.literal("avalon"),
      name: z.string().max(80),
      config: avalonRoomConfigInputSchema
    })
  ]),
  "room.join": z.discriminatedUnion("gameType", [
    z.object({
      ...roomPayload,
      gameType: z.literal("texas-holdem"),
      buyIn: safePositiveIntegerSchema
    }),
    z.object({
      ...roomPayload,
      gameType: z.literal("avalon")
    })
  ]),
  "room.start": z.object({
    ...roomPayload,
    gameType: z.literal("texas-holdem"),
    pokerVersion: safeNonnegativeIntegerSchema.optional(),
    confirmUnready: z.boolean().optional()
  }),
  "room.pause": z.object(roomPayload),
  "room.resume": z.object(roomPayload),
  "room.transfer-host": z.object({
    ...roomPayload,
    targetAccountId: z.string().min(1).max(128)
  }),
  "room.top-up": z.object({
    ...roomPayload,
    amount: safePositiveIntegerSchema
  }),
  "room.leave": z.object({
    ...roomPayload,
    confirmed: z.boolean().optional()
  }),
  "room.remove": z.object({
    ...roomPayload,
    targetAccountId: z.string().min(1).max(128),
    confirmed: z.boolean().optional()
  }),
  "room.close": z.object(roomPayload),
  "poker.action": z.object({
    ...roomPayload,
    pokerVersion: safeNonnegativeIntegerSchema,
    action: pokerActionSchema
  }),
  "poker.undo": z.object({
    ...roomPayload,
    pokerVersion: safeNonnegativeIntegerSchema
  }),
  "poker.settle": z.object({
    ...roomPayload,
    pokerVersion: safeNonnegativeIntegerSchema,
    winnersByPot: z.array(z.array(z.string().min(1).max(128)).min(1)).min(1)
  }),
  "poker.undo-settlement": z.object({
    ...roomPayload,
    pokerVersion: safeNonnegativeIntegerSchema
  }),
  "poker.ready": z.object({
    ...roomPayload,
    pokerVersion: safeNonnegativeIntegerSchema.optional(),
    ready: z.boolean().optional()
  }),
  "avalon.config.update": z.object({
    ...roomPayload,
    config: avalonRoomConfigInputSchema,
    avalonVersion: safeNonnegativeIntegerSchema.optional()
  }),
  "avalon.ready": z.object({
    ...roomPayload,
    avalonVersion: safeNonnegativeIntegerSchema.optional(),
    ready: z.boolean().optional()
  }),
  "avalon.start": z.object({
    ...roomPayload,
    avalonVersion: safeNonnegativeIntegerSchema.optional(),
    confirmUnready: z.boolean().optional()
  }),
  "avalon.role.confirm": z.object({
    ...roomPayload,
    avalonVersion: safeNonnegativeIntegerSchema
  }),
  "avalon.night.advance": z.object({
    ...roomPayload,
    avalonVersion: safeNonnegativeIntegerSchema
  }),
  "avalon.night.restart": z.object({
    ...roomPayload,
    avalonVersion: safeNonnegativeIntegerSchema
  }),
  "avalon.team.propose": z.object({
    ...roomPayload,
    avalonVersion: safeNonnegativeIntegerSchema,
    teamAccountIds: z.array(z.string().min(1).max(128)).min(1).max(5)
  }),
  "avalon.vote": z.object({
    ...roomPayload,
    avalonVersion: safeNonnegativeIntegerSchema,
    approve: z.boolean()
  }),
  "avalon.mission": z.object({
    ...roomPayload,
    avalonVersion: safeNonnegativeIntegerSchema,
    choice: z.enum(["success", "fail"])
  }),
  "avalon.assassinate": z.object({
    ...roomPayload,
    avalonVersion: safeNonnegativeIntegerSchema,
    targetAccountId: z.string().min(1).max(128)
  }),
  "avalon.void": z.object({
    ...roomPayload,
    avalonVersion: safeNonnegativeIntegerSchema
  })
};
const adminCommandPayloadSchemas: Record<string, z.ZodTypeAny> = {
  "admin.settings.update": z.object({
    settings: globalSettingsSchema
  }),
  "admin.accounts.delete": z.object({
    accountIds: z.array(z.string().min(1).max(128)).min(1).max(1_000)
  }),
  "admin.seasons.delete": z.object({
    seasonIds: z.array(z.string().min(1).max(128)).min(1).max(1_000)
  }),
  "admin.season.start": z.object({
    name: z.string().max(80).optional(),
    baseScore: safeIntegerSchema
  })
};

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  mkdirSync(dirname(resolve(options.databasePath)), { recursive: true });
  const app = Fastify({
    logger: options.logger
      ? {
          redact: {
            paths: [
              "req.headers.authorization",
              "*.connectionId",
              "*.holeCards",
              "*.deck",
              "*.payload"
            ],
            censor: "[REDACTED]"
          }
        }
      : false
  });
  const store = new PlatformStore(options.databasePath);
  store.recoverAfterRestart();
  const subscribers = new Set<Subscriber>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const send = (subscriber: Subscriber, value: unknown) => {
    if (subscriber.socket.readyState === 1) {
      subscriber.socket.send(JSON.stringify(value));
    }
  };

  const sendLobby = (subscriber: Subscriber) => {
    const domain = new PlatformDomain(store.load());
    if (
      subscriber.accountId &&
      subscriber.connectionId &&
      !leaseIsCurrent(domain, subscriber.accountId, subscriber.connectionId)
    ) {
      send(subscriber, { type: "session.replaced", code: "STALE_CONNECTION" });
      subscriber.lobby = false;
      return;
    }
    send(subscriber, {
      type: "lobby",
      data: domain.lobbyProjection(subscriber.accountId)
    });
  };

  const sendRoom = (subscriber: Subscriber) => {
    if (!subscriber.roomId) return;
    const state = store.load();
    const domain = new PlatformDomain(state);
    if (
      !subscriber.display &&
      (!subscriber.accountId ||
        !subscriber.connectionId ||
        !leaseIsCurrent(domain, subscriber.accountId, subscriber.connectionId))
    ) {
      send(subscriber, { type: "session.replaced", code: "STALE_CONNECTION" });
      subscriber.roomId = undefined;
      return;
    }
    const room = state.rooms[subscriber.roomId];
    if (!room) {
      send(subscriber, { type: "room.closed", data: { roomId: subscriber.roomId } });
      return;
    }
    if (
      !subscriber.display &&
      subscriber.accountId &&
      !room.seats.some((seat) => seat.accountId === subscriber.accountId)
    ) {
      const roomId = subscriber.roomId;
      subscriber.roomId = undefined;
      subscriber.lobby = true;
      send(subscriber, { type: "room.left", data: { roomId } });
      sendLobby(subscriber);
      return;
    }
    send(subscriber, {
      type: "projection",
      data: domain.projectRoom(subscriber.roomId, {
        accountId: subscriber.display ? undefined : subscriber.accountId,
        display: subscriber.display
      })
    });
  };

  const broadcast = () => {
    for (const subscriber of subscribers) {
      try {
        if (subscriber.lobby) sendLobby(subscriber);
        if (subscriber.roomId) sendRoom(subscriber);
      } catch {
        send(subscriber, { type: "error", code: "PROJECTION_FAILED" });
      }
    }
  };

  const clearTimers = () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  };

  const scheduleTimers = () => {
    clearTimers();
    const state = store.load();
    for (const room of Object.values(state.rooms)) {
      const deadline =
        room.gameType === "texas-holdem"
          ? room.poker?.advanceDeadline
          : undefined;
      if (deadline) {
        const key = `poker:${room.id}:${deadline}`;
        const timer = setTimeout(() => {
          timers.delete(key);
          runScheduledPokerAction(store, room.id, deadline);
          broadcast();
          scheduleTimers();
        }, Math.max(0, deadline - Date.now()));
        timer.unref?.();
        timers.set(key, timer);
      }
      const hostDeadline = room.hostDisconnectDeadline;
      if (hostDeadline) {
        const key = `host:${room.id}:${hostDeadline}`;
        const timer = setTimeout(() => {
          timers.delete(key);
          runScheduledHostAction(store, room.id, hostDeadline);
          broadcast();
          scheduleTimers();
        }, Math.max(0, hostDeadline - Date.now()));
        timer.unref?.();
        timers.set(key, timer);
      }
    }
  };

  const setPresence = (accountId: string, connectionId: string, connected: boolean) => {
    const state = store.load();
    const domain = new PlatformDomain(state);
    if (!leaseIsCurrent(domain, accountId, connectionId)) return false;
    const room = domain.roomForAccount(accountId);
    const seat = room?.seats.find((candidate) => candidate.accountId === accountId);
    if (!room || !seat || seat.connected === connected) return false;
    const result = dispatch(store, {
      commandId: `presence:${connected ? "open" : "close"}:${connectionId}:${randomUUID()}`,
      connectionId,
      aggregateId: room.id,
      expectedVersion: state.version,
      type: connected ? "system.connection.open" : "system.connection.close",
      payload: { accountId, roomId: room.id }
    });
    return result.status !== "rejected";
  };

  app.addHook("onClose", async () => {
    clearTimers();
    store.close();
  });
  await app.register(websocket);

  if (options.staticRoot) {
    await app.register(fastifyStatic, { root: resolve(options.staticRoot) });
  }

  app.get("/healthz", async () => ({ status: "ok", version: store.load().version }));

  app.get("/api/state", async (request, reply) => {
    const query = request.query as { accountId?: string; connectionId?: string };
    const domain = new PlatformDomain(store.load());
    if (query.accountId) {
      try {
        domain.assertLease(query.accountId, query.connectionId ?? "");
      } catch {
        return reply.code(403).send({ code: "STALE_CONNECTION" });
      }
    }
    return domain.lobbyProjection(query.accountId);
  });

  app.get("/api/room/:roomId", async (request, reply) => {
    const params = request.params as { roomId: string };
    const query = request.query as {
      accountId?: string;
      connectionId?: string;
      display?: string;
    };
    const state = store.load();
    if (!state.rooms[params.roomId]) return reply.code(404).send({ code: "ROOM_NOT_FOUND" });
    const domain = new PlatformDomain(state);
    if (query.display !== "1") {
      try {
        domain.assertLease(query.accountId ?? "", query.connectionId ?? "");
      } catch {
        return reply.code(403).send({ code: "STALE_CONNECTION" });
      }
    }
    return domain.projectRoom(params.roomId, {
      accountId: query.display === "1" ? undefined : query.accountId,
      display: query.display === "1"
    });
  });

  app.post("/api/account/lookup", async (request, reply) => {
    const parsedBody = z
      .object({ username: z.string().min(1).max(64) })
      .strict()
      .safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ code: "INVALID_USERNAME" });
    }
    try {
      return new PlatformDomain(store.load()).lookupUsername(
        parsedBody.data.username
      );
    } catch (error) {
      const code =
        error instanceof DomainError ? error.code : "INVALID_USERNAME";
      return reply.code(400).send({ code });
    }
  });

  app.post("/api/enter", async (request, reply) => {
    const parsedBody = z
      .object({
        commandId: z.string().min(8).max(128),
        username: z.string().min(1).max(64)
      })
      .strict()
      .safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ code: "INVALID_ENTER_REQUEST" });
    }
    const body = parsedBody.data;
    const snapshot = store.load();
    const result = store.execute(
      {
        commandId: body.commandId,
        aggregateId: "platform",
        expectedVersion: snapshot.version,
        type: "account.enter-existing",
        payload: { username: body.username }
      },
      (domain) => {
      const account = domain.enterExistingAccount(body.username);
      const connectionId = domain.acquireLease(account.id);
      const room = domain.roomForAccount(account.id);
      return {
        account,
        connectionId,
        lobby: domain.lobbyProjection(account.id),
        room: room ? domain.projectRoom(room.id, { accountId: account.id }) : undefined
      };
      }
    );
    if (result.status !== "rejected") {
      broadcast();
      scheduleTimers();
    }
    return reply.code(result.status === "rejected" ? 409 : 200).send(result);
  });

  app.post("/api/register", async (request, reply) => {
    const parsedBody = z
      .object({
        commandId: z.string().min(8).max(128),
        username: z.string().min(1).max(64),
        avatar: z.string().min(1).max(16),
        language: z.enum(["zh-CN", "en"]),
        theme: z.enum(["light", "dark"])
      })
      .strict()
      .safeParse(request.body);
    if (!parsedBody.success) {
      request.log.warn(
        { rejectionCode: "INVALID_REGISTER_REQUEST" },
        "registration_rejected"
      );
      return reply.code(400).send({ code: "INVALID_REGISTER_REQUEST" });
    }
    const body = parsedBody.data;
    const snapshot = store.load();
    const result = store.execute(
      {
        commandId: body.commandId,
        aggregateId: "platform",
        expectedVersion: snapshot.version,
        type: "account.register",
        payload: {
          username: body.username,
          avatar: body.avatar,
          language: body.language,
          theme: body.theme
        }
      },
      (domain) => {
        const account = domain.registerAccount(
          body.username,
          body.avatar,
          body.language,
          body.theme
        );
        const connectionId = domain.acquireLease(account.id);
        return {
          account,
          connectionId,
          lobby: domain.lobbyProjection(account.id)
        };
      }
    );
    if (result.status === "rejected") {
      request.log.warn(
        {
          commandId: body.commandId,
          rejectionCode: result.code
        },
        "registration_rejected"
      );
    } else {
      broadcast();
      scheduleTimers();
    }
    return reply.code(result.status === "rejected" ? 409 : 200).send(result);
  });

  app.get("/api/admin/state", async () =>
    new PlatformDomain(store.load()).adminProjection()
  );

  app.post("/api/admin/command", async (request, reply) => {
    const parsed = parseAdminCommand(request.body);
    if (!parsed) {
      request.log.warn(
        { rejectionCode: "INVALID_ADMIN_COMMAND" },
        "admin_command_rejected"
      );
      return reply.code(400).send({ code: "INVALID_ADMIN_COMMAND" });
    }
    const result = dispatchAdmin(store, parsed);
    if (result.status === "rejected") {
      request.log.warn(
        {
          commandId: parsed.commandId,
          commandType: parsed.type,
          aggregateId: parsed.aggregateId,
          rejectionCode: result.code
        },
        "admin_command_rejected"
      );
    } else {
      broadcast();
      scheduleTimers();
    }
    return reply.code(result.status === "rejected" ? 409 : 200).send(result);
  });

  app.post("/api/command", async (request, reply) => {
    const parsed = parseExternalCommand(request.body);
    if (!parsed) {
      request.log.warn({ rejectionCode: "INVALID_COMMAND" }, "command_rejected");
      return reply.code(400).send({ code: "INVALID_COMMAND" });
    }
    const result = dispatch(store, parsed);
    if (result.status === "rejected") {
      request.log.warn(
        {
          commandId: parsed.commandId,
          commandType: parsed.type,
          aggregateId: parsed.aggregateId,
          rejectionCode: result.code
        },
        "command_rejected"
      );
    } else {
      broadcast();
      scheduleTimers();
    }
    return reply.code(result.status === "rejected" ? 409 : 200).send(result);
  });

  app.get("/ws", { websocket: true }, (rawSocket) => {
    const socket = rawSocket as unknown as SocketLike;
    const subscriber: Subscriber = { socket, display: false, lobby: false };
    subscribers.add(subscriber);
    send(subscriber, { type: "connected", data: { version: store.load().version } });

    socket.on("message", (raw: Buffer) => {
      try {
        const input = JSON.parse(raw.toString()) as Record<string, any>;
        if (input.type === "subscription.lobby") {
          const payload = input.payload as { accountId?: string; connectionId?: string };
          const domain = new PlatformDomain(store.load());
          domain.assertLease(payload.accountId ?? "", payload.connectionId ?? "");
          subscriber.accountId = payload.accountId;
          subscriber.connectionId = payload.connectionId;
          subscriber.roomId = undefined;
          subscriber.display = false;
          subscriber.lobby = true;
          if (setPresence(payload.accountId ?? "", payload.connectionId ?? "", true)) {
            broadcast();
            scheduleTimers();
          }
          sendLobby(subscriber);
          return;
        }
        if (input.type === "subscription.room") {
          const payload = input.payload as {
            roomId: string;
            accountId?: string;
            connectionId?: string;
            display?: boolean;
          };
          if (payload.display !== true) {
            const domain = new PlatformDomain(store.load());
            domain.assertLease(payload.accountId ?? "", payload.connectionId ?? "");
          }
          subscriber.accountId = payload.accountId;
          subscriber.connectionId = payload.connectionId;
          subscriber.roomId = payload.roomId;
          subscriber.display = payload.display === true;
          subscriber.lobby = false;
          if (
            payload.display !== true &&
            setPresence(payload.accountId ?? "", payload.connectionId ?? "", true)
          ) {
            broadcast();
            scheduleTimers();
          }
          sendRoom(subscriber);
          return;
        }
        const parsed = parseExternalCommand(input);
        if (!parsed) throw new DomainError("INVALID_COMMAND");
        const result = dispatch(store, parsed);
        send(subscriber, { type: "result", data: result });
        if (result.status !== "rejected") {
          broadcast();
          scheduleTimers();
        }
      } catch {
        send(subscriber, { type: "error", code: "INVALID_COMMAND" });
      }
    });
    socket.on("close", () => {
      subscribers.delete(subscriber);
      if (
        subscriber.accountId &&
        subscriber.connectionId &&
        ![...subscribers].some(
          (candidate) =>
            candidate.accountId === subscriber.accountId &&
            candidate.connectionId === subscriber.connectionId
        ) &&
        setPresence(subscriber.accountId, subscriber.connectionId, false)
      ) {
        broadcast();
        scheduleTimers();
      }
    });
  });

  if (options.staticRoot) {
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && request.headers.accept?.includes("text/html")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ code: "NOT_FOUND" });
    });
  }

  scheduleTimers();
  return app;
}

export function dispatch(store: PlatformStore, envelope: CommandEnvelope) {
  return store.execute(envelope, (domain) => {
    const payload = envelope.payload as Record<string, any>;
    const accountId = String(payload.accountId ?? "");
    const roomId = String(payload.roomId ?? envelope.aggregateId);
    const assertLease = () => {
      if (!accountId || !envelope.connectionId) throw new DomainError("STALE_CONNECTION");
      domain.assertLease(accountId, envelope.connectionId);
    };
    const requireRoom = () => {
      const room = domain.state.rooms[roomId];
      if (!room) throw new DomainError("ROOM_NOT_FOUND");
      return room;
    };
    const requirePokerRoom = () => {
      const room = requireRoom();
      if (room.gameType !== "texas-holdem") {
        throw new DomainError("WRONG_GAME_TYPE");
      }
      return room;
    };
    const requireAvalonRoom = () => {
      const room = requireRoom();
      if (room.gameType !== "avalon") {
        throw new DomainError("WRONG_GAME_TYPE");
      }
      return room;
    };
    const requireHost = () => {
      assertLease();
      const room = requireRoom();
      if (room.hostAccountId !== accountId) throw new DomainError("HOST_ONLY");
      return room;
    };
    const avalonConfig = (): AvalonRoomConfig => {
      const config = payload.config as Record<string, any>;
      const common = {
        recognitionMode: config.recognitionMode,
        oberonRule: config.oberonRule,
        stake: Number(config.stake),
        hostTransferTimeoutSeconds: Number(
          config.hostTransferTimeoutSeconds
        )
      };
      return config.roleSource === "custom"
        ? {
            ...common,
            roleSource: "custom",
            roles: [...(config.roles as string[])]
          } as AvalonRoomConfig
        : {
            ...common,
            roleSource: "preset",
            rolePresets: structuredClone(
              domain.state.settings.avalon.rolePresets
            )
          };
    };

    switch (envelope.type) {
      case "account.profile":
        assertLease();
        return domain.updateProfile(
          accountId,
          String(payload.username),
          String(payload.avatar),
          payload.language,
          payload.theme,
          Number(payload.volume)
        );
      case "room.create":
        assertLease();
        {
          if (payload.gameType === "avalon") {
            const room = domain.createAvalonRoom(
              accountId,
              String(payload.name ?? ""),
              avalonConfig()
            );
            return domain.projectRoom(room.id, { accountId });
          }
          const room = domain.createRoom(
            accountId,
            String(payload.name ?? ""),
            payload.config
          );
          domain.joinRoom(room.id, accountId, Number(payload.buyIn));
          return domain.projectRoom(room.id, { accountId });
        }
      case "room.join":
        assertLease();
        if (payload.gameType === "avalon") {
          return domain.projectRoom(
            domain.joinAvalonRoom(roomId, accountId).id,
            { accountId }
          );
        }
        return domain.projectRoom(
          domain.joinRoom(roomId, accountId, Number(payload.buyIn)).id,
          { accountId }
        );
      case "room.start": {
        assertLease();
        requirePokerRoom();
        return startSelectedHand(domain, roomId, accountId, {
          pokerVersion:
            payload.pokerVersion === undefined
              ? undefined
              : Number(payload.pokerVersion),
          confirmUnready: payload.confirmUnready === true
        });
      }
      case "room.pause":
        requireHost();
        return domain.projectRoom(domain.pauseRoom(roomId, accountId).id, { accountId });
      case "room.resume":
        requireHost();
        return domain.projectRoom(domain.resumeRoom(roomId, accountId).id, { accountId });
      case "room.transfer-host":
        requireHost();
        return domain.projectRoom(
          domain.transferHost(roomId, accountId, String(payload.targetAccountId)).id,
          { accountId }
        );
      case "room.top-up":
        assertLease();
        return domain.projectRoom(domain.topUp(roomId, accountId, Number(payload.amount)).id, {
          accountId
        });
      case "room.leave": {
        assertLease();
        const room = requireRoom();
        const activeAvalonParticipant =
          room.gameType === "avalon" &&
          Boolean(
            room.avalon &&
              !["complete", "void"].includes(room.avalon.phase) &&
              room.avalon.participants.some(
                (participant) => participant.accountId === accountId
              )
          );
        if (activeAvalonParticipant && payload.confirmed !== true) {
          throw new DomainError("AVALON_VOID_CONFIRMATION_REQUIRED");
        }
        const leavingHost = room.hostAccountId === accountId;
        if (leavingHost) {
          const candidates = room.seats.filter(
            (seat) => seat.accountId !== accountId && seat.connected
          );
          if (candidates.length === 0) {
            domain.closeRoom(roomId);
            return { left: true, closed: true };
          }
          if (
            room.gameType === "texas-holdem" &&
            room.poker &&
            !["complete", "waiting", "void"].includes(room.poker.phase) &&
            room.poker.players.some((player) => player.accountId === accountId)
          ) {
            forceFold(room.poker, accountId);
          }
          const nextHost = candidates[randomInt(candidates.length)]!;
          domain.leaveRoom(roomId, accountId, true, nextHost.accountId);
          return { left: true, hostAccountId: nextHost.accountId };
        }
        domain.leaveRoom(roomId, accountId);
        return { left: true };
      }
      case "room.remove": {
        const room = requireHost();
        const targetAccountId = String(payload.targetAccountId);
        if (targetAccountId === room.hostAccountId) {
          throw new DomainError("CANNOT_REMOVE_HOST");
        }
        const targetSeat = room.seats.find(
          (seat) => seat.accountId === targetAccountId
        );
        if (!targetSeat) throw new DomainError("PLAYER_NOT_IN_ROOM");
        if (room.gameType === "avalon") {
          const activeParticipant = Boolean(
            room.avalon &&
              !["complete", "void"].includes(room.avalon.phase) &&
              room.avalon.participants.some(
                (participant) => participant.accountId === targetAccountId
              )
          );
          if (activeParticipant && payload.confirmed !== true) {
            throw new DomainError("AVALON_VOID_CONFIRMATION_REQUIRED");
          }
        } else {
          const handActive = Boolean(
            room.poker &&
              !["complete", "waiting", "void"].includes(room.poker.phase)
          );
          if (
            handActive &&
            room.poker?.players.some(
              (player) => player.accountId === targetAccountId
            )
          ) {
            forceFold(room.poker, targetAccountId);
          }
        }
        const remaining = domain.leaveRoom(roomId, targetAccountId, true);
        if (!remaining) return { closed: true };
        return domain.projectRoom(remaining.id, { accountId });
      }
      case "room.close":
        requireHost();
        domain.closeRoom(roomId);
        return { closed: true };
      case "poker.action": {
        assertLease();
        const room = requirePokerRoom();
        if (room.status !== "in_progress") throw new DomainError("ROOM_PAUSED");
        if (!room.poker) throw new DomainError("POKER_NOT_STARTED");
        const beforeStack =
          room.poker.players.find((player) => player.accountId === accountId)?.stack ?? 0;
        act(room.poker, accountId, payload.action, Number(payload.pokerVersion));
        const afterStack =
          room.poker.players.find((player) => player.accountId === accountId)?.stack ?? 0;
        domain.recordPokerMovement(
          room.id,
          accountId,
          beforeStack - afterStack,
          "table-to-pot",
          `poker-${String((payload.action as { kind?: string })?.kind ?? "action")}`,
          room.poker.handNumber
        );
        room.version += 1;
        return domain.projectRoom(room.id, { accountId });
      }
      case "poker.undo": {
        assertLease();
        const room = requirePokerRoom();
        if (!room.poker) throw new DomainError("POKER_NOT_STARTED");
        const actionKind = room.poker.lastAction?.kind;
        const beforeStack =
          room.poker.players.find((player) => player.accountId === accountId)?.stack ?? 0;
        room.poker = undoLastAction(room.poker, accountId, Number(payload.pokerVersion));
        const afterStack =
          room.poker.players.find((player) => player.accountId === accountId)?.stack ?? 0;
        domain.recordPokerMovement(
          room.id,
          accountId,
          afterStack - beforeStack,
          "pot-to-table",
          `poker-${actionKind ?? "action"}-undo`,
          room.poker.handNumber,
          actionKind ? `poker-${actionKind}` : undefined
        );
        room.version += 1;
        return domain.projectRoom(room.id, { accountId });
      }
      case "system.poker.advance": {
        const room = requirePokerRoom();
        if (!room.poker) throw new DomainError("POKER_NOT_STARTED");
        advancePhase(room.poker, Date.now(), Number(payload.pokerVersion));
        room.version += 1;
        return domain.projectRoom(room.id, { display: true });
      }
      case "poker.settle": {
        requireHost();
        const room = requirePokerRoom();
        if (!room.poker) throw new DomainError("POKER_NOT_STARTED");
        if (room.poker.phase !== "showdown") throw new DomainError("INVALID_PHASE");
        if (room.status !== "in_progress") throw new DomainError("ROOM_PAUSED");
        const beforeStacks = pokerStacks(room);
        const startingStacks = pokerStartingStacks(room);
        delete room.poker.advanceDeadline;
        delete room.poker.pausedAdvanceRemainingMs;
        if (room.config.mode === "chips-only") {
          settleManual(room.poker, payload.winnersByPot, Number(payload.pokerVersion));
        } else {
          settleAutomatically(room.poker);
        }
        recordSettlement(domain, room, beforeStacks, startingStacks);
        beginDistribution(room);
        room.version += 1;
        return domain.projectRoom(room.id, { accountId });
      }
      case "system.poker.settle": {
        const room = requirePokerRoom();
        if (!room.poker) throw new DomainError("POKER_NOT_STARTED");
        const beforeStacks = pokerStacks(room);
        const startingStacks = pokerStartingStacks(room);
        delete room.poker.advanceDeadline;
        delete room.poker.pausedAdvanceRemainingMs;
        if (room.config.mode === "chips-and-cards") {
          settleAutomatically(room.poker);
        } else {
          const winners = room.poker.pots.map((pot) => {
            if (pot.eligibleAccountIds.length !== 1) throw new DomainError("WINNER_REQUIRED");
            return [pot.eligibleAccountIds[0]!];
          });
          settleManual(room.poker, winners, room.poker.version);
        }
        recordSettlement(domain, room, beforeStacks, startingStacks);
        beginDistribution(room);
        room.version += 1;
        return domain.projectRoom(room.id, { display: true });
      }
      case "system.poker.await-winners": {
        const room = requirePokerRoom();
        if (!room.poker) throw new DomainError("POKER_NOT_STARTED");
        if (room.poker.phase !== "showdown" || room.config.mode !== "chips-only") {
          throw new DomainError("INVALID_PHASE");
        }
        delete room.poker.advanceDeadline;
        room.version += 1;
        return domain.projectRoom(room.id, { display: true });
      }
      case "system.poker.complete-distribution": {
        const room = requirePokerRoom();
        if (!room.poker) throw new DomainError("POKER_NOT_STARTED");
        if (
          room.poker.phase !== "distribution" ||
          room.poker.version !== Number(payload.pokerVersion)
        ) {
          throw new DomainError("STALE_VERSION");
        }
        if (
          room.poker.advanceDeadline === undefined ||
          room.poker.advanceDeadline > Date.now()
        ) {
          throw new DomainError("ADVANCE_NOT_DUE");
        }
        delete room.poker.advanceDeadline;
        room.poker.phase = "complete";
        room.poker.version += 1;
        room.version += 1;
        return domain.projectRoom(room.id, { display: true });
      }
      case "poker.undo-settlement": {
        requireHost();
        const room = requirePokerRoom();
        if (!room.poker) throw new DomainError("POKER_NOT_STARTED");
        if ((room.poker.departedAccountIds?.length ?? 0) > 0) {
          throw new DomainError("SETTLEMENT_UNDO_UNAVAILABLE_AFTER_LEAVE");
        }
        if (room.config.mode !== "chips-only") {
          throw new DomainError("SETTLEMENT_UNDO_NOT_AVAILABLE");
        }
        if (room.poker.version !== Number(payload.pokerVersion)) {
          throw new DomainError("STALE_VERSION");
        }
        const beforeStacks = pokerStacks(room);
        const handNumber = room.poker.handNumber;
        room.poker = undoSettlement(room.poker);
        for (const player of room.poker.players) {
          const amount = (beforeStacks.get(player.accountId) ?? player.stack) - player.stack;
          domain.recordPokerMovement(
            room.id,
            player.accountId,
            amount,
            "table-to-pot",
            "settlement-undo",
            handNumber,
            "settlement"
          );
        }
        domain.reverseHandResult(room.id, handNumber);
        room.version += 1;
        return domain.projectRoom(room.id, { accountId });
      }
      case "poker.ready": {
        assertLease();
        const room = requirePokerRoom();
        domain.setReady(
          room.id,
          accountId,
          payload.ready !== false,
          payload.pokerVersion === undefined
            ? undefined
            : Number(payload.pokerVersion)
        );
        return domain.projectRoom(room.id, { accountId });
      }
      case "avalon.config.update": {
        assertLease();
        const room = requireAvalonRoom();
        return domain.projectRoom(
          domain.updateAvalonRoomConfig(
            room.id,
            accountId,
            avalonConfig(),
            payload.avalonVersion === undefined
              ? undefined
              : Number(payload.avalonVersion)
          ).id,
          { accountId }
        );
      }
      case "avalon.ready": {
        assertLease();
        const room = requireAvalonRoom();
        return domain.projectRoom(
          domain.setAvalonReady(
            room.id,
            accountId,
            payload.ready !== false,
            payload.avalonVersion === undefined
              ? undefined
              : Number(payload.avalonVersion)
          ).id,
          { accountId }
        );
      }
      case "avalon.start": {
        assertLease();
        const room = requireAvalonRoom();
        return domain.projectRoom(
          domain.startAvalonGame(room.id, accountId, {
            expectedAvalonVersion:
              payload.avalonVersion === undefined
                ? undefined
                : Number(payload.avalonVersion),
            confirmUnready: payload.confirmUnready === true,
            randomInt: (maxExclusive) => randomInt(maxExclusive)
          }).id,
          { accountId }
        );
      }
      case "avalon.role.confirm": {
        assertLease();
        const room = requireAvalonRoom();
        return domain.projectRoom(
          domain.confirmAvalonRole(
            room.id,
            accountId,
            Number(payload.avalonVersion)
          ).id,
          { accountId }
        );
      }
      case "avalon.night.advance": {
        assertLease();
        const room = requireAvalonRoom();
        return domain.projectRoom(
          domain.advanceAvalonNight(
            room.id,
            accountId,
            Number(payload.avalonVersion)
          ).id,
          { accountId }
        );
      }
      case "avalon.night.restart": {
        assertLease();
        const room = requireAvalonRoom();
        return domain.projectRoom(
          domain.restartAvalonNight(
            room.id,
            accountId,
            Number(payload.avalonVersion)
          ).id,
          { accountId }
        );
      }
      case "avalon.team.propose": {
        assertLease();
        const room = requireAvalonRoom();
        return domain.projectRoom(
          domain.proposeAvalonTeam(
            room.id,
            accountId,
            (payload.teamAccountIds as unknown[]).map(String),
            Number(payload.avalonVersion)
          ).id,
          { accountId }
        );
      }
      case "avalon.vote": {
        assertLease();
        const room = requireAvalonRoom();
        return domain.projectRoom(
          domain.castAvalonVote(
            room.id,
            accountId,
            payload.approve === true,
            Number(payload.avalonVersion)
          ).id,
          { accountId }
        );
      }
      case "avalon.mission": {
        assertLease();
        const room = requireAvalonRoom();
        return domain.projectRoom(
          domain.submitAvalonMission(
            room.id,
            accountId,
            payload.choice,
            Number(payload.avalonVersion)
          ).id,
          { accountId }
        );
      }
      case "avalon.assassinate": {
        assertLease();
        const room = requireAvalonRoom();
        return domain.projectRoom(
          domain.assassinateInAvalon(
            room.id,
            accountId,
            String(payload.targetAccountId),
            Number(payload.avalonVersion)
          ).id,
          { accountId }
        );
      }
      case "avalon.void": {
        const room = requireHost();
        if (room.gameType !== "avalon") {
          throw new DomainError("WRONG_GAME_TYPE");
        }
        return domain.projectRoom(
          domain.voidAvalonRound(
            room.id,
            Number(payload.avalonVersion)
          ).id,
          { accountId }
        );
      }
      case "system.connection.open":
        domain.assertLease(accountId, envelope.connectionId ?? "");
        domain.connect(accountId);
        return { connected: true };
      case "system.connection.close": {
        domain.assertLease(accountId, envelope.connectionId ?? "");
        const room = domain.roomForAccount(accountId);
        if (room) domain.disconnect(room.id, accountId);
        return { connected: false };
      }
      case "system.room.resolve-host-timeout": {
        const room = requireRoom();
        if (room.hostDisconnectDeadline !== Number(payload.deadline)) {
          throw new DomainError("HOST_TIMEOUT_CHANGED");
        }
        const remaining = domain.resolveHostTimeout(room.id, (ids) => ids[randomInt(ids.length)]!);
        return remaining
          ? domain.projectRoom(remaining.id, { display: true })
          : { closed: true };
      }
      default:
        throw new DomainError("UNSUPPORTED_COMMAND");
    }
  });
}

export function dispatchAdmin(
  store: PlatformStore,
  envelope: CommandEnvelope
) {
  return store.execute(envelope, (domain) => {
    const payload = envelope.payload as Record<string, any>;
    switch (envelope.type) {
      case "admin.settings.update":
        return domain.updateSettings(payload.settings as GlobalSettings);
      case "admin.accounts.delete": {
        const targets = domain.validateAccountDeletionTargets(
          (payload.accountIds as unknown[]).map(String)
        );
        removeAccountsFromRooms(domain, targets);
        return domain.deleteAccounts(targets);
      }
      case "admin.seasons.delete":
        return domain.deleteHistoricalSeasons(
          (payload.seasonIds as unknown[]).map(String)
        );
      case "admin.season.start":
        domain.startSeason(
          typeof payload.name === "string" ? payload.name : undefined,
          Number(payload.baseScore)
        );
        return { ok: true };
      default:
        throw new DomainError("UNSUPPORTED_COMMAND");
    }
  });
}

function removeAccountsFromRooms(
  domain: PlatformDomain,
  accountIds: readonly string[]
): void {
  const selected = new Set(accountIds);
  const roomIds = Object.values(domain.state.rooms)
    .filter((room) =>
      room.seats.some((seat) => selected.has(seat.accountId))
    )
    .map((room) => room.id)
    .sort();

  for (const roomId of roomIds) {
    const initialRoom = domain.state.rooms[roomId];
    if (!initialRoom) continue;
    const selectedSeatIds = initialRoom.seats
      .filter((seat) => selected.has(seat.accountId))
      .sort((left, right) => left.position - right.position)
      .map((seat) => seat.accountId);
    const hostAccountId = initialRoom.hostAccountId;
    let nextHostAccountId: string | undefined;

    if (selected.has(hostAccountId)) {
      const candidates = initialRoom.seats.filter(
        (seat) => !selected.has(seat.accountId) && seat.connected
      );
      if (candidates.length === 0) {
        domain.closeRoom(roomId);
        continue;
      }
      nextHostAccountId = candidates[randomInt(candidates.length)]!.accountId;
    }

    for (const accountId of selectedSeatIds) {
      if (accountId === hostAccountId) continue;
      foldActivePlayerForRemoval(domain.state.rooms[roomId], accountId);
      domain.leaveRoom(roomId, accountId, true);
    }

    if (selected.has(hostAccountId)) {
      foldActivePlayerForRemoval(domain.state.rooms[roomId], hostAccountId);
      domain.leaveRoom(roomId, hostAccountId, true, nextHostAccountId);
    }
  }
}

function foldActivePlayerForRemoval(
  room: Room | undefined,
  accountId: string
): void {
  if (room?.gameType !== "texas-holdem") return;
  const player = room.poker?.players.find(
    (candidate) => candidate.accountId === accountId
  );
  if (
    !room?.poker ||
    ["complete", "waiting", "void"].includes(room.poker.phase) ||
    !player ||
    player.folded
  ) {
    return;
  }
  forceFold(room.poker, accountId);
}

function startSelectedHand(
  domain: PlatformDomain,
  roomId: string,
  hostAccountId: string,
  options: {
    pokerVersion?: number;
    confirmUnready: boolean;
  }
) {
  const room = domain.state.rooms[roomId];
  if (!room) throw new DomainError("ROOM_NOT_FOUND");
  if (room.gameType !== "texas-holdem") {
    throw new DomainError("WRONG_GAME_TYPE");
  }
  if (room.hostAccountId !== hostAccountId) throw new DomainError("HOST_ONLY");
  const waiting = room.status === "waiting";
  const complete = room.poker?.phase === "complete";
  if (!waiting && !complete) throw new DomainError("HAND_IN_PROGRESS");
  if (complete && room.status !== "in_progress") {
    throw new DomainError("ROOM_PAUSED");
  }
  if (complete && room.poker?.version !== options.pokerVersion) {
    throw new DomainError("STALE_VERSION");
  }
  const previous = room.poker;
  const seatStacks = room.seats.map((seat) => ({
    seat,
    stack: seat.tableChips
  }));
  const hostEntry = seatStacks.find(
    ({ seat }) => seat.accountId === hostAccountId
  );
  if (!hostEntry) throw new DomainError("PLAYER_NOT_IN_ROOM");
  if (!hostEntry.seat.connected) throw new DomainError("PLAYER_OFFLINE");
  if (hostEntry.stack <= 0) throw new DomainError("HOST_NEEDS_TOP_UP");

  const ready = new Set(domain.readyAccountIdsForRoom(room));
  const selected = seatStacks.filter(
    ({ seat, stack }) =>
      seat.accountId === hostAccountId ||
      (ready.has(seat.accountId) && seat.connected && stack > 0)
  );
  if (selected.length < 2) throw new DomainError("NOT_ENOUGH_READY_PLAYERS");
  const selectedIds = new Set(selected.map(({ seat }) => seat.accountId));
  const unreadyMembers = room.seats.filter(
    (seat) => seat.accountId !== hostAccountId && !selectedIds.has(seat.accountId)
  );
  if (unreadyMembers.length > 0 && !options.confirmUnready) {
    throw new DomainError("UNREADY_PLAYERS_REQUIRE_CONFIRMATION");
  }

  for (const { seat, stack } of seatStacks) {
    seat.tableChips = stack;
    seat.currentBet = 0;
    seat.folded = false;
    seat.allIn = false;
  }
  const players = selected.map(({ seat, stack }) => ({
    accountId: seat.accountId,
    position: seat.position,
    stack
  }));
  const positions = players.map((player) => player.position).sort((a, b) => a - b);
  const dealerPosition = previous
    ? positions.find((position) => position > previous.dealerPosition) ?? positions[0]!
    : undefined;

  if (waiting) domain.startRoom(room.id, hostAccountId);
  room.waitingReadyAccountIds = [];
  room.poker = createPokerState({
    players,
    mode: room.config.mode,
    smallBlind: room.config.smallBlind,
    bigBlind: room.config.bigBlind,
    dealerPosition,
    denominations: domain.state.settings.poker.denominations
  });
  if (previous) room.poker.handNumber = previous.handNumber + 1;
  recordInitialBets(domain, room);
  room.version += 1;
  return domain.projectRoom(room.id, { accountId: hostAccountId });
}

function leaseIsCurrent(
  domain: PlatformDomain,
  accountId: string,
  connectionId: string
): boolean {
  try {
    domain.assertLease(accountId, connectionId);
    return true;
  } catch {
    return false;
  }
}

function parseExternalCommand(input: unknown): CommandEnvelope | undefined {
  const envelope = commandEnvelopeSchema.safeParse(input);
  if (!envelope.success || envelope.data.type.startsWith("system.")) return undefined;
  const payloadSchema = commandPayloadSchemas[envelope.data.type];
  if (!payloadSchema || !payloadSchema.safeParse(envelope.data.payload).success) return undefined;
  return envelope.data as CommandEnvelope;
}

function parseAdminCommand(input: unknown): CommandEnvelope | undefined {
  const envelope = commandEnvelopeSchema.safeParse(input);
  if (
    !envelope.success ||
    envelope.data.aggregateId !== "platform" ||
    envelope.data.connectionId !== undefined
  ) {
    return undefined;
  }
  const payloadSchema = adminCommandPayloadSchemas[envelope.data.type];
  if (
    !payloadSchema ||
    !payloadSchema.safeParse(envelope.data.payload).success
  ) {
    return undefined;
  }
  return envelope.data as CommandEnvelope;
}

function pokerStacks(room: { poker?: { players: Array<{ accountId: string; stack: number }> } }) {
  return new Map(
    room.poker?.players.map((player) => [player.accountId, player.stack]) ?? []
  );
}

function pokerStartingStacks(room: {
  poker?: {
    players: Array<{ accountId: string; stack: number; totalBet: number }>;
  };
}) {
  return new Map(
    room.poker?.players.map((player) => [
      player.accountId,
      player.stack + player.totalBet
    ]) ?? []
  );
}

function recordInitialBets(
  domain: PlatformDomain,
  room: {
    id: string;
    poker?: {
      handNumber: number;
      players: Array<{ accountId: string; totalBet: number }>;
    };
  }
): void {
  if (!room.poker) return;
  for (const player of room.poker.players) {
    domain.recordPokerMovement(
      room.id,
      player.accountId,
      player.totalBet,
      "table-to-pot",
      "blind",
      room.poker.handNumber
    );
  }
}

function recordSettlement(
  domain: PlatformDomain,
  room: PokerRoom,
  beforeStacks: Map<string, number>,
  startingStacks: Map<string, number>
): void {
  if (!room.poker) return;
  const payouts = room.poker.players
    .map((player) => ({
      accountId: player.accountId,
      amount: player.stack - (beforeStacks.get(player.accountId) ?? player.stack)
    }))
    .filter((payout) => payout.amount > 0);
  for (const payout of payouts) {
    domain.recordPokerMovement(
      room.id,
      payout.accountId,
      payout.amount,
      "pot-to-table",
      "settlement",
      room.poker.handNumber
    );
  }
  const payoutAccountIds = new Set(payouts.map((payout) => payout.accountId));
  const livePlayers = room.poker.players.filter((player) => !player.folded);
  const showdown =
    room.config.mode === "chips-and-cards" &&
    livePlayers.length > 1 &&
    room.poker.communityCards.length === 5
      ? {
          communityCards: structuredClone(room.poker.communityCards),
          players: livePlayers.map((player) => {
            const cards = room.poker?.holeCards[player.accountId] ?? [];
            const score = evaluateSeven([
              ...cards,
              ...(room.poker?.communityCards ?? [])
            ]);
            return {
              accountId: player.accountId,
              cards: structuredClone(cards),
              handCategory: handCategoryFromScore(score),
              winner: payoutAccountIds.has(player.accountId)
            };
          })
        }
      : undefined;
  domain.recordHandResult(
    room.id,
    room.poker.handNumber,
    room.config.mode,
    payouts,
    "settled",
    room.poker.players.map((player) => player.accountId),
    {
      chipDeltas: room.poker.players.map((player) => ({
        accountId: player.accountId,
        amount:
          player.stack -
          (startingStacks.get(player.accountId) ?? player.stack),
        endingChips: player.stack
      })),
      showdown
    }
  );
  const stacks = new Map(
    room.poker.players.map((player) => [player.accountId, player.stack])
  );
  for (const seat of room.seats) {
    const stack = stacks.get(seat.accountId);
    if (stack === undefined) continue;
    seat.tableChips = stack;
    seat.currentBet = 0;
    seat.folded = false;
    seat.allIn = stack === 0;
  }
}

function beginDistribution(room: PokerRoom): void {
  if (!room.poker) return;
  room.poker.phase = "distribution";
  room.poker.actingAccountId = null;
  room.poker.readyAccountIds = [];
  room.poker.lastAction = room.poker.lastAction
    ? { ...room.poker.lastAction, reversible: false }
    : undefined;
  delete room.poker.undoSnapshot;
  room.poker.advanceDeadline = Date.now() + 3_000;
}

function runScheduledPokerAction(store: PlatformStore, roomId: string, deadline: number): void {
  const state = store.load();
  const room = state.rooms[roomId];
  if (
    room?.gameType !== "texas-holdem" ||
    !room.poker ||
    room.poker.advanceDeadline !== deadline
  ) {
    return;
  }
  let type = "system.poker.advance";
  if (room.poker.phase === "showdown") {
    type =
      room.config.mode === "chips-only" &&
      room.poker.pots.some((pot) => pot.eligibleAccountIds.length !== 1)
        ? "system.poker.await-winners"
        : "system.poker.settle";
  }
  if (room.poker.phase === "distribution") {
    type = "system.poker.complete-distribution";
  }
  dispatch(store, {
    commandId: `timer:${roomId}:${deadline}:${state.version}`,
    aggregateId: roomId,
    expectedVersion: state.version,
    type,
    payload: {
      roomId,
      pokerVersion: room.poker.version
    }
  });
}

function runScheduledHostAction(store: PlatformStore, roomId: string, deadline: number): void {
  const state = store.load();
  const room = state.rooms[roomId];
  if (!room || room.hostDisconnectDeadline !== deadline) return;
  dispatch(store, {
    commandId: `host-timer:${roomId}:${deadline}:${state.version}`,
    aggregateId: roomId,
    expectedVersion: state.version,
    type: "system.room.resolve-host-timeout",
    payload: { roomId, deadline }
  });
}

export function defaultStaticRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../dist/web");
}
