import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AccountManagementSummary,
  Language,
  LobbyProjection
} from "@party/contracts";
import { t } from "./locales";
import { ConfirmDialog, SelectField } from "./ui";

export function PlatformLeaderboard({
  language,
  lobby
}: {
  language: Language;
  lobby: LobbyProjection;
}) {
  const seasons = useMemo(
    () => [
      lobby.currentSeason,
      ...[...lobby.historicalSeasons]
        .sort(
          (left, right) =>
            (right.season.endedAt ?? right.season.startedAt) -
            (left.season.endedAt ?? left.season.startedAt)
        )
        .map((item) => item.season)
    ],
    [lobby.currentSeason, lobby.historicalSeasons]
  );
  const [selectedSeasonId, setSelectedSeasonId] = useState(
    lobby.currentSeason.id
  );
  useEffect(() => {
    setSelectedSeasonId(lobby.currentSeason.id);
  }, [lobby.currentSeason.id]);
  useEffect(() => {
    if (!seasons.some((season) => season.id === selectedSeasonId)) {
      setSelectedSeasonId(lobby.currentSeason.id);
    }
  }, [lobby.currentSeason.id, seasons, selectedSeasonId]);
  const historical = lobby.historicalSeasons.find(
    (item) => item.season.id === selectedSeasonId
  );
  const entries = historical?.entries ?? lobby.leaderboard;
  const seasonName = historical?.season.name ?? lobby.currentSeason.name;
  return (
    <aside className="leaderboard">
      <p className="eyebrow">{seasonName}</p>
      <h2>{t(language, "leaderboard")}</h2>
      <SelectField
        label={t(language, "selectSeason")}
        value={selectedSeasonId}
        options={seasons.map((season) => ({
          value: season.id,
          label:
            season.id === lobby.currentSeason.id
              ? `${season.name} · ${t(language, "protectedCurrentSeason")}`
              : season.name
        }))}
        onChange={setSelectedSeasonId}
      />
      {entries.length === 0 ? (
        <p className="empty-state">{t(language, "emptyLeaderboard")}</p>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={entry.accountId}>
              <span className="rank">{rankBadge(entry.rank)}</span>
              <span className="leader-name">
                {entry.avatar}{" "}
                {entry.anonymized && entry.anonymousNumber
                  ? t(language, "deletedPlayer").replace(
                      "{number}",
                      String(entry.anonymousNumber)
                    )
                  : entry.username}
                {!historical &&
                  lobby.rooms.some((room) =>
                    room.seats.some(
                      (seat) => seat.accountId === entry.accountId
                    )
                  ) && <small>{t(language, "playing")}</small>}
              </span>
              <strong>{entry.score.toLocaleString()}</strong>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

export function AccountManagementDialog({
  language,
  accounts,
  currentAccountId,
  onClose,
  onDelete,
  onDeleteOthers
}: {
  language: Language;
  accounts: AccountManagementSummary[];
  currentAccountId: string;
  onClose: () => void;
  onDelete: (accountId: string) => Promise<boolean>;
  onDeleteOthers: () => Promise<boolean>;
}) {
  const current = accounts.find((account) => account.id === currentAccountId);
  const [confirmation, setConfirmation] = useState<
    { kind: "one"; account: AccountManagementSummary } | { kind: "others" } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const others = accounts.filter((account) => account.id !== currentAccountId);

  const confirm = async () => {
    if (!confirmation || busy) return;
    setBusy(true);
    try {
      const completed =
        confirmation.kind === "one"
          ? await onDelete(confirmation.account.id)
          : await onDeleteOthers();
      if (completed) setConfirmation(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ManagementDialog
        language={language}
        title={t(language, "accountManagement")}
        onClose={onClose}
      >
        <p className="warning">{t(language, "accountDeletionImpact")}</p>
        <div className="management-list">
          {accounts.map((account) => (
            <div className="management-row" key={account.id}>
              <span className="management-identity">
                <b aria-hidden="true">{account.avatar}</b>
                <span>
                  <strong>{account.username}</strong>
                  {account.id === currentAccountId && (
                    <small>{t(language, "currentAccount")}</small>
                  )}
                </span>
              </span>
              <button
                className="danger compact-button"
                onClick={() => setConfirmation({ kind: "one", account })}
              >
                {t(language, "deleteAccount")}
              </button>
            </div>
          ))}
        </div>
        {accounts.length === 0 && (
          <p className="empty-state">{t(language, "noAccounts")}</p>
        )}
        <div className="management-summary">
          <span>
            {t(language, "protectedAccount")}:{" "}
            <strong>{current?.username ?? t(language, "currentAccount")}</strong>
          </span>
          <span>
            {t(language, "deleteTargetCount").replace(
              "{count}",
              String(others.length)
            )}
          </span>
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>
            {t(language, "close")}
          </button>
          <button
            className="danger"
            disabled={others.length === 0}
            onClick={() => setConfirmation({ kind: "others" })}
          >
            {t(language, "deleteOtherAccounts")}
          </button>
        </div>
      </ManagementDialog>
      {confirmation && (
        <ConfirmDialog
          title={
            confirmation.kind === "one"
              ? t(language, "confirmDeleteAccount")
              : t(language, "confirmDeleteOtherAccounts")
          }
          description={
            confirmation.kind === "one"
              ? t(
                  language,
                  confirmation.account.id === currentAccountId
                    ? "confirmSelfDeleteAccountDescription"
                    : "confirmDeleteAccountDescription"
                ).replace("{name}", confirmation.account.username)
              : t(language, "confirmDeleteOtherAccountsDescription")
                  .replace("{count}", String(others.length))
                  .replace(
                    "{name}",
                    current?.username ?? t(language, "currentAccount")
                  )
          }
          confirmLabel={
            busy ? t(language, "loading") : t(language, "permanentlyDelete")
          }
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => {
            if (!busy) setConfirmation(null);
          }}
          onConfirm={() => void confirm()}
        />
      )}
    </>
  );
}

export function SeasonManagementDialog({
  language,
  lobby,
  onClose,
  onDelete,
  onDeleteHistory
}: {
  language: Language;
  lobby: LobbyProjection;
  onClose: () => void;
  onDelete: (seasonId: string) => Promise<boolean>;
  onDeleteHistory: () => Promise<boolean>;
}) {
  const historical = [...lobby.historicalSeasons].sort(
    (left, right) =>
      (right.season.endedAt ?? right.season.startedAt) -
      (left.season.endedAt ?? left.season.startedAt)
  );
  const [confirmation, setConfirmation] = useState<
    { kind: "one"; seasonId: string; name: string } | { kind: "history" } | null
  >(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!confirmation || busy) return;
    setBusy(true);
    try {
      const completed =
        confirmation.kind === "one"
          ? await onDelete(confirmation.seasonId)
          : await onDeleteHistory();
      if (completed) setConfirmation(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ManagementDialog
        language={language}
        title={t(language, "seasonManagement")}
        onClose={onClose}
      >
        <p className="warning">{t(language, "seasonDeletionImpact")}</p>
        <div className="management-list">
          <div className="management-row protected-row">
            <span>
              <strong>{lobby.currentSeason.name}</strong>
              <small>{t(language, "protectedCurrentSeason")}</small>
            </span>
            <button className="secondary compact-button" disabled>
              {t(language, "protected")}
            </button>
          </div>
          {historical.map(({ season }) => (
            <div className="management-row" key={season.id}>
              <span>
                <strong>{season.name}</strong>
                <small>{t(language, "historicalSeason")}</small>
              </span>
              <button
                className="danger compact-button"
                onClick={() =>
                  setConfirmation({
                    kind: "one",
                    seasonId: season.id,
                    name: season.name
                  })
                }
              >
                {t(language, "deleteSeason")}
              </button>
            </div>
          ))}
        </div>
        {historical.length === 0 && (
          <p className="empty-state">{t(language, "noHistoricalSeasons")}</p>
        )}
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>
            {t(language, "close")}
          </button>
          <button
            className="danger"
            disabled={historical.length === 0}
            onClick={() => setConfirmation({ kind: "history" })}
          >
            {t(language, "deleteAllHistoricalSeasons")}
          </button>
        </div>
      </ManagementDialog>
      {confirmation && (
        <ConfirmDialog
          title={
            confirmation.kind === "one"
              ? t(language, "confirmDeleteSeason")
              : t(language, "confirmDeleteAllHistoricalSeasons")
          }
          description={
            confirmation.kind === "one"
              ? t(language, "confirmDeleteSeasonDescription").replace(
                  "{name}",
                  confirmation.name
                )
              : t(language, "confirmDeleteAllHistoricalSeasonsDescription").replace(
                  "{count}",
                  String(historical.length)
                )
          }
          confirmLabel={
            busy ? t(language, "loading") : t(language, "permanentlyDelete")
          }
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => {
            if (!busy) setConfirmation(null);
          }}
          onConfirm={() => void confirm()}
        />
      )}
    </>
  );
}

function ManagementDialog({
  language,
  title,
  onClose,
  children
}: {
  language: Language;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal management-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-title">
          <div>
            <p className="eyebrow">HOME TABLE</p>
            <h2>{title}</h2>
          </div>
          <button
            ref={closeRef}
            className="icon-button"
            aria-label={t(language, "close")}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function rankBadge(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
}
