import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import type {
  AdminProjection,
  AvalonPlayerCount,
  AvalonRole,
  CommandResult,
  GlobalSettings,
  Language,
  PlatformDataDeletionResult,
  ThemeMode
} from "@party/contracts";
import { normalizeAvalonRoles } from "@party/avalon";
import { t } from "./locales";
import { AvalonRoleEditor, avalonText } from "./avalon-ui";
import {
  ArrowIcon,
  CollapsibleCard,
  ConfirmDialog,
  FixedPanel,
  SelectField,
  ThemeToggle,
  applyProductTheme
} from "./ui";

type AdminPath = "/admin" | "/admin/accounts" | "/admin/seasons";

const adminLanguageKey = "party-admin-language";
const adminThemeKey = "party-admin-theme";

export function isAdminPath(pathname: string): pathname is AdminPath {
  return ["/admin", "/admin/accounts", "/admin/seasons"].includes(pathname);
}

export function AdminApp() {
  const [path, setPath] = useState<AdminPath>(
    isAdminPath(location.pathname) ? location.pathname : "/admin"
  );
  const [projection, setProjection] = useState<AdminProjection | null>(null);
  const [language, setLanguage] = useState<Language>(
    () => readAdminLanguage() ?? "zh-CN"
  );
  const [theme, setTheme] = useState<ThemeMode>(
    () => readAdminTheme() ?? "dark"
  );
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/state");
    if (!response.ok) throw new Error("STATE_FAILED");
    const next = (await response.json()) as AdminProjection;
    setProjection(next);
    if (!readAdminLanguage()) setLanguage(next.settings.defaultLanguage);
    if (!readAdminTheme()) setTheme(next.settings.defaultTheme);
    return next;
  }, []);

  useEffect(() => {
    void refresh().catch((reason) =>
      setNotice(
        adminErrorMessage(readAdminLanguage() ?? "zh-CN", reason)
      )
    );
  }, [refresh]);

  useEffect(() => {
    const onPopState = () => {
      setPath(isAdminPath(location.pathname) ? location.pathname : "/admin");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useLayoutEffect(() => {
    applyProductTheme("main", theme);
    document.documentElement.lang = language;
  }, [language, theme]);

  const navigate = (next: AdminPath) => {
    if (next !== path) history.pushState({}, "", next);
    setPath(next);
  };

  const selectLanguage = (next: Language) => {
    localStorage.setItem(adminLanguageKey, next);
    setLanguage(next);
  };
  const selectTheme = (next: ThemeMode) => {
    localStorage.setItem(adminThemeKey, next);
    setTheme(next);
  };

  const command = useCallback(
    async <T,>(type: string, payload: Record<string, unknown>) => {
      if (!projection) throw new Error("STATE_FAILED");
      const response = await fetch("/api/admin/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commandId: createAdminCommandId(),
          aggregateId: "platform",
          expectedVersion: projection.version,
          type,
          payload
        })
      });
      const result = (await response.json()) as CommandResult<T>;
      if (!response.ok || result.status === "rejected") {
        await refresh();
        throw new Error(result.code || "COMMAND_FAILED");
      }
      await refresh();
      return result;
    },
    [projection, refresh]
  );

  const localControls = (
    <AdminLocalControls
      language={language}
      theme={theme}
      onLanguage={selectLanguage}
      onTheme={selectTheme}
    />
  );

  if (!projection) {
    return (
      <main className="loading-shell">
        <div className="brand-mark" aria-hidden="true">♠</div>
        <p>{notice || t(language, "loading")}</p>
      </main>
    );
  }

  if (path === "/admin/accounts") {
    return (
      <AdminAccounts
        language={language}
        projection={projection}
        controls={localControls}
        notice={notice}
        onNotice={setNotice}
        onBack={() => navigate("/admin")}
        command={command}
      />
    );
  }
  if (path === "/admin/seasons") {
    return (
      <AdminSeasons
        language={language}
        projection={projection}
        controls={localControls}
        notice={notice}
        onNotice={setNotice}
        onBack={() => navigate("/admin")}
        command={command}
      />
    );
  }
  return (
    <AdminHome
      language={language}
      projection={projection}
      controls={localControls}
      notice={notice}
      onNotice={setNotice}
      onAccounts={() => navigate("/admin/accounts")}
      onSeasons={() => navigate("/admin/seasons")}
      command={command}
    />
  );
}

function AdminHome({
  language,
  projection,
  controls,
  notice,
  onNotice,
  onAccounts,
  onSeasons,
  command
}: {
  language: Language;
  projection: AdminProjection;
  controls: React.ReactNode;
  notice: string;
  onNotice: (notice: string) => void;
  onAccounts: () => void;
  onSeasons: () => void;
  command: AdminCommand;
}) {
  const [settings, setSettings] = useState<GlobalSettings>(
    () => structuredClone(projection.settings)
  );
  const [pokerExpanded, setPokerExpanded] = useState(false);
  const [avalonExpanded, setAvalonExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSettings(structuredClone(projection.settings));
  }, [projection.settings, projection.version]);

  const denominationError = validateDenominations(settings.poker.denominations)
    ? ""
    : t(language, "invalidDenominations");
  const hostTimeoutValid =
    Number.isInteger(settings.defaultHostTransferTimeoutSeconds) &&
    settings.defaultHostTransferTimeoutSeconds > 0;
  const avalonStakeValid =
    Number.isSafeInteger(settings.avalon.defaultStake) &&
    settings.avalon.defaultStake >= 2;
  const avalonPresetErrors = avalonPlayerCounts.map((playerCount) => ({
    playerCount,
    error: validateAvalonPreset(
      language,
      playerCount,
      settings.avalon.rolePresets[playerCount]
    )
  }));
  const avalonSettingsValid =
    avalonStakeValid &&
    avalonPresetErrors.every((entry) => entry.error === "");

  const save = async () => {
    if (!hostTimeoutValid || denominationError || !avalonSettingsValid) return;
    setBusy(true);
    try {
      await command("admin.settings.update", { settings });
      onNotice(t(language, "settingsSaved"));
    } catch (reason) {
      onNotice(adminErrorMessage(language, reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FixedPanel
      as="main"
      className="admin-shell"
      header={
        <AdminHeader
          language={language}
          title={t(language, "adminTitle")}
          controls={controls}
          action={
            <button
              className="primary admin-save"
              disabled={
                busy ||
                !hostTimeoutValid ||
                Boolean(denominationError) ||
                !avalonSettingsValid
              }
              onClick={() => void save()}
            >
              {busy ? t(language, "loading") : t(language, "save")}
            </button>
          }
        />
      }
      footer={
        notice ? <p className="notice" role="status">{notice}</p> : <span />
      }
    >
      <p className="warning admin-trust-warning">
        {t(language, "adminAnonymousWarning")}
      </p>
      <div className="admin-columns">
        <section className="admin-card" aria-labelledby="general-settings-title">
          <p className="eyebrow">PLATFORM</p>
          <h2 id="general-settings-title">{t(language, "generalSettings")}</h2>
          <AdminNumberField
            label={t(language, "hostTimeoutSeconds")}
            value={settings.defaultHostTransferTimeoutSeconds}
            onChange={(value) =>
              setSettings((current) => ({
                ...current,
                defaultHostTransferTimeoutSeconds: value
              }))
            }
          />
          {!hostTimeoutValid && (
            <p className="error" role="alert">
              {t(language, "positiveIntegerRequired")}
            </p>
          )}
          <div className="setting-row">
            <span>{t(language, "defaultLanguage")}</span>
            <LanguageButtons
              language={settings.defaultLanguage}
              onChange={(defaultLanguage) =>
                setSettings((current) => ({ ...current, defaultLanguage }))
              }
            />
          </div>
          <div className="setting-row">
            <span>{t(language, "defaultTheme")}</span>
            <ThemeToggle
              mode={settings.defaultTheme}
              onChange={(defaultTheme) =>
                setSettings((current) => ({ ...current, defaultTheme }))
              }
              lightLabel={t(language, "lightTheme")}
              darkLabel={t(language, "darkTheme")}
              groupLabel={t(language, "themeSelection")}
            />
          </div>
          <div className="admin-navigation">
            <button className="secondary" onClick={onAccounts}>
              {t(language, "accountManagement")}
              <ArrowIcon direction="right" />
            </button>
            <button className="secondary" onClick={onSeasons}>
              {t(language, "seasonManagement")}
              <ArrowIcon direction="right" />
            </button>
          </div>
        </section>
        <section className="admin-games" aria-labelledby="game-settings-title">
          <p className="eyebrow">GAMES</p>
          <h2 id="game-settings-title">{t(language, "gameSettings")}</h2>
          <CollapsibleCard
            title={t(language, "poker")}
            summary={t(language, "pokerSettingsSummary")}
            expanded={pokerExpanded}
            onToggle={() => setPokerExpanded((current) => !current)}
          >
            <SelectField
              label={t(language, "suitColors")}
              value={settings.poker.suitColorPreset}
              options={[
                { value: "standard", label: t(language, "standardSuitColors") },
                {
                  value: "high-contrast",
                  label: t(language, "highContrastSuitColors")
                }
              ]}
              onChange={(value) =>
                setSettings((current) => ({
                  ...current,
                  poker: {
                    ...current.poker,
                    suitColorPreset:
                      value as GlobalSettings["poker"]["suitColorPreset"]
                  }
                }))
              }
            />
            <div className="setting-grid">
              {(
                [
                  ["smallBlind", "smallBlind"],
                  ["bigBlind", "bigBlind"],
                  ["minBuyIn", "minBuyIn"],
                  ["maxBuyIn", "maxBuyIn"]
                ] as const
              ).map(([field, key]) => (
                <AdminNumberField
                  key={field}
                  label={t(language, key)}
                  value={settings.poker[field]}
                  onChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      poker: { ...current.poker, [field]: value }
                    }))
                  }
                />
              ))}
            </div>
            <fieldset className="denomination-editor">
              <legend>{t(language, "chipDenominations")}</legend>
              <div className="denomination-list">
                {settings.poker.denominations.map((denomination, index) => (
                  <div className="denomination-row" key={index}>
                    <AdminNumberField
                      label={`${t(language, "chipDenomination")} ${index + 1}`}
                      value={denomination}
                      onChange={(value) =>
                        setSettings((current) => {
                          const denominations = [
                            ...current.poker.denominations
                          ];
                          denominations[index] = value;
                          return {
                            ...current,
                            poker: { ...current.poker, denominations }
                          };
                        })
                      }
                    />
                    <button
                      type="button"
                      className="icon-button danger-text"
                      aria-label={`${t(language, "removeDenomination")} ${denomination}`}
                      disabled={settings.poker.denominations.length === 1}
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          poker: {
                            ...current.poker,
                            denominations: current.poker.denominations.filter(
                              (_, item) => item !== index
                            )
                          }
                        }))
                      }
                    >
                      −
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="secondary compact-button"
                disabled={settings.poker.denominations.length >= 16}
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    poker: {
                      ...current.poker,
                      denominations: [
                        ...current.poker.denominations,
                        Math.max(...current.poker.denominations, 0) + 1
                      ]
                    }
                  }))
                }
              >
                ＋ {t(language, "addDenomination")}
              </button>
              {denominationError && (
                <p className="error" role="alert">{denominationError}</p>
              )}
            </fieldset>
          </CollapsibleCard>
          <CollapsibleCard
            title="Avalon"
            summary={
              language === "zh-CN"
                ? "默认流程、押分与 5–10 人角色预设"
                : "Default flow, stake, and 5–10 player role presets"
            }
            expanded={avalonExpanded}
            onToggle={() => setAvalonExpanded((current) => !current)}
          >
            <div className="avalon-setting-grid">
              <SelectField
                label={avalonText(language, "recognition")}
                value={settings.avalon.defaultRecognitionMode}
                options={[
                  {
                    value: "automatic",
                    label: avalonText(language, "automatic")
                  },
                  {
                    value: "manual",
                    label: avalonText(language, "manual")
                  }
                ]}
                onChange={(defaultRecognitionMode) =>
                  setSettings((current) => ({
                    ...current,
                    avalon: {
                      ...current.avalon,
                      defaultRecognitionMode:
                        defaultRecognitionMode as GlobalSettings["avalon"]["defaultRecognitionMode"]
                    }
                  }))
                }
              />
              <SelectField
                label={avalonText(language, "oberon")}
                value={settings.avalon.defaultOberonRule}
                options={[
                  {
                    value: "original",
                    label: avalonText(language, "original")
                  },
                  {
                    value: "dized",
                    label: avalonText(language, "dized")
                  }
                ]}
                onChange={(defaultOberonRule) =>
                  setSettings((current) => ({
                    ...current,
                    avalon: {
                      ...current.avalon,
                      defaultOberonRule:
                        defaultOberonRule as GlobalSettings["avalon"]["defaultOberonRule"]
                    }
                  }))
                }
              />
              <AdminNumberField
                label={avalonText(language, "stake")}
                value={settings.avalon.defaultStake}
                onChange={(defaultStake) =>
                  setSettings((current) => ({
                    ...current,
                    avalon: { ...current.avalon, defaultStake }
                  }))
                }
              />
            </div>
            {!avalonStakeValid && (
              <p className="error" role="alert">
                {language === "zh-CN"
                  ? "押分必须是不小于 2 的安全整数"
                  : "Stake must be a safe whole number of at least 2"}
              </p>
            )}
            <div className="avalon-admin-presets">
              {avalonPresetErrors.map(({ playerCount, error }) => (
                <section
                  className="avalon-admin-preset"
                  key={playerCount}
                  aria-labelledby={`avalon-preset-${playerCount}`}
                >
                  <div className="avalon-section-heading">
                    <h3 id={`avalon-preset-${playerCount}`}>
                      {playerCount}{" "}
                      {language === "zh-CN" ? "人预设" : "player preset"}
                    </h3>
                    <span>
                      {settings.avalon.rolePresets[playerCount].length}/
                      {playerCount}
                    </span>
                  </div>
                  <AvalonRoleEditor
                    language={language}
                    roles={settings.avalon.rolePresets[playerCount]}
                    onChange={(roles) =>
                      setSettings((current) => ({
                        ...current,
                        avalon: {
                          ...current.avalon,
                          rolePresets: {
                            ...current.avalon.rolePresets,
                            [playerCount]: roles
                          }
                        }
                      }))
                    }
                  />
                  {error && (
                    <p className="error" role="alert">{error}</p>
                  )}
                </section>
              ))}
            </div>
          </CollapsibleCard>
        </section>
      </div>
    </FixedPanel>
  );
}

function AdminAccounts({
  language,
  projection,
  controls,
  notice,
  onNotice,
  onBack,
  command
}: AdminSubpageProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const ids = projection.accounts.map((account) => account.id);
  useSelectionCleanup(ids, setSelected);

  const remove = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await command<PlatformDataDeletionResult>("admin.accounts.delete", {
        accountIds: [...selected]
      });
      setSelected(new Set());
      setConfirming(false);
      onNotice(t(language, "selectedAccountsDeleted"));
    } catch (reason) {
      onNotice(adminErrorMessage(language, reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminSelectionShell
        language={language}
        title={t(language, "accountManagement")}
        controls={controls}
        notice={notice}
        onBack={onBack}
        ids={ids}
        selected={selected}
        setSelected={setSelected}
        actionLabel={t(language, "deleteSelectedUsers")}
        actionDisabled={selected.size === 0}
        onAction={() => setConfirming(true)}
      >
        <p className="warning">{t(language, "accountDeletionImpactBatch")}</p>
        <div className="admin-selection-list">
          {projection.accounts.map((account) => (
            <label className="admin-selection-row" key={account.id}>
              <input
                type="checkbox"
                checked={selected.has(account.id)}
                onChange={() => toggleSelection(account.id, setSelected)}
              />
              <span className="management-identity">
                <b aria-hidden="true">{account.avatar}</b>
                <strong>{account.username}</strong>
              </span>
            </label>
          ))}
          {projection.accounts.length === 0 && (
            <p className="empty-state">{t(language, "noAccounts")}</p>
          )}
        </div>
      </AdminSelectionShell>
      {confirming && (
        <ConfirmDialog
          title={t(language, "confirmDeleteSelectedAccounts")}
          description={t(language, "confirmDeleteSelectedAccountsDescription")
            .replace("{count}", String(selected.size))}
          confirmLabel={busy ? t(language, "loading") : t(language, "permanentlyDelete")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => {
            if (!busy) setConfirming(false);
          }}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}

function AdminSeasons({
  language,
  projection,
  controls,
  notice,
  onNotice,
  onBack,
  command
}: AdminSubpageProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStart, setConfirmStart] = useState(false);
  const [name, setName] = useState("");
  const [baseScore, setBaseScore] = useState(10_000);
  const [busy, setBusy] = useState(false);
  const ids = projection.historicalSeasons.map((season) => season.id);
  useSelectionCleanup(ids, setSelected);

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await command<PlatformDataDeletionResult>("admin.seasons.delete", {
        seasonIds: [...selected]
      });
      setSelected(new Set());
      setConfirmDelete(false);
      onNotice(t(language, "selectedSeasonsDeleted"));
    } catch (reason) {
      onNotice(adminErrorMessage(language, reason));
    } finally {
      setBusy(false);
    }
  };

  const startSeason = async () => {
    if (!Number.isSafeInteger(baseScore)) return;
    setBusy(true);
    try {
      await command("admin.season.start", { name, baseScore });
      setName("");
      setConfirmStart(false);
      onNotice(t(language, "seasonStarted"));
    } catch (reason) {
      onNotice(adminErrorMessage(language, reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminSelectionShell
        language={language}
        title={t(language, "seasonManagement")}
        controls={controls}
        notice={notice}
        onBack={onBack}
        ids={ids}
        selected={selected}
        setSelected={setSelected}
        actionLabel={t(language, "deleteSelectedSeasons")}
        actionDisabled={selected.size === 0}
        onAction={() => setConfirmDelete(true)}
      >
        <p className="warning">{t(language, "seasonDeletionImpact")}</p>
        <div className="admin-selection-list">
          <label className="admin-selection-row protected-row">
            <input type="checkbox" disabled />
            <span>
              <strong>{projection.currentSeason.name}</strong>
              <small>{t(language, "protectedCurrentSeason")}</small>
            </span>
          </label>
          {projection.historicalSeasons.map((season) => (
            <label className="admin-selection-row" key={season.id}>
              <input
                type="checkbox"
                checked={selected.has(season.id)}
                onChange={() => toggleSelection(season.id, setSelected)}
              />
              <span>
                <strong>{season.name}</strong>
                <small>{t(language, "historicalSeason")}</small>
              </span>
            </label>
          ))}
        </div>
        <section className="admin-card season-create-card">
          <h2>{t(language, "newSeason")}</h2>
          <label>
            {t(language, "seasonName")}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <AdminNumberField
            label={t(language, "baseScore")}
            value={baseScore}
            onChange={setBaseScore}
          />
          <p>{t(language, "seasonImpact")}</p>
          <button
            className="primary"
            disabled={!Number.isSafeInteger(baseScore)}
            onClick={() => setConfirmStart(true)}
          >
            {t(language, "newSeason")}
          </button>
        </section>
      </AdminSelectionShell>
      {confirmDelete && (
        <ConfirmDialog
          title={t(language, "confirmDeleteSelectedSeasons")}
          description={t(language, "confirmDeleteSelectedSeasonsDescription")
            .replace("{count}", String(selected.size))}
          confirmLabel={busy ? t(language, "loading") : t(language, "permanentlyDelete")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => {
            if (!busy) setConfirmDelete(false);
          }}
          onConfirm={() => void deleteSelected()}
        />
      )}
      {confirmStart && (
        <ConfirmDialog
          title={t(language, "newSeason")}
          description={t(language, "seasonImpact")}
          confirmLabel={busy ? t(language, "loading") : t(language, "confirm")}
          cancelLabel={t(language, "cancel")}
          onCancel={() => {
            if (!busy) setConfirmStart(false);
          }}
          onConfirm={() => void startSeason()}
        />
      )}
    </>
  );
}

function AdminSelectionShell({
  language,
  title,
  controls,
  notice,
  onBack,
  ids,
  selected,
  setSelected,
  actionLabel,
  actionDisabled,
  onAction,
  children
}: {
  language: Language;
  title: string;
  controls: React.ReactNode;
  notice: string;
  onBack: () => void;
  ids: string[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  actionLabel: string;
  actionDisabled: boolean;
  onAction: () => void;
  children: React.ReactNode;
}) {
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;
  return (
    <FixedPanel
      as="main"
      className="admin-shell admin-subpage"
      header={
        <AdminHeader
          language={language}
          title={title}
          controls={controls}
          back={onBack}
        />
      }
      footer={
        <div className="admin-selection-footer">
          <span>
            {t(language, "selectedCount").replace(
              "{count}",
              String(selected.size)
            )}
          </span>
          <button
            className="danger"
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        </div>
      }
    >
      {notice && <p className="notice" role="status">{notice}</p>}
      <div className="admin-select-all">
        <IndeterminateCheckbox
          checked={allSelected}
          indeterminate={someSelected}
          label={allSelected ? t(language, "clearSelection") : t(language, "selectAll")}
          onChange={() =>
            setSelected(allSelected ? new Set() : new Set(ids))
          }
        />
      </div>
      {children}
    </FixedPanel>
  );
}

function AdminHeader({
  language,
  title,
  controls,
  action,
  back
}: {
  language: Language;
  title: string;
  controls: React.ReactNode;
  action?: React.ReactNode;
  back?: () => void;
}) {
  return (
    <header className="admin-header">
      <div className="admin-heading">
        {back && (
          <button
            className="icon-button"
            aria-label={t(language, "backAdmin")}
            onClick={back}
          >
            <ArrowIcon direction="left" />
          </button>
        )}
        <div>
          <p className="eyebrow">HOME TABLE · LAN</p>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="admin-header-actions">
        {controls}
        {action}
      </div>
    </header>
  );
}

function AdminLocalControls({
  language,
  theme,
  onLanguage,
  onTheme
}: {
  language: Language;
  theme: ThemeMode;
  onLanguage: (language: Language) => void;
  onTheme: (theme: ThemeMode) => void;
}) {
  return (
    <div className="admin-local-controls">
      <LanguageButtons language={language} onChange={onLanguage} />
      <ThemeToggle
        mode={theme}
        onChange={onTheme}
        lightLabel={t(language, "lightTheme")}
        darkLabel={t(language, "darkTheme")}
        groupLabel={t(language, "adminThemeSelection")}
      />
    </div>
  );
}

function LanguageButtons({
  language,
  onChange
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="language-toggle" aria-label={t(language, "languageSelection")}>
      <button
        type="button"
        className={language === "zh-CN" ? "active" : ""}
        aria-pressed={language === "zh-CN"}
        onClick={() => onChange("zh-CN")}
      >
        中
      </button>
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        aria-pressed={language === "en"}
        onClick={() => onChange("en")}
      >
        EN
      </button>
    </div>
  );
}

function AdminNumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? Number.NaN : Number(event.target.value)
          )
        }
      />
    </label>
  );
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  label,
  onChange
}: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />
      {label}
    </label>
  );
}

function useSelectionCleanup(
  ids: string[],
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  const key = ids.join("\u0000");
  useEffect(() => {
    const valid = new Set(key ? key.split("\u0000") : []);
    setSelected(
      (current) => new Set([...current].filter((id) => valid.has(id)))
    );
  }, [key, setSelected]);
}

function toggleSelection(
  id: string,
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
) {
  setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function validateDenominations(values: readonly number[]) {
  return (
    values.length >= 1 &&
    values.length <= 16 &&
    values.every((value) => Number.isSafeInteger(value) && value > 0) &&
    new Set(values).size === values.length &&
    values.includes(1)
  );
}

const avalonPlayerCounts: readonly AvalonPlayerCount[] = [
  5,
  6,
  7,
  8,
  9,
  10
];

function validateAvalonPreset(
  language: Language,
  playerCount: AvalonPlayerCount,
  roles: readonly AvalonRole[]
): string {
  try {
    normalizeAvalonRoles(playerCount, roles);
    return "";
  } catch {
    return language === "zh-CN"
      ? `角色配置必须符合 ${playerCount} 人善恶人数，并且包含唯一的梅林与刺客`
      : `Roles must fit the ${playerCount}-player alignments and include exactly one Merlin and Assassin`;
  }
}

function readAdminLanguage(): Language | undefined {
  const value = localStorage.getItem(adminLanguageKey);
  return value === "zh-CN" || value === "en" ? value : undefined;
}

function readAdminTheme(): ThemeMode | undefined {
  const value = localStorage.getItem(adminThemeKey);
  return value === "light" || value === "dark" ? value : undefined;
}

function createAdminCommandId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function adminErrorMessage(language: Language, reason: unknown) {
  const code = reason instanceof Error ? reason.message : "COMMAND_FAILED";
  const known: Record<string, [string, string]> = {
    STALE_VERSION: ["数据已更新，请检查最新内容后重试", "Data changed; review the latest state and retry"],
    INVALID_ROOM_CONFIG: ["扑克设置无效，请检查盲注和买入范围", "Poker settings are invalid"],
    INVALID_DENOMINATIONS: ["筹码面值无效", "Chip denominations are invalid"],
    INVALID_AVALON_SETTINGS: ["阿瓦隆默认设置无效", "Avalon defaults are invalid"],
    INVALID_AVALON_ROLE_CONFIG: ["阿瓦隆角色预设无效", "An Avalon role preset is invalid"],
    INVALID_LANGUAGE: ["默认语言无效", "The default language is invalid"],
    INVALID_THEME: ["默认主题无效", "The default theme is invalid"],
    CURRENT_SEASON_PROTECTED: ["当前赛季受保护", "The current season is protected"],
    ROOMS_MUST_CLOSE: ["请先关闭所有房间", "Close every room first"],
    ACCOUNT_NOT_FOUND: ["所选账户已不存在", "A selected account no longer exists"],
    SEASON_NOT_FOUND: ["所选赛季已不存在", "A selected season no longer exists"]
  };
  return known[code]?.[language === "zh-CN" ? 0 : 1] ??
    (language === "zh-CN" ? "操作失败，请重试" : "The operation failed; try again");
}

type AdminCommand = <T = unknown>(
  type: string,
  payload: Record<string, unknown>
) => Promise<CommandResult<T>>;

interface AdminSubpageProps {
  language: Language;
  projection: AdminProjection;
  controls: React.ReactNode;
  notice: string;
  onNotice: (notice: string) => void;
  onBack: () => void;
  command: AdminCommand;
}
