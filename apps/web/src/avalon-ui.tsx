import { useEffect, useRef, useState } from "react";
import type {
  Account,
  AvalonNightStepCode,
  AvalonPlayerCount,
  AvalonRole,
  AvalonRoomConfig,
  AvalonRoomProjection,
  AvalonWinReason,
  Language
} from "@party/contracts";
import { normalizeAvalonRoles } from "@party/avalon";
import { ArrowIcon, ConfirmDialog, SelectField } from "./ui";

type RunCommand = (
  type: string,
  payload?: Record<string, unknown>
) => Promise<boolean>;

interface AvalonRoomViewProps {
  language: Language;
  account: Account;
  room: AvalonRoomProjection;
  notice: string;
  volume: number;
  run: RunCommand;
  onLobby: () => void;
}

type AvalonTextKey =
  | "back"
  | "leave"
  | "close"
  | "void"
  | "pause"
  | "resume"
  | "display"
  | "readonly"
  | "waiting"
  | "spectating"
  | "participant"
  | "host"
  | "you"
  | "online"
  | "offline"
  | "ready"
  | "cancelReady"
  | "readyDone"
  | "hostReady"
  | "start"
  | "startNext"
  | "unreadyConfirm"
  | "settings"
  | "save"
  | "automatic"
  | "manual"
  | "original"
  | "dized"
  | "preset"
  | "custom"
  | "stake"
  | "recognition"
  | "oberon"
  | "roleSource"
  | "roles"
  | "role"
  | "alignment"
  | "good"
  | "evil"
  | "secretCovered"
  | "reveal"
  | "hide"
  | "knowledge"
  | "visibleEvil"
  | "percivalCandidates"
  | "evilAllies"
  | "none"
  | "confirmRole"
  | "confirmed"
  | "roleProgress"
  | "night"
  | "advanceNight"
  | "restartNight"
  | "mission"
  | "attempt"
  | "leader"
  | "team"
  | "selectTeam"
  | "submitTeam"
  | "vote"
  | "approve"
  | "reject"
  | "submitted"
  | "waitingSubmissions"
  | "missionSuccess"
  | "missionFail"
  | "goodCannotFail"
  | "assassination"
  | "chooseTarget"
  | "assassinate"
  | "outcome"
  | "winner"
  | "reason"
  | "scoreDelta"
  | "totalScore"
  | "voided"
  | "transfer"
  | "remove"
  | "confirmDanger"
  | "rejections"
  | "missionTrack"
  | "successes"
  | "failures"
  | "failThreshold"
  | "compatibleCounts"
  | "invalidRoleConfig"
  | "currentAction"
  | "waitingOthers";

const avalonTexts: Record<AvalonTextKey, [string, string]> = {
  back: ["返回大厅", "Back to lobby"],
  leave: ["离开房间", "Leave room"],
  close: ["关闭房间", "Close room"],
  void: ["作废本局", "Void game"],
  pause: ["暂停", "Pause"],
  resume: ["恢复", "Resume"],
  display: ["公共大屏", "Public display"],
  readonly: ["匿名只读 · 不占成员名额", "Anonymous read-only · no member slot"],
  waiting: ["局间准备", "Intermission"],
  spectating: ["本局观战", "Spectating this game"],
  participant: ["本局参赛", "Playing this game"],
  host: ["房主", "Host"],
  you: ["本人", "You"],
  online: ["在线", "Online"],
  offline: ["离线", "Offline"],
  ready: ["准备", "Ready"],
  cancelReady: ["取消准备", "Cancel ready"],
  readyDone: ["已准备", "Ready"],
  hostReady: ["房主自动准备并参赛", "Host is automatically ready"],
  start: ["开始游戏", "Start game"],
  startNext: ["开始下一局", "Start next game"],
  unreadyConfirm: [
    "未准备成员将只观战本局。确认开始？",
    "Unready members will spectate this game. Start?"
  ],
  settings: ["阿瓦隆设置", "Avalon settings"],
  save: ["保存下一局设置", "Save next-game settings"],
  automatic: ["自动认角色", "Automatic recognition"],
  manual: ["手动认角色", "Manual recognition"],
  original: ["原版奥伯伦", "Original Oberon"],
  dized: ["Dized 奥伯伦", "Dized Oberon"],
  preset: ["管理员人数预设", "Admin player-count preset"],
  custom: ["自定义角色", "Custom roles"],
  stake: ["每人押分", "Stake per player"],
  recognition: ["认角色模式", "Recognition mode"],
  oberon: ["奥伯伦规则", "Oberon rule"],
  roleSource: ["角色来源", "Role source"],
  roles: ["角色配置", "Role configuration"],
  role: ["你的角色", "Your role"],
  alignment: ["阵营", "Alignment"],
  good: ["善方", "Good"],
  evil: ["邪恶方", "Evil"],
  secretCovered: ["私密信息已遮盖", "Private information is covered"],
  reveal: ["按住查看私密信息", "Hold to reveal private information"],
  hide: ["隐藏私密信息", "Hide private information"],
  knowledge: ["你依法可见的信息", "Information you may know"],
  visibleEvil: ["梅林可见的邪恶", "Evil visible to Merlin"],
  percivalCandidates: ["派西维尔候选", "Percival candidates"],
  evilAllies: ["邪恶同伴", "Evil allies"],
  none: ["无", "None"],
  confirmRole: ["确认已看清角色", "Confirm role"],
  confirmed: ["已确认", "Confirmed"],
  roleProgress: ["角色确认进度", "Role confirmation"],
  night: ["夜间认人", "Night recognition"],
  advanceNight: ["下一步", "Next step"],
  restartNight: ["重新开始夜间流程", "Restart night sequence"],
  mission: ["任务", "Mission"],
  attempt: ["提名次数", "Proposal attempt"],
  leader: ["队长", "Leader"],
  team: ["任务队伍", "Mission team"],
  selectTeam: ["选择任务队伍", "Select mission team"],
  submitTeam: ["提交队伍", "Submit team"],
  vote: ["队伍投票", "Team vote"],
  approve: ["同意", "Approve"],
  reject: ["反对", "Reject"],
  submitted: ["已秘密提交", "Submitted secretly"],
  waitingSubmissions: ["等待全部秘密提交", "Waiting for all secret submissions"],
  missionSuccess: ["任务成功", "Mission success"],
  missionFail: ["任务失败", "Mission fail"],
  goodCannotFail: ["善方只能选择任务成功", "Good players can only choose success"],
  assassination: ["刺杀梅林", "Assassinate Merlin"],
  chooseTarget: ["选择一名刺杀目标；候选列表不揭示阵营", "Choose a target; candidates reveal no alignment"],
  assassinate: ["确认刺杀", "Confirm assassination"],
  outcome: ["最终结算", "Final result"],
  winner: ["胜方", "Winner"],
  reason: ["胜因", "Reason"],
  scoreDelta: ["积分变化", "Score change"],
  totalScore: ["结算后总分", "Ending score"],
  voided: ["本局已作废；角色不会公开，押分已退回", "Game voided; roles stay hidden and stakes were refunded"],
  transfer: ["转让房主", "Transfer host"],
  remove: ["移除", "Remove"],
  confirmDanger: ["此操作可能作废活动局并退款。确认继续？", "This can void the active game and refund stakes. Continue?"],
  rejections: ["连续否决", "Consecutive rejections"],
  missionTrack: ["任务轨迹", "Mission track"],
  successes: ["成功", "Successes"],
  failures: ["失败", "Failures"],
  failThreshold: ["失败阈值", "Fail threshold"],
  compatibleCounts: ["适用人数", "Compatible player counts"],
  invalidRoleConfig: [
    "角色配置必须包含唯一的梅林与刺客，并符合至少一种 5–10 人善恶人数",
    "Roles must include exactly one Merlin and Assassin and fit at least one 5–10 player alignment"
  ],
  currentAction: ["当前行动", "Current action"],
  waitingOthers: ["等待其他玩家", "Waiting for other players"]
};

export function avalonText(language: Language, key: AvalonTextKey): string {
  return avalonTexts[key][language === "zh-CN" ? 0 : 1];
}

export function avalonRoleLabel(
  language: Language,
  role: AvalonRole
): string {
  const labels: Record<AvalonRole, [string, string]> = {
    merlin: ["梅林", "Merlin"],
    percival: ["派西维尔", "Percival"],
    "loyal-servant": ["忠臣", "Loyal Servant"],
    assassin: ["刺客", "Assassin"],
    morgana: ["莫甘娜", "Morgana"],
    mordred: ["莫德雷德", "Mordred"],
    oberon: ["奥伯伦", "Oberon"],
    minion: ["爪牙", "Minion"]
  };
  return labels[role][language === "zh-CN" ? 0 : 1];
}

const avalonPlayerCounts: readonly AvalonPlayerCount[] = [
  5,
  6,
  7,
  8,
  9,
  10
];

export function avalonCompatiblePlayerCounts(
  roles: readonly AvalonRole[]
): AvalonPlayerCount[] {
  return avalonPlayerCounts.filter((playerCount) => {
    try {
      normalizeAvalonRoles(playerCount, roles);
      return true;
    } catch {
      return false;
    }
  });
}

function avalonRoleDescription(
  language: Language,
  role: AvalonRole
): string {
  const descriptions: Record<AvalonRole, [string, string]> = {
    merlin: [
      "善方。你能辨认规则允许看见的邪恶玩家，但要隐藏身份避开刺杀。",
      "Good. You recognize the evil players allowed by the room rule, but must conceal your identity from the Assassin."
    ],
    percival: [
      "善方。你看到梅林候选；有莫甘娜时，两名候选不可区分。",
      "Good. You see Merlin candidates; when Morgana is present, the two candidates are indistinguishable."
    ],
    "loyal-servant": [
      "善方。没有额外角色知识，通过讨论、投票和任务找出邪恶。",
      "Good. You have no extra role knowledge; use discussion, votes, and missions to find evil."
    ],
    assassin: [
      "邪恶方。善方完成三项任务后，由你选择一次梅林刺杀目标。",
      "Evil. After three successful missions, you choose one target in the attempt to assassinate Merlin."
    ],
    morgana: [
      "邪恶方。你会作为梅林候选迷惑派西维尔。",
      "Evil. You appear as a Merlin candidate to confuse Percival."
    ],
    mordred: [
      "邪恶方。梅林看不见你。",
      "Evil. You are hidden from Merlin."
    ],
    oberon: [
      "邪恶方。你与其他邪恶互不认识；梅林能否看见你取决于本房间规则。",
      "Evil. You and the other evil players do not recognize one another; whether Merlin sees you depends on the room rule."
    ],
    minion: [
      "邪恶方。协助邪恶阵营让任务失败，并隐藏同伴身份。",
      "Evil. Help evil fail missions while concealing your allies."
    ]
  };
  return descriptions[role][language === "zh-CN" ? 0 : 1];
}

function winReasonLabel(language: Language, reason: AvalonWinReason): string {
  const labels: Record<AvalonWinReason, [string, string]> = {
    "three-failed-missions": ["三项任务失败", "Three failed missions"],
    "five-rejected-teams": ["同一任务五次否决", "Five rejected teams"],
    "merlin-assassinated": ["刺客命中梅林", "Merlin was assassinated"],
    "merlin-survived": ["刺客未命中梅林", "Merlin survived"]
  };
  return labels[reason][language === "zh-CN" ? 0 : 1];
}

function nightStepLabel(
  language: Language,
  code: AvalonNightStepCode
): string {
  const labels: Record<AvalonNightStepCode, [string, string]> = {
    "all-close-eyes": ["所有人闭眼", "Everyone close your eyes"],
    "evil-recognize": ["邪恶阵营睁眼互认（按奥伯伦规则）", "Evil players recognize one another (per Oberon rule)"],
    "evil-close-eyes": ["邪恶阵营闭眼", "Evil players close their eyes"],
    "merlin-recognize-original": ["除莫德雷德外，梅林可见的邪恶举手", "Evil visible to Merlin, except Mordred, raise a hand"],
    "merlin-recognize-dized": ["按 Dized 规则，梅林可见的邪恶举手", "Evil visible under Dized rules raise a hand"],
    "merlin-close-eyes": ["梅林闭眼", "Merlin close your eyes"],
    "percival-recognize": ["梅林与莫甘娜举手供派西维尔辨认", "Merlin and Morgana raise a hand for Percival"],
    "percival-close-eyes": ["派西维尔闭眼", "Percival close your eyes"],
    "all-open-eyes": ["所有人睁眼", "Everyone open your eyes"]
  };
  return labels[code][language === "zh-CN" ? 0 : 1];
}

function roleIsEvil(role: AvalonRole | undefined): boolean {
  return Boolean(
    role &&
      ["assassin", "morgana", "mordred", "oberon", "minion"].includes(
        role
      )
  );
}

export function AvalonRoomView({
  language,
  account,
  room,
  notice,
  volume,
  run,
  onLobby
}: AvalonRoomViewProps) {
  const host = room.hostAccountId === account.id;
  const participant = room.participantAccountIds.includes(account.id);
  const intermission =
    room.phase === undefined ||
    room.phase === "complete" ||
    room.phase === "void";
  const [secretVisible, setSecretVisible] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
  const [assassinationTarget, setAssassinationTarget] = useState("");
  const [danger, setDanger] = useState<
    | { kind: "leave" | "close" | "void" | "start" }
    | { kind: "remove"; accountId: string; username: string }
    | null
  >(null);
  const lastPhase = useRef(room.phase);

  useEffect(() => {
    setSecretVisible(false);
    setSelectedTeam([]);
    setAssassinationTarget("");
  }, [room.avalonVersion]);

  useEffect(() => {
    if (lastPhase.current !== room.phase) {
      setSecretVisible(false);
      if (
        participant &&
        ["team-proposal", "team-vote", "mission", "assassination"].includes(
          room.phase ?? ""
        )
      ) {
        playAvalonTone(volume);
      }
      lastPhase.current = room.phase;
    }
  }, [participant, room.phase, volume]);

  useEffect(() => {
    const cover = () => setSecretVisible(false);
    const visibility = () => {
      if (document.visibilityState !== "visible") cover();
    };
    window.addEventListener("blur", cover);
    window.addEventListener("offline", cover);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", cover);
      window.removeEventListener("offline", cover);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!secretVisible) return;
    const cover = () => setSecretVisible(false);
    const releaseKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") cover();
    };
    window.addEventListener("pointerup", cover);
    window.addEventListener("pointercancel", cover);
    window.addEventListener("keyup", releaseKey);
    return () => {
      window.removeEventListener("pointerup", cover);
      window.removeEventListener("pointercancel", cover);
      window.removeEventListener("keyup", releaseKey);
    };
  }, [secretVisible]);

  const actionLabel =
    room.status === "paused"
      ? avalonText(language, "pause")
      : room.phase === "role-confirmation"
        ? avalonText(language, "roleProgress")
        : room.phase === "manual-night"
          ? avalonText(language, "night")
          : room.phase === "team-proposal"
            ? avalonText(language, "selectTeam")
            : room.phase === "team-vote"
              ? avalonText(language, "vote")
              : room.phase === "mission"
                ? avalonText(language, "mission")
                : room.phase === "assassination"
                  ? avalonText(language, "assassination")
                  : avalonText(language, "waiting");

  return (
    <main className="avalon-shell">
      <header className="avalon-topbar">
        <div className="avalon-top-actions">
          <button className="secondary" onClick={onLobby}>
            <ArrowIcon direction="left" /> {avalonText(language, "back")}
          </button>
          <button className="secondary" onClick={() => setDanger({ kind: "leave" })}>
            {avalonText(language, "leave")}
          </button>
        </div>
        <div className="avalon-room-title">
          <p className="eyebrow">AVALON · {actionLabel}</p>
          <h1>{room.name}</h1>
          <span>
            {account.avatar} {account.username} ·{" "}
            {room.viewerRole === "spectator"
              ? avalonText(language, "spectating")
              : avalonText(language, "participant")}
          </span>
        </div>
        <div className="avalon-host-actions">
          <a
            className="secondary"
            href={`/?display=1&roomId=${encodeURIComponent(room.id)}`}
            target="_blank"
            rel="noreferrer"
          >
            {avalonText(language, "display")}
          </a>
          {host && !intermission && (
            <>
              <button
                className="secondary"
                onClick={() =>
                  void run(
                    room.status === "paused" ? "room.resume" : "room.pause"
                  )
                }
              >
                {avalonText(
                  language,
                  room.status === "paused" ? "resume" : "pause"
                )}
              </button>
              <button className="danger" onClick={() => setDanger({ kind: "void" })}>
                {avalonText(language, "void")}
              </button>
            </>
          )}
          {host && (
            <button className="danger" onClick={() => setDanger({ kind: "close" })}>
              {avalonText(language, "close")}
            </button>
          )}
        </div>
      </header>
      <p
        className={`notice avalon-notice${notice ? "" : " avalon-notice-empty"}`}
        role="status"
      >
        {notice || "\u00a0"}
      </p>

      <section className="avalon-layout">
        <AvalonMemberRail
          language={language}
          room={room}
          currentAccountId={account.id}
          host={host}
          onTransfer={(targetAccountId) =>
            void run("room.transfer-host", { targetAccountId })
          }
          onRemove={(accountId, username) =>
            setDanger({ kind: "remove", accountId, username })
          }
        />

        <AvalonMissionBoard language={language} room={room} />

        <section className="avalon-action-panel" aria-label={actionLabel}>
          {room.viewerRole === "spectator" && !intermission && (
            <div className="avalon-callout">
              <strong>{avalonText(language, "spectating")}</strong>
              <p>{avalonText(language, "waitingOthers")}</p>
            </div>
          )}

          {intermission && (
            <AvalonIntermission
              language={language}
              account={account}
              room={room}
              host={host}
              run={run}
              onConfirmStart={() => setDanger({ kind: "start" })}
            />
          )}

          {!intermission && participant && room.ownKnowledge && (
            <AvalonSecretPanel
              language={language}
              room={room}
              visible={secretVisible}
              setVisible={setSecretVisible}
            />
          )}

          {room.phase === "role-confirmation" && participant && (
            <section className="avalon-control-card">
              <h2>{avalonText(language, "roleProgress")}</h2>
              <p>
                {room.roleConfirmedAccountIds.length}/
                {room.participantAccountIds.length}
              </p>
              <button
                className="primary"
                disabled={room.ownRoleConfirmed || room.status === "paused"}
                onClick={() =>
                  void run("avalon.role.confirm", {
                    avalonVersion: room.avalonVersion
                  })
                }
              >
                {room.ownRoleConfirmed
                  ? avalonText(language, "confirmed")
                  : avalonText(language, "confirmRole")}
              </button>
            </section>
          )}

          {room.phase === "manual-night" && (
            <AvalonNightControls
              language={language}
              room={room}
              host={host}
              run={run}
            />
          )}

          {room.phase === "team-proposal" && participant && (
            <AvalonTeamProposal
              language={language}
              room={room}
              accountId={account.id}
              selectedTeam={selectedTeam}
              setSelectedTeam={setSelectedTeam}
              run={run}
            />
          )}

          {room.phase === "team-vote" && participant && (
            <section className="avalon-control-card">
              <h2>{avalonText(language, "vote")}</h2>
              <p>
                {avalonText(language, "team")}:{" "}
                {memberNames(room, room.proposedTeamAccountIds).join(", ")}
              </p>
              {room.ownVoteSubmitted ? (
                <p className="avalon-submitted">
                  {avalonText(language, "submitted")} ·{" "}
                  {room.voteSubmittedAccountIds.length}/
                  {room.participantAccountIds.length}
                </p>
              ) : (
                <div className="avalon-choice-row">
                  <button
                    className="primary"
                    disabled={room.status === "paused"}
                    onClick={() =>
                      void run("avalon.vote", {
                        avalonVersion: room.avalonVersion,
                        approve: true
                      })
                    }
                  >
                    {avalonText(language, "approve")}
                  </button>
                  <button
                    className="danger"
                    disabled={room.status === "paused"}
                    onClick={() =>
                      void run("avalon.vote", {
                        avalonVersion: room.avalonVersion,
                        approve: false
                      })
                    }
                  >
                    {avalonText(language, "reject")}
                  </button>
                </div>
              )}
            </section>
          )}

          {room.phase === "mission" &&
            participant &&
            room.proposedTeamAccountIds.includes(account.id) && (
              <section className="avalon-control-card">
                <h2>{avalonText(language, "mission")}</h2>
                {room.ownMissionSubmitted ? (
                  <p className="avalon-submitted">
                    {avalonText(language, "submitted")} ·{" "}
                    {room.missionSubmittedAccountIds.length}/
                    {room.proposedTeamAccountIds.length}
                  </p>
                ) : (
                  <>
                    {!roleIsEvil(room.ownKnowledge?.role) && (
                      <p>{avalonText(language, "goodCannotFail")}</p>
                    )}
                    <div className="avalon-choice-row">
                      <button
                        className="primary"
                        disabled={room.status === "paused"}
                        onClick={() =>
                          void run("avalon.mission", {
                            avalonVersion: room.avalonVersion,
                            choice: "success"
                          })
                        }
                      >
                        {avalonText(language, "missionSuccess")}
                      </button>
                      <button
                        className="danger"
                        disabled={
                          room.status === "paused" ||
                          !roleIsEvil(room.ownKnowledge?.role)
                        }
                        onClick={() =>
                          void run("avalon.mission", {
                            avalonVersion: room.avalonVersion,
                            choice: "fail"
                          })
                        }
                      >
                        {avalonText(language, "missionFail")}
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

          {room.phase === "mission" &&
            (!participant ||
              !room.proposedTeamAccountIds.includes(account.id)) && (
              <div className="avalon-callout">
                <strong>{avalonText(language, "waitingSubmissions")}</strong>
                <p>
                  {room.missionSubmittedAccountIds.length}/
                  {room.proposedTeamAccountIds.length}
                </p>
              </div>
            )}

          {room.phase === "assassination" &&
            participant &&
            room.ownKnowledge?.role === "assassin" && (
              <section className="avalon-control-card">
                <h2>{avalonText(language, "assassination")}</h2>
                <p>{avalonText(language, "chooseTarget")}</p>
                <div className="avalon-target-grid">
                  {(room.assassinationCandidates ?? []).map((candidate) => (
                    <button
                      key={candidate.accountId}
                      className={
                        assassinationTarget === candidate.accountId
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setAssassinationTarget(candidate.accountId)
                      }
                    >
                      <span>{candidate.avatar}</span>
                      {candidate.username}
                    </button>
                  ))}
                </div>
                <button
                  className="danger"
                  disabled={
                    !assassinationTarget || room.status === "paused"
                  }
                  onClick={() =>
                    void run("avalon.assassinate", {
                      avalonVersion: room.avalonVersion,
                      targetAccountId: assassinationTarget
                    })
                  }
                >
                  {avalonText(language, "assassinate")}
                </button>
              </section>
            )}

          {room.phase === "assassination" &&
            room.ownKnowledge?.role !== "assassin" && (
              <div className="avalon-callout">
                <strong>{avalonText(language, "assassination")}</strong>
                <p>{avalonText(language, "waitingOthers")}</p>
              </div>
            )}
        </section>
      </section>

      {danger?.kind === "start" && (
        <ConfirmDialog
          title={avalonText(language, "start")}
          description={avalonText(language, "unreadyConfirm")}
          confirmLabel={
            room.phase === "complete" || room.phase === "void"
              ? avalonText(language, "startNext")
              : avalonText(language, "start")
          }
          cancelLabel={language === "zh-CN" ? "取消" : "Cancel"}
          onCancel={() => setDanger(null)}
          onConfirm={() => {
            setDanger(null);
            void run("avalon.start", {
              avalonVersion: room.avalonVersion,
              confirmUnready: true
            });
          }}
        />
      )}
      {danger && danger.kind !== "start" && (
        <ConfirmDialog
          title={
            danger.kind === "remove"
              ? `${avalonText(language, "remove")} ${danger.username}`
              : avalonText(language, danger.kind)
          }
          description={avalonText(language, "confirmDanger")}
          confirmLabel={
            danger.kind === "remove"
              ? avalonText(language, "remove")
              : avalonText(language, danger.kind)
          }
          cancelLabel={language === "zh-CN" ? "取消" : "Cancel"}
          danger
          onCancel={() => setDanger(null)}
          onConfirm={() => {
            const action = danger;
            setDanger(null);
            if (action.kind === "remove") {
              void run("room.remove", {
                targetAccountId: action.accountId,
                confirmed: true
              });
            } else if (action.kind === "leave") {
              void run("room.leave", { confirmed: true });
            } else if (action.kind === "void") {
              void run("avalon.void", {
                avalonVersion: room.avalonVersion
              });
            } else {
              void run("room.close");
            }
          }}
        />
      )}
    </main>
  );
}

function AvalonMemberRail({
  language,
  room,
  currentAccountId,
  host,
  onTransfer,
  onRemove
}: {
  language: Language;
  room: AvalonRoomProjection;
  currentAccountId?: string;
  host: boolean;
  onTransfer?: (accountId: string) => void;
  onRemove?: (accountId: string, username: string) => void;
}) {
  const ready = new Set(room.readyAccountIds);
  const team = new Set(room.proposedTeamAccountIds);
  const submitted =
    room.phase === "role-confirmation"
      ? new Set(room.roleConfirmedAccountIds)
      : room.phase === "team-vote"
        ? new Set(room.voteSubmittedAccountIds)
        : room.phase === "mission"
          ? new Set(room.missionSubmittedAccountIds)
          : new Set<string>();
  return (
    <section className="avalon-member-rail" aria-label={avalonText(language, "participant")}>
      <div className="avalon-section-heading">
        <p className="eyebrow">{avalonText(language, "participant")}</p>
        <strong>{room.seats.length}/10</strong>
      </div>
      <div className="avalon-member-grid">
        {room.seats.map((member) => (
          <article
            key={member.accountId}
            className={[
              "avalon-member",
              `avalon-member-${member.role}`,
              member.accountId === currentAccountId ? "is-self" : "",
              member.accountId === room.currentLeaderAccountId
                ? "is-leader"
                : "",
              team.has(member.accountId) ? "is-team" : ""
            ].filter(Boolean).join(" ")}
          >
            <span className="avalon-avatar">{member.avatar}</span>
            <div>
              <strong>{member.username}</strong>
              <small>
                {member.accountId === room.hostAccountId
                  ? avalonText(language, "host")
                  : member.role === "spectator"
                    ? avalonText(language, "spectating")
                    : ready.has(member.accountId)
                      ? avalonText(language, "readyDone")
                      : member.role === "participant"
                        ? avalonText(language, "participant")
                        : avalonText(language, "waiting")}
              </small>
            </div>
            <i className={member.connected ? "online" : "offline"}>
              {member.connected
                ? avalonText(language, "online")
                : avalonText(language, "offline")}
            </i>
            {(member.accountId === currentAccountId ||
              member.accountId === room.currentLeaderAccountId ||
              team.has(member.accountId) ||
              submitted.has(member.accountId)) && (
              <span className="avalon-member-badges">
                {member.accountId === currentAccountId && (
                  <b>{avalonText(language, "you")}</b>
                )}
                {member.accountId === room.currentLeaderAccountId && (
                  <b>{avalonText(language, "leader")}</b>
                )}
                {team.has(member.accountId) && (
                  <b>{avalonText(language, "team")}</b>
                )}
                {submitted.has(member.accountId) && (
                  <b>{avalonText(language, "submitted")}</b>
                )}
              </span>
            )}
            {host &&
              currentAccountId &&
              member.accountId !== currentAccountId && (
                <span className="avalon-member-actions">
                  <button
                    className="text-button"
                    disabled={!member.connected}
                    onClick={() => onTransfer?.(member.accountId)}
                  >
                    {avalonText(language, "transfer")}
                  </button>
                  <button
                    className="text-button danger-text"
                    onClick={() =>
                      onRemove?.(member.accountId, member.username)
                    }
                  >
                    {avalonText(language, "remove")}
                  </button>
                </span>
              )}
          </article>
        ))}
      </div>
    </section>
  );
}

function AvalonMissionBoard({
  language,
  room
}: {
  language: Language;
  room: AvalonRoomProjection;
}) {
  const successCount = room.missionHistory.filter(
    (mission) => mission.succeeded
  ).length;
  const failCount = room.missionHistory.length - successCount;
  return (
    <section className="avalon-mission-board" aria-label={avalonText(language, "missionTrack")}>
      <div className="avalon-section-heading">
        <div>
          <p className="eyebrow">{avalonText(language, "missionTrack")}</p>
          <h2>
            {avalonText(language, "successes")} {successCount} ·{" "}
            {avalonText(language, "failures")} {failCount}
          </h2>
        </div>
        <span className="avalon-rejection-counter">
          {avalonText(language, "rejections")} {room.rejectionCount}/5
        </span>
      </div>
      <div className="avalon-mission-track">
        {Array.from({ length: 5 }, (_, index) => {
          const result = room.missionHistory[index];
          const current = room.currentMissionNumber === index + 1;
          return (
            <article
              key={index}
              className={
                result
                  ? result.succeeded
                    ? "mission-success"
                    : "mission-fail"
                  : current
                    ? "mission-current"
                    : ""
              }
            >
              <strong>{index + 1}</strong>
              <span>
                {result
                  ? result.succeeded
                    ? avalonText(language, "missionSuccess")
                    : avalonText(language, "missionFail")
                  : current
                    ? `${room.currentMissionRule?.teamSize ?? "–"} ${avalonText(language, "participant")} · ${avalonText(language, "failThreshold")} ${room.currentMissionRule?.failThreshold ?? "–"}`
                    : "–"}
              </span>
              {result && (
                <small>
                  {result.failCount} {avalonText(language, "failures")}
                </small>
              )}
            </article>
          );
        })}
      </div>
      {room.currentLeaderAccountId && (
        <div className="avalon-public-state">
          <span>
            {avalonText(language, "leader")}:{" "}
            <strong>
              {memberName(room, room.currentLeaderAccountId)}
            </strong>
          </span>
          <span>
            {avalonText(language, "mission")} {room.currentMissionNumber}
          </span>
          {room.proposedTeamAccountIds.length > 0 && (
            <span>
              {avalonText(language, "team")}:{" "}
              {memberNames(room, room.proposedTeamAccountIds).join(", ")}
            </span>
          )}
          {room.phase === "team-vote" && (
            <span>
              {avalonText(language, "vote")} ·{" "}
              {avalonText(language, "submitted")}{" "}
              {room.voteSubmittedAccountIds.length}/
              {room.participantAccountIds.length}
            </span>
          )}
          {room.phase === "mission" && (
            <span>
              {avalonText(language, "mission")} ·{" "}
              {avalonText(language, "submitted")}{" "}
              {room.missionSubmittedAccountIds.length}/
              {room.proposedTeamAccountIds.length}
            </span>
          )}
        </div>
      )}
      {room.voteHistory.length > 0 && (
        <details className="avalon-public-history">
          <summary>
            {avalonText(language, "vote")} · {room.voteHistory.length}
          </summary>
          {room.voteHistory.map((vote, index) => (
            <article key={`${vote.missionNumber}-${vote.attempt}-${index}`}>
              <strong>
                {avalonText(language, "mission")} {vote.missionNumber} ·{" "}
                {avalonText(language, "attempt")} {vote.attempt}
              </strong>
              <span>
                {vote.votes.map((entry) => (
                  <i key={entry.accountId}>
                    {memberName(room, entry.accountId)}{" "}
                    {entry.approve ? "✓" : "✕"}
                  </i>
                ))}
              </span>
            </article>
          ))}
        </details>
      )}
      {(room.phase === "complete" || room.phase === "void") && (
        <AvalonResult language={language} room={room} />
      )}
    </section>
  );
}

function AvalonResult({
  language,
  room
}: {
  language: Language;
  room: AvalonRoomProjection;
}) {
  const result = room.lastResult;
  if (room.phase === "void" || result?.outcome === "void") {
    return (
      <section className="avalon-result avalon-result-void" role="status">
        <h2>{avalonText(language, "voided")}</h2>
      </section>
    );
  }
  if (!result || result.outcome !== "settled") return null;
  return (
    <section className="avalon-result" role="status">
      <header>
        <div>
          <p className="eyebrow">{avalonText(language, "outcome")}</p>
          <h2>
            {avalonText(language, "winner")}:{" "}
            {avalonText(language, result.winningAlignment)}
          </h2>
        </div>
        <span>
          {avalonText(language, "reason")}:{" "}
          {winReasonLabel(language, result.reason)}
        </span>
      </header>
      <div className="avalon-result-list">
        {result.playerResults.map((player) => (
          <article key={player.accountId}>
            <span>{player.avatar}</span>
            <div>
              <strong>{player.username}</strong>
              <small>
                {avalonRoleLabel(language, player.role)} ·{" "}
                {avalonText(language, player.alignment)}
              </small>
            </div>
            <b className={player.scoreDelta >= 0 ? "score-positive" : "score-negative"}>
              {player.scoreDelta >= 0 ? "+" : ""}
              {player.scoreDelta.toLocaleString()}
            </b>
            <small>
              {avalonText(language, "totalScore")}{" "}
              {player.endingScore.toLocaleString()}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}

function AvalonSecretPanel({
  language,
  room,
  visible,
  setVisible
}: {
  language: Language;
  room: AvalonRoomProjection;
  visible: boolean;
  setVisible: (visible: boolean) => void;
}) {
  const knowledge = room.ownKnowledge!;
  const alignment = roleIsEvil(knowledge.role) ? "evil" : "good";
  const list = (ids: string[]) =>
    ids.length > 0 ? memberNames(room, ids).join(", ") : avalonText(language, "none");
  return (
    <section
      className={`avalon-secret ${visible ? "revealed" : "covered"}`}
      aria-label={avalonText(language, "knowledge")}
    >
      {!visible ? (
        <>
          <div className="avalon-secret-shield" aria-hidden="true">◈</div>
          <strong>{avalonText(language, "secretCovered")}</strong>
          <button
            className="primary"
            onPointerDown={() => setVisible(true)}
            onPointerUp={() => setVisible(false)}
            onPointerCancel={() => setVisible(false)}
            onPointerLeave={() => setVisible(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                setVisible(true);
              }
            }}
            onKeyUp={() => setVisible(false)}
          >
            {avalonText(language, "reveal")}
          </button>
        </>
      ) : (
        <>
          <header>
            <div>
              <small>{avalonText(language, "role")}</small>
              <h2>{avalonRoleLabel(language, knowledge.role)}</h2>
              <p>{avalonRoleDescription(language, knowledge.role)}</p>
            </div>
            <span className={`alignment-${alignment}`}>
              {avalonText(language, alignment)}
            </span>
          </header>
          <dl>
            {knowledge.visibleEvilAccountIds.length > 0 && (
              <>
                <dt>{avalonText(language, "visibleEvil")}</dt>
                <dd>{list(knowledge.visibleEvilAccountIds)}</dd>
              </>
            )}
            {knowledge.percivalCandidateAccountIds.length > 0 && (
              <>
                <dt>{avalonText(language, "percivalCandidates")}</dt>
                <dd>{list(knowledge.percivalCandidateAccountIds)}</dd>
              </>
            )}
            {knowledge.evilAllyAccountIds.length > 0 && (
              <>
                <dt>{avalonText(language, "evilAllies")}</dt>
                <dd>{list(knowledge.evilAllyAccountIds)}</dd>
              </>
            )}
          </dl>
          <button className="secondary" onClick={() => setVisible(false)}>
            {avalonText(language, "hide")}
          </button>
        </>
      )}
    </section>
  );
}

function AvalonNightControls({
  language,
  room,
  host,
  run
}: {
  language: Language;
  room: AvalonRoomProjection;
  host: boolean;
  run: RunCommand;
}) {
  const currentStep = room.nightSteps[room.nightStepIndex ?? 0];
  return (
    <section className="avalon-control-card avalon-night-card">
      <h2>{avalonText(language, "night")}</h2>
      <ol>
        {room.nightSteps.map((step) => (
          <li
            key={step.index}
            className={
              step.index === room.nightStepIndex ? "current" : ""
            }
          >
            {nightStepLabel(language, step.code)}
          </li>
        ))}
      </ol>
      {currentStep && (
        <p className="avalon-current-night">
          {nightStepLabel(language, currentStep.code)}
        </p>
      )}
      {host && (
        <div className="avalon-choice-row">
          <button
            className="primary"
            disabled={room.status === "paused"}
            onClick={() =>
              void run("avalon.night.advance", {
                avalonVersion: room.avalonVersion
              })
            }
          >
            {avalonText(language, "advanceNight")}
          </button>
          <button
            className="secondary"
            disabled={room.status === "paused"}
            onClick={() =>
              void run("avalon.night.restart", {
                avalonVersion: room.avalonVersion
              })
            }
          >
            {avalonText(language, "restartNight")}
          </button>
        </div>
      )}
    </section>
  );
}

function AvalonTeamProposal({
  language,
  room,
  accountId,
  selectedTeam,
  setSelectedTeam,
  run
}: {
  language: Language;
  room: AvalonRoomProjection;
  accountId: string;
  selectedTeam: string[];
  setSelectedTeam: (team: string[]) => void;
  run: RunCommand;
}) {
  const leader = room.currentLeaderAccountId === accountId;
  const teamSize = room.currentMissionRule?.teamSize ?? 0;
  if (!leader) {
    return (
      <div className="avalon-callout">
        <strong>{avalonText(language, "selectTeam")}</strong>
        <p>
          {avalonText(language, "leader")}:{" "}
          {memberName(room, room.currentLeaderAccountId)}
        </p>
      </div>
    );
  }
  return (
    <section className="avalon-control-card">
      <h2>
        {avalonText(language, "selectTeam")} · {selectedTeam.length}/{teamSize}
      </h2>
      <div className="avalon-target-grid">
        {room.seats
          .filter((member) =>
            room.participantAccountIds.includes(member.accountId)
          )
          .map((member) => {
            const selected = selectedTeam.includes(member.accountId);
            return (
              <button
                key={member.accountId}
                className={selected ? "selected" : ""}
                aria-pressed={selected}
                onClick={() =>
                  setSelectedTeam(
                    selected
                      ? selectedTeam.filter(
                          (accountId) => accountId !== member.accountId
                        )
                      : selectedTeam.length < teamSize
                        ? [...selectedTeam, member.accountId]
                        : selectedTeam
                  )
                }
              >
                <span>{member.avatar}</span>
                {member.username}
              </button>
            );
          })}
      </div>
      <button
        className="primary"
        disabled={
          selectedTeam.length !== teamSize || room.status === "paused"
        }
        onClick={() =>
          void run("avalon.team.propose", {
            avalonVersion: room.avalonVersion,
            teamAccountIds: selectedTeam
          })
        }
      >
        {avalonText(language, "submitTeam")}
      </button>
    </section>
  );
}

function AvalonIntermission({
  language,
  account,
  room,
  host,
  run,
  onConfirmStart
}: {
  language: Language;
  account: Account;
  room: AvalonRoomProjection;
  host: boolean;
  run: RunCommand;
  onConfirmStart: () => void;
}) {
  const ready = new Set(room.readyAccountIds);
  const currentReady = ready.has(account.id);
  const selected = room.seats.filter(
    (member) =>
      member.accountId === room.hostAccountId ||
      (member.connected && ready.has(member.accountId))
  );
  const unready = room.seats.filter(
    (member) => !selected.some((entry) => entry.accountId === member.accountId)
  );
  const canStart =
    host &&
    selected.length >= 5 &&
    selected.length <= 10 &&
    room.seats.find((member) => member.accountId === room.hostAccountId)
      ?.connected;
  const start = () => {
    if (!canStart) return;
    if (unready.length > 0) {
      onConfirmStart();
      return;
    }
    void run("avalon.start", {
      avalonVersion: room.avalonVersion,
      confirmUnready: false
    });
  };
  return (
    <>
      <section className="avalon-control-card avalon-ready-card">
        <h2>{avalonText(language, "waiting")}</h2>
        <p>{avalonText(language, "hostReady")}</p>
        <strong>{selected.length}/5–10</strong>
        <div className="avalon-choice-row">
          {!host && (
            <button
              className={currentReady ? "secondary" : "primary"}
              disabled={
                !room.seats.find((member) => member.accountId === account.id)
                  ?.connected
              }
              onClick={() =>
                void run("avalon.ready", {
                  avalonVersion: room.avalonVersion,
                  ready: !currentReady
                })
              }
            >
              {avalonText(
                language,
                currentReady ? "cancelReady" : "ready"
              )}
            </button>
          )}
          {host && (
            <button className="primary" disabled={!canStart} onClick={start}>
              {room.phase === "complete" || room.phase === "void"
                ? avalonText(language, "startNext")
                : avalonText(language, "start")}
            </button>
          )}
        </div>
      </section>
      {host && (
        <AvalonRoomSettings
          language={language}
          room={room}
          run={run}
        />
      )}
    </>
  );
}

function AvalonRoomSettings({
  language,
  room,
  run
}: {
  language: Language;
  room: AvalonRoomProjection;
  run: RunCommand;
}) {
  const [recognitionMode, setRecognitionMode] = useState(
    room.config.recognitionMode
  );
  const [oberonRule, setOberonRule] = useState(room.config.oberonRule);
  const [stake, setStake] = useState(room.config.stake);
  const [roleSource, setRoleSource] = useState(room.config.roleSource);
  const [roles, setRoles] = useState<AvalonRole[]>(
    room.config.roleSource === "custom"
      ? [...room.config.roles]
      : ["merlin", "percival", "assassin", "morgana"]
  );
  const compatiblePlayerCounts = avalonCompatiblePlayerCounts(roles);

  useEffect(() => {
    setRecognitionMode(room.config.recognitionMode);
    setOberonRule(room.config.oberonRule);
    setStake(room.config.stake);
    setRoleSource(room.config.roleSource);
    if (room.config.roleSource === "custom") {
      setRoles([...room.config.roles]);
    }
  }, [room.config, room.avalonVersion]);

  return (
    <section className="avalon-control-card avalon-settings-card">
      <h2>{avalonText(language, "settings")}</h2>
      <div className="avalon-setting-grid">
        <SelectField
          label={avalonText(language, "recognition")}
          value={recognitionMode}
          options={[
            {
              value: "automatic",
              label: avalonText(language, "automatic")
            },
            { value: "manual", label: avalonText(language, "manual") }
          ]}
          onChange={(value) =>
            setRecognitionMode(value as "automatic" | "manual")
          }
        />
        <SelectField
          label={avalonText(language, "oberon")}
          value={oberonRule}
          options={[
            { value: "original", label: avalonText(language, "original") },
            { value: "dized", label: avalonText(language, "dized") }
          ]}
          onChange={(value) =>
            setOberonRule(value as "original" | "dized")
          }
        />
        <SelectField
          label={avalonText(language, "roleSource")}
          value={roleSource}
          options={[
            { value: "preset", label: avalonText(language, "preset") },
            { value: "custom", label: avalonText(language, "custom") }
          ]}
          onChange={(value) =>
            setRoleSource(value as "preset" | "custom")
          }
        />
        <label>
          {avalonText(language, "stake")}
          <input
            type="number"
            inputMode="numeric"
            min="2"
            step="1"
            value={stake}
            onChange={(event) => setStake(Number(event.target.value))}
          />
        </label>
      </div>
      {roleSource === "custom" && (
        <>
          <AvalonRoleEditor
            language={language}
            roles={roles}
            onChange={setRoles}
          />
          <p
            className={
              compatiblePlayerCounts.length > 0
                ? "avalon-role-hint"
                : "error"
            }
            role={compatiblePlayerCounts.length > 0 ? "status" : "alert"}
          >
            {compatiblePlayerCounts.length > 0
              ? `${avalonText(language, "compatibleCounts")}: ${compatiblePlayerCounts.join(", ")}`
              : avalonText(language, "invalidRoleConfig")}
          </p>
        </>
      )}
      <button
        className="primary"
        disabled={
          stake < 2 ||
          !Number.isSafeInteger(stake) ||
          (roleSource === "custom" &&
            compatiblePlayerCounts.length === 0)
        }
        onClick={() =>
          void run("avalon.config.update", {
            avalonVersion: room.avalonVersion,
            config: {
              recognitionMode,
              oberonRule,
              stake,
              hostTransferTimeoutSeconds:
                room.config.hostTransferTimeoutSeconds,
              roleSource,
              ...(roleSource === "custom" ? { roles } : {})
            }
          })
        }
      >
        {avalonText(language, "save")}
      </button>
    </section>
  );
}

export function AvalonRoleEditor({
  language,
  roles,
  onChange
}: {
  language: Language;
  roles: AvalonRole[];
  onChange: (roles: AvalonRole[]) => void;
}) {
  const roleOrder: AvalonRole[] = [
    "merlin",
    "percival",
    "loyal-servant",
    "assassin",
    "morgana",
    "mordred",
    "oberon",
    "minion"
  ];
  const unique = new Set<AvalonRole>([
    "merlin",
    "percival",
    "assassin",
    "morgana",
    "mordred",
    "oberon"
  ]);
  return (
    <fieldset className="avalon-role-editor">
      <legend>{avalonText(language, "roles")}</legend>
      {roleOrder.map((role) => {
        const count = roles.filter((entry) => entry === role).length;
        return (
          <label key={role}>
            <span>{avalonRoleLabel(language, role)}</span>
            <input
              aria-label={avalonRoleLabel(language, role)}
              type="number"
              min={role === "merlin" || role === "assassin" ? 1 : 0}
              max={unique.has(role) ? 1 : 10}
              step="1"
              value={count}
              onChange={(event) => {
                const nextCount = Math.max(
                  0,
                  Math.min(
                    unique.has(role) ? 1 : 10,
                    Number(event.target.value)
                  )
                );
                onChange([
                  ...roles.filter((entry) => entry !== role),
                  ...Array.from({ length: nextCount }, () => role)
                ]);
              }}
            />
          </label>
        );
      })}
    </fieldset>
  );
}

export function AvalonPublicDisplay({
  language,
  room
}: {
  language: Language;
  room: AvalonRoomProjection;
}) {
  return (
    <main className="avalon-shell avalon-display-shell">
      <header className="avalon-topbar">
        <div className="avalon-room-title">
          <p className="eyebrow">AVALON · {avalonText(language, "display")}</p>
          <h1>{room.name}</h1>
          <span>{avalonText(language, "readonly")}</span>
        </div>
      </header>
      <section className="avalon-layout avalon-display-layout">
        <AvalonMemberRail
          language={language}
          room={room}
          host={false}
        />
        <AvalonMissionBoard language={language} room={room} />
        <section className="avalon-action-panel">
          {room.phase === "manual-night" && (
            <AvalonNightControls
              language={language}
              room={room}
              host={false}
              run={async () => false}
            />
          )}
          {room.phase === "role-confirmation" && (
            <div className="avalon-callout">
              <strong>{avalonText(language, "roleProgress")}</strong>
              <p>
                {room.roleConfirmedAccountIds.length}/
                {room.participantAccountIds.length}
              </p>
            </div>
          )}
          {!room.phase && (
            <div className="avalon-callout">
              <strong>{avalonText(language, "waiting")}</strong>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function memberName(
  room: AvalonRoomProjection,
  accountId: string | undefined
): string {
  if (!accountId) return "–";
  const currentMember = room.seats.find(
    (member) => member.accountId === accountId
  );
  if (currentMember) return currentMember.username;
  if (room.lastResult?.outcome === "settled") {
    return (
      room.lastResult.playerResults.find(
        (player) => player.accountId === accountId
      )?.username ?? accountId
    );
  }
  return accountId;
}

function memberNames(
  room: AvalonRoomProjection,
  accountIds: readonly string[]
): string[] {
  return accountIds.map((accountId) => memberName(room, accountId));
}

function playAvalonTone(volume: number): void {
  if (volume <= 0 || typeof AudioContext === "undefined") return;
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 520;
    gain.gain.value = Math.min(0.08, (volume / 100) * 0.08);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 0.12
    );
    oscillator.stop(context.currentTime + 0.13);
    oscillator.addEventListener("ended", () => {
      void context.close();
    });
  } catch {
    // Audio is optional and must never interrupt an authoritative command.
  }
}

export function avalonRoomConfigPayload(
  config: AvalonRoomConfig
): Record<string, unknown> {
  return {
    recognitionMode: config.recognitionMode,
    oberonRule: config.oberonRule,
    stake: config.stake,
    hostTransferTimeoutSeconds: config.hostTransferTimeoutSeconds,
    roleSource: config.roleSource,
    ...(config.roleSource === "custom" ? { roles: config.roles } : {})
  };
}
