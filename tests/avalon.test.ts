import { describe, expect, it } from "vitest";
import type {
  AvalonGameState,
  AvalonMissionChoice,
  AvalonOberonRule,
  AvalonParticipant,
  AvalonRecognitionMode,
  AvalonRole
} from "@party/contracts";
import {
  AVALON_RULES,
  DEFAULT_AVALON_ROLE_PRESETS,
  advanceAvalonNight,
  assassinateInAvalon,
  avalonAlignmentForRole,
  avalonKnowledgeFor,
  castAvalonVote,
  confirmAvalonRole,
  createAvalonGame,
  createAvalonNightSteps,
  currentAvalonLeader,
  currentAvalonMissionRule,
  normalizeAvalonRoles,
  proposeAvalonTeam,
  restartAvalonNight,
  submitAvalonMission,
  voidAvalonGame
} from "@party/avalon";

describe("Avalon rules", () => {
  it("defines the original 5-10 player alignment, team-size, and failure matrix", () => {
    expect(
      Object.fromEntries(
        Object.entries(AVALON_RULES).map(([count, rule]) => [
          count,
          {
            alignments: [rule.goodCount, rule.evilCount],
            teams: rule.missions.map((mission) => mission.teamSize),
            thresholds: rule.missions.map((mission) => mission.failThreshold)
          }
        ])
      )
    ).toEqual({
      5: {
        alignments: [3, 2],
        teams: [2, 3, 2, 3, 3],
        thresholds: [1, 1, 1, 1, 1]
      },
      6: {
        alignments: [4, 2],
        teams: [2, 3, 4, 3, 4],
        thresholds: [1, 1, 1, 1, 1]
      },
      7: {
        alignments: [4, 3],
        teams: [2, 3, 3, 4, 4],
        thresholds: [1, 1, 1, 2, 1]
      },
      8: {
        alignments: [5, 3],
        teams: [3, 4, 4, 5, 5],
        thresholds: [1, 1, 1, 2, 1]
      },
      9: {
        alignments: [6, 3],
        teams: [3, 4, 4, 5, 5],
        thresholds: [1, 1, 1, 2, 1]
      },
      10: {
        alignments: [6, 4],
        teams: [3, 4, 4, 5, 5],
        thresholds: [1, 1, 1, 2, 1]
      }
    });

    for (const [countText, roles] of Object.entries(
      DEFAULT_AVALON_ROLE_PRESETS
    )) {
      const count = Number(countText);
      const normalized = normalizeAvalonRoles(count, roles);
      const rule = AVALON_RULES[count as keyof typeof AVALON_RULES];
      expect(normalized).toHaveLength(count);
      expect(
        normalized.filter(
          (role) => avalonAlignmentForRole(role) === "good"
        )
      ).toHaveLength(rule.goodCount);
      expect(
        normalized.filter(
          (role) => avalonAlignmentForRole(role) === "evil"
        )
      ).toHaveLength(rule.evilCount);
    }
  });

  it("normalizes ordinary roles and rejects invalid required, duplicate, and five-player pairings", () => {
    expect(normalizeAvalonRoles(5, ["merlin", "assassin"])).toEqual([
      "merlin",
      "loyal-servant",
      "loyal-servant",
      "assassin",
      "minion"
    ]);
    expect(() =>
      normalizeAvalonRoles(5, ["merlin", "percival", "assassin"])
    ).toThrowError("INVALID_AVALON_ROLE_CONFIG");
    expect(() =>
      normalizeAvalonRoles(6, ["merlin", "merlin", "assassin"])
    ).toThrowError("INVALID_AVALON_ROLE_CONFIG");
    expect(() =>
      normalizeAvalonRoles(5, ["percival", "assassin", "morgana"])
    ).toThrowError("INVALID_AVALON_ROLE_CONFIG");
    expect(() =>
      normalizeAvalonRoles(11, ["merlin", "assassin"])
    ).toThrowError("INVALID_AVALON_PLAYER_COUNT");
  });

  it("projects automatic knowledge without exact special-role labels and honors both Oberon rules", () => {
    const original = game(10, "automatic", "original");
    const merlinId = accountForRole(original, "merlin");
    const percivalId = accountForRole(original, "percival");
    const assassinId = accountForRole(original, "assassin");
    const morganaId = accountForRole(original, "morgana");
    const mordredId = accountForRole(original, "mordred");
    const oberonId = accountForRole(original, "oberon");

    expect(avalonKnowledgeFor(original, merlinId)).toEqual({
      role: "merlin",
      visibleEvilAccountIds: [assassinId, morganaId, oberonId],
      percivalCandidateAccountIds: [],
      evilAllyAccountIds: []
    });
    expect(avalonKnowledgeFor(original, percivalId)).toEqual({
      role: "percival",
      visibleEvilAccountIds: [],
      percivalCandidateAccountIds: [merlinId, morganaId],
      evilAllyAccountIds: []
    });
    expect(avalonKnowledgeFor(original, assassinId).evilAllyAccountIds).toEqual([
      morganaId,
      mordredId
    ]);
    expect(avalonKnowledgeFor(original, oberonId).evilAllyAccountIds).toEqual([]);

    const dized = game(10, "automatic", "dized");
    expect(avalonKnowledgeFor(dized, accountForRole(dized, "merlin")))
      .toMatchObject({
        visibleEvilAccountIds: [
          accountForRole(dized, "assassin"),
          accountForRole(dized, "morgana")
        ]
      });
    const manual = game(10, "manual", "original");
    expect(avalonKnowledgeFor(manual, accountForRole(manual, "merlin")))
      .toEqual({
        role: "merlin",
        visibleEvilAccountIds: [],
        percivalCandidateAccountIds: [],
        evilAllyAccountIds: []
      });
  });

  it("generates role-aware night steps and permits restart only before the first proposal", () => {
    const roles = DEFAULT_AVALON_ROLE_PRESETS[5];
    expect(createAvalonNightSteps(roles, "original").map((step) => step.code))
      .toEqual([
        "all-close-eyes",
        "evil-recognize",
        "evil-close-eyes",
        "merlin-recognize-original",
        "merlin-close-eyes",
        "percival-recognize",
        "percival-close-eyes",
        "all-open-eyes"
      ]);

    let state = confirmAll(game(5, "manual"));
    expect(state.phase).toBe("manual-night");
    state = advanceAvalonNight(state, state.version);
    expect(state.nightStepIndex).toBe(1);
    state = restartAvalonNight(state, state.version);
    expect(state.nightStepIndex).toBe(0);
    while (state.phase === "manual-night") {
      state = advanceAvalonNight(state, state.version);
    }
    expect(state.phase).toBe("team-proposal");
    state = restartAvalonNight(state, state.version);
    expect(state.phase).toBe("manual-night");
    while (state.phase === "manual-night") {
      state = advanceAvalonNight(state, state.version);
    }
    state = proposeCurrentTeam(state);
    expect(() => restartAvalonNight(state, state.version)).toThrowError(
      "AVALON_NIGHT_RESTART_UNAVAILABLE"
    );
  });

  it("keeps votes secret until all submit, uses strict majority, and ends on five rejections", () => {
    let state = confirmAll(game(6));
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      state = proposeCurrentTeam(state);
      const beforeLast = state.participants.slice(0, -1);
      for (const participant of beforeLast) {
        state = castAvalonVote(
          state,
          participant.accountId,
          attempt === 1 && participant.position < 3,
          state.version
        );
      }
      expect(state.voteHistory).toHaveLength(attempt - 1);
      const last = state.participants.at(-1)!;
      state = castAvalonVote(
        state,
        last.accountId,
        attempt === 1 && last.position < 3,
        state.version
      );
      expect(state.voteHistory).toHaveLength(attempt);
      expect(state.voteHistory.at(-1)?.approved).toBe(false);
      if (attempt < 5) expect(state.phase).toBe("team-proposal");
    }
    expect(state.phase).toBe("complete");
    expect(state.outcome).toEqual({
      status: "settled",
      winningAlignment: "evil",
      reason: "five-rejected-teams",
      assassinationTargetAccountId: undefined
    });
  });

  it("allows only mission members, rejects a good failure, and applies the fourth-mission threshold", () => {
    let state = confirmAll(game(7));
    state = runMission(state, []);
    state = runMission(state, [accountForRole(state, "assassin")]);
    state = runMission(state, []);
    expect(state.missionIndex).toBe(3);
    expect(currentAvalonMissionRule(state)).toEqual({
      teamSize: 4,
      failThreshold: 2
    });

    state = proposeCurrentTeam(
      state,
      teamIncluding(state, [accountForRole(state, "assassin")])
    );
    state = approveAll(state);
    const goodMember = state.proposedTeamAccountIds.find(
      (accountId) =>
        avalonAlignmentForRole(state.roleAssignments[accountId]!) === "good"
    )!;
    const before = structuredClone(state);
    expect(() =>
      submitAvalonMission(state, goodMember, "fail", state.version)
    ).toThrowError("AVALON_GOOD_CANNOT_FAIL");
    expect(state).toEqual(before);

    state = submitMissionChoices(state, [accountForRole(state, "assassin")]);
    expect(state.missionHistory.at(-1)).toMatchObject({
      missionNumber: 4,
      failCount: 1,
      succeeded: true
    });
    expect(state.phase).toBe("assassination");
  });

  it("enters assassination after three successes and only the assassin can settle it", () => {
    let state = confirmAll(game(5));
    state = runMission(state, []);
    state = runMission(state, []);
    state = runMission(state, []);
    expect(state.phase).toBe("assassination");
    const assassinId = accountForRole(state, "assassin");
    const merlinId = accountForRole(state, "merlin");
    const loyalId = accountForRole(state, "loyal-servant");
    expect(() =>
      assassinateInAvalon(state, loyalId, merlinId, state.version)
    ).toThrowError("AVALON_ASSASSIN_ONLY");

    const goodWin = assassinateInAvalon(
      state,
      assassinId,
      loyalId,
      state.version
    );
    expect(goodWin.outcome).toEqual({
      status: "settled",
      winningAlignment: "good",
      reason: "merlin-survived",
      assassinationTargetAccountId: loyalId
    });
    const evilWin = assassinateInAvalon(
      state,
      assassinId,
      merlinId,
      state.version
    );
    expect(evilWin.outcome).toEqual({
      status: "settled",
      winningAlignment: "evil",
      reason: "merlin-assassinated",
      assassinationTargetAccountId: merlinId
    });
  });

  it("rejects stale transitions without mutating state and voids without revealing roles", () => {
    const state = game(5);
    const before = structuredClone(state);
    expect(() =>
      confirmAvalonRole(state, state.participants[0]!.accountId, 9)
    ).toThrowError("STALE_AVALON_VERSION");
    expect(state).toEqual(before);
    const voided = voidAvalonGame(state, state.version);
    expect(voided).toMatchObject({
      phase: "void",
      outcome: { status: "void", reason: "voided" }
    });
    expect(state.phase).toBe("role-confirmation");
  });
});

function game(
  count: 5 | 6 | 7 | 8 | 9 | 10,
  recognitionMode: AvalonRecognitionMode = "automatic",
  oberonRule: AvalonOberonRule = "original"
): AvalonGameState {
  const participants: AvalonParticipant[] = Array.from(
    { length: count },
    (_, position) => ({ accountId: `p${position}`, position })
  );
  let randomCalls = 0;
  return createAvalonGame({
    gameNumber: 1,
    participants,
    recognitionMode,
    oberonRule,
    roles: DEFAULT_AVALON_ROLE_PRESETS[count],
    stake: 100,
    randomInt: (maxExclusive) => {
      randomCalls += 1;
      return randomCalls < count ? maxExclusive - 1 : 0;
    }
  });
}

function confirmAll(input: AvalonGameState): AvalonGameState {
  let state = input;
  for (const participant of state.participants) {
    state = confirmAvalonRole(state, participant.accountId, state.version);
  }
  return state;
}

function proposeCurrentTeam(
  state: AvalonGameState,
  team = state.participants
    .slice(0, currentAvalonMissionRule(state).teamSize)
    .map((participant) => participant.accountId)
): AvalonGameState {
  return proposeAvalonTeam(
    state,
    currentAvalonLeader(state),
    team,
    state.version
  );
}

function approveAll(input: AvalonGameState): AvalonGameState {
  let state = input;
  for (const participant of state.participants) {
    state = castAvalonVote(state, participant.accountId, true, state.version);
  }
  return state;
}

function runMission(
  input: AvalonGameState,
  failingAccountIds: readonly string[]
): AvalonGameState {
  const required = currentAvalonMissionRule(input).teamSize;
  const team = teamIncluding(input, failingAccountIds, required);
  return submitMissionChoices(
    approveAll(proposeCurrentTeam(input, team)),
    failingAccountIds
  );
}

function teamIncluding(
  state: AvalonGameState,
  requiredAccountIds: readonly string[],
  size = currentAvalonMissionRule(state).teamSize
): string[] {
  const team = [...new Set(requiredAccountIds)];
  for (const participant of state.participants) {
    if (team.length >= size) break;
    if (!team.includes(participant.accountId)) team.push(participant.accountId);
  }
  return team;
}

function submitMissionChoices(
  input: AvalonGameState,
  failingAccountIds: readonly string[]
): AvalonGameState {
  let state = input;
  for (const accountId of state.proposedTeamAccountIds) {
    const choice: AvalonMissionChoice = failingAccountIds.includes(accountId)
      ? "fail"
      : "success";
    state = submitAvalonMission(state, accountId, choice, state.version);
  }
  return state;
}

function accountForRole(
  state: AvalonGameState,
  role: AvalonRole
): string {
  const accountId = state.participants.find(
    (participant) => state.roleAssignments[participant.accountId] === role
  )?.accountId;
  if (!accountId) throw new Error(`Missing role ${role}`);
  return accountId;
}
