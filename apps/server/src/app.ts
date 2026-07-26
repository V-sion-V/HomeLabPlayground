import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { commandEnvelopeSchema, type CommandEnvelope } from "@party/contracts";
import { PlatformDomain } from "@party/domain";
import { PlatformStore } from "@party/persistence";
import {
  act,
  advancePhase,
  createPokerState,
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
  app.addHook("onClose", async () => store.close());
  await app.register(websocket);

  if (options.staticRoot) {
    await app.register(fastifyStatic, { root: resolve(options.staticRoot) });
  }

  app.get("/healthz", async () => ({ status: "ok", version: store.load().version }));

  app.post("/api/enter", async (request, reply) => {
    const body = request.body as { username?: string; avatar?: string };
    if (typeof body?.username !== "string") {
      return reply.code(400).send({ code: "INVALID_USERNAME" });
    }
    const snapshot = store.load();
    const envelope: CommandEnvelope = {
      commandId: request.id,
      aggregateId: "platform",
      expectedVersion: snapshot.version,
      type: "account.enter",
      payload: body
    };
    const result = store.execute(envelope, (domain) => {
      const account = domain.enterAccount(body.username!, body.avatar);
      const connectionId = domain.acquireLease(account.id);
      return { account, connectionId, leaderboard: domain.currentLeaderboard() };
    });
    return reply.code(result.status === "rejected" ? 409 : 200).send(result);
  });

  app.get("/api/state", async () => {
    const state = store.load();
    const domain = new PlatformDomain(state);
    return {
      version: state.version,
      rooms: Object.keys(state.rooms),
      leaderboard: domain.currentLeaderboard(),
      settings: state.settings,
      seasons: state.seasons
    };
  });

  app.post("/api/command", async (request, reply) => {
    const parsed = commandEnvelopeSchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn({ rejectionCode: "INVALID_COMMAND" }, "command_rejected");
      return reply.code(400).send({ code: "INVALID_COMMAND" });
    }
    const result = dispatch(store, parsed.data as CommandEnvelope);
    if (result.status === "rejected") {
      request.log.warn(
        {
          commandId: parsed.data.commandId,
          commandType: parsed.data.type,
          aggregateId: parsed.data.aggregateId,
          rejectionCode: result.code
        },
        "command_rejected"
      );
    }
    return reply.code(result.status === "rejected" ? 409 : 200).send(result);
  });

  app.get("/ws", { websocket: true }, (socket) => {
    const initial = store.load();
    socket.send(
      JSON.stringify({
        type: "lobby",
        data: {
          version: initial.version,
          roomIds: Object.keys(initial.rooms)
        }
      })
    );
    socket.on("message", (raw: Buffer) => {
      try {
        const input = JSON.parse(raw.toString()) as Record<string, unknown>;
        if (input.type === "subscription.room") {
          const state = store.load();
          const domain = new PlatformDomain(state);
          const payload = input.payload as { roomId: string; accountId?: string; display?: boolean };
          socket.send(
            JSON.stringify({
              type: "projection",
              data: domain.projectRoom(payload.roomId, {
                accountId: payload.accountId,
                display: payload.display
              })
            })
          );
          return;
        }
        const parsed = commandEnvelopeSchema.parse(input);
        socket.send(
          JSON.stringify({
            type: "result",
            data: dispatch(store, parsed as CommandEnvelope)
          })
        );
      } catch {
        socket.send(JSON.stringify({ type: "error", code: "INVALID_COMMAND" }));
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
  return app;
}

export function dispatch(store: PlatformStore, envelope: CommandEnvelope) {
  return store.execute(envelope, (domain) => {
    const payload = envelope.payload as Record<string, any>;
    switch (envelope.type) {
      case "room.create":
        domain.assertLease(String(payload.accountId), String(envelope.connectionId));
        return domain.createRoom(
          String(payload.accountId),
          String(payload.name ?? ""),
          payload.config
        );
      case "room.join":
        domain.assertLease(String(payload.accountId), String(envelope.connectionId));
        return domain.joinRoom(
          String(payload.roomId),
          String(payload.accountId),
          Number(payload.buyIn)
        );
      case "room.start": {
        domain.assertLease(String(payload.accountId), String(envelope.connectionId));
        const room = domain.startRoom(String(payload.roomId), String(payload.accountId));
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
        return domain.projectRoom(room.id, { accountId: String(payload.accountId) });
      }
      case "poker.action": {
        domain.assertLease(String(payload.accountId), String(envelope.connectionId));
        const room = domain.state.rooms[String(payload.roomId)];
        if (!room?.poker) throw new Error("POKER_NOT_STARTED");
        act(
          room.poker,
          String(payload.accountId),
          payload.action,
          Number(payload.pokerVersion)
        );
        room.version += 1;
        return domain.projectRoom(room.id, { accountId: String(payload.accountId) });
      }
      case "poker.undo": {
        domain.assertLease(String(payload.accountId), String(envelope.connectionId));
        const room = domain.state.rooms[String(payload.roomId)];
        if (!room?.poker) throw new Error("POKER_NOT_STARTED");
        room.poker = undoLastAction(
          room.poker,
          String(payload.accountId),
          Number(payload.pokerVersion)
        );
        room.version += 1;
        return domain.projectRoom(room.id, { accountId: String(payload.accountId) });
      }
      case "poker.advance": {
        const room = domain.state.rooms[String(payload.roomId)];
        if (!room?.poker) throw new Error("POKER_NOT_STARTED");
        advancePhase(room.poker, Date.now(), Number(payload.pokerVersion));
        room.version += 1;
        return domain.projectRoom(room.id, { display: true });
      }
      case "poker.settle": {
        domain.assertLease(String(payload.accountId), String(envelope.connectionId));
        const room = domain.state.rooms[String(payload.roomId)];
        if (!room?.poker) throw new Error("POKER_NOT_STARTED");
        if (room.config.mode === "chips-only") {
          settleManual(room.poker, payload.winnersByPot, Number(payload.pokerVersion));
        } else {
          settleAutomatically(room.poker);
        }
        room.version += 1;
        return domain.projectRoom(room.id, { accountId: String(payload.accountId) });
      }
      case "poker.undo-settlement": {
        domain.assertLease(String(payload.accountId), String(envelope.connectionId));
        const room = domain.state.rooms[String(payload.roomId)];
        if (!room?.poker) throw new Error("POKER_NOT_STARTED");
        if (room.hostAccountId !== payload.accountId) throw new Error("HOST_ONLY");
        room.poker = undoSettlement(room.poker);
        room.version += 1;
        return domain.projectRoom(room.id, { accountId: String(payload.accountId) });
      }
      case "season.start":
        domain.assertLease(String(payload.accountId), String(envelope.connectionId));
        domain.startSeason(
          typeof payload.name === "string" ? payload.name : undefined,
          Number(payload.baseScore)
        );
        return { ok: true };
      default:
        throw new Error(`Unsupported command: ${envelope.type}`);
    }
  });
}

export function defaultStaticRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../../dist/web");
}
