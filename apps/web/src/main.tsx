import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Language, RoomMode } from "@party/contracts";
import { t } from "./locales";
import "./styles.css";

const avatars = ["🦊", "🐼", "🐯", "🐸", "🐙", "🦁", "🐧", "🦄"];
const denominations = [1, 5, 25, 100, 500, 1_000, 5_000, 10_000];

function App() {
  const query = new URLSearchParams(location.search);
  const isDisplay = query.get("display") === "1";
  const displayMode: RoomMode =
    query.get("mode") === "chips-only" ? "chips-only" : "chips-and-cards";
  const [language, setLanguage] = useStored<Language>("party-language", "zh-CN");
  const [account, setAccount] = useState<{ username: string; avatar: string } | null>(null);
  const [view, setView] = useState<"lobby" | "table">("lobby");

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  if (isDisplay) {
    return <PublicDisplay language={language} setLanguage={setLanguage} mode={displayMode} />;
  }
  if (!account) {
    return <Login language={language} setLanguage={setLanguage} onEnter={setAccount} />;
  }
  if (view === "table") {
    return (
      <PlayerTable
        language={language}
        setLanguage={setLanguage}
        account={account}
        onLeave={() => setView("lobby")}
      />
    );
  }
  return (
    <Lobby
      language={language}
      setLanguage={setLanguage}
      account={account}
      onSwitch={() => setAccount(null)}
      onJoin={() => setView("table")}
    />
  );
}

function Login({
  language,
  setLanguage,
  onEnter
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  onEnter: (account: { username: string; avatar: string }) => void;
}) {
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(avatars[0]!);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) {
      setError(t(language, "enterName"));
      return;
    }
    try {
      const response = await fetch("/api/enter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, avatar })
      });
      if (!response.ok) throw new Error("enter_failed");
      const body = (await response.json()) as {
        data?: { account?: { username: string; avatar: string } };
      };
      onEnter(body.data?.account ?? { username: username.trim(), avatar });
      localStorage.setItem("party-recent-account", username.trim());
    } catch {
      setError(language === "zh-CN" ? "无法连接家庭服务器" : "Cannot reach the home server");
    }
  }
  return (
    <main className="login-shell">
      <section className="login-hero">
        <div className="brand-mark" aria-hidden="true">♠</div>
        <p className="eyebrow">HOME PARTY PLATFORM</p>
        <h1>{t(language, "brand")}</h1>
        <p className="tagline">{t(language, "tagline")}</p>
        <div className="trust-pill">● LAN · {t(language, "passwordFree")}</div>
      </section>
      <form className="login-card" onSubmit={submit}>
        <LanguageToggle language={language} setLanguage={setLanguage} />
        <label>
          <span>{t(language, "enterName")}</span>
          <input
            aria-label={t(language, "enterName")}
            value={username}
            maxLength={32}
            autoComplete="username"
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>{t(language, "chooseAvatar")}</legend>
          <div className="avatar-grid">
            {avatars.map((item) => (
              <button
                type="button"
                key={item}
                aria-label={`avatar-${item}`}
                aria-pressed={avatar === item}
                className={avatar === item ? "avatar selected" : "avatar"}
                onClick={() => setAvatar(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary wide" type="submit">{t(language, "enter")}</button>
        <p className="fine-print">{t(language, "noPassword")}</p>
      </form>
    </main>
  );
}

function Lobby({
  language,
  setLanguage,
  account,
  onSwitch,
  onJoin
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  account: { username: string; avatar: string };
  onSwitch: () => void;
  onJoin: () => void;
}) {
  const [settings, setSettings] = useState(false);
  const [season, setSeason] = useState(false);
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">HOME TABLE</p>
          <h1>{t(language, "lobby")}</h1>
        </div>
        <div className="top-actions">
          <LanguageToggle language={language} setLanguage={setLanguage} />
          <button className="account-chip" onClick={onSwitch}>
            <span>{account.avatar}</span>
            {account.username}
            <small>{t(language, "switchAccount")}</small>
          </button>
          <button className="icon-button" aria-label={t(language, "settings")} onClick={() => setSettings(true)}>
            ⚙
          </button>
        </div>
      </header>
      <div className="lobby-grid">
        <section className="room-column">
          <div className="section-title">
            <div>
              <p className="eyebrow">{t(language, "waitingRooms")}</p>
              <h2>{t(language, "createRoom")}</h2>
            </div>
            <span className="live-badge">1 LIVE</span>
          </div>
          <article className="room-card">
            <div className="room-identity">
              <span className="suit-badge">♦</span>
              <div>
                <h3>{t(language, "roomName")}</h3>
                <p>{t(language, "chipsCards")} · 50 / 100</p>
              </div>
            </div>
            <div className="seats">
              <span>🦊</span><span>🐼</span><span className="empty-seat">+8</span>
            </div>
            <div className="room-actions">
              <button className="primary" onClick={onJoin}>{t(language, "join")}</button>
              <a className="secondary" href="/?display=1&mode=chips-and-cards" target="_blank">
                {t(language, "openDisplay")}
              </a>
            </div>
          </article>
          <div className="empty-card">
            <span>♣</span>
            <p>{language === "zh-CN" ? "准备好后，创建另一张牌桌" : "Create another table when the group is ready"}</p>
          </div>
        </section>
        <Leaderboard language={language} />
      </div>
      {settings && (
        <SettingsModal
          language={language}
          setLanguage={setLanguage}
          onClose={() => setSettings(false)}
          onSeason={() => setSeason(true)}
        />
      )}
      {season && <SeasonModal language={language} onClose={() => setSeason(false)} />}
    </main>
  );
}

function Leaderboard({ language }: { language: Language }) {
  const entries = [
    ["🥇", "Mia", "12,480", false],
    ["🥈", "Leo", "10,000", true],
    ["🥉", "小明", "9,520", false]
  ] as const;
  return (
    <aside className="leaderboard">
      <p className="eyebrow">{t(language, "currentSeason")}</p>
      <h2>{t(language, "leaderboard")}</h2>
      <div className="season-tabs">
        <button className="active">{t(language, "currentSeason")}</button>
        <button>2025 Winter</button>
      </div>
      <ol>
        {entries.map(([rank, name, score, playing]) => (
          <li key={name}>
            <span className="rank">{rank}</span>
            <span className="leader-name">{name}{playing && <small>{t(language, "playing")}</small>}</span>
            <strong>{score}</strong>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function SettingsModal({
  language,
  setLanguage,
  onClose,
  onSeason
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  onClose: () => void;
  onSeason: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={t(language, "settings")} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <div><p className="eyebrow">PLATFORM</p><h2>{t(language, "settings")}</h2></div>
          <button className="icon-button" aria-label={t(language, "close")} onClick={onClose}>×</button>
        </div>
        <div className="setting-row">
          <span>{t(language, "defaultLanguage")}</span>
          <LanguageToggle language={language} setLanguage={setLanguage} />
        </div>
        <label className="setting-row">
          <span>{t(language, "hostTimeout")}</span>
          <select defaultValue="60"><option value="30">30s</option><option value="60">60s</option><option value="120">120s</option></select>
        </label>
        <details open>
          <summary>♠ {t(language, "poker")}</summary>
          <div className="setting-grid">
            <label>{t(language, "smallBlind")}<input value="50" readOnly /></label>
            <label>{t(language, "bigBlind")}<input value="100" readOnly /></label>
            <label>{t(language, "minBuyIn")}<input value="2000" readOnly /></label>
            <label>{t(language, "maxBuyIn")}<input value="20000" readOnly /></label>
          </div>
        </details>
        <button className="danger-link" onClick={onSeason}>{t(language, "newSeason")}</button>
      </section>
    </div>
  );
}

function SeasonModal({ language, onClose }: { language: Language; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="modal-backdrop">
      <section className="modal narrow" role="dialog" aria-modal="true" aria-label={t(language, "newSeason")}>
        <p className="eyebrow">SEASON RESET</p>
        <h2>{t(language, "newSeason")}</h2>
        <p className="warning">{t(language, "seasonImpact")}</p>
        <label>{t(language, "seasonName")}<input placeholder={t(language, "currentSeason")} /></label>
        <label>{t(language, "baseScore")}<input inputMode="numeric" defaultValue="10000" /></label>
        <label className="confirm-check">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          {t(language, "confirm")}
        </label>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>{t(language, "close")}</button>
          <button className="primary" disabled={!confirmed} onClick={onClose}>{t(language, "confirm")}</button>
        </div>
      </section>
    </div>
  );
}

function PlayerTable({
  language,
  setLanguage,
  account,
  onLeave
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  account: { username: string; avatar: string };
  onLeave: () => void;
}) {
  const [cache, setCache] = useState<number[]>([]);
  const [muted, setMuted] = useStored("party-muted", false);
  const [notice, setNotice] = useState("");
  const total = cache.reduce((sum, value) => sum + value, 0);
  const callAmount = 100;
  const balance = 8_000;
  const confirmLabel =
    total === callAmount
      ? t(language, "confirmCall")
      : total > callAmount
        ? t(language, "confirmRaise")
        : t(language, "confirmBet");
  const addChip = (value: number) => {
    if (total + value <= balance) setCache((current) => [...current, value]);
  };
  const clearFromAuthority = () => {
    setCache([]);
    setNotice(t(language, "cacheCleared"));
  };
  return (
    <main className="table-shell">
      <header className="table-topbar">
        <button className="secondary" onClick={onLeave}>← {t(language, "lobby")}</button>
        <div><strong>{t(language, "roomName")}</strong><span>{t(language, "chipsCards")} · 50 / 100</span></div>
        <LanguageToggle language={language} setLanguage={setLanguage} />
        <button className="secondary" onClick={() => setMuted(!muted)}>{muted ? t(language, "unmute") : t(language, "mute")}</button>
      </header>
      <section className="poker-felt" aria-label={t(language, "poker")}>
        <div className="player-seat north"><span>🐼</span><b>Leo</b><small>7,900</small></div>
        <div className="player-seat west"><span>🐯</span><b>Mia</b><small>12,480</small></div>
        <div className="player-seat south active"><span>{account.avatar}</span><b>{account.username}</b><small>8,000</small></div>
        <div className="board">
          <p>{t(language, "phase")}</p>
          <div className="cards"><span>🂠</span><span>🂠</span><span>🂠</span><span>🂠</span><span>🂠</span></div>
          <div className="pot"><small>{t(language, "pot")}</small><strong>300</strong></div>
          <div className="timer"><span style={{ width: "68%" }} /><b>3.0s</b></div>
        </div>
      </section>
      <section className="action-dock">
        <div className="turn-line">
          <div><span className="pulse" />{t(language, "yourTurn")}</div>
          <button className="text-button" onClick={clearFromAuthority}>{t(language, "undo")}</button>
        </div>
        {notice && <p className="notice" role="status">{notice}</p>}
        <div
          className="bet-cache"
          aria-label={t(language, "betCache")}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => addChip(Number(event.dataTransfer.getData("chip")))}
        >
          <span>{t(language, "betCache")}</span>
          <div className="cache-chips">
            {cache.map((chip, index) => (
              <button
                key={`${chip}-${index}`}
                className={`poker-chip chip-${chip}`}
                aria-label={`remove-${chip}`}
                onClick={() => setCache((current) => current.filter((_, item) => item !== index))}
              >
                {chip.toLocaleString()}
              </button>
            ))}
          </div>
          <strong>{total.toLocaleString()}</strong>
          <button className="text-button" onClick={() => setCache([])}>{t(language, "clear")}</button>
        </div>
        <div className="chip-rack" aria-label="chip denominations">
          {denominations.map((value) => (
            <button
              key={value}
              draggable
              className={`poker-chip chip-${value}`}
              disabled={total + value > balance}
              onDragStart={(event) => event.dataTransfer.setData("chip", String(value))}
              onClick={() => addChip(value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") addChip(value);
              }}
            >
              {value.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="action-grid">
          <button className="danger">{t(language, "fold")}</button>
          <button className="secondary" onClick={() => setCache([callAmount])}>{t(language, "call")}</button>
          <button className="secondary" onClick={() => setCache([balance])}>{t(language, "allIn")}</button>
          <button className="primary" disabled={total < callAmount}>{total < callAmount ? t(language, "invalidBet") : confirmLabel}</button>
        </div>
      </section>
    </main>
  );
}

function PublicDisplay({
  language,
  setLanguage,
  mode
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  mode: RoomMode;
}) {
  return (
    <main className="display-shell">
      <header className="display-header">
        <div><p className="eyebrow">{t(language, "display")}</p><h1>{t(language, "roomName")}</h1><span>{t(language, "displayReadonly")}</span></div>
        <LanguageToggle language={language} setLanguage={setLanguage} />
      </header>
      <section className="display-felt">
        <div className="display-seat seat-a">🦊<b>Mia</b><strong>12,480</strong></div>
        <div className="display-seat seat-b">🐼<b>Leo</b><strong>7,900</strong></div>
        <div className="display-seat seat-c">🐯<b>小明</b><strong>8,000</strong></div>
        <div className="display-board">
          {mode === "chips-and-cards" && (
            <div className="cards" data-testid="community-cards"><span>🂠</span><span>🂠</span><span>🂠</span><span>🂠</span><span>🂠</span></div>
          )}
          <p>{t(language, "phase")}</p>
          <div className="pot"><small>{t(language, "pot")}</small><strong>300</strong></div>
        </div>
      </section>
    </main>
  );
}

function LanguageToggle({
  language,
  setLanguage
}: {
  language: Language;
  setLanguage: (language: Language) => void;
}) {
  return (
    <div className="language-toggle" aria-label="language">
      <button className={language === "zh-CN" ? "active" : ""} onClick={() => setLanguage("zh-CN")} type="button">中</button>
      <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} type="button">EN</button>
    </div>
  );
}

function useStored<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored === null ? initial : (JSON.parse(stored) as T);
  });
  return [
    value,
    (next: T) => {
      localStorage.setItem(key, JSON.stringify(next));
      setValue(next);
    }
  ];
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
