import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type {
  Account,
  AvalonRoom,
  AvalonRoomConfig,
  PlatformSnapshot
} from "@party/contracts";
import { selectableAvatars } from "@party/contracts";
import {
  buildApp,
  dispatch,
  dispatchAdmin
} from "../apps/server/src/app";
import { initialSnapshot, PlatformDomain } from "@party/domain";
import {
  currentAvalonLeader,
  currentAvalonMissionRule
} from "@party/avalon";
import { PlatformStore } from "@party/persistence";
import {
  defaultAvalonRoomConfig,
  defaultRoomConfig,
  requireAvalonProjection,
  requireAvalonRoom,
  requirePokerRoom,
  temporaryDatabase
} from "@party/test-support";

interface AvalonTable {
  domain: PlatformDomain;
  state: PlatformSnapshot;
  accounts: Account[];
  leases: string[];
  room: AvalonRoom;
}

function createAvalonTable(options?: {
  count?: number;
  recognitionMode?: "automatic" | "manual";
  start?: boolean;
  state?: PlatformSnapshot;
}): AvalonTable {
  const count = options?.count ?? 5;
  const state = options?.state ?? initialSnapshot(1_000);
  const domain = new PlatformDomain(state, () => 2_000);
  const accounts = Array.from({ length: count }, (_, index) =>
    domain.enterAccount(`Avalon ${index + 1}`)
  );
  const leases = accounts.map((account) => domain.acquireLease(account.id));
  const config: AvalonRoomConfig = {
    ...structuredClone(defaultAvalonRoomConfig),
    recognitionMode: options?.recognitionMode ?? "automatic"
  };
  const room = domain.createAvalonRoom(accounts[0]!.id, "Camelot", config);
  for (const account of accounts.slice(1)) {
    domain.joinAvalonRoom(room.id, account.id);
    domain.setAvalonReady(room.id, account.id, true);
  }
  if (options?.start !== false) {
    domain.startAvalonGame(room.id, accounts[0]!.id, {
      confirmUnready: false,
      randomInt: () => 0
    });
  }
  return { domain, state, accounts, leases, room };
}

function confirmAllRoles(table: AvalonTable): void {
  for (const account of table.accounts) {
    table.domain.confirmAvalonRole(
      table.room.id,
      account.id,
      table.room.avalon!.version
    );
  }
}

function settleWithFiveRejectedTeams(table: AvalonTable): void {
  confirmAllRoles(table);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const state = table.room.avalon!;
    const leaderAccountId = currentAvalonLeader(state);
    const teamSize = currentAvalonMissionRule(state).teamSize;
    table.domain.proposeAvalonTeam(
      table.room.id,
      leaderAccountId,
      state.participants.slice(0, teamSize).map((entry) => entry.accountId),
      state.version
    );
    for (const participant of state.participants) {
      table.domain.castAvalonVote(
        table.room.id,
        participant.accountId,
        false,
        table.room.avalon!.version
      );
    }
  }
}

describe("Avalon platform integration", () => {
  it("validates the public Avalon command family through Fastify", async () => {
    const app = await buildApp({ databasePath: temporaryDatabase() });
    const entered: Array<{
      account: Account;
      connectionId: string;
      version: number;
    }> = [];
    for (let index = 0; index < 5; index += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/register",
        payload: {
          commandId: randomUUID(),
          username: `HTTP Avalon ${index + 1}`,
          avatar: selectableAvatars[0],
          language: "en",
          theme: "dark"
        }
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      entered.push({
        account: body.data.account,
        connectionId: body.data.connectionId,
        version: body.version
      });
    }
    let version = entered.at(-1)!.version;
    const host = entered[0]!;
    const invalid = await app.inject({
      method: "POST",
      url: "/api/command",
      payload: {
        commandId: randomUUID(),
        connectionId: host.connectionId,
        aggregateId: "platform",
        expectedVersion: version,
        type: "room.create",
        payload: {
          accountId: host.account.id,
          name: "Missing discriminator",
          config: defaultAvalonRoomConfig
        }
      }
    });
    expect(invalid.statusCode).toBe(400);

    const created = await app.inject({
      method: "POST",
      url: "/api/command",
      payload: {
        commandId: randomUUID(),
        connectionId: host.connectionId,
        aggregateId: "platform",
        expectedVersion: version,
        type: "room.create",
        payload: {
          gameType: "avalon",
          accountId: host.account.id,
          name: "HTTP Camelot",
          config: {
            recognitionMode: "automatic",
            oberonRule: "original",
            stake: 100,
            hostTransferTimeoutSeconds: 60,
            roleSource: "preset"
          }
        }
      }
    });
    expect(created.statusCode).toBe(200);
    const createdBody = created.json();
    const roomId = createdBody.data.id as string;
    version = createdBody.version;

    for (const member of entered.slice(1)) {
      const joined = await app.inject({
        method: "POST",
        url: "/api/command",
        payload: {
          commandId: randomUUID(),
          connectionId: member.connectionId,
          aggregateId: roomId,
          expectedVersion: version,
          type: "room.join",
          payload: {
            gameType: "avalon",
            accountId: member.account.id,
            roomId
          }
        }
      });
      expect(joined.statusCode).toBe(200);
      version = joined.json().version;
      const ready = await app.inject({
        method: "POST",
        url: "/api/command",
        payload: {
          commandId: randomUUID(),
          connectionId: member.connectionId,
          aggregateId: roomId,
          expectedVersion: version,
          type: "avalon.ready",
          payload: {
            accountId: member.account.id,
            roomId,
            ready: true
          }
        }
      });
      expect(ready.statusCode).toBe(200);
      version = ready.json().version;
    }

    const started = await app.inject({
      method: "POST",
      url: "/api/command",
      payload: {
        commandId: randomUUID(),
        connectionId: host.connectionId,
        aggregateId: roomId,
        expectedVersion: version,
        type: "avalon.start",
        payload: {
          accountId: host.account.id,
          roomId,
          confirmUnready: false
        }
      }
    });
    expect(started.statusCode).toBe(200);
    expect(started.json().data).toMatchObject({
      gameType: "avalon",
      phase: "role-confirmation",
      viewerRole: "participant"
    });
    version = started.json().version;

    const wrongGame = await app.inject({
      method: "POST",
      url: "/api/command",
      payload: {
        commandId: randomUUID(),
        connectionId: entered[1]!.connectionId,
        aggregateId: roomId,
        expectedVersion: version,
        type: "poker.ready",
        payload: {
          accountId: entered[1]!.account.id,
          roomId,
          ready: true
        }
      }
    });
    expect(wrongGame.statusCode).toBe(409);
    expect(wrongGame.json().code).toBe("WRONG_GAME_TYPE");
    await app.close();
  });

  it("settles signed stakes atomically and exposes only the completed result", () => {
    const state = initialSnapshot(1_000);
    state.seasons[0]!.baseScore = -50;
    const table = createAvalonTable({ state });
    const participantIds = table.accounts.map((account) => account.id);

    expect(
      participantIds.map(
        (accountId) => table.state.seasonAssets[accountId]!.score
      )
    ).toEqual([-150, -150, -150, -150, -150]);
    table.domain.validateInvariants();

    const displayDuringPlay = requireAvalonProjection(
      table.domain.projectRoom(table.room.id, { display: true })
    );
    expect(displayDuringPlay.viewerRole).toBe("display");
    expect(displayDuringPlay.ownKnowledge).toBeUndefined();
    expect(displayDuringPlay.revealedRoles).toBeUndefined();
    expect(JSON.stringify(displayDuringPlay)).not.toContain(
      "roleAssignments"
    );

    settleWithFiveRejectedTeams(table);
    expect(table.room.avalon?.phase).toBe("complete");
    expect(table.room.avalon?.outcome).toMatchObject({
      status: "settled",
      winningAlignment: "evil",
      reason: "five-rejected-teams"
    });
    expect(table.state.avalonResults).toHaveLength(1);
    const result = table.state.avalonResults[0]!;
    expect(result.outcome).toBe("settled");
    if (result.outcome !== "settled") throw new Error("expected settlement");
    expect(
      result.playerResults.reduce(
        (sum, player) => sum + player.scoreDelta,
        0
      )
    ).toBe(0);
    const winners = result.playerResults.filter(
      (player) => player.alignment === "evil"
    );
    const losers = result.playerResults.filter(
      (player) => player.alignment === "good"
    );
    expect(winners.every((player) => player.scoreDelta >= 1)).toBe(true);
    expect(losers.every((player) => player.scoreDelta === -100)).toBe(true);
    expect(
      result.playerResults.every(
        (player) =>
          table.state.seasonAssets[player.accountId]!.score ===
          player.endingScore
      )
    ).toBe(true);

    const completedDisplay = requireAvalonProjection(
      table.domain.projectRoom(table.room.id, { display: true })
    );
    expect(completedDisplay.revealedRoles).toHaveLength(5);
    expect(completedDisplay.lastResult).toEqual(result);
    expect(table.domain.currentLeaderboard()).toHaveLength(5);
    table.domain.validateInvariants();
  });

  it("keeps manual knowledge, partial votes, and mission choices private across restart", () => {
    const table = createAvalonTable({ recognitionMode: "manual" });
    const participant = table.accounts[1]!;
    const privateProjection = requireAvalonProjection(
      table.domain.projectRoom(table.room.id, {
        accountId: participant.id
      })
    );
    expect(privateProjection.ownKnowledge?.role).toBeTypeOf("string");
    expect(privateProjection.ownKnowledge?.visibleEvilAccountIds).toEqual([]);
    expect(
      privateProjection.ownKnowledge?.percivalCandidateAccountIds
    ).toEqual([]);
    expect(privateProjection.ownKnowledge?.evilAllyAccountIds).toEqual([]);

    confirmAllRoles(table);
    expect(table.room.avalon?.phase).toBe("manual-night");
    const displayAtNight = requireAvalonProjection(
      table.domain.projectRoom(table.room.id, { display: true })
    );
    expect(displayAtNight.nightSteps.length).toBeGreaterThan(0);
    expect(displayAtNight.ownKnowledge).toBeUndefined();
    while (table.room.avalon?.phase === "manual-night") {
      table.domain.advanceAvalonNight(
        table.room.id,
        table.accounts[0]!.id,
        table.room.avalon.version
      );
    }

    const state = table.room.avalon!;
    const team = state.participants
      .slice(0, currentAvalonMissionRule(state).teamSize)
      .map((entry) => entry.accountId);
    table.domain.proposeAvalonTeam(
      table.room.id,
      currentAvalonLeader(state),
      team,
      state.version
    );
    table.domain.castAvalonVote(
      table.room.id,
      table.accounts[0]!.id,
      true,
      table.room.avalon!.version
    );
    const partialVote = requireAvalonProjection(
      table.domain.projectRoom(table.room.id, { display: true })
    );
    expect(partialVote.voteSubmittedAccountIds).toEqual([
      table.accounts[0]!.id
    ]);
    expect(JSON.stringify(partialVote)).not.toContain('"approve"');

    for (const account of table.accounts.slice(1)) {
      table.domain.castAvalonVote(
        table.room.id,
        account.id,
        true,
        table.room.avalon!.version
      );
    }
    expect(table.room.avalon?.phase).toBe("mission");
    table.domain.submitAvalonMission(
      table.room.id,
      team[0]!,
      "success",
      table.room.avalon!.version
    );
    const partialMission = requireAvalonProjection(
      table.domain.projectRoom(table.room.id, { display: true })
    );
    expect(partialMission.missionSubmittedAccountIds).toEqual([team[0]]);
    expect(JSON.stringify(partialMission)).not.toContain("missionChoices");
    expect(JSON.stringify(partialMission)).not.toContain('"choice"');

    const roleAssignments = structuredClone(
      table.room.avalon!.roleAssignments
    );
    const databasePath = temporaryDatabase();
    const store = new PlatformStore(databasePath);
    store.save(table.state);
    store.close();

    const reopened = new PlatformStore(databasePath);
    const recovered = reopened.recoverAfterRestart();
    const recoveredRoom = requireAvalonRoom(recovered.rooms[table.room.id]);
    expect(recoveredRoom.avalon?.roleAssignments).toEqual(roleAssignments);
    expect(recoveredRoom.avalon?.missionChoices).toEqual({
      [team[0]!]: "success"
    });
    expect(recoveredRoom.seats.every((seat) => !seat.connected)).toBe(true);
    expect(recovered.leases).toEqual({});
    const recoveredDisplay = requireAvalonProjection(
      new PlatformDomain(recovered).projectRoom(recoveredRoom.id, {
        display: true
      })
    );
    expect(JSON.stringify(recoveredDisplay)).not.toContain("missionChoices");
    new PlatformDomain(recovered).validateInvariants();
    reopened.close();
  });

  it("enforces game type, platform version, command replay, and lease takeover", () => {
    const table = createAvalonTable({ start: false });
    const store = new PlatformStore(temporaryDatabase());
    store.save(table.state);
    const startEnvelope = {
      commandId: "avalon-start-idempotent",
      connectionId: table.leases[0],
      aggregateId: table.room.id,
      expectedVersion: 0,
      type: "avalon.start",
      payload: {
        accountId: table.accounts[0]!.id,
        roomId: table.room.id,
        confirmUnready: false
      }
    };
    const started = dispatch(store, startEnvelope);
    expect(started.status).toBe("accepted");
    const replayed = dispatch(store, startEnvelope);
    expect(replayed.status).toBe("replayed");
    expect(store.load().avalonResults).toEqual([]);

    const stale = dispatch(store, {
      commandId: "avalon-stale-command",
      connectionId: table.leases[0],
      aggregateId: table.room.id,
      expectedVersion: 0,
      type: "avalon.role.confirm",
      payload: {
        accountId: table.accounts[0]!.id,
        roomId: table.room.id,
        avalonVersion: 0
      }
    });
    expect(stale.code).toBe("STALE_VERSION");

    const crossGame = dispatch(store, {
      commandId: "poker-command-on-avalon",
      connectionId: table.leases[1],
      aggregateId: table.room.id,
      expectedVersion: 1,
      type: "poker.ready",
      payload: {
        accountId: table.accounts[1]!.id,
        roomId: table.room.id,
        ready: true
      }
    });
    expect(crossGame.code).toBe("WRONG_GAME_TYPE");
    expect(store.load().version).toBe(1);

    const takeover = store.execute(
      {
        commandId: "avalon-control-takeover",
        aggregateId: "platform",
        expectedVersion: 1,
        type: "test.acquire-lease",
        payload: {}
      },
      (domain) => domain.acquireLease(table.accounts[0]!.id)
    );
    expect(takeover.status).toBe("accepted");
    const newConnectionId = takeover.data!;

    const oldLease = dispatch(store, {
      commandId: "avalon-old-lease",
      connectionId: table.leases[0],
      aggregateId: table.room.id,
      expectedVersion: 2,
      type: "avalon.role.confirm",
      payload: {
        accountId: table.accounts[0]!.id,
        roomId: table.room.id,
        avalonVersion: 0
      }
    });
    expect(oldLease.code).toBe("STALE_CONNECTION");
    const newLease = dispatch(store, {
      commandId: "avalon-new-lease",
      connectionId: newConnectionId,
      aggregateId: table.room.id,
      expectedVersion: 2,
      type: "avalon.role.confirm",
      payload: {
        accountId: table.accounts[0]!.id,
        roomId: table.room.id,
        avalonVersion: 0
      }
    });
    expect(newLease.status).toBe("accepted");
    expect(
      requireAvalonRoom(store.load().rooms[table.room.id]).avalon
        ?.roleConfirmedAccountIds
    ).toEqual([table.accounts[0]!.id]);
    store.close();

    const pokerState = initialSnapshot(1_000);
    const pokerDomain = new PlatformDomain(pokerState, () => 2_000);
    const pokerHost = pokerDomain.enterAccount("Poker host");
    const pokerLease = pokerDomain.acquireLease(pokerHost.id);
    const pokerRoom = pokerDomain.createRoom(
      pokerHost.id,
      "Poker",
      defaultRoomConfig
    );
    pokerDomain.joinRoom(pokerRoom.id, pokerHost.id, 2_000);
    const pokerStore = new PlatformStore(temporaryDatabase());
    pokerStore.save(pokerState);
    const avalonOnPoker = dispatch(pokerStore, {
      commandId: "avalon-command-on-poker",
      connectionId: pokerLease,
      aggregateId: pokerRoom.id,
      expectedVersion: 0,
      type: "avalon.ready",
      payload: {
        accountId: pokerHost.id,
        roomId: pokerRoom.id,
        ready: true
      }
    });
    expect(avalonOnPoker.code).toBe("WRONG_GAME_TYPE");
    expect(requirePokerRoom(pokerStore.load().rooms[pokerRoom.id])).toBeTruthy();
    pokerStore.close();
  });

  it("voids and refunds before atomically deleting an active participant", () => {
    const table = createAvalonTable();
    const deletedAccount = table.accounts[1]!;
    const scoresBefore = new Map(
      table.accounts.map((account) => [
        account.id,
        table.state.seasonAssets[account.id]!.score + 100
      ])
    );
    const store = new PlatformStore(temporaryDatabase());
    store.save(table.state);

    const deleted = dispatchAdmin(store, {
      commandId: "delete-active-avalon-player",
      aggregateId: "platform",
      expectedVersion: 0,
      type: "admin.accounts.delete",
      payload: { accountIds: [deletedAccount.id] }
    });
    expect(deleted.status).toBe("accepted");
    const persisted = store.load();
    const room = requireAvalonRoom(persisted.rooms[table.room.id]);
    expect(room.avalon?.phase).toBe("void");
    expect(room.avalon?.outcome).toEqual({
      status: "void",
      reason: "voided"
    });
    expect(persisted.accounts[deletedAccount.id]).toBeUndefined();
    expect(persisted.seasonAssets[deletedAccount.id]).toBeUndefined();
    expect(room.seats.some((seat) => seat.accountId === deletedAccount.id)).toBe(
      false
    );
    expect(persisted.avalonResults).toHaveLength(1);
    expect(persisted.avalonResults[0]?.outcome).toBe("void");
    expect(
      persisted.avalonResults[0]?.participantAccountIds
    ).not.toContain(deletedAccount.id);
    expect(
      Object.values(persisted.seasonAssets).every(
        (asset) => asset.score === scoresBefore.get(asset.accountId)
      )
    ).toBe(true);
    const projection = requireAvalonProjection(
      new PlatformDomain(persisted).projectRoom(room.id, { display: true })
    );
    expect(projection.revealedRoles).toBeUndefined();
    expect(projection.participantAccountIds).toEqual([]);
    expect(
      new PlatformDomain(persisted).participationFacts()[0]?.valid
    ).toBe(false);
    new PlatformDomain(persisted).validateInvariants();
    expect(
      dispatchAdmin(store, {
        commandId: "delete-active-avalon-player",
        aggregateId: "platform",
        expectedVersion: 0,
        type: "admin.accounts.delete",
        payload: { accountIds: [deletedAccount.id] }
      }).status
    ).toBe("replayed");
    store.close();
  });

  it("normalizes legacy state and rolls back invalid settings, overflow, and faults", () => {
    const settingsDomain = new PlatformDomain(initialSnapshot(1_000));
    const settingsBefore = structuredClone(settingsDomain.state.settings);
    expect(() =>
      settingsDomain.updateSettings({
        ...settingsBefore,
        avalon: {
          ...settingsBefore.avalon,
          rolePresets: {
            ...settingsBefore.avalon.rolePresets,
            5: ["merlin", "merlin", "assassin"]
          }
        }
      })
    ).toThrowError("INVALID_AVALON_ROLE_CONFIG");
    expect(settingsDomain.state.settings).toEqual(settingsBefore);

    const legacyState = initialSnapshot(1_000);
    delete (
      legacyState.settings as unknown as {
        avalon?: PlatformSnapshot["settings"]["avalon"];
      }
    ).avalon;
    delete (
      legacyState as unknown as {
        avalonResults?: PlatformSnapshot["avalonResults"];
      }
    ).avalonResults;
    const legacyDomain = new PlatformDomain(legacyState);
    expect(legacyState.settings.avalon.defaultStake).toBe(100);
    expect(legacyState.avalonResults).toEqual([]);
    expect(legacyDomain.recoverAfterRestart()).toBe(true);
    expect(legacyDomain.recoverAfterRestart()).toBe(false);

    const overflowState = initialSnapshot(1_000);
    overflowState.seasons[0]!.baseScore = Number.MIN_SAFE_INTEGER + 50;
    const overflowDomain = new PlatformDomain(overflowState, () => 2_000);
    const first = overflowDomain.enterAccount("Near minimum");
    overflowState.seasons[0]!.baseScore = 0;
    const others = Array.from({ length: 4 }, (_, index) =>
      overflowDomain.enterAccount(`Zero ${index + 1}`)
    );
    const overflowRoom = overflowDomain.createAvalonRoom(
      first.id,
      "Overflow",
      defaultAvalonRoomConfig
    );
    for (const account of others) {
      overflowDomain.joinAvalonRoom(overflowRoom.id, account.id);
      overflowDomain.setAvalonReady(overflowRoom.id, account.id, true);
    }
    const beforeOverflow = JSON.stringify(overflowState);
    expect(() =>
      overflowDomain.startAvalonGame(overflowRoom.id, first.id, {
        confirmUnready: false,
        randomInt: () => 0
      })
    ).toThrowError("SAFE_INTEGER_OVERFLOW");
    expect(JSON.stringify(overflowState)).toBe(beforeOverflow);
    overflowDomain.validateInvariants();

    const faultTable = createAvalonTable({ start: false });
    const faultStore = new PlatformStore(temporaryDatabase());
    faultStore.save(faultTable.state);
    const beforeFault = faultStore.load();
    expect(() =>
      faultStore.execute(
        {
          commandId: "avalon-start-fault",
          aggregateId: faultTable.room.id,
          expectedVersion: 0,
          type: "test.fault",
          payload: {}
        },
        (domain) => {
          domain.startAvalonGame(
            faultTable.room.id,
            faultTable.accounts[0]!.id,
            {
              confirmUnready: false,
              randomInt: () => 0
            }
          );
          throw new Error("fault injection");
        }
      )
    ).toThrowError("fault injection");
    expect(faultStore.load()).toEqual(beforeFault);
    faultStore.close();
  });
});
