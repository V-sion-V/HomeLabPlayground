import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  AvalonRoom,
  AvalonRoomConfig,
  AvalonRoomProjection,
  CommandEnvelope,
  PokerRoom,
  PokerRoomProjection,
  Room,
  RoomConfig,
  RoomProjection
} from "@party/contracts";
import { DEFAULT_AVALON_ROLE_PRESETS } from "@party/avalon";

export const defaultRoomConfig: RoomConfig = {
  mode: "chips-and-cards",
  smallBlind: 50,
  bigBlind: 100,
  minBuyIn: 2_000,
  maxBuyIn: 20_000,
  hostTransferTimeoutSeconds: 60
};

export const defaultAvalonRoomConfig: AvalonRoomConfig = {
  recognitionMode: "automatic",
  oberonRule: "original",
  stake: 100,
  hostTransferTimeoutSeconds: 60,
  roleSource: "preset",
  rolePresets: structuredClone(DEFAULT_AVALON_ROLE_PRESETS)
};

export function requirePokerRoom(room: Room | undefined): PokerRoom {
  if (room?.gameType !== "texas-holdem") {
    throw new Error("EXPECTED_POKER_ROOM");
  }
  return room;
}

export function requireAvalonRoom(room: Room | undefined): AvalonRoom {
  if (room?.gameType !== "avalon") {
    throw new Error("EXPECTED_AVALON_ROOM");
  }
  return room;
}

export function requireAvalonProjection(
  projection: RoomProjection
): AvalonRoomProjection {
  if (projection.gameType !== "avalon") {
    throw new Error("EXPECTED_AVALON_PROJECTION");
  }
  return projection;
}

export function requirePokerProjection(
  projection: RoomProjection
): PokerRoomProjection {
  if (projection.gameType !== "texas-holdem") {
    throw new Error("EXPECTED_POKER_PROJECTION");
  }
  return projection;
}

export function command<T>(
  version: number,
  type: string,
  payload: T,
  aggregateId = "platform"
): CommandEnvelope<T> {
  return {
    commandId: randomUUID(),
    aggregateId,
    expectedVersion: version,
    type,
    payload
  };
}

export function temporaryDatabase(name = "platform.sqlite"): string {
  return join(mkdtempSync(join(tmpdir(), "party-platform-")), name);
}
