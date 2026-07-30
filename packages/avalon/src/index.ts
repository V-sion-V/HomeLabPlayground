import type {
  AvalonAlignment,
  AvalonGameState,
  AvalonKnowledge,
  AvalonMissionChoice,
  AvalonMissionRule,
  AvalonNightStep,
  AvalonOberonRule,
  AvalonParticipant,
  AvalonPlayerCount,
  AvalonRecognitionMode,
  AvalonRole,
  AvalonRolePresets
} from "@party/contracts";

export class AvalonRuleError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export const AVALON_RULES: Record<
  AvalonPlayerCount,
  {
    goodCount: number;
    evilCount: number;
    missions: readonly [
      AvalonMissionRule,
      AvalonMissionRule,
      AvalonMissionRule,
      AvalonMissionRule,
      AvalonMissionRule
    ];
  }
> = {
  5: {
    goodCount: 3,
    evilCount: 2,
    missions: [
      { teamSize: 2, failThreshold: 1 },
      { teamSize: 3, failThreshold: 1 },
      { teamSize: 2, failThreshold: 1 },
      { teamSize: 3, failThreshold: 1 },
      { teamSize: 3, failThreshold: 1 }
    ]
  },
  6: {
    goodCount: 4,
    evilCount: 2,
    missions: [
      { teamSize: 2, failThreshold: 1 },
      { teamSize: 3, failThreshold: 1 },
      { teamSize: 4, failThreshold: 1 },
      { teamSize: 3, failThreshold: 1 },
      { teamSize: 4, failThreshold: 1 }
    ]
  },
  7: {
    goodCount: 4,
    evilCount: 3,
    missions: [
      { teamSize: 2, failThreshold: 1 },
      { teamSize: 3, failThreshold: 1 },
      { teamSize: 3, failThreshold: 1 },
      { teamSize: 4, failThreshold: 2 },
      { teamSize: 4, failThreshold: 1 }
    ]
  },
  8: {
    goodCount: 5,
    evilCount: 3,
    missions: [
      { teamSize: 3, failThreshold: 1 },
      { teamSize: 4, failThreshold: 1 },
      { teamSize: 4, failThreshold: 1 },
      { teamSize: 5, failThreshold: 2 },
      { teamSize: 5, failThreshold: 1 }
    ]
  },
  9: {
    goodCount: 6,
    evilCount: 3,
    missions: [
      { teamSize: 3, failThreshold: 1 },
      { teamSize: 4, failThreshold: 1 },
      { teamSize: 4, failThreshold: 1 },
      { teamSize: 5, failThreshold: 2 },
      { teamSize: 5, failThreshold: 1 }
    ]
  },
  10: {
    goodCount: 6,
    evilCount: 4,
    missions: [
      { teamSize: 3, failThreshold: 1 },
      { teamSize: 4, failThreshold: 1 },
      { teamSize: 4, failThreshold: 1 },
      { teamSize: 5, failThreshold: 2 },
      { teamSize: 5, failThreshold: 1 }
    ]
  }
};

export const DEFAULT_AVALON_ROLE_PRESETS: Readonly<AvalonRolePresets> = {
  5: ["merlin", "percival", "loyal-servant", "assassin", "morgana"],
  6: [
    "merlin",
    "percival",
    "loyal-servant",
    "loyal-servant",
    "assassin",
    "morgana"
  ],
  7: [
    "merlin",
    "percival",
    "loyal-servant",
    "loyal-servant",
    "assassin",
    "morgana",
    "mordred"
  ],
  8: [
    "merlin",
    "percival",
    "loyal-servant",
    "loyal-servant",
    "loyal-servant",
    "assassin",
    "morgana",
    "mordred"
  ],
  9: [
    "merlin",
    "percival",
    "loyal-servant",
    "loyal-servant",
    "loyal-servant",
    "loyal-servant",
    "assassin",
    "morgana",
    "mordred"
  ],
  10: [
    "merlin",
    "percival",
    "loyal-servant",
    "loyal-servant",
    "loyal-servant",
    "loyal-servant",
    "assassin",
    "morgana",
    "mordred",
    "oberon"
  ]
};

const specialRoles = new Set<AvalonRole>([
  "merlin",
  "percival",
  "assassin",
  "morgana",
  "mordred",
  "oberon"
]);

export type AvalonRandomInt = (maxExclusive: number) => number;

export interface CreateAvalonGameInput {
  gameNumber: number;
  participants: readonly AvalonParticipant[];
  recognitionMode: AvalonRecognitionMode;
  oberonRule: AvalonOberonRule;
  roles: readonly AvalonRole[];
  stake: number;
  randomInt: AvalonRandomInt;
}

export function avalonAlignmentForRole(role: AvalonRole): AvalonAlignment {
  return ["assassin", "morgana", "mordred", "oberon", "minion"].includes(role)
    ? "evil"
    : "good";
}

export function isAvalonPlayerCount(value: number): value is AvalonPlayerCount {
  return Number.isInteger(value) && value >= 5 && value <= 10;
}

export function getAvalonRule(playerCount: number) {
  if (!isAvalonPlayerCount(playerCount)) {
    throw new AvalonRuleError("INVALID_AVALON_PLAYER_COUNT");
  }
  return AVALON_RULES[playerCount];
}

export function normalizeAvalonRoles(
  playerCount: number,
  requestedRoles: readonly AvalonRole[]
): AvalonRole[] {
  const rule = getAvalonRule(playerCount);
  if (requestedRoles.length > playerCount) {
    throw new AvalonRuleError("INVALID_AVALON_ROLE_CONFIG");
  }
  for (const role of specialRoles) {
    if (requestedRoles.filter((candidate) => candidate === role).length > 1) {
      throw new AvalonRuleError("INVALID_AVALON_ROLE_CONFIG");
    }
  }
  if (
    requestedRoles.filter((role) => role === "merlin").length !== 1 ||
    requestedRoles.filter((role) => role === "assassin").length !== 1
  ) {
    throw new AvalonRuleError("INVALID_AVALON_ROLE_CONFIG");
  }
  if (
    playerCount === 5 &&
    requestedRoles.includes("percival") &&
    !requestedRoles.some((role) => role === "morgana" || role === "mordred")
  ) {
    throw new AvalonRuleError("INVALID_AVALON_ROLE_CONFIG");
  }

  const goodRoles = requestedRoles.filter(
    (role) => avalonAlignmentForRole(role) === "good"
  );
  const evilRoles = requestedRoles.filter(
    (role) => avalonAlignmentForRole(role) === "evil"
  );
  if (goodRoles.length > rule.goodCount || evilRoles.length > rule.evilCount) {
    throw new AvalonRuleError("INVALID_AVALON_ROLE_CONFIG");
  }
  const normalized = [
    ...goodRoles,
    ...Array.from(
      { length: rule.goodCount - goodRoles.length },
      () => "loyal-servant" as const
    ),
    ...evilRoles,
    ...Array.from(
      { length: rule.evilCount - evilRoles.length },
      () => "minion" as const
    )
  ];
  if (normalized.length !== playerCount) {
    throw new AvalonRuleError("INVALID_AVALON_ROLE_CONFIG");
  }
  return normalized;
}

export function createAvalonNightSteps(
  roles: readonly AvalonRole[],
  oberonRule: AvalonOberonRule
): AvalonNightStep[] {
  const codes: AvalonNightStep["code"][] = [
    "all-close-eyes",
    "evil-recognize",
    "evil-close-eyes",
    oberonRule === "original"
      ? "merlin-recognize-original"
      : "merlin-recognize-dized",
    "merlin-close-eyes"
  ];
  if (roles.includes("percival")) {
    codes.push("percival-recognize", "percival-close-eyes");
  }
  codes.push("all-open-eyes");
  return codes.map((code, index) => ({ index, code }));
}

export function createAvalonGame(input: CreateAvalonGameInput): AvalonGameState {
  if (
    !Number.isSafeInteger(input.gameNumber) ||
    input.gameNumber <= 0 ||
    !Number.isSafeInteger(input.stake) ||
    input.stake < 2
  ) {
    throw new AvalonRuleError("INVALID_AVALON_STAKE");
  }
  const participants = [...input.participants].sort(
    (left, right) => left.position - right.position
  );
  getAvalonRule(participants.length);
  if (
    new Set(participants.map((participant) => participant.accountId)).size !==
      participants.length ||
    new Set(participants.map((participant) => participant.position)).size !==
      participants.length ||
    participants.some(
      (participant) =>
        participant.accountId.length === 0 ||
        !Number.isSafeInteger(participant.position) ||
        participant.position < 0
    )
  ) {
    throw new AvalonRuleError("INVALID_AVALON_PARTICIPANTS");
  }
  const roles = normalizeAvalonRoles(participants.length, input.roles);
  const shuffledRoles = shuffled(roles, input.randomInt);
  const startingLeaderIndex = input.randomInt(participants.length);
  assertRandomIndex(startingLeaderIndex, participants.length);
  const roleAssignments = Object.fromEntries(
    participants.map((participant, index) => [
      participant.accountId,
      shuffledRoles[index]!
    ])
  );
  return {
    gameNumber: input.gameNumber,
    phase: "role-confirmation",
    config: {
      recognitionMode: input.recognitionMode,
      oberonRule: input.oberonRule,
      roles: [...roles],
      stake: input.stake
    },
    participants,
    roleAssignments,
    startingLeaderIndex,
    currentLeaderIndex: startingLeaderIndex,
    missionIndex: 0,
    rejectionCount: 0,
    proposedTeamAccountIds: [],
    votes: {},
    missionChoices: {},
    voteHistory: [],
    missionHistory: [],
    roleConfirmedAccountIds: [],
    nightSteps: createAvalonNightSteps(roles, input.oberonRule),
    nightStepIndex: 0,
    version: 0
  };
}

export function currentAvalonLeader(state: AvalonGameState): string {
  return state.participants[state.currentLeaderIndex]?.accountId ??
    fail("INVALID_AVALON_STATE");
}

export function currentAvalonMissionRule(
  state: AvalonGameState
): AvalonMissionRule {
  return getAvalonRule(state.participants.length).missions[state.missionIndex] ??
    fail("INVALID_AVALON_STATE");
}

export function avalonKnowledgeFor(
  state: AvalonGameState,
  accountId: string
): AvalonKnowledge {
  const role = state.roleAssignments[accountId];
  if (!role || !state.participants.some((entry) => entry.accountId === accountId)) {
    throw new AvalonRuleError("AVALON_PARTICIPANT_ONLY");
  }
  const knowledge: AvalonKnowledge = {
    role,
    visibleEvilAccountIds: [],
    percivalCandidateAccountIds: [],
    evilAllyAccountIds: []
  };
  if (state.config.recognitionMode === "manual") return knowledge;

  const ordered = state.participants.map((participant) => participant.accountId);
  if (role === "merlin") {
    knowledge.visibleEvilAccountIds = ordered.filter((candidate) => {
      const candidateRole = state.roleAssignments[candidate];
      return (
        candidateRole !== undefined &&
        avalonAlignmentForRole(candidateRole) === "evil" &&
        candidateRole !== "mordred" &&
        !(candidateRole === "oberon" && state.config.oberonRule === "dized")
      );
    });
  } else if (role === "percival") {
    knowledge.percivalCandidateAccountIds = ordered.filter((candidate) =>
      ["merlin", "morgana"].includes(state.roleAssignments[candidate] ?? "")
    );
  } else if (
    avalonAlignmentForRole(role) === "evil" &&
    role !== "oberon"
  ) {
    knowledge.evilAllyAccountIds = ordered.filter((candidate) => {
      if (candidate === accountId) return false;
      const candidateRole = state.roleAssignments[candidate];
      return (
        candidateRole !== undefined &&
        avalonAlignmentForRole(candidateRole) === "evil" &&
        candidateRole !== "oberon"
      );
    });
  }
  return knowledge;
}

export function confirmAvalonRole(
  state: AvalonGameState,
  accountId: string,
  expectedVersion: number
): AvalonGameState {
  return transition(state, expectedVersion, (next) => {
    requirePhase(next, "role-confirmation");
    requireParticipant(next, accountId);
    if (next.roleConfirmedAccountIds.includes(accountId)) {
      throw new AvalonRuleError("AVALON_ALREADY_CONFIRMED");
    }
    next.roleConfirmedAccountIds.push(accountId);
    if (next.roleConfirmedAccountIds.length === next.participants.length) {
      next.phase =
        next.config.recognitionMode === "manual"
          ? "manual-night"
          : "team-proposal";
    }
  });
}

export function advanceAvalonNight(
  state: AvalonGameState,
  expectedVersion: number
): AvalonGameState {
  return transition(state, expectedVersion, (next) => {
    requirePhase(next, "manual-night");
    if (next.nightStepIndex >= next.nightSteps.length - 1) {
      next.phase = "team-proposal";
    } else {
      next.nightStepIndex += 1;
    }
  });
}

export function restartAvalonNight(
  state: AvalonGameState,
  expectedVersion: number
): AvalonGameState {
  return transition(state, expectedVersion, (next) => {
    if (
      next.config.recognitionMode !== "manual" ||
      !["manual-night", "team-proposal"].includes(next.phase) ||
      next.missionIndex !== 0 ||
      next.voteHistory.length !== 0 ||
      next.proposedTeamAccountIds.length !== 0
    ) {
      throw new AvalonRuleError("AVALON_NIGHT_RESTART_UNAVAILABLE");
    }
    next.phase = "manual-night";
    next.nightStepIndex = 0;
  });
}

export function proposeAvalonTeam(
  state: AvalonGameState,
  accountId: string,
  teamAccountIds: readonly string[],
  expectedVersion: number
): AvalonGameState {
  return transition(state, expectedVersion, (next) => {
    requirePhase(next, "team-proposal");
    if (currentAvalonLeader(next) !== accountId) {
      throw new AvalonRuleError("AVALON_LEADER_ONLY");
    }
    const participantIds = new Set(
      next.participants.map((participant) => participant.accountId)
    );
    if (
      teamAccountIds.length !== currentAvalonMissionRule(next).teamSize ||
      new Set(teamAccountIds).size !== teamAccountIds.length ||
      teamAccountIds.some((candidate) => !participantIds.has(candidate))
    ) {
      throw new AvalonRuleError("INVALID_AVALON_TEAM");
    }
    next.proposedTeamAccountIds = [...teamAccountIds];
    next.votes = {};
    next.phase = "team-vote";
  });
}

export function castAvalonVote(
  state: AvalonGameState,
  accountId: string,
  approve: boolean,
  expectedVersion: number
): AvalonGameState {
  return transition(state, expectedVersion, (next) => {
    requirePhase(next, "team-vote");
    requireParticipant(next, accountId);
    if (Object.hasOwn(next.votes, accountId)) {
      throw new AvalonRuleError("AVALON_ALREADY_SUBMITTED");
    }
    next.votes[accountId] = approve;
    if (Object.keys(next.votes).length !== next.participants.length) return;

    const votes = next.participants.map((participant) => ({
      accountId: participant.accountId,
      approve: next.votes[participant.accountId]!
    }));
    const approved =
      votes.filter((vote) => vote.approve).length > next.participants.length / 2;
    next.voteHistory.push({
      missionNumber: next.missionIndex + 1,
      attempt: next.rejectionCount + 1,
      leaderAccountId: currentAvalonLeader(next),
      teamAccountIds: [...next.proposedTeamAccountIds],
      votes,
      approved
    });
    next.votes = {};
    if (approved) {
      next.missionChoices = {};
      next.phase = "mission";
      return;
    }

    next.rejectionCount += 1;
    next.proposedTeamAccountIds = [];
    if (next.rejectionCount >= 5) {
      completeAvalon(next, "evil", "five-rejected-teams");
      return;
    }
    advanceLeader(next);
    next.phase = "team-proposal";
  });
}

export function submitAvalonMission(
  state: AvalonGameState,
  accountId: string,
  choice: AvalonMissionChoice,
  expectedVersion: number
): AvalonGameState {
  return transition(state, expectedVersion, (next) => {
    requirePhase(next, "mission");
    if (!next.proposedTeamAccountIds.includes(accountId)) {
      throw new AvalonRuleError("AVALON_MISSION_MEMBER_ONLY");
    }
    if (Object.hasOwn(next.missionChoices, accountId)) {
      throw new AvalonRuleError("AVALON_ALREADY_SUBMITTED");
    }
    const role = next.roleAssignments[accountId] ??
      fail("INVALID_AVALON_STATE");
    if (
      choice === "fail" &&
      avalonAlignmentForRole(role) === "good"
    ) {
      throw new AvalonRuleError("AVALON_GOOD_CANNOT_FAIL");
    }
    next.missionChoices[accountId] = choice;
    if (
      Object.keys(next.missionChoices).length !==
      next.proposedTeamAccountIds.length
    ) {
      return;
    }

    const choices = next.proposedTeamAccountIds.map(
      (candidate) => next.missionChoices[candidate]!
    );
    const failCount = choices.filter((candidate) => candidate === "fail").length;
    const successCount = choices.length - failCount;
    const succeeded = failCount < currentAvalonMissionRule(next).failThreshold;
    next.missionHistory.push({
      missionNumber: next.missionIndex + 1,
      leaderAccountId: currentAvalonLeader(next),
      teamAccountIds: [...next.proposedTeamAccountIds],
      successCount,
      failCount,
      succeeded
    });
    next.missionChoices = {};
    next.proposedTeamAccountIds = [];
    next.rejectionCount = 0;

    const failedMissions = next.missionHistory.filter(
      (mission) => !mission.succeeded
    ).length;
    const successfulMissions = next.missionHistory.filter(
      (mission) => mission.succeeded
    ).length;
    if (failedMissions >= 3) {
      completeAvalon(next, "evil", "three-failed-missions");
      return;
    }
    if (successfulMissions >= 3) {
      next.phase = "assassination";
      return;
    }
    next.missionIndex += 1;
    advanceLeader(next);
    next.phase = "team-proposal";
  });
}

export function assassinateInAvalon(
  state: AvalonGameState,
  accountId: string,
  targetAccountId: string,
  expectedVersion: number
): AvalonGameState {
  return transition(state, expectedVersion, (next) => {
    requirePhase(next, "assassination");
    if (next.roleAssignments[accountId] !== "assassin") {
      throw new AvalonRuleError("AVALON_ASSASSIN_ONLY");
    }
    if (
      targetAccountId === accountId ||
      !next.participants.some(
        (participant) => participant.accountId === targetAccountId
      )
    ) {
      throw new AvalonRuleError("INVALID_AVALON_TARGET");
    }
    next.assassinationTargetAccountId = targetAccountId;
    const merlinHit = next.roleAssignments[targetAccountId] === "merlin";
    completeAvalon(
      next,
      merlinHit ? "evil" : "good",
      merlinHit ? "merlin-assassinated" : "merlin-survived",
      targetAccountId
    );
  });
}

export function voidAvalonGame(
  state: AvalonGameState,
  expectedVersion: number
): AvalonGameState {
  return transition(state, expectedVersion, (next) => {
    if (["complete", "void"].includes(next.phase)) {
      throw new AvalonRuleError("INVALID_AVALON_PHASE");
    }
    next.phase = "void";
    next.outcome = { status: "void", reason: "voided" };
    next.votes = {};
    next.missionChoices = {};
  });
}

function transition(
  state: AvalonGameState,
  expectedVersion: number,
  update: (next: AvalonGameState) => void
): AvalonGameState {
  if (
    !Number.isSafeInteger(expectedVersion) ||
    state.version !== expectedVersion
  ) {
    throw new AvalonRuleError("STALE_AVALON_VERSION");
  }
  const next = structuredClone(state);
  update(next);
  if (!Number.isSafeInteger(next.version + 1)) {
    throw new AvalonRuleError("AVALON_VERSION_OVERFLOW");
  }
  next.version += 1;
  return next;
}

function requirePhase(
  state: AvalonGameState,
  phase: AvalonGameState["phase"]
): void {
  if (state.phase !== phase) {
    throw new AvalonRuleError("INVALID_AVALON_PHASE");
  }
}

function requireParticipant(state: AvalonGameState, accountId: string): void {
  if (
    !state.participants.some(
      (participant) => participant.accountId === accountId
    )
  ) {
    throw new AvalonRuleError("AVALON_PARTICIPANT_ONLY");
  }
}

function advanceLeader(state: AvalonGameState): void {
  state.currentLeaderIndex =
    (state.currentLeaderIndex + 1) % state.participants.length;
}

function completeAvalon(
  state: AvalonGameState,
  winningAlignment: AvalonAlignment,
  reason:
    | "three-failed-missions"
    | "five-rejected-teams"
    | "merlin-assassinated"
    | "merlin-survived",
  assassinationTargetAccountId?: string
): void {
  state.phase = "complete";
  state.outcome = {
    status: "settled",
    winningAlignment,
    reason,
    assassinationTargetAccountId
  };
  state.votes = {};
  state.missionChoices = {};
}

function shuffled<T>(
  input: readonly T[],
  randomInt: AvalonRandomInt
): T[] {
  const values = [...input];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const selected = randomInt(index + 1);
    assertRandomIndex(selected, index + 1);
    [values[index], values[selected]] = [values[selected]!, values[index]!];
  }
  return values;
}

function assertRandomIndex(value: number, maxExclusive: number): void {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value >= maxExclusive
  ) {
    throw new AvalonRuleError("INVALID_AVALON_RANDOM_SOURCE");
  }
}

function fail(code: string): never {
  throw new AvalonRuleError(code);
}
