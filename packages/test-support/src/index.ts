import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CommandEnvelope, RoomConfig } from "@party/contracts";

export const defaultRoomConfig: RoomConfig = {
  mode: "chips-and-cards",
  smallBlind: 50,
  bigBlind: 100,
  minBuyIn: 2_000,
  maxBuyIn: 20_000,
  hostTransferTimeoutSeconds: 60
};

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
