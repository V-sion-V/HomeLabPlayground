import { randomInt, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import {
  commandEnvelopeSchema,
  type CommandEnvelope,
  type GlobalSettings,
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
const roomConfigSchema = z.object({
  mode: z.enum(["chips-only", "chips-and-cards"]),
  smallBlind: z.number().int().positive(),
  bigBlind: z.number().int().positive(),
  minBuyIn: z.number().int().positive(),
  maxBuyIn: z.number().int().positive(),
  hostTransferTimeoutSeconds: z.number().int().positive()
});
const pokerActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fold") }),
  z.object({ kind: z.literal("check") }),
  z.object({ kind: z.literal("call") }),
  z.object({ kind: z.literal("all-in") }),
  z.object({ kind: z.literal("bet"), amount: z.number().int().positive() }),
  z.object({ kind: z.literal("raise"), amount: z.number().int().positive() })
]);
const commandPayloadSchemas: Record<string, z.ZodTypeAny> = {
  "account.profile": z.object({
    ...accountPayload,
    username: z.string().min(1).max(64),
    avatar: z.string().min(1).max(16)
  }),
  "settings.update": z.object({
    ...accountPayload,
    settings: z.object({
      defaultLanguage: z.enum(["zh-CN", "en"]),
      defaultHostTransferTimeoutSeconds: z.number().int().positive(),
      poker: roomConfigSchema
        .omit({ mode: true, hostTransferTimeoutSeconds: true })
        .extend({
          suitColorPreset: z.enum(["standard", "high-contrast"]),
          denominations: z.array(z.number())
      })
    })
  }),
  "account.delete": z.object({
    ...accountPayload,
    targetAccountId: z.string().min(1).max(128)
  }),
  "account.delete-others": z.object(accountPayload),
  "season.delete": z.object({
    ...accountPayload,
    targetSeasonId: z.string().min(1).max(128)
  }),
  "season.delete-history": z.object(accountPayload),
  "room.create": z.object({
    ...accountPayload,
    name: z.string().max(80),
    config: roomConfigSchema,
    buyIn: z.number().int().positive()
  }),
  "room.join": z.object({
    ...roomPayload,
    buyIn: z.number().int().positive()
  }),
  "room.start": z.object({
    ...roomPayload,
    pokerVersion: z.number().int().nonnegative().optional(),
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
    amount: z.number().int().positive()
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
    pokerVersion: z.number().int().nonnegative(),
    action: pokerActionSchema
  }),
  "poker.undo": z.object({
    ...roomPayload,
    pokerVersion: z.number().int().nonnegative()
  }),
  "poker.settle": z.object({
    ...roomPayload,
    pokerVersion: z.number().int().nonnegative(),
    winnersByPot: z.array(z.array(z.string().min(1).max(128)).min(1)).min(1)
  }),
  "poker.undo-settlement": z.object({
    ...roomPayload,
    pokerVersion: z.number().int().nonnegative()
  }),
  "poker.ready": z.object({
    ...roomPayload,
    pokerVersion: z.number().int().nonnegative().optional(),
    ready: z.boolean().optional()
  }),
  "season.start": z.object({
    ...accountPayload,
    name: z.string().max(80).optional(),
    baseScore: z.number().int().nonnegative()
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
      const deadline = room.poker?.advanceDeadline;
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

  app.post("/api/enter", async (request, reply) => {
    const parsedBody = z
      .object({
        username: z.string().min(1).max(64),
        avatar: z.string().min(1).max(16).optional()
      })
      .safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ code: "INVALID_USERNAME" });
    }
    const body = parsedBody.data;
    const snapshot = store.load();
    const envelope: CommandEnvelope = {
      commandId: `enter:${randomUUID()}`,
      aggregateId: "platform",
      expectedVersion: snapshot.version,
      type: "account.enter",
      payload: body
    };
    const result = store.execute(envelope, (domain) => {
      const account = domain.enterAccount(body.username, body.avatar);
      const connectionId = domain.acquireLease(account.id);
      const room = domain.roomForAccount(account.id);
      return {
        account,
        connectionId,
        lobby: domain.lobbyProjection(account.id),
        room: room ? domain.projectRoom(room.id, { accountId: account.id }) : undefined
      };
    });
    if (result.status !== "rejected") {
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
    const requireHost = () => {
      assertLease();
      const room = requireRoom();
      if (room.hostAccountId !== accountId) throw new DomainError("HOST_ONLY");
      return room;
    };

    switch (envelope.type) {
      case "account.profile":
        assertLease();
        return domain.updateProfile(accountId, String(payload.username), String(payload.avatar));
      case "settings.update":
        assertLease();
        return domain.updateSettings(payload.settings as GlobalSettings);
      case "account.delete":
        assertLease();
        return domain.deleteAccount(String(payload.targetAccountId), accountId);
      case "account.delete-others":
        assertLease();
        return domain.deleteOtherAccounts(accountId);
      case "season.delete":
        assertLease();
        return domain.deleteHistoricalSeason(
          String(payload.targetSeasonId),
          accountId
        );
      case "season.delete-history":
        assertLease();
        return domain.deleteAllHistoricalSeasons(accountId);
      case "room.create":
        assertLease();
        {
          const room = domain.createRoom(accountId, String(payload.name ?? ""), payload.config);
          domain.joinRoom(room.id, accountId, Number(payload.buyIn));
          return domain.projectRoom(room.id, { accountId });
        }
      case "room.join":
        assertLease();
        return domain.projectRoom(
          domain.joinRoom(roomId, accountId, Number(payload.buyIn)).id,
          { accountId }
        );
      case "room.start": {
        requireHost();
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
        const handActive = Boolean(
          room.poker && !["complete", "waiting", "void"].includes(room.poker.phase)
        );
        if (
          handActive &&
          room.poker?.players.some((player) => player.accountId === targetAccountId)
        ) {
          forceFold(room.poker, targetAccountId);
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
        const room = requireRoom();
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
        const room = requireRoom();
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
        const room = requireRoom();
        if (!room.poker) throw new DomainError("POKER_NOT_STARTED");
        advancePhase(room.poker, Date.now(), Number(payload.pokerVersion));
        room.version += 1;
        return domain.projectRoom(room.id, { display: true });
      }
      case "poker.settle": {
        requireHost();
        const room = requireRoom();
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
        const room = requireRoom();
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
        const room = requireRoom();
        if (!room.poker) throw new DomainError("POKER_NOT_STARTED");
        if (room.poker.phase !== "showdown" || room.config.mode !== "chips-only") {
          throw new DomainError("INVALID_PHASE");
        }
        delete room.poker.advanceDeadline;
        room.version += 1;
        return domain.projectRoom(room.id, { display: true });
      }
      case "system.poker.complete-distribution": {
        const room = requireRoom();
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
        const room = requireRoom();
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
        const room = requireRoom();
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
      case "season.start":
        assertLease();
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
  room: {
    id: string;
    config: { mode: "chips-only" | "chips-and-cards" };
    seats: Array<{
      accountId: string;
      tableChips: number;
      currentBet: number;
      folded: boolean;
      allIn: boolean;
    }>;
    poker?: {
      handNumber: number;
      communityCards: NonNullable<Room["poker"]>["communityCards"];
      holeCards: NonNullable<Room["poker"]>["holeCards"];
      players: Array<{
        accountId: string;
        stack: number;
        folded: boolean;
      }>;
    };
  },
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

function beginDistribution(room: Room): void {
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
  if (!room?.poker || room.poker.advanceDeadline !== deadline) return;
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
