import {
  StrictMode,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import { createRoot } from "react-dom/client";
import type {
  Account,
  Card,
  CommandResult,
  GlobalSettings,
  Language,
  LobbyProjection,
  LobbyRoomProjection,
  RoomConfig,
  RoomMode,
  RoomProjection
} from "@party/contracts";
import { t } from "./locales";
import "./styles.css";

const avatars = ["🦊", "🐼", "🐯", "🐸", "🐙", "🦁", "🐧", "🦄"];
const denominations = [1, 5, 25, 100, 500, 1_000, 5_000, 10_000];

interface Session {
  account: Account;
  connectionId: string;
}

interface EnterData {
  account: Account;
  connectionId: string;
  lobby: LobbyProjection;
  room?: RoomProjection;
}

function App() {
  const query = new URLSearchParams(location.search);
  const displayRoomId = query.get("display") === "1" ? query.get("roomId") : null;
  const [language, setLanguage] = useStored<Language>("party-language", "zh-CN");
  const [session, setSession] = useState<Session | null>(null);
  const [lobby, setLobby] = useState<LobbyProjection | null>(null);
  const [room, setRoom] = useState<RoomProjection | null>(null);
  const [restoring, setRestoring] = useState(!displayRoomId && Boolean(readRecentAccount()));
  const [notice, setNotice] = useState("");
  const restoreStarted = useRef(false);
  const activeRoomId = room?.id;

  useEffect(() => {
    if (localStorage.getItem("party-language")) return;
    void fetch("/api/state")
      .then((response) => response.json() as Promise<LobbyProjection>)
      .then((state) => setLanguage(state.settings.defaultLanguage))
      .catch(() => {
        // The login remains usable with the bundled fallback language.
      });
  }, [setLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const enter = useCallback(async (username: string, avatar: string) => {
    const response = await fetch("/api/enter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, avatar })
    });
    const result = (await response.json()) as CommandResult<EnterData>;
    if (!response.ok || !result.data) throw new Error(result.code || "ENTER_FAILED");
    const nextSession = {
      account: result.data.account,
      connectionId: result.data.connectionId
    };
    setSession(nextSession);
    setLobby({ ...result.data.lobby, version: result.version });
    setRoom(
      result.data.room
        ? { ...result.data.room, platformVersion: result.version }
        : null
    );
    writeRecentAccount(result.data.account);
    setNotice("");
  }, []);

  useEffect(() => {
    if (displayRoomId || restoreStarted.current) return;
    const recent = readRecentAccount();
    if (!recent) {
      setRestoring(false);
      return;
    }
    restoreStarted.current = true;
    void enter(recent.username, recent.avatar)
      .catch(() => {
        localStorage.removeItem("party-recent-account");
      })
      .finally(() => setRestoring(false));
  }, [displayRoomId, enter]);

  const refreshLobby = useCallback(async () => {
    if (!session) return;
    const response = await fetch(
      `/api/state?accountId=${encodeURIComponent(session.account.id)}&connectionId=${encodeURIComponent(session.connectionId)}`
    );
    if (!response.ok) throw new Error("STATE_FAILED");
    setLobby((await response.json()) as LobbyProjection);
  }, [session]);

  const refreshRoom = useCallback(async () => {
    if (!session || !activeRoomId) return;
    const response = await fetch(
      `/api/room/${encodeURIComponent(activeRoomId)}?accountId=${encodeURIComponent(session.account.id)}&connectionId=${encodeURIComponent(session.connectionId)}`
    );
    if (response.status === 404) {
      setRoom(null);
      await refreshLobby();
      return;
    }
    if (!response.ok) throw new Error("ROOM_FAILED");
    setRoom((await response.json()) as RoomProjection);
  }, [activeRoomId, refreshLobby, session]);

  useEffect(() => {
    if (!session) return;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const connect = () => {
      const url = new URL("/ws", location.href);
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(url);
      socket.addEventListener("open", () => {
        socket?.send(
          JSON.stringify(
            activeRoomId
              ? {
                  type: "subscription.room",
                  payload: {
                    roomId: activeRoomId,
                    accountId: session.account.id,
                    connectionId: session.connectionId
                  }
                }
              : {
                  type: "subscription.lobby",
                  payload: {
                    accountId: session.account.id,
                    connectionId: session.connectionId
                  }
                }
          )
        );
      });
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as {
          type: string;
          data?: LobbyProjection | RoomProjection | { roomId: string };
        };
        if (message.type === "lobby") setLobby(message.data as LobbyProjection);
        if (message.type === "projection") setRoom(message.data as RoomProjection);
        if (message.type === "room.closed" || message.type === "room.left") {
          setRoom(null);
          setNotice(
            t(language, message.type === "room.closed" ? "roomClosed" : "removedFromRoom")
          );
          void refreshLobby();
        }
        if (message.type === "session.replaced") {
          localStorage.removeItem("party-recent-account");
          setRoom(null);
          setLobby(null);
          setSession(null);
          setNotice(t(language, "connectionTaken"));
        }
      });
      socket.addEventListener("close", () => {
        if (!stopped) retry = setTimeout(connect, 1_000);
      });
    };
    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [activeRoomId, language, refreshLobby, session]);

  const command = useCallback(
    async <T,>(
      type: string,
      payload: Record<string, unknown>,
      aggregateId = room?.id ?? "platform"
    ): Promise<CommandResult<T>> => {
      if (!session) throw new Error("STALE_CONNECTION");
      const expectedVersion = room?.platformVersion ?? lobby?.version ?? 0;
      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commandId: createCommandId(),
          connectionId: session.connectionId,
          aggregateId,
          expectedVersion,
          type,
          payload: { ...payload, accountId: session.account.id }
        })
      });
      const result = (await response.json()) as CommandResult<T>;
      if (!response.ok || result.status === "rejected") {
        if (result.code === "STALE_CONNECTION") {
          localStorage.removeItem("party-recent-account");
          setRoom(null);
          setLobby(null);
          setSession(null);
          throw new Error("STALE_CONNECTION");
        }
        if (room) await refreshRoom();
        else await refreshLobby();
        throw new Error(result.code || "COMMAND_FAILED");
      }
      if (isRoomProjection(result.data)) {
        setRoom({ ...result.data, platformVersion: result.version });
      } else if (
        (result.data as { closed?: boolean; left?: boolean } | undefined)?.closed ||
        (result.data as { closed?: boolean; left?: boolean } | undefined)?.left
      ) {
        setRoom(null);
        await refreshLobby();
      } else {
        await refreshLobby();
      }
      return result;
    },
    [lobby?.version, refreshLobby, refreshRoom, room, session]
  );

  if (displayRoomId) {
    return (
      <PublicDisplay
        language={language}
        setLanguage={setLanguage}
        roomId={displayRoomId}
      />
    );
  }

  if (restoring) return <Loading language={language} />;

  if (!session) {
    return (
      <Login
        language={language}
        setLanguage={setLanguage}
        onEnter={enter}
        notice={notice}
      />
    );
  }

  if (room) {
    return (
      <RoomView
        language={language}
        setLanguage={setLanguage}
        session={session}
        room={room}
        notice={notice}
        setNotice={setNotice}
        command={command}
        onLobby={() => {
          setRoom(null);
          void refreshLobby();
        }}
      />
    );
  }

  if (!lobby) return <Loading language={language} />;

  return (
    <Lobby
      language={language}
      setLanguage={setLanguage}
      session={session}
      setSession={setSession}
      lobby={lobby}
      notice={notice}
      setNotice={setNotice}
      command={command}
      onRoom={setRoom}
      onSwitch={() => {
        localStorage.removeItem("party-recent-account");
        setSession(null);
        setLobby(null);
        setRoom(null);
      }}
    />
  );
}

function Loading({ language }: { language: Language }) {
  return (
    <main className="loading-shell">
      <div className="brand-mark" aria-hidden="true">♠</div>
      <p>{t(language, "loading")}</p>
    </main>
  );
}

function Login({
  language,
  setLanguage,
  onEnter,
  notice
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  onEnter: (username: string, avatar: string) => Promise<void>;
  notice: string;
}) {
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(avatars[0]!);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) {
      setError(t(language, "enterName"));
      return;
    }
    setBusy(true);
    try {
      await onEnter(username, avatar);
    } catch (reason) {
      setError(errorMessage(language, reason));
    } finally {
      setBusy(false);
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
        {(error || notice) && <p className="error" role="alert">{error || notice}</p>}
        <button className="primary wide" type="submit" disabled={busy}>
          {busy ? t(language, "loading") : t(language, "enter")}
        </button>
        <p className="fine-print">{t(language, "noPassword")}</p>
      </form>
    </main>
  );
}

function Lobby({
  language,
  setLanguage,
  session,
  setSession,
  lobby,
  notice,
  setNotice,
  command,
  onRoom,
  onSwitch
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  session: Session;
  setSession: (session: Session) => void;
  lobby: LobbyProjection;
  notice: string;
  setNotice: (notice: string) => void;
  command: CommandFunction;
  onRoom: (room: RoomProjection) => void;
  onSwitch: () => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [joinRoom, setJoinRoom] = useState<LobbyRoomProjection | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  async function returnToRoom(roomId: string) {
    const response = await fetch(
      `/api/room/${encodeURIComponent(roomId)}?accountId=${encodeURIComponent(session.account.id)}&connectionId=${encodeURIComponent(session.connectionId)}`
    );
    if (!response.ok) {
      setNotice(t(language, "roomClosed"));
      return;
    }
    onRoom((await response.json()) as RoomProjection);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">HOME TABLE</p>
          <h1>{t(language, "lobby")}</h1>
        </div>
        <div className="top-actions">
          <LanguageToggle language={language} setLanguage={setLanguage} />
          <button className="account-chip" onClick={() => setProfileOpen(true)}>
            <span>{session.account.avatar}</span>
            {session.account.username}
            <small>{t(language, "profile")}</small>
          </button>
          <button
            className="icon-button"
            aria-label={t(language, "settings")}
            onClick={() => setSettingsOpen(true)}
          >
            ⚙
          </button>
        </div>
      </header>
      {notice && <p className="notice" role="status">{notice}</p>}
      <div className="lobby-grid">
        <section className="room-column">
          <div className="section-title">
            <div>
              <p className="eyebrow">{t(language, "waitingRooms")}</p>
              <h2>{t(language, "createRoom")}</h2>
            </div>
            <button className="primary" onClick={() => setCreateOpen(true)}>
              ＋ {t(language, "create")}
            </button>
          </div>
          <div className="room-list">
            {lobby.rooms.map((entry) => {
              const ownRoom = lobby.accountRoomId === entry.id;
              return (
                <article className="room-card" key={entry.id}>
                  <div className="room-identity">
                    <span className="suit-badge">{entry.mode === "chips-only" ? "♣" : "♦"}</span>
                    <div>
                      <h3>{entry.name}</h3>
                      <p>
                        {entry.mode === "chips-only"
                          ? t(language, "chipsOnly")
                          : t(language, "chipsCards")} · {entry.smallBlind} / {entry.bigBlind}
                      </p>
                    </div>
                  </div>
                  <div className="room-meta">
                    <span className={`status-pill status-${entry.status}`}>
                      {roomStatus(language, entry.status)}
                    </span>
                    <span>{entry.seatCount}/10 {t(language, "seats")}</span>
                  </div>
                  <div className="seats">
                    {entry.seats.map((seat) => (
                      <span key={seat.accountId} title={seat.username}>{seat.avatar}</span>
                    ))}
                    <span className="empty-seat">+{10 - entry.seatCount}</span>
                  </div>
                  <div className="room-actions">
                    {ownRoom ? (
                      <button className="primary" onClick={() => void returnToRoom(entry.id)}>
                        {t(language, "returnRoom")}
                      </button>
                    ) : (
                      <button
                        className="primary"
                        disabled={entry.status !== "waiting"}
                        onClick={() => setJoinRoom(entry)}
                      >
                        {t(language, "join")}
                      </button>
                    )}
                    <a
                      className="secondary"
                      href={`/?display=1&roomId=${encodeURIComponent(entry.id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t(language, "openDisplay")}
                    </a>
                  </div>
                </article>
              );
            })}
            {lobby.rooms.length === 0 && (
              <div className="empty-card"><span>♣</span><p>{t(language, "noRooms")}</p></div>
            )}
          </div>
        </section>
        <Leaderboard language={language} lobby={lobby} />
      </div>
      {createOpen && (
        <CreateRoomModal
          language={language}
          settings={lobby.settings}
          onClose={() => setCreateOpen(false)}
          onCreate={async (name, config, buyIn) => {
            try {
              const result = await command<RoomProjection>(
                "room.create",
                { name, config, buyIn },
                "platform"
              );
              if (result.data) onRoom({ ...result.data, platformVersion: result.version });
              setCreateOpen(false);
            } catch (reason) {
              setNotice(errorMessage(language, reason));
            }
          }}
        />
      )}
      {joinRoom && (
        <JoinRoomModal
          language={language}
          room={joinRoom}
          onClose={() => setJoinRoom(null)}
          onJoin={async (buyIn) => {
            try {
              const result = await command<RoomProjection>(
                "room.join",
                { roomId: joinRoom.id, buyIn },
                joinRoom.id
              );
              if (result.data) onRoom({ ...result.data, platformVersion: result.version });
              setJoinRoom(null);
            } catch (reason) {
              setNotice(errorMessage(language, reason));
            }
          }}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          language={language}
          setLanguage={setLanguage}
          settings={lobby.settings}
          onClose={() => setSettingsOpen(false)}
          onSave={async (settings) => {
            try {
              await command("settings.update", { settings }, "platform");
              setNotice(t(language, "settingsSaved"));
              setSettingsOpen(false);
            } catch (reason) {
              setNotice(errorMessage(language, reason));
            }
          }}
          onSeason={() => setSeasonOpen(true)}
        />
      )}
      {seasonOpen && (
        <SeasonModal
          language={language}
          onClose={() => setSeasonOpen(false)}
          onConfirm={async (name, baseScore) => {
            try {
              await command("season.start", { name, baseScore }, "platform");
              setNotice(t(language, "seasonStarted"));
              setSeasonOpen(false);
              setSettingsOpen(false);
            } catch (reason) {
              setNotice(errorMessage(language, reason));
            }
          }}
        />
      )}
      {profileOpen && (
        <ProfileModal
          language={language}
          account={session.account}
          onClose={() => setProfileOpen(false)}
          onSwitch={onSwitch}
          onSave={async (username, avatar) => {
            try {
              const result = await command<Account>(
                "account.profile",
                { username, avatar },
                "platform"
              );
              if (result.data) {
                const next = { ...session, account: result.data };
                setSession(next);
                writeRecentAccount(result.data);
              }
              setProfileOpen(false);
            } catch (reason) {
              setNotice(errorMessage(language, reason));
            }
          }}
        />
      )}
    </main>
  );
}

function Leaderboard({
  language,
  lobby
}: {
  language: Language;
  lobby: LobbyProjection;
}) {
  const [selectedSeasonId, setSelectedSeasonId] = useState(lobby.currentSeason.id);
  useEffect(() => setSelectedSeasonId(lobby.currentSeason.id), [lobby.currentSeason.id]);
  const historical = lobby.historicalSeasons.find(
    (item) => item.season.id === selectedSeasonId
  );
  const entries = historical?.entries ?? lobby.leaderboard;
  const seasonName = historical?.season.name ?? lobby.currentSeason.name;
  return (
    <aside className="leaderboard">
      <p className="eyebrow">{seasonName}</p>
      <h2>{t(language, "leaderboard")}</h2>
      <div className="season-tabs">
        <button
          className={selectedSeasonId === lobby.currentSeason.id ? "active" : ""}
          onClick={() => setSelectedSeasonId(lobby.currentSeason.id)}
        >
          {lobby.currentSeason.name}
        </button>
        {lobby.historicalSeasons.map((item) => (
          <button
            key={item.season.id}
            className={selectedSeasonId === item.season.id ? "active" : ""}
            onClick={() => setSelectedSeasonId(item.season.id)}
          >
            {item.season.name}
          </button>
        ))}
      </div>
      <ol>
        {entries.map((entry) => (
          <li key={entry.accountId}>
            <span className="rank">{rankBadge(entry.rank)}</span>
            <span className="leader-name">
              {entry.avatar} {entry.username}
              {!historical && lobby.rooms.some((room) =>
                room.seats.some((seat) => seat.accountId === entry.accountId)
              ) && <small>{t(language, "playing")}</small>}
            </span>
            <strong>{entry.score.toLocaleString()}</strong>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function CreateRoomModal({
  language,
  settings,
  onClose,
  onCreate
}: {
  language: Language;
  settings: GlobalSettings;
  onClose: () => void;
  onCreate: (name: string, config: RoomConfig, buyIn: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<RoomMode>("chips-and-cards");
  const [smallBlind, setSmallBlind] = useState(settings.poker.smallBlind);
  const [bigBlind, setBigBlind] = useState(settings.poker.bigBlind);
  const [minBuyIn, setMinBuyIn] = useState(settings.poker.minBuyIn);
  const [maxBuyIn, setMaxBuyIn] = useState(settings.poker.maxBuyIn);
  const [hostTransferTimeoutSeconds, setHostTransferTimeoutSeconds] = useState(
    settings.defaultHostTransferTimeoutSeconds
  );
  const [buyIn, setBuyIn] = useState(settings.poker.minBuyIn);
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onCreate(
        name,
        {
          mode,
          smallBlind,
          bigBlind,
          minBuyIn,
          maxBuyIn,
          hostTransferTimeoutSeconds
        },
        buyIn
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal language={language} title={t(language, "createRoom")} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        <label>{t(language, "roomNameLabel")}
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>{t(language, "mode")}
          <select value={mode} onChange={(event) => setMode(event.target.value as RoomMode)}>
            <option value="chips-and-cards">{t(language, "chipsCards")}</option>
            <option value="chips-only">{t(language, "chipsOnly")}</option>
          </select>
        </label>
        <div className="setting-grid">
          <NumberField label={t(language, "smallBlind")} value={smallBlind} onChange={setSmallBlind} />
          <NumberField label={t(language, "bigBlind")} value={bigBlind} onChange={setBigBlind} />
          <NumberField label={t(language, "minBuyIn")} value={minBuyIn} onChange={setMinBuyIn} />
          <NumberField label={t(language, "maxBuyIn")} value={maxBuyIn} onChange={setMaxBuyIn} />
          <NumberField
            label={t(language, "hostTimeout")}
            value={hostTransferTimeoutSeconds}
            onChange={setHostTransferTimeoutSeconds}
          />
        </div>
        <NumberField label={t(language, "buyIn")} value={buyIn} onChange={setBuyIn} />
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>{t(language, "cancel")}</button>
          <button className="primary" disabled={busy}>{t(language, "create")}</button>
        </div>
      </form>
    </Modal>
  );
}

function JoinRoomModal({
  language,
  room,
  onClose,
  onJoin
}: {
  language: Language;
  room: LobbyRoomProjection;
  onClose: () => void;
  onJoin: (buyIn: number) => Promise<void>;
}) {
  const [buyIn, setBuyIn] = useState(room.minBuyIn);
  const [busy, setBusy] = useState(false);
  return (
    <Modal language={language} title={t(language, "joinBuyIn")} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          try {
            await onJoin(buyIn);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>{room.name} · {room.minBuyIn.toLocaleString()}–{room.maxBuyIn.toLocaleString()}</p>
        <NumberField label={t(language, "buyIn")} value={buyIn} onChange={setBuyIn} />
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>{t(language, "cancel")}</button>
          <button className="primary" disabled={busy}>{t(language, "join")}</button>
        </div>
      </form>
    </Modal>
  );
}

function SettingsModal({
  language,
  setLanguage,
  settings,
  onClose,
  onSave,
  onSeason
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  settings: GlobalSettings;
  onClose: () => void;
  onSave: (settings: GlobalSettings) => Promise<void>;
  onSeason: () => void;
}) {
  const [value, setValue] = useState(structuredClone(settings));
  return (
    <Modal language={language} title={t(language, "settings")} onClose={onClose}>
      <div className="setting-row">
        <span>{t(language, "defaultLanguage")}</span>
        <LanguageToggle
          language={value.defaultLanguage}
          setLanguage={(next) => {
            setValue((current) => ({ ...current, defaultLanguage: next }));
            setLanguage(next);
          }}
        />
      </div>
      <label className="setting-row">
        <span>{t(language, "hostTimeout")}</span>
        <select
          value={value.defaultHostTransferTimeoutSeconds}
          onChange={(event) => setValue((current) => ({
            ...current,
            defaultHostTransferTimeoutSeconds: Number(event.target.value)
          }))}
        >
          <option value="30">30s</option><option value="60">60s</option><option value="120">120s</option>
        </select>
      </label>
      <details open>
        <summary>♠ {t(language, "poker")}</summary>
        <div className="setting-grid">
          <NumberField label={t(language, "smallBlind")} value={value.poker.smallBlind} onChange={(next) => setValue((current) => ({ ...current, poker: { ...current.poker, smallBlind: next } }))} />
          <NumberField label={t(language, "bigBlind")} value={value.poker.bigBlind} onChange={(next) => setValue((current) => ({ ...current, poker: { ...current.poker, bigBlind: next } }))} />
          <NumberField label={t(language, "minBuyIn")} value={value.poker.minBuyIn} onChange={(next) => setValue((current) => ({ ...current, poker: { ...current.poker, minBuyIn: next } }))} />
          <NumberField label={t(language, "maxBuyIn")} value={value.poker.maxBuyIn} onChange={(next) => setValue((current) => ({ ...current, poker: { ...current.poker, maxBuyIn: next } }))} />
        </div>
      </details>
      <div className="modal-actions">
        <button className="danger-link" onClick={onSeason}>{t(language, "newSeason")}</button>
        <button className="primary" onClick={() => void onSave(value)}>{t(language, "save")}</button>
      </div>
    </Modal>
  );
}

function SeasonModal({
  language,
  onClose,
  onConfirm
}: {
  language: Language;
  onClose: () => void;
  onConfirm: (name: string, baseScore: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [baseScore, setBaseScore] = useState(10_000);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Modal language={language} title={t(language, "newSeason")} onClose={onClose} narrow>
      <p className="warning">{t(language, "seasonImpact")}</p>
      <div className="form-stack">
        <label>{t(language, "seasonName")}<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <NumberField label={t(language, "baseScore")} value={baseScore} onChange={setBaseScore} />
        <label className="confirm-check">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          {t(language, "confirm")}
        </label>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>{t(language, "cancel")}</button>
          <button className="primary" disabled={!confirmed} onClick={() => void onConfirm(name, baseScore)}>
            {t(language, "confirm")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProfileModal({
  language,
  account,
  onClose,
  onSwitch,
  onSave
}: {
  language: Language;
  account: Account;
  onClose: () => void;
  onSwitch: () => void;
  onSave: (username: string, avatar: string) => Promise<void>;
}) {
  const [username, setUsername] = useState(account.username);
  const [avatar, setAvatar] = useState(account.avatar);
  return (
    <Modal language={language} title={t(language, "profile")} onClose={onClose}>
      <div className="form-stack">
        <label>{t(language, "username")}<input value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <div className="avatar-grid">
          {avatars.map((item) => (
            <button
              key={item}
              className={avatar === item ? "avatar selected" : "avatar"}
              aria-label={`avatar-${item}`}
              aria-pressed={avatar === item}
              onClick={() => setAvatar(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={onSwitch}>{t(language, "switchAccount")}</button>
          <button className="primary" onClick={() => void onSave(username, avatar)}>
            {t(language, "updateProfile")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RoomView({
  language,
  setLanguage,
  session,
  room,
  notice,
  setNotice,
  command,
  onLobby
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  session: Session;
  room: RoomProjection;
  notice: string;
  setNotice: (notice: string) => void;
  command: CommandFunction;
  onLobby: () => void;
}) {
  const host = room.hostAccountId === session.account.id;
  const run = async (type: string, payload: Record<string, unknown> = {}) => {
    try {
      setNotice("");
      await command(type, { roomId: room.id, ...payload }, room.id);
      return true;
    } catch (reason) {
      setNotice(errorMessage(language, reason));
      return false;
    }
  };
  if (room.status === "waiting") {
    return (
      <WaitingRoom
        language={language}
        setLanguage={setLanguage}
        session={session}
        room={room}
        notice={notice}
        host={host}
        run={run}
        onLobby={onLobby}
      />
    );
  }
  return (
    <PlayerTable
      language={language}
      setLanguage={setLanguage}
      session={session}
      room={room}
      notice={notice}
      setNotice={setNotice}
      host={host}
      run={run}
      onLobby={onLobby}
    />
  );
}

function WaitingRoom({
  language,
  setLanguage,
  session,
  room,
  notice,
  host,
  run,
  onLobby
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  session: Session;
  room: RoomProjection;
  notice: string;
  host: boolean;
  run: (type: string, payload?: Record<string, unknown>) => Promise<boolean>;
  onLobby: () => void;
}) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="secondary" onClick={onLobby}>← {t(language, "backLobby")}</button>
        <div className="room-heading">
          <p className="eyebrow">{t(language, "waiting")}</p>
          <h1>{room.name}</h1>
        </div>
        <LanguageToggle language={language} setLanguage={setLanguage} />
      </header>
      {notice && <p className="notice" role="status">{notice}</p>}
      <section className="waiting-panel">
        <div className="room-summary">
          <strong>{room.mode === "chips-only" ? t(language, "chipsOnly") : t(language, "chipsCards")}</strong>
          <span>{room.config.smallBlind} / {room.config.bigBlind}</span>
          <a className="secondary" href={`/?display=1&roomId=${encodeURIComponent(room.id)}`} target="_blank" rel="noreferrer">
            {t(language, "openDisplay")}
          </a>
        </div>
        <div className="waiting-seats">
          {room.seats.map((seat) => (
            <article key={seat.accountId}>
              <span>{seat.avatar}</span>
              <div><strong>{seat.username}</strong><small>{seat.tableChips.toLocaleString()} {t(language, "score")}</small></div>
              {seat.accountId === room.hostAccountId && <em>{t(language, "host")}</em>}
              <small className={seat.connected ? "online" : "offline"}>
                {seat.connected ? t(language, "online") : t(language, "offline")}
              </small>
              {host && seat.accountId !== session.account.id && (
                <div className="inline-actions">
                  <button className="text-button" onClick={() => void run("room.transfer-host", { targetAccountId: seat.accountId })}>
                    {t(language, "transferHost")}
                  </button>
                  <button className="text-button danger-text" onClick={() => void run("room.remove", { targetAccountId: seat.accountId })}>
                    {t(language, "removePlayer")}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        <div className="room-footer-actions">
          {host && (
            <button className="primary" disabled={room.seats.length < 2} onClick={() => void run("room.start")}>
              {t(language, "startGame")}
            </button>
          )}
          {host ? (
            <button className="danger" onClick={() => void run("room.close")}>{t(language, "endGame")}</button>
          ) : (
            <button className="secondary" onClick={() => void run("room.leave")}>{t(language, "leaveRoom")}</button>
          )}
        </div>
      </section>
    </main>
  );
}

function PlayerTable({
  language,
  setLanguage,
  session,
  room,
  notice,
  setNotice,
  host,
  run,
  onLobby
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  session: Session;
  room: RoomProjection;
  notice: string;
  setNotice: (notice: string) => void;
  host: boolean;
  run: (type: string, payload?: Record<string, unknown>) => Promise<boolean>;
  onLobby: () => void;
}) {
  const [cache, setCache] = useState<number[]>([]);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [muted, setMuted] = useStored("party-muted", false);
  const betCacheRef = useRef<HTMLDivElement>(null);
  const chipRackRef = useRef<HTMLDivElement>(null);
  const pointerGesture = useRef<{
    source: "rack" | "cache";
    value: number;
    index?: number;
    x: number;
    y: number;
  } | null>(null);
  const suppressClick = useRef<{
    source: "rack" | "cache";
    expiresAt: number;
  } | null>(null);
  const seat = room.seats.find((candidate) => candidate.accountId === session.account.id);
  const authorityKey = JSON.stringify([
    room.status,
    room.actingAccountId,
    room.currentBet,
    room.minimumRaise,
    seat?.tableChips
  ]);
  const previousAuthority = useRef(authorityKey);
  const total = cache.reduce((sum, value) => sum + value, 0);
  const canAct = room.status === "in_progress" && room.actingAccountId === session.account.id;
  const raiseLocked = room.raiseLockedAccountIds?.includes(session.account.id) ?? false;
  const callAmount = Math.max(
    0,
    Math.min((room.currentBet ?? 0) - (seat?.currentBet ?? 0), seat?.tableChips ?? 0)
  );
  const target = (seat?.currentBet ?? 0) + total;
  const allInTarget = (seat?.currentBet ?? 0) + (seat?.tableChips ?? 0);
  const isAllIn = target === allInTarget && total > 0;
  const isCall = target === (room.currentBet ?? 0) && total === callAmount;
  const isRaise = target > (room.currentBet ?? 0);
  const legalAmount =
    canAct &&
    total > 0 &&
    total <= (seat?.tableChips ?? 0) &&
    (
      isCall ||
      (isAllIn && (!raiseLocked || target <= (room.currentBet ?? 0))) ||
      (
        isRaise &&
        !raiseLocked &&
        target >= (room.currentBet ?? 0) + (room.minimumRaise ?? 0)
      )
    );
  const confirmLabel = isCall
    ? t(language, "confirmCall")
    : (room.currentBet ?? 0) === 0
      ? t(language, "confirmBet")
      : t(language, "confirmRaise");
  const now = useNow(Boolean(room.advanceDeadline));
  const countdown = room.advanceDeadline
    ? Math.max(0, (room.advanceDeadline - now) / 1_000)
    : 0;

  useEffect(() => {
    if (
      cache.length > 0 &&
      authorityKey !== previousAuthority.current
    ) {
      setCache([]);
      setNotice(t(language, "cacheCleared"));
    }
    previousAuthority.current = authorityKey;
  }, [authorityKey, cache.length, language, setNotice]);

  useEffect(() => {
    if (muted || !room.phase) return;
    playTone();
  }, [muted, room.phase]);

  const submitAction = async (kind: string, amount?: number) => {
    await run("poker.action", {
      pokerVersion: room.pokerVersion,
      action: amount === undefined ? { kind } : { kind, amount }
    });
    setCache([]);
  };

  const confirm = async () => {
    if (!legalAmount) return;
    if (isAllIn) await submitAction("all-in");
    else if (isCall) await submitAction("call");
    else if ((room.currentBet ?? 0) === 0) await submitAction("bet", target);
    else await submitAction("raise", target);
  };

  const completePointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = pointerGesture.current;
    pointerGesture.current = null;
    if (!gesture || event.pointerType === "mouse") return;
    const moved = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 12;
    if (!moved) return;
    suppressClick.current = {
      source: gesture.source,
      expiresAt: performance.now() + 500
    };
    event.preventDefault();
    if (!canAct) return;
    const targetRect =
      gesture.source === "rack"
        ? betCacheRef.current?.getBoundingClientRect()
        : chipRackRef.current?.getBoundingClientRect();
    if (
      !targetRect ||
      event.clientX < targetRect.left ||
      event.clientX > targetRect.right ||
      event.clientY < targetRect.top ||
      event.clientY > targetRect.bottom
    ) {
      return;
    }
    if (
      gesture.source === "rack" &&
      total + gesture.value <= (seat?.tableChips ?? 0)
    ) {
      setCache((current) => [...current, gesture.value]);
    } else if (gesture.source === "cache" && gesture.index !== undefined) {
      setCache((current) => current.filter((_, index) => index !== gesture.index));
    }
  };

  return (
    <main className="table-shell">
      <header className="table-topbar">
        <button className="secondary" onClick={onLobby}>← {t(language, "backLobby")}</button>
        <div>
          <strong>{room.name}</strong>
          <span>{room.mode === "chips-only" ? t(language, "chipsOnly") : t(language, "chipsCards")} · {room.config.smallBlind} / {room.config.bigBlind}</span>
        </div>
        <LanguageToggle language={language} setLanguage={setLanguage} />
        <button className="secondary" onClick={() => setMuted(!muted)}>
          {muted ? t(language, "unmute") : t(language, "mute")}
        </button>
      </header>
      <section className="poker-felt" aria-label={t(language, "poker")}>
        <div className="table-seats">
          {room.seats.map((entry) => (
            <article
              key={entry.accountId}
              className={`player-seat ${entry.accountId === room.actingAccountId ? "active" : ""}`}
            >
              <span>{entry.avatar}</span>
              <b>{entry.username}{entry.accountId === room.hostAccountId ? " ★" : ""}</b>
              <small>{entry.tableChips.toLocaleString()} · {entry.currentBet.toLocaleString()}</small>
              <small className={entry.connected ? "online" : "offline"}>
                {entry.connected ? t(language, "online") : t(language, "offline")}
              </small>
              {entry.position === room.dealerPosition && (
                <em className="dealer-marker" aria-label={t(language, "dealer")}>D</em>
              )}
              {entry.folded && <em>{t(language, "fold")}</em>}
              {host && entry.accountId !== session.account.id && (
                <div className="inline-actions seat-actions">
                  {entry.connected && (
                    <button
                      className="text-button"
                      onClick={() => void run("room.transfer-host", {
                        targetAccountId: entry.accountId
                      })}
                    >
                      {t(language, "transferHost")}
                    </button>
                  )}
                  {(!entry.connected || room.phase === "complete") && (
                    <button
                      className="text-button danger-text"
                      onClick={() => void run("room.remove", {
                        targetAccountId: entry.accountId
                      })}
                    >
                      {t(language, "removePlayer")}
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
        {room.lastAction && room.lastAction.amount > 0 && (
          <div
            key={room.lastAction.version}
            className="chip-flight"
            style={{
              "--seat-angle": `${
                (room.seats.find(
                  (entry) => entry.accountId === room.lastAction?.accountId
                )?.position ?? 0) * 36
              }deg`
            } as React.CSSProperties}
            aria-label={t(language, "betUpdated")}
          >
            +{room.lastAction.amount.toLocaleString()}
          </div>
        )}
        <div className="board">
          <p>{phaseLabel(language, room.phase)} · {formatTemplate(t(language, "hand"), room.handNumber ?? 1)}</p>
          {room.mode === "chips-and-cards" && (
            <div className="cards" aria-label={t(language, "communityCards")}>
              {(room.communityCards ?? []).map((card, index) => (
                <span key={index}>{cardLabel(card)}</span>
              ))}
            </div>
          )}
          {room.ownHoleCards && room.ownHoleCards.length > 0 && (
            <div className="own-cards" aria-label={t(language, "myCards")}>
              {room.ownHoleCards.map((card, index) => <span key={index}>{cardLabel(card)}</span>)}
            </div>
          )}
          <div className="pot"><small>{t(language, "pot")}</small><strong>{room.potTotal.toLocaleString()}</strong></div>
          {room.advanceDeadline && (
            <div className="timer" aria-label={t(language, "countdown")}>
              <span style={{ width: `${Math.min(100, countdown / 3 * 100)}%` }} />
              <b>{countdown.toFixed(1)}s</b>
            </div>
          )}
        </div>
      </section>
      <section className="action-dock">
        <div className="turn-line">
          <div><span className="pulse" />{canAct ? t(language, "yourTurn") : t(language, "notYourTurn")}</div>
          <div className="inline-actions">
            {room.lastAction?.accountId === session.account.id && room.lastAction.reversible && (
              <button className="text-button" onClick={() => void run("poker.undo", { pokerVersion: room.pokerVersion })}>
                {t(language, "undo")}
              </button>
            )}
            {host && room.status === "in_progress" && (
              <button className="text-button" onClick={() => void run("room.pause")}>{t(language, "pauseGame")}</button>
            )}
            {host && room.status === "paused" && (
              <button className="text-button" onClick={() => void run("room.resume")}>{t(language, "resumeGame")}</button>
            )}
          </div>
        </div>
        {notice && <p className="notice" role="status">{notice}</p>}
        <HandResultBanner language={language} room={room} />
        {room.phase === "showdown" &&
          room.mode === "chips-only" &&
          room.status === "in_progress" &&
          host && (
          <WinnerPicker language={language} room={room} run={run} />
        )}
        {room.phase === "complete" && (
          <div className="settlement-actions">
            {host && room.mode === "chips-only" && (
              <>
                <button className="secondary" onClick={() => void run("poker.undo-settlement", { pokerVersion: room.pokerVersion })}>
                  {t(language, "undoSettlement")}
                </button>
                <button
                  className="primary"
                  disabled={room.status !== "in_progress"}
                  onClick={() => void run("poker.next-hand")}
                >
                  {t(language, "startNextHand")}
                </button>
              </>
            )}
          </div>
        )}
        <div
          className="bet-cache"
          ref={betCacheRef}
          aria-label={t(language, "betCache")}
          onDragOver={(event) => {
            if (canAct) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const value = Number(event.dataTransfer.getData("chip"));
            if (
              canAct &&
              denominations.includes(value) &&
              total + value <= (seat?.tableChips ?? 0)
            ) {
              setCache((current) => [...current, value]);
            }
          }}
        >
          <span>{t(language, "betCache")}</span>
          <div className="cache-chips">
            {cache.map((chip, index) => (
              <button
                key={`${chip}-${index}`}
                className={`poker-chip chip-${chip}`}
                aria-label={`remove-${chip}`}
                draggable={canAct}
                disabled={!canAct}
                onDragStart={(event) => event.dataTransfer.setData("cache-index", String(index))}
                onPointerDown={(event) => {
                  if (event.pointerType !== "mouse") {
                    pointerGesture.current = {
                      source: "cache",
                      value: chip,
                      index,
                      x: event.clientX,
                      y: event.clientY
                    };
                  }
                }}
                onPointerUp={completePointerDrag}
                onClick={() => {
                  if (
                    suppressClick.current?.source === "cache" &&
                    suppressClick.current.expiresAt >= performance.now()
                  ) {
                    suppressClick.current = null;
                    return;
                  }
                  suppressClick.current = null;
                  setCache((current) => current.filter((_, item) => item !== index));
                }}
              >
                {chip.toLocaleString()}
              </button>
            ))}
          </div>
          <strong>{total.toLocaleString()}</strong>
          <button className="text-button" disabled={!canAct} onClick={() => setCache([])}>{t(language, "clear")}</button>
        </div>
        <div
          className="chip-rack"
          ref={chipRackRef}
          aria-label="chip denominations"
          onDragOver={(event) => {
            if (canAct) event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const index = Number(event.dataTransfer.getData("cache-index"));
            if (canAct && Number.isInteger(index)) {
              setCache((current) => current.filter((_, item) => item !== index));
            }
          }}
        >
          {denominations.map((value) => (
            <button
              key={value}
              draggable
              className={`poker-chip chip-${value}`}
              disabled={!canAct || total + value > (seat?.tableChips ?? 0)}
              onDragStart={(event) => event.dataTransfer.setData("chip", String(value))}
              onPointerDown={(event) => {
                if (event.pointerType !== "mouse") {
                  pointerGesture.current = {
                    source: "rack",
                    value,
                    x: event.clientX,
                    y: event.clientY
                  };
                }
              }}
              onPointerUp={completePointerDrag}
              onClick={() => {
                if (
                  suppressClick.current?.source === "rack" &&
                  suppressClick.current.expiresAt >= performance.now()
                ) {
                  suppressClick.current = null;
                  return;
                }
                suppressClick.current = null;
                setCache((current) => [...current, value]);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setCache((current) => [...current, value]);
                }
              }}
            >
              {value.toLocaleString()}
            </button>
          ))}
        </div>
        <div className="action-grid">
          <button className="danger" disabled={!canAct} onClick={() => void submitAction("fold")}>
            {t(language, "fold")}
          </button>
          <button
            className="secondary"
            disabled={
              !canAct ||
              (raiseLocked && allInTarget > (room.currentBet ?? 0))
            }
            onClick={() => {
              if (callAmount === 0) void submitAction("check");
              else setCache(amountToChips(callAmount));
            }}
          >
            {callAmount === 0 ? t(language, "check") : t(language, "call")}
          </button>
          <button
            className="secondary"
            disabled={!canAct}
            onClick={() => setCache(amountToChips(seat?.tableChips ?? 0))}
          >
            {t(language, "allIn")}
          </button>
          <button className="primary" disabled={!legalAmount} onClick={() => void confirm()}>
            {legalAmount ? confirmLabel : t(language, "invalidBet")}
          </button>
        </div>
        <div className="room-footer-actions compact">
          {room.phase === "complete" && seat && seat.tableChips < room.config.maxBuyIn && (
            <button className="secondary" onClick={() => setTopUpOpen(true)}>
              {t(language, "topUp")}
            </button>
          )}
          {host && <button className="danger" onClick={() => void run("room.close")}>{t(language, "endGame")}</button>}
          {!host && (
            <button
              className="secondary"
              disabled={room.phase !== "complete"}
              onClick={() => void run("room.leave")}
            >
              {t(language, "leaveRoom")}
            </button>
          )}
        </div>
        {topUpOpen && seat && (
          <TopUpModal
            language={language}
            maximum={room.config.maxBuyIn - seat.tableChips}
            onClose={() => setTopUpOpen(false)}
            onConfirm={async (amount) => {
              if (await run("room.top-up", { amount })) setTopUpOpen(false);
            }}
          />
        )}
      </section>
    </main>
  );
}

function WinnerPicker({
  language,
  room,
  run
}: {
  language: Language;
  room: RoomProjection;
  run: (type: string, payload?: Record<string, unknown>) => Promise<boolean>;
}) {
  const [winners, setWinners] = useState<Record<number, string[]>>({});
  const pots = room.pots ?? [];
  const complete = pots.every((_, index) => (winners[index]?.length ?? 0) > 0);
  return (
    <section className="winner-picker">
      <strong>{t(language, "selectWinners")}</strong>
      {pots.map((pot, index) => (
        <fieldset key={index}>
          <legend>{t(language, "pot")} {index + 1} · {pot.amount.toLocaleString()}</legend>
          {pot.eligibleAccountIds.map((accountId) => {
            const seat = room.seats.find((entry) => entry.accountId === accountId);
            return (
              <label key={accountId} className="winner-option">
                <input
                  type="checkbox"
                  checked={winners[index]?.includes(accountId) ?? false}
                  onChange={(event) => setWinners((current) => {
                    const values = new Set(current[index] ?? []);
                    if (event.target.checked) values.add(accountId);
                    else values.delete(accountId);
                    return { ...current, [index]: [...values] };
                  })}
                />
                {seat?.avatar} {seat?.username}
              </label>
            );
          })}
        </fieldset>
      ))}
      <button
        className="primary"
        disabled={!complete}
        onClick={() => void run("poker.settle", {
          pokerVersion: room.pokerVersion,
          winnersByPot: pots.map((_, index) => winners[index] ?? [])
        })}
      >
        {t(language, "settle")}
      </button>
    </section>
  );
}

function PublicDisplay({
  language,
  setLanguage,
  roomId
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  roomId: string;
}) {
  const [room, setRoom] = useState<RoomProjection | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let socket: WebSocket | undefined;
    let stopped = false;
    const load = async () => {
      const response = await fetch(`/api/room/${encodeURIComponent(roomId)}?display=1`);
      if (!response.ok) throw new Error("ROOM_NOT_FOUND");
      setRoom((await response.json()) as RoomProjection);
      const url = new URL("/ws", location.href);
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(url);
      socket.addEventListener("open", () => {
        socket?.send(JSON.stringify({
          type: "subscription.room",
          payload: { roomId, display: true }
        }));
      });
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as { type: string; data?: RoomProjection };
        if (message.type === "projection" && message.data) setRoom(message.data);
        if (message.type === "room.closed") setError(t(language, "roomClosed"));
      });
      socket.addEventListener("close", () => {
        if (!stopped) setError(t(language, "connectionError"));
      });
    };
    void load().catch((reason) => setError(errorMessage(language, reason)));
    return () => {
      stopped = true;
      socket?.close();
    };
  }, [language, roomId]);

  if (error) return <main className="loading-shell"><p className="error">{error}</p></main>;
  if (!room) return <Loading language={language} />;
  return (
    <main className="display-shell">
      <header className="display-header">
        <div>
          <p className="eyebrow">{t(language, "display")}</p>
          <h1>{room.name}</h1>
          <span>{t(language, "displayReadonly")}</span>
        </div>
        <LanguageToggle language={language} setLanguage={setLanguage} />
      </header>
      <section className="display-felt">
        <div className="display-seats">
          {room.seats.map((seat) => (
            <article key={seat.accountId} className={seat.accountId === room.actingAccountId ? "active" : ""}>
              <span>{seat.avatar}</span>
              <b>{seat.username}</b>
              <strong>{seat.tableChips.toLocaleString()}</strong>
              <small>{seat.currentBet.toLocaleString()}</small>
              {seat.position === room.dealerPosition && (
                <em className="dealer-marker" aria-label={t(language, "dealer")}>D</em>
              )}
            </article>
          ))}
        </div>
        <div className="display-board">
          {room.mode === "chips-and-cards" && (
            <div className="cards" data-testid="community-cards">
              {(room.communityCards ?? []).map((card, index) => <span key={index}>{cardLabel(card)}</span>)}
            </div>
          )}
          <p>{phaseLabel(language, room.phase)}</p>
          <div className="pot"><small>{t(language, "pot")}</small><strong>{room.potTotal.toLocaleString()}</strong></div>
          <HandResultBanner language={language} room={room} />
        </div>
        {room.lastAction && room.lastAction.amount > 0 && (
          <div
            key={room.lastAction.version}
            className="chip-flight display-flight"
            style={{
              "--seat-angle": `${
                (room.seats.find(
                  (entry) => entry.accountId === room.lastAction?.accountId
                )?.position ?? 0) * 36
              }deg`
            } as React.CSSProperties}
            aria-label={t(language, "betUpdated")}
          >
            +{room.lastAction.amount.toLocaleString()}
          </div>
        )}
      </section>
    </main>
  );
}

function Modal({
  language,
  title,
  onClose,
  narrow,
  children
}: {
  language: Language;
  title: string;
  onClose: () => void;
  narrow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal ${narrow ? "narrow" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-title">
          <div><p className="eyebrow">HOME TABLE</p><h2>{title}</h2></div>
          <button className="icon-button" aria-label={t(language, "close")} onClick={onClose}>×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>{label}
      <input
        type="number"
        min="1"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function HandResultBanner({
  language,
  room
}: {
  language: Language;
  room: RoomProjection;
}) {
  const result = room.lastResult;
  if (!result) return null;
  return (
    <div className="hand-result" role="status">
      <strong>
        {result.outcome === "void"
          ? t(language, "handVoided")
          : t(language, "handResult")}
      </strong>
      {result.outcome === "settled" && result.payouts.length > 0 && (
        <ul>
          {result.payouts.map((payout) => {
            const seat = room.seats.find(
              (candidate) => candidate.accountId === payout.accountId
            );
            return (
              <li key={payout.accountId}>
                {seat?.avatar} {seat?.username ?? payout.accountId} +
                {payout.amount.toLocaleString()}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TopUpModal({
  language,
  maximum,
  onClose,
  onConfirm
}: {
  language: Language;
  maximum: number;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState(Math.min(maximum, 1_000));
  return (
    <Modal language={language} title={t(language, "topUp")} onClose={onClose} narrow>
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onConfirm(amount);
        }}
      >
        <NumberField label={`${t(language, "topUp")} (≤ ${maximum.toLocaleString()})`} value={amount} onChange={setAmount} />
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>{t(language, "cancel")}</button>
          <button className="primary" disabled={amount <= 0 || amount > maximum}>{t(language, "confirm")}</button>
        </div>
      </form>
    </Modal>
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
    if (stored === null) return initial;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return initial;
    }
  });
  const setStored = useCallback(
    (next: T) => {
      localStorage.setItem(key, JSON.stringify(next));
      setValue(next);
    },
    [key]
  );
  return [value, setStored];
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function readRecentAccount(): Pick<Account, "username" | "avatar"> | null {
  const stored = localStorage.getItem("party-recent-account");
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Pick<Account, "username" | "avatar">;
    return parsed.username ? parsed : null;
  } catch {
    return { username: stored, avatar: avatars[0]! };
  }
}

function writeRecentAccount(account: Pick<Account, "username" | "avatar">): void {
  localStorage.setItem(
    "party-recent-account",
    JSON.stringify({ username: account.username, avatar: account.avatar })
  );
}

function createCommandId(): string {
  const cryptoApi = globalThis.crypto as (Crypto & {
    randomUUID?: () => string;
  }) | undefined;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return `cmd-${Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")}`;
  }
  return `cmd-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}-${Math.random().toString(36).slice(2)}`;
}

type CommandFunction = <T>(
  type: string,
  payload: Record<string, unknown>,
  aggregateId?: string
) => Promise<CommandResult<T>>;

function isRoomProjection(value: unknown): value is RoomProjection {
  return Boolean(
    value &&
    typeof value === "object" &&
    "id" in value &&
    "seats" in value &&
    "hostAccountId" in value
  );
}

function amountToChips(amount: number): number[] {
  const result: number[] = [];
  let remaining = amount;
  for (const denomination of [...denominations].reverse()) {
    while (remaining >= denomination) {
      result.push(denomination);
      remaining -= denomination;
    }
  }
  return result;
}

function cardLabel(card: Card | { hidden: true }): string {
  if ("hidden" in card) return "🂠";
  const suits = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  return `${card.rank}${suits[card.suit]}`;
}

function roomStatus(language: Language, status: RoomProjection["status"]): string {
  const labels = {
    waiting: t(language, "waiting"),
    in_progress: t(language, "inProgress"),
    paused: t(language, "paused"),
    closing: t(language, "endGame"),
    closed: t(language, "roomClosed")
  };
  return labels[status];
}

function phaseLabel(language: Language, phase?: RoomProjection["phase"]): string {
  const zh = {
    waiting: "等待",
    blinds: "盲注",
    preflop: "翻牌前",
    flop: "翻牌",
    turn: "转牌",
    river: "河牌",
    showdown: "摊牌",
    distribution: "分配底池",
    complete: "本手结束",
    void: "本手作废"
  };
  const en = {
    waiting: "Waiting",
    blinds: "Blinds",
    preflop: "Pre-flop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown",
    distribution: "Payout",
    complete: "Hand complete",
    void: "Hand void"
  };
  if (!phase) return language === "zh-CN" ? "等待开始" : "Waiting to start";
  return (language === "zh-CN" ? zh : en)[phase];
}

function rankBadge(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
}

function formatTemplate(template: string, value: number): string {
  return template.replace("{number}", String(value));
}

function errorMessage(language: Language, reason: unknown): string {
  const code = reason instanceof Error ? reason.message : String(reason);
  const messages: Record<string, [string, string]> = {
    INVALID_USERNAME: ["用户名不能为空或超过 32 个字符", "Username is required and must be at most 32 characters"],
    USERNAME_TAKEN: ["该用户名已被使用", "That username is already in use"],
    STALE_CONNECTION: ["此账户已由新设备接管，请重新进入", "A newer device controls this account; enter again"],
    STALE_VERSION: ["状态已更新，请重试", "State changed; please try again"],
    ALREADY_IN_ROOM: ["该账户已经在另一房间", "This account is already in another room"],
    ROOM_ALREADY_STARTED: ["牌局已开始，不能加入新玩家", "The game already started; new players cannot join"],
    ROOM_FULL: ["房间已满", "The room is full"],
    INVALID_BUY_IN: ["买入金额超出房间范围", "Buy-in is outside the room limits"],
    INSUFFICIENT_SCORE: ["账户分数不足", "Not enough account score"],
    BUY_IN_LIMIT: ["补充后会超过牌桌上限", "The top-up would exceed the table limit"],
    INVALID_AMOUNT: ["金额必须是正整数", "The amount must be a positive whole number"],
    INVALID_BASE_SCORE: ["基础分必须是非负整数", "Base score must be a non-negative whole number"],
    INVALID_ROOM_CONFIG: ["房间配置无效，请检查盲注和买入范围", "Room settings are invalid; check blinds and buy-in limits"],
    INVALID_LANGUAGE: ["不支持该界面语言", "That interface language is not supported"],
    NOT_ENOUGH_PLAYERS: ["至少需要两名玩家", "At least two players are required"],
    HOST_ONLY: ["只有房主可以执行此操作", "Only the host can do that"],
    TRANSFER_HOST_FIRST: ["请先转让房主", "Transfer the host role first"],
    TARGET_OFFLINE: ["只能把房主转让给在线玩家", "The new host must be online"],
    CANNOT_REMOVE_HOST: ["房主不能移除自己，请先转让或关闭房间", "The host cannot remove themselves; transfer or close the room"],
    PLAYER_STILL_CONNECTED: ["对局中只能移除已断线玩家", "Only disconnected players can be removed during a hand"],
    PLAYER_NEEDS_TOP_UP: ["至少两名玩家需要先补充筹码", "At least two players must top up first"],
    HAND_IN_PROGRESS: ["请在两手牌之间操作", "This action is available between hands"],
    ROOM_NOT_IN_PROGRESS: ["牌局尚未开始或已经暂停", "The room is not in progress"],
    ROOM_NOT_PAUSED: ["牌局当前没有暂停", "The room is not paused"],
    ROOM_PAUSED: ["牌局已暂停", "The room is paused"],
    POKER_NOT_STARTED: ["牌局尚未开始", "Poker has not started"],
    ROOMS_MUST_CLOSE: ["开始新赛季前必须关闭全部房间", "Close every room before starting a new season"],
    WRONG_ACTOR: ["当前不是你的行动", "It is not your turn"],
    CANNOT_CHECK: ["当前需要跟注，不能过牌", "You must call or fold; checking is unavailable"],
    INVALID_BET: ["下注金额不合法", "The bet amount is invalid"],
    MINIMUM_RAISE: ["加注未达到最低额度", "Raise is below the minimum"],
    RAISE_NOT_REOPENED: ["较小的全押未重新开放加注，你只能跟注或弃牌", "A short all-in did not reopen raising; call or fold"],
    INVALID_PHASE: ["当前牌局阶段不允许此操作", "This action is unavailable in the current phase"],
    SETTLEMENT_UNDO_NOT_AVAILABLE: ["当前结算不能撤销", "This settlement cannot be undone"],
    UNDO_NOT_AVAILABLE: ["下一位玩家已行动，不能撤销", "Undo is no longer available"],
    WINNER_REQUIRED: ["请为每个底池选择获胜者", "Choose a winner for every pot"],
    INELIGIBLE_WINNER: ["所选玩家无权赢得该底池", "A selected player is not eligible for that pot"],
    PLAYER_NOT_IN_ROOM: ["该玩家不在房间中", "That player is not in the room"],
    PLAYER_NOT_FOUND: ["牌局中找不到该玩家", "That player is not in the hand"],
    HAND_RESULT_NOT_FOUND: ["找不到可撤销的结算", "No reversible settlement was found"],
    MANUAL_WINNER_NOT_ALLOWED: ["该模式不能手动选择赢家", "Winners cannot be selected manually in this mode"],
    AUTOMATIC_WINNER_NOT_ALLOWED: ["该模式需要房主选择赢家", "This mode requires the host to select winners"],
    BOARD_INCOMPLETE: ["公共牌尚未发完", "The community board is incomplete"],
    DECK_EXHAUSTED: ["牌堆状态异常", "The deck state is invalid"],
    INVALID_PLAYER_COUNT: ["德州扑克需要 2 到 10 名玩家", "Texas Hold'em requires 2 to 10 players"],
    INVALID_SEAT_POSITIONS: ["牌桌座位状态冲突", "Table seat positions are inconsistent"],
    INVALID_DEALER_POSITION: ["庄家座位无效", "The dealer position is invalid"],
    INVALID_COMMAND: ["操作格式无效，请刷新后重试", "The command is invalid; refresh and try again"],
    UNSUPPORTED_COMMAND: ["当前版本不支持此操作", "This action is not supported by this version"],
    ROOM_NOT_FOUND: ["房间不存在或已经关闭", "The room does not exist or has closed"],
    ACCOUNT_NOT_FOUND: ["账户不存在", "The account does not exist"],
    ASSET_NOT_FOUND: ["账户资产状态不存在", "Account asset state is missing"],
    NO_CURRENT_SEASON: ["当前赛季状态不存在", "There is no current season"],
    DUPLICATE_USERNAME: ["用户名状态冲突", "Username state is inconsistent"],
    MULTIPLE_ROOM_OCCUPANCY: ["账户不能同时加入多个房间", "An account cannot occupy multiple rooms"],
    NEGATIVE_ASSET: ["资产状态异常，操作已回滚", "Asset state is invalid; the action was rolled back"],
    ASSET_CONSERVATION_FAILED: ["资产守恒检查失败，操作已回滚", "Asset conservation failed; the action was rolled back"],
    INVALID_HAND: ["手牌状态无效", "The hand state is invalid"],
    ADVANCE_NOT_DUE: ["自动推进时间尚未到达", "The auto-advance deadline has not arrived"],
    HOST_TIMEOUT_CHANGED: ["房主连接状态已经变化", "The host connection state changed"],
    INVALID_HOST_CANDIDATE: ["无法选择新的房主", "A new host could not be selected"],
    ENTER_FAILED: ["无法进入家庭服务器", "Cannot enter the home server"],
    STATE_FAILED: ["无法读取权威状态", "Cannot load authoritative state"],
    COMMAND_FAILED: ["操作未被服务器接受", "The server rejected the action"]
  };
  return messages[code]?.[language === "zh-CN" ? 0 : 1] ??
    (language === "zh-CN" ? `操作失败：${code}` : `Action failed: ${code}`);
}

function playTone(): void {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Sound is optional and never blocks state changes.
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
