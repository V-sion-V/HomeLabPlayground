import { describe, expect, it } from "vitest";
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
});
