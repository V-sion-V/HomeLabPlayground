import {
  StrictMode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import type {
  Account,
  AvalonLobbyRoomProjection,
  AvalonRole,
  AvalonRoomProjection,
  Card,
  CommandResult,
  GlobalSettings,
  HandCategory,
  Language,
  LobbyProjection,
  LobbyRoomProjection,
  PokerLobbyRoomProjection,
  PokerRoomProjection,
  PublicSeatProjection,
  RoomConfig,
  RoomMode,
  RoomProjection,
  ThemeMode
} from "@party/contracts";
import {
  fallbackAvatar,
  productConfig,
  selectableAvatars
} from "@party/contracts";
import { t } from "./locales";
import { AdminApp, isAdminPath } from "./admin-ui";
import { PlatformLeaderboard } from "./platform-ui";
import {
  AvalonPublicDisplay,
  AvalonRoleEditor,
  AvalonRoomView,
  avalonCompatiblePlayerCounts,
  avalonText
} from "./avalon-ui";
import {
  AnchoredMenu,
  ArrowIcon,
  CollapsibleCard,
  ConfirmDialog,
  RoomHeader,
  SelectField,
  ThemeToggle,
  ToastProvider,
  applyProductTheme,
  type ThemeScope,
  useContextMenuGesture,
  useToast
} from "./ui";
import "./styles.css";

const avatars = selectableAvatars;

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
  const [language, setLanguage] = useState<Language>("zh-CN");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [volume, setVolume] = useState(100);
  const [loginDefaults, setLoginDefaults] = useState<{
    language: Language;
    theme: ThemeMode;
  }>({ language: "zh-CN", theme: "dark" });
  const [session, setSession] = useState<Session | null>(null);
  const [lobby, setLobby] = useState<LobbyProjection | null>(null);
  const [room, setRoom] = useState<RoomProjection | null>(null);
  const [restoring, setRestoring] = useState(!displayRoomId && Boolean(readRecentAccount()));
  const pushNotice = useToast();
  const restoreStarted = useRef(false);
  const accountPreferencesApplied = useRef(false);
  const activeRoomId = room?.id;
  const themeScope: ThemeScope =
    room?.gameType === "avalon"
      ? "avalon"
      : displayRoomId || room
        ? "poker"
        : "main";

  useLayoutEffect(() => {
    applyProductTheme(themeScope, themeMode);
  }, [themeMode, themeScope]);

  useEffect(() => {
    void fetch("/api/state")
      .then((response) => response.json() as Promise<LobbyProjection>)
      .then((state) => {
        const defaults = {
          language: state.settings.defaultLanguage,
          theme: state.settings.defaultTheme
        };
        setLoginDefaults(defaults);
        if (!accountPreferencesApplied.current) {
          setLanguage(defaults.language);
          setThemeMode(defaults.theme);
          setVolume(100);
        }
      })
      .catch(() => {
        // The login remains usable with the bundled fallback language.
      });
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const acceptEntry = useCallback((result: CommandResult<EnterData>) => {
    if (!result.data) throw new Error(result.code || "ENTER_FAILED");
    const nextSession = {
      account: result.data.account,
      connectionId: result.data.connectionId
    };
    accountPreferencesApplied.current = true;
    setLanguage(result.data.account.language);
    setThemeMode(result.data.account.theme);
    setVolume(result.data.account.volume);
    setSession(nextSession);
    setLobby({ ...result.data.lobby, version: result.version });
    setRoom(
      result.data.room
        ? { ...result.data.room, platformVersion: result.version }
        : null
    );
    writeRecentAccount(result.data.account);
  }, []);

  const enter = useCallback(async (username: string) => {
    const response = await fetch("/api/enter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ commandId: createCommandId(), username })
    });
    const result = (await response.json()) as CommandResult<EnterData>;
    if (!response.ok || !result.data) throw new Error(result.code || "ENTER_FAILED");
    acceptEntry(result);
  }, [acceptEntry]);

  const register = useCallback(
    async (input: {
      username: string;
      avatar: string;
      language: Language;
      theme: ThemeMode;
    }) => {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          commandId: createCommandId(),
          ...input
        })
      });
      const result = (await response.json()) as CommandResult<EnterData>;
      if (!response.ok || !result.data) {
        throw new Error(result.code || "REGISTER_FAILED");
      }
      acceptEntry(result);
    },
    [acceptEntry]
  );

  useEffect(() => {
    if (displayRoomId || restoreStarted.current) return;
    const recent = readRecentAccount();
    if (!recent) {
      setRestoring(false);
      return;
    }
    restoreStarted.current = true;
    void enter(recent.username)
      .catch(() => {
        localStorage.removeItem("party-recent-account");
        accountPreferencesApplied.current = false;
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
          pushNotice(
            t(language, message.type === "room.closed" ? "roomClosed" : "removedFromRoom")
          );
          void refreshLobby();
        }
        if (message.type === "session.replaced") {
          localStorage.removeItem("party-recent-account");
          accountPreferencesApplied.current = false;
          setLanguage(loginDefaults.language);
          setThemeMode(loginDefaults.theme);
          setVolume(100);
          setRoom(null);
          setLobby(null);
          setSession(null);
          pushNotice(t(language, "connectionTaken"));
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
  }, [activeRoomId, language, loginDefaults, pushNotice, refreshLobby, session]);

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
          accountPreferencesApplied.current = false;
          setLanguage(loginDefaults.language);
          setThemeMode(loginDefaults.theme);
          setVolume(100);
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
    [
      lobby?.version,
      loginDefaults,
      refreshLobby,
      refreshRoom,
      room,
      session
    ]
  );

  if (displayRoomId) {
    return (
      <PublicDisplay
        language={language}
        roomId={displayRoomId}
        themeMode={themeMode}
      />
    );
  }

  if (restoring) return <Loading language={language} />;

  if (!session) {
    return (
      <Login
        language={language}
        defaults={loginDefaults}
        setLanguage={setLanguage}
        setTheme={setThemeMode}
        onEnter={enter}
        onRegister={register}
      />
    );
  }

  if (room) {
    return (
      <RoomView
        language={language}
        session={session}
        room={room}
        pushNotice={pushNotice}
        volume={volume}
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
      session={session}
      setSession={setSession}
      lobby={lobby}
      pushNotice={pushNotice}
      command={command}
      onRoom={setRoom}
      onPreferences={(account) => {
        accountPreferencesApplied.current = true;
        setLanguage(account.language);
        setThemeMode(account.theme);
        setVolume(account.volume);
      }}
      onSwitch={() => {
        localStorage.removeItem("party-recent-account");
        accountPreferencesApplied.current = false;
        setLanguage(loginDefaults.language);
        setThemeMode(loginDefaults.theme);
        setVolume(100);
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
  defaults,
  setLanguage,
  setTheme,
  onEnter,
  onRegister
}: {
  language: Language;
  defaults: { language: Language; theme: ThemeMode };
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeMode) => void;
  onEnter: (username: string) => Promise<void>;
  onRegister: (input: {
    username: string;
    avatar: string;
    language: Language;
    theme: ThemeMode;
  }) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [registrationUsername, setRegistrationUsername] = useState("");
  const [avatar, setAvatar] = useState(avatars[0]!);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [registrationLanguage, setRegistrationLanguage] =
    useState<Language>(defaults.language);
  const [registrationTheme, setRegistrationTheme] =
    useState<ThemeMode>(defaults.theme);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (registrationUsername) return;
    setRegistrationLanguage(defaults.language);
    setRegistrationTheme(defaults.theme);
  }, [defaults, registrationUsername]);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) {
      setError(t(language, "enterName"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/account/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username })
      });
      const result = (await response.json()) as {
        username?: string;
        exists?: boolean;
        code?: string;
      };
      if (!response.ok || !result.username) {
        throw new Error(result.code || "INVALID_USERNAME");
      }
      if (result.exists) {
        await onEnter(result.username);
      } else {
        setRegistrationUsername(result.username);
        setRegistrationLanguage(defaults.language);
        setRegistrationTheme(defaults.theme);
        setLanguage(defaults.language);
        setTheme(defaults.theme);
        setError("");
      }
    } catch (reason) {
      setError(errorMessage(language, reason));
    } finally {
      setBusy(false);
    }
  }

  async function registerAccount(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onRegister({
        username: registrationUsername,
        avatar,
        language: registrationLanguage,
        theme: registrationTheme
      });
    } catch (reason) {
      setError(errorMessage(language, reason));
    } finally {
      setBusy(false);
    }
  }

  const back = () => {
    setRegistrationUsername("");
    setAvatarOpen(false);
    setError("");
    setLanguage(defaults.language);
    setTheme(defaults.theme);
  };

  return (
    <main className="login-shell">
      <section className="login-hero">
        <div className="brand-mark" aria-hidden="true">♠</div>
        <p className="eyebrow">HOME PARTY PLATFORM</p>
        <h1>{t(language, "brand")}</h1>
        <p className="tagline">{t(language, "tagline")}</p>
        <div className="trust-pill">● LAN · {t(language, "passwordFree")}</div>
      </section>
      {registrationUsername ? (
        <form className="login-card registration-card" onSubmit={registerAccount}>
          <div className="registration-header">
            <button
              type="button"
              className="icon-button"
              aria-label={t(language, "backToUsername")}
              onClick={back}
            >
              <ArrowIcon direction="left" />
            </button>
            <div>
              <p className="eyebrow">{t(language, "newAccount")}</p>
              <h2>{t(language, "registration")}</h2>
            </div>
          </div>
          <label>
            {t(language, "username")}
            <input
              value={registrationUsername}
              aria-label={t(language, "username")}
              readOnly
            />
          </label>
          <div className="avatar-disclosure">
            <span>{t(language, "chooseAvatar")}</span>
            <button
              type="button"
              className="avatar-current"
              aria-label={t(language, "chooseAvatar")}
              aria-expanded={avatarOpen}
              onClick={() => setAvatarOpen((current) => !current)}
            >
              <b aria-hidden="true">{avatar}</b>
              <ArrowIcon direction={avatarOpen ? "down" : "right"} />
            </button>
          </div>
          {avatarOpen && (
            <div className="avatar-grid" role="listbox" aria-label={t(language, "chooseAvatar")}>
              {avatars.map((item) => (
                <button
                  type="button"
                  role="option"
                  key={item}
                  aria-label={`avatar-${item}`}
                  aria-selected={avatar === item}
                  className={avatar === item ? "avatar selected" : "avatar"}
                  onClick={() => {
                    setAvatar(item);
                    setAvatarOpen(false);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          <div className="setting-row">
            <span>{t(language, "accountLanguage")}</span>
            <LanguageToggle
              language={registrationLanguage}
              setLanguage={(next) => {
                setRegistrationLanguage(next);
                setLanguage(next);
              }}
            />
          </div>
          <div className="setting-row">
            <span>{t(language, "accountTheme")}</span>
            <ThemeToggle
              mode={registrationTheme}
              onChange={(next) => {
                setRegistrationTheme(next);
                setTheme(next);
              }}
              lightLabel={t(language, "lightTheme")}
              darkLabel={t(language, "darkTheme")}
              groupLabel={t(language, "themeSelection")}
            />
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary wide" type="submit" disabled={busy}>
            {busy ? t(language, "loading") : t(language, "registerAndEnter")}
          </button>
        </form>
      ) : (
        <form className="login-card username-card" onSubmit={lookup}>
          <label>
            <span>{t(language, "enterName")}</span>
            <span className="username-entry">
              <input
                aria-label={t(language, "enterName")}
                value={username}
                maxLength={32}
                autoComplete="username"
                onChange={(event) => setUsername(event.target.value)}
              />
              <button
                className="primary username-submit"
                type="submit"
                aria-label={t(language, "continue")}
                disabled={busy}
              >
                <ArrowIcon direction="right" />
              </button>
            </span>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="fine-print">{t(language, "noPassword")}</p>
        </form>
      )}
    </main>
  );
}

function Lobby({
  language,
  session,
  setSession,
  lobby,
  pushNotice,
  command,
  onRoom,
  onPreferences,
  onSwitch
}: {
  language: Language;
  session: Session;
  setSession: (session: Session) => void;
  lobby: LobbyProjection;
  pushNotice: (notice: string) => void;
  command: CommandFunction;
  onRoom: (room: RoomProjection) => void;
  onPreferences: (account: Account) => void;
  onSwitch: () => void;
}) {
  const [createGame, setCreateGame] = useState<
    "chooser" | "poker" | "avalon" | null
  >(null);
  const [joinRoom, setJoinRoom] = useState<LobbyRoomProjection | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  async function returnToRoom(roomId: string) {
    const response = await fetch(
      `/api/room/${encodeURIComponent(roomId)}?accountId=${encodeURIComponent(session.account.id)}&connectionId=${encodeURIComponent(session.connectionId)}`
    );
    if (!response.ok) {
      pushNotice(t(language, "roomClosed"));
      return;
    }
    onRoom((await response.json()) as RoomProjection);
  }

  return (
    <main className={`app-shell suit-theme-${lobby.settings.poker.suitColorPreset}`}>
      <header className="topbar">
        <div>
          <p className="eyebrow">HOME TABLE</p>
          <h1>{t(language, "lobby")}</h1>
        </div>
        <div className="top-actions">
          <button className="account-chip" onClick={() => setProfileOpen(true)}>
            <span>{session.account.avatar}</span>
            {session.account.username}
            <small>{t(language, "profile")}</small>
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
            <button className="primary" onClick={() => setCreateGame("chooser")}>
              ＋ {t(language, "create")}
            </button>
          </div>
          <div className="room-list">
            {lobby.rooms.map((entry) => {
              const ownRoom = lobby.accountRoomId === entry.id;
              if (entry.gameType === "avalon") {
                return (
                  <article className="room-card" key={entry.id}>
                    <div className="room-identity">
                      <span className="suit-badge suit-clubs">A</span>
                      <div>
                        <h3>{entry.name}</h3>
                        <p>
                          {t(language, "avalon")} ·{" "}
                          {avalonText(language, entry.recognitionMode)} ·{" "}
                          {avalonText(language, entry.oberonRule)} ·{" "}
                          {avalonText(language, "stake")}{" "}
                          {entry.stake.toLocaleString()}
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
                        <span key={seat.accountId} title={seat.username}>
                          {seat.avatar}
                        </span>
                      ))}
                      <span className="empty-seat">+{10 - entry.seatCount}</span>
                    </div>
                    <div className="room-actions">
                      {ownRoom ? (
                        <button
                          className="primary"
                          onClick={() => void returnToRoom(entry.id)}
                        >
                          {t(language, "returnRoom")}
                        </button>
                      ) : (
                        <button
                          className="primary"
                          disabled={
                            entry.seatCount >= entry.maxSeats ||
                            !["waiting", "in_progress", "paused"].includes(
                              entry.status
                            )
                          }
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
              }
              return (
                <article className="room-card" key={entry.id}>
                  <div className="room-identity">
                    <span
                      className={`suit-badge ${
                        entry.mode === "chips-only" ? "suit-clubs" : "suit-diamonds"
                      }`}
                    >
                      {entry.mode === "chips-only" ? "♣" : "♦"}
                    </span>
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
                        disabled={
                          entry.seatCount >= entry.maxSeats ||
                          !["waiting", "in_progress", "paused"].includes(entry.status)
                        }
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
        <PlatformLeaderboard language={language} lobby={lobby} />
      </div>
      {createGame === "chooser" && (
        <Modal
          language={language}
          title={t(language, "createRoom")}
          onClose={() => setCreateGame(null)}
        >
          <div className="game-choice-grid">
            <button
              className="game-choice-card"
              onClick={() => setCreateGame("poker")}
            >
              <span>♠</span>
              <strong>{t(language, "poker")}</strong>
            </button>
            <button
              className="game-choice-card"
              onClick={() => setCreateGame("avalon")}
            >
              <span>◈</span>
              <strong>{t(language, "avalon")}</strong>
            </button>
          </div>
        </Modal>
      )}
      {createGame === "poker" && (
        <CreateRoomModal
          language={language}
          settings={lobby.settings}
          onClose={() => setCreateGame(null)}
          onCreate={async (name, config, buyIn) => {
            try {
              const result = await command<RoomProjection>(
                "room.create",
                { gameType: "texas-holdem", name, config, buyIn },
                "platform"
              );
              if (result.data) onRoom({ ...result.data, platformVersion: result.version });
              setCreateGame(null);
            } catch (reason) {
              pushNotice(errorMessage(language, reason));
            }
          }}
        />
      )}
      {createGame === "avalon" && (
        <AvalonCreateRoomModal
          language={language}
          settings={lobby.settings}
          onClose={() => setCreateGame(null)}
          onCreate={async (name, config) => {
            try {
              const result = await command<AvalonRoomProjection>(
                "room.create",
                {
                  gameType: "avalon",
                  name,
                  config
                },
                "platform"
              );
              if (result.data) {
                onRoom({
                  ...result.data,
                  platformVersion: result.version
                });
              }
              setCreateGame(null);
            } catch (reason) {
              pushNotice(errorMessage(language, reason));
            }
          }}
        />
      )}
      {joinRoom?.gameType === "texas-holdem" && (
        <JoinRoomModal
          language={language}
          room={joinRoom}
          onClose={() => setJoinRoom(null)}
          onJoin={async (buyIn) => {
            try {
              const result = await command<RoomProjection>(
                "room.join",
                {
                  gameType: "texas-holdem",
                  roomId: joinRoom.id,
                  buyIn
                },
                joinRoom.id
              );
              if (result.data) onRoom({ ...result.data, platformVersion: result.version });
              setJoinRoom(null);
            } catch (reason) {
              pushNotice(errorMessage(language, reason));
            }
          }}
        />
      )}
      {joinRoom?.gameType === "avalon" && (
        <AvalonJoinRoomModal
          language={language}
          room={joinRoom}
          onClose={() => setJoinRoom(null)}
          onJoin={async () => {
            const selectedRoom = joinRoom;
            try {
              const result = await command<RoomProjection>(
                "room.join",
                { gameType: "avalon", roomId: selectedRoom.id },
                selectedRoom.id
              );
              if (result.data) {
                onRoom({
                  ...result.data,
                  platformVersion: result.version
                });
              }
              setJoinRoom(null);
            } catch (reason) {
              pushNotice(errorMessage(language, reason));
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
          onSave={async (username, avatar, nextLanguage, theme, volume) => {
            try {
              const result = await command<Account>(
                "account.profile",
                {
                  username,
                  avatar,
                  language: nextLanguage,
                  theme,
                  volume
                },
                "platform"
              );
              if (result.data) {
                const next = { ...session, account: result.data };
                setSession(next);
                writeRecentAccount(result.data);
                onPreferences(result.data);
              }
              setProfileOpen(false);
            } catch (reason) {
              pushNotice(errorMessage(language, reason));
            }
          }}
        />
      )}
    </main>
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
    <Modal
      language={language}
      title={`${t(language, "createRoom")} · ${t(language, "poker")}`}
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {t(language, "cancel")}
          </button>
          <button
            className="primary"
            disabled={busy}
            form="create-room-form"
          >
            {t(language, "create")}
          </button>
        </div>
      }
    >
      <form id="create-room-form" className="form-stack" onSubmit={submit}>
        <label>{t(language, "roomNameLabel")}
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <SelectField
          label={t(language, "mode")}
          value={mode}
          options={[
            { value: "chips-and-cards", label: t(language, "chipsCards") },
            { value: "chips-only", label: t(language, "chipsOnly") }
          ]}
          onChange={(next) => setMode(next as RoomMode)}
        />
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
      </form>
    </Modal>
  );
}

type AvalonRoomCreateConfig =
  | {
      recognitionMode: GlobalSettings["avalon"]["defaultRecognitionMode"];
      oberonRule: GlobalSettings["avalon"]["defaultOberonRule"];
      stake: number;
      hostTransferTimeoutSeconds: number;
      roleSource: "preset";
    }
  | {
      recognitionMode: GlobalSettings["avalon"]["defaultRecognitionMode"];
      oberonRule: GlobalSettings["avalon"]["defaultOberonRule"];
      stake: number;
      hostTransferTimeoutSeconds: number;
      roleSource: "custom";
      roles: AvalonRole[];
    };

function AvalonCreateRoomModal({
  language,
  settings,
  onClose,
  onCreate
}: {
  language: Language;
  settings: GlobalSettings;
  onClose: () => void;
  onCreate: (
    name: string,
    config: AvalonRoomCreateConfig
  ) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [recognitionMode, setRecognitionMode] = useState(
    settings.avalon.defaultRecognitionMode
  );
  const [oberonRule, setOberonRule] = useState(
    settings.avalon.defaultOberonRule
  );
  const [stake, setStake] = useState(settings.avalon.defaultStake);
  const [hostTransferTimeoutSeconds, setHostTransferTimeoutSeconds] = useState(
    settings.defaultHostTransferTimeoutSeconds
  );
  const [roleSource, setRoleSource] = useState<"preset" | "custom">("preset");
  const [roles, setRoles] = useState<AvalonRole[]>([
    "merlin",
    "percival",
    "assassin",
    "morgana"
  ]);
  const [busy, setBusy] = useState(false);
  const compatiblePlayerCounts = avalonCompatiblePlayerCounts(roles);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const common = {
        recognitionMode,
        oberonRule,
        stake,
        hostTransferTimeoutSeconds
      };
      await onCreate(
        name,
        roleSource === "custom"
          ? { ...common, roleSource, roles }
          : { ...common, roleSource }
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      language={language}
      title={`${t(language, "createRoom")} · ${t(language, "avalon")}`}
      onClose={onClose}
      className="avalon-create-modal"
      footer={
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {t(language, "cancel")}
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              !Number.isSafeInteger(stake) ||
              stake < 2 ||
              (roleSource === "custom" &&
                compatiblePlayerCounts.length === 0)
            }
            form="create-avalon-room-form"
          >
            {busy ? t(language, "loading") : t(language, "create")}
          </button>
        </div>
      }
    >
      <form
        id="create-avalon-room-form"
        className="form-stack"
        onSubmit={submit}
      >
        <label>
          {t(language, "roomNameLabel")}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="avalon-setting-grid">
          <SelectField
            label={avalonText(language, "recognition")}
            value={recognitionMode}
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
            onChange={(value) =>
              setRecognitionMode(value as typeof recognitionMode)
            }
          />
          <SelectField
            label={avalonText(language, "oberon")}
            value={oberonRule}
            options={[
              {
                value: "original",
                label: avalonText(language, "original")
              },
              { value: "dized", label: avalonText(language, "dized") }
            ]}
            onChange={(value) => setOberonRule(value as typeof oberonRule)}
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
          <NumberField
            label={avalonText(language, "stake")}
            value={stake}
            onChange={setStake}
          />
          <NumberField
            label={t(language, "hostTimeout")}
            value={hostTransferTimeoutSeconds}
            onChange={setHostTransferTimeoutSeconds}
          />
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
  room: PokerLobbyRoomProjection;
  onClose: () => void;
  onJoin: (buyIn: number) => Promise<void>;
}) {
  const [buyIn, setBuyIn] = useState(room.minBuyIn);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      language={language}
      title={t(language, "joinBuyIn")}
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {t(language, "cancel")}
          </button>
          <button
            className="primary"
            disabled={busy}
            form="join-room-form"
          >
            {t(language, "join")}
          </button>
        </div>
      }
    >
      <form
        id="join-room-form"
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
        <JoinRoomSummary
          language={language}
          roomName={room.name}
          gameName={t(language, "poker")}
          seatCount={room.seatCount}
          maxSeats={room.maxSeats}
          detail={`${room.minBuyIn.toLocaleString()}–${room.maxBuyIn.toLocaleString()}`}
        />
        <NumberField label={t(language, "buyIn")} value={buyIn} onChange={setBuyIn} />
      </form>
    </Modal>
  );
}

function AvalonJoinRoomModal({
  language,
  room,
  onClose,
  onJoin
}: {
  language: Language;
  room: AvalonLobbyRoomProjection;
  onClose: () => void;
  onJoin: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      language={language}
      title={t(language, "join")}
      onClose={onClose}
      narrow
      footer={
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {t(language, "cancel")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onJoin();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? t(language, "loading") : t(language, "join")}
          </button>
        </div>
      }
    >
      <JoinRoomSummary
        language={language}
        roomName={room.name}
        gameName={t(language, "avalon")}
        seatCount={room.seatCount}
        maxSeats={room.maxSeats}
      />
    </Modal>
  );
}

function JoinRoomSummary({
  language,
  roomName,
  gameName,
  seatCount,
  maxSeats,
  detail
}: {
  language: Language;
  roomName: string;
  gameName: string;
  seatCount: number;
  maxSeats: number;
  detail?: string;
}) {
  return (
    <section className="join-room-summary">
      <h3>{roomName}</h3>
      <p>{gameName}</p>
      <strong>
        {t(language, "currentPlayers")} {seatCount}/{maxSeats}
      </strong>
      {detail && <small>{detail}</small>}
    </section>
  );
}

export function SettingsModal({
  language,
  setLanguage,
  settings,
  onClose,
  onSave,
  onSeason,
  onAccountManagement,
  onSeasonManagement
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  settings: GlobalSettings;
  onClose: () => void;
  onSave: (settings: GlobalSettings) => Promise<void>;
  onSeason: () => void;
  onAccountManagement: () => void;
  onSeasonManagement: () => void;
}) {
  const [value, setValue] = useState(structuredClone(settings));
  const [pokerExpanded, setPokerExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const denominationError = validateDenominations(value.poker.denominations)
    ? ""
    : t(language, "invalidDenominations");

  const save = async () => {
    const denominations = normalizedDenominations(value.poker.denominations);
    if (!denominations) return;
    setBusy(true);
    try {
      await onSave({
        ...value,
        poker: {
          ...value.poker,
          denominations
        }
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      language={language}
      title={t(language, "settings")}
      onClose={onClose}
      className="settings-modal"
      footer={
        <div className="modal-actions settings-actions">
          <button className="danger-link compact-button" onClick={onSeason}>
            {t(language, "newSeason")}
          </button>
          <button
            className="primary settings-save"
            disabled={busy || Boolean(denominationError)}
            onClick={() => void save()}
          >
            {busy ? t(language, "loading") : t(language, "save")}
          </button>
        </div>
      }
    >
      <div className="settings-scroll">
        <div className="settings-management-actions">
          <button
            type="button"
            className="secondary"
            onClick={onAccountManagement}
          >
            {t(language, "accountManagement")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onSeasonManagement}
          >
            {t(language, "seasonManagement")}
          </button>
        </div>
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
        <SelectField
          label={t(language, "hostTimeout")}
          value={String(value.defaultHostTransferTimeoutSeconds)}
          options={[
            { value: "30", label: "30s" },
            { value: "60", label: "60s" },
            { value: "120", label: "120s" }
          ]}
          onChange={(next) =>
            setValue((current) => ({
              ...current,
              defaultHostTransferTimeoutSeconds: Number(next)
            }))
          }
        />
        <CollapsibleCard
          title={t(language, "poker")}
          summary={t(language, "pokerSettingsSummary")}
          expanded={pokerExpanded}
          onToggle={() => setPokerExpanded((current) => !current)}
        >
          <SelectField
            label={t(language, "suitColors")}
            value={value.poker.suitColorPreset}
            options={[
              {
                value: "standard",
                label: t(language, "standardSuitColors")
              },
              {
                value: "high-contrast",
                label: t(language, "highContrastSuitColors")
              }
            ]}
            onChange={(next) =>
              setValue((current) => ({
                ...current,
                poker: {
                  ...current.poker,
                  suitColorPreset:
                    next as GlobalSettings["poker"]["suitColorPreset"]
                }
              }))
            }
          />
          <div className="setting-grid">
            <NumberField label={t(language, "smallBlind")} value={value.poker.smallBlind} onChange={(next) => setValue((current) => ({ ...current, poker: { ...current.poker, smallBlind: next } }))} />
            <NumberField label={t(language, "bigBlind")} value={value.poker.bigBlind} onChange={(next) => setValue((current) => ({ ...current, poker: { ...current.poker, bigBlind: next } }))} />
            <NumberField label={t(language, "minBuyIn")} value={value.poker.minBuyIn} onChange={(next) => setValue((current) => ({ ...current, poker: { ...current.poker, minBuyIn: next } }))} />
            <NumberField label={t(language, "maxBuyIn")} value={value.poker.maxBuyIn} onChange={(next) => setValue((current) => ({ ...current, poker: { ...current.poker, maxBuyIn: next } }))} />
          </div>
          <fieldset className="denomination-editor">
            <legend>{t(language, "chipDenominations")}</legend>
            <div className="denomination-list">
              {value.poker.denominations.map((denomination, index) => (
                <div key={index} className="denomination-row">
                  <NumberField
                    label={`${t(language, "chipDenomination")} ${index + 1}`}
                    value={denomination}
                    onChange={(next) =>
                      setValue((current) => {
                        const denominations = [...current.poker.denominations];
                        denominations[index] = next;
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
                    disabled={value.poker.denominations.length <= 1}
                    onClick={() =>
                      setValue((current) => ({
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
              disabled={value.poker.denominations.length >= 16}
              onClick={() =>
                setValue((current) => {
                  const maximum = Math.max(...current.poker.denominations, 0);
                  return {
                    ...current,
                    poker: {
                      ...current.poker,
                      denominations: [
                        ...current.poker.denominations,
                        maximum === 0 ? 1 : maximum + 1
                      ]
                    }
                  };
                })
              }
            >
              ＋ {t(language, "addDenomination")}
            </button>
            {denominationError && (
              <p className="error" role="alert">{denominationError}</p>
            )}
          </fieldset>
        </CollapsibleCard>
      </div>
    </Modal>
  );
}

export function SeasonModal({
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
    <Modal
      language={language}
      title={t(language, "newSeason")}
      onClose={onClose}
      narrow
      footer={
        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>
            {t(language, "cancel")}
          </button>
          <button
            className="primary"
            disabled={!confirmed}
            onClick={() => void onConfirm(name, baseScore)}
          >
            {t(language, "confirm")}
          </button>
        </div>
      }
    >
      <p className="warning">{t(language, "seasonImpact")}</p>
      <div className="form-stack">
        <label>{t(language, "seasonName")}<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <NumberField label={t(language, "baseScore")} value={baseScore} onChange={setBaseScore} />
        <label className="confirm-check">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          {t(language, "confirm")}
        </label>
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
  onSave: (
    username: string,
    avatar: string,
    language: Language,
    theme: ThemeMode,
    volume: number
  ) => Promise<void>;
}) {
  const [username, setUsername] = useState(account.username);
  const [avatar, setAvatar] = useState(account.avatar);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [nextLanguage, setNextLanguage] = useState(account.language);
  const [theme, setTheme] = useState(account.theme);
  const [volume, setVolume] = useState(account.volume);
  const [busy, setBusy] = useState(false);
  const avatarSelectable = avatars.includes(avatar);
  return (
    <Modal
      language={language}
      title={t(language, "profile")}
      onClose={onClose}
      className="profile-modal"
      footer={
        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            onClick={onSwitch}
          >
            {t(language, "switchAccount")}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!avatarSelectable || busy}
            onClick={() => {
              setBusy(true);
              void onSave(
                username,
                avatar,
                nextLanguage,
                theme,
                volume
              ).finally(() => setBusy(false));
            }}
          >
            {busy ? t(language, "loading") : t(language, "updateProfile")}
          </button>
        </div>
      }
    >
      <div className="form-stack">
        <div className="profile-identity-fields">
          <label>
            {t(language, "username")}
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            {t(language, "chooseAvatar")}
            <button
              type="button"
              className="avatar-current"
              aria-label={t(language, "chooseAvatar")}
              aria-expanded={avatarOpen}
              onClick={() => setAvatarOpen((current) => !current)}
            >
              <b aria-hidden="true">{avatarSelectable ? avatar : fallbackAvatar}</b>
              <ArrowIcon direction={avatarOpen ? "down" : "right"} />
            </button>
          </label>
        </div>
        {avatarOpen && (
          <div className="avatar-grid" role="listbox" aria-label={t(language, "chooseAvatar")}>
            {avatars.map((item) => (
              <button
                type="button"
                role="option"
                key={item}
                className={avatar === item ? "avatar selected" : "avatar"}
                aria-label={`avatar-${item}`}
                aria-selected={avatar === item}
                onClick={() => {
                  setAvatar(item);
                  setAvatarOpen(false);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
        {!avatarSelectable && (
          <p className="warning" role="status">
            {fallbackAvatar} {t(language, "chooseReplacementAvatar")}
          </p>
        )}
        <div className="setting-row">
          <span>{t(language, "accountLanguage")}</span>
          <LanguageToggle
            language={nextLanguage}
            setLanguage={setNextLanguage}
          />
        </div>
        <div className="setting-row">
          <span>{t(language, "accountTheme")}</span>
          <ThemeToggle
            mode={theme}
            onChange={setTheme}
            lightLabel={t(language, "lightTheme")}
            darkLabel={t(language, "darkTheme")}
            groupLabel={t(language, "themeSelection")}
          />
        </div>
        <label className="volume-field">
          <span>
            {t(language, "volume")} <strong>{volume}</strong>
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            aria-valuetext={`${volume}%`}
            onChange={(event) => setVolume(Number(event.target.value))}
          />
        </label>
      </div>
    </Modal>
  );
}

function RoomView({
  language,
  session,
  room,
  pushNotice,
  volume,
  command,
  onLobby
}: {
  language: Language;
  session: Session;
  room: RoomProjection;
  pushNotice: (notice: string) => void;
  volume: number;
  command: CommandFunction;
  onLobby: () => void;
}) {
  const host = room.hostAccountId === session.account.id;
  const run = async (type: string, payload: Record<string, unknown> = {}) => {
    try {
      await command(type, { roomId: room.id, ...payload }, room.id);
      return true;
    } catch (reason) {
      pushNotice(errorMessage(language, reason));
      return false;
    }
  };
  if (room.gameType === "avalon") {
    return (
      <AvalonRoomView
        language={language}
        account={session.account}
        room={room}
        volume={volume}
        run={run}
        onLobby={onLobby}
      />
    );
  }
  if (room.status === "waiting") {
    return (
      <WaitingRoom
        language={language}
        session={session}
        room={room}
        host={host}
        run={run}
        onLobby={onLobby}
      />
    );
  }
  if (room.viewerRole === "spectator") {
    return (
      <SpectatorTable
        language={language}
        session={session}
        room={room}
        host={host}
        run={run}
        onLobby={onLobby}
      />
    );
  }
  return (
    <PlayerTable
      language={language}
      session={session}
      room={room}
      host={host}
      volume={volume}
      run={run}
      onLobby={onLobby}
    />
  );
}

function WaitingRoom({
  language,
  session,
  room,
  host,
  run,
  onLobby
}: {
  language: Language;
  session: Session;
  room: PokerRoomProjection;
  host: boolean;
  run: (type: string, payload?: Record<string, unknown>) => Promise<boolean>;
  onLobby: () => void;
}) {
  const [selectedMember, setSelectedMember] = useState<
    PublicSeatProjection | null
  >(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmation, setConfirmation] = useState<
    | { kind: "kick"; member: PublicSeatProjection }
    | { kind: "leave" | "close" | "start" }
    | null
  >(null);
  useMemberMenuValidity(room, host, selectedMember, setSelectedMember);
  const memberMenuGesture = useContextMenuGesture((accountId, anchor) => {
    const member = room.seats.find(
      (candidate) => candidate.accountId === accountId
    );
    if (host && member && member.accountId !== session.account.id) {
      setMenuAnchor(anchor);
      setSelectedMember(member);
    }
  });
  const ready = new Set(room.readyAccountIds ?? []);
  const currentReady = ready.has(session.account.id);
  const eligibleReady = room.seats.filter(
    (seat) =>
      seat.accountId !== room.hostAccountId &&
      ready.has(seat.accountId) &&
      seat.connected &&
      seat.tableChips > 0
  );
  const unreadyMembers = room.seats.filter(
    (seat) =>
      seat.accountId !== room.hostAccountId &&
      !eligibleReady.some((candidate) => candidate.accountId === seat.accountId)
  );
  const hostSeat = room.seats.find(
    (seat) => seat.accountId === room.hostAccountId
  );
  const canStart = Boolean(
    host &&
    hostSeat?.connected &&
    (hostSeat.tableChips ?? 0) > 0 &&
    eligibleReady.length > 0
  );

  const start = () => {
    if (!canStart) return;
    if (unreadyMembers.length > 0) {
      setConfirmation({ kind: "start" });
      return;
    }
    void run("room.start", { gameType: "texas-holdem" });
  };

  return (
    <main className="app-shell poker-waiting-shell">
      <RoomHeader
        roomName={room.name}
        gameLabel={t(language, "poker")}
        phaseLabel={t(language, "waiting")}
        backLabel={t(language, "backLobby")}
        leaveLabel={t(language, "leaveRoom")}
        closeLabel={t(language, "endGame")}
        onBack={onLobby}
        onLeave={() => setConfirmation({ kind: "leave" })}
        onClose={
          host ? () => setConfirmation({ kind: "close" }) : undefined
        }
      />
      <section className="waiting-panel">
        <div className="room-summary">
          <strong>{room.mode === "chips-only" ? t(language, "chipsOnly") : t(language, "chipsCards")}</strong>
          <span>{room.config.smallBlind} / {room.config.bigBlind}</span>
        </div>
        <div className="waiting-seats" {...memberMenuGesture}>
          {room.seats.map((seat) => {
            const canManage = host && seat.accountId !== session.account.id;
            return (
            <article
              key={seat.accountId}
              className={canManage ? "member-menu-trigger" : undefined}
              data-context-menu-id={canManage ? seat.accountId : undefined}
              tabIndex={canManage ? 0 : undefined}
              role={canManage ? "group" : undefined}
              aria-label={
                canManage
                  ? `${seat.username} ${t(language, "memberActions")}`
                  : undefined
              }
              aria-haspopup={canManage ? "menu" : undefined}
              aria-expanded={
                canManage
                  ? selectedMember?.accountId === seat.accountId
                  : undefined
              }
            >
              <span className="member-avatar" aria-hidden="true">
                {seat.avatar}
              </span>
              <div><strong>{seat.username}</strong><small>{seat.tableChips.toLocaleString()} {t(language, "score")}</small></div>
              {seat.accountId === room.hostAccountId && <em>{t(language, "host")}</em>}
              {ready.has(seat.accountId) && seat.accountId !== room.hostAccountId && (
                <em>✓ {t(language, "readyDone")}</em>
              )}
              <small className={seat.connected ? "online" : "offline"}>
                {seat.connected ? t(language, "online") : t(language, "offline")}
              </small>
            </article>
            );
          })}
        </div>
        <MemberActionsMenu
          language={language}
          anchor={menuAnchor}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onTransfer={(member) =>
            void run("room.transfer-host", {
              targetAccountId: member.accountId
            })
          }
          onRemove={(member) =>
            setConfirmation({ kind: "kick", member })
          }
        />
        <div className="room-footer-actions">
          {host && (
            <button className="primary" disabled={!canStart} onClick={start}>
              {t(language, "startGame")}
            </button>
          )}
          {!host && (
            <button
              className={currentReady ? "secondary" : "primary"}
              disabled={
                !room.seats.find(
                  (seat) => seat.accountId === session.account.id
                )?.connected
              }
              onClick={() =>
                void run("poker.ready", { ready: !currentReady })
              }
            >
              {currentReady
                ? t(language, "cancelReady")
                : t(language, "ready")}
            </button>
          )}
        </div>
      </section>
      {confirmation?.kind === "kick" && (
        <ConfirmDialog
          title={t(language, "confirmRemoveTitle")}
          description={t(language, "confirmRemoveDescription").replace(
            "{name}",
            confirmation.member.username
          )}
          confirmLabel={t(language, "removePlayer")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const member = confirmation.member;
            setConfirmation(null);
            void run("room.remove", {
              targetAccountId: member.accountId,
              confirmed: true
            });
          }}
        />
      )}
      {confirmation?.kind === "leave" && (
        <ConfirmDialog
          title={t(language, "confirmLeaveTitle")}
          description={
            host
              ? t(language, "confirmHostLeaveDescription")
              : t(language, "confirmLeaveDescription")
          }
          confirmLabel={t(language, "leaveRoom")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            void run("room.leave", { confirmed: true });
          }}
        />
      )}
      {confirmation?.kind === "close" && (
        <ConfirmDialog
          title={t(language, "confirmCloseTitle")}
          description={t(language, "confirmCloseDescription")}
          confirmLabel={t(language, "endGame")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            void run("room.close");
          }}
        />
      )}
      {confirmation?.kind === "start" && (
        <ConfirmDialog
          title={t(language, "confirmStartTitle")}
          description={t(language, "confirmStartDescription").replace(
            "{count}",
            String(unreadyMembers.length)
          )}
          confirmLabel={t(language, "startGame")}
          cancelLabel={t(language, "cancel")}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            void run("room.start", {
              gameType: "texas-holdem",
              confirmUnready: true
            });
          }}
        />
      )}
    </main>
  );
}

function useMemberMenuValidity(
  room: PokerRoomProjection,
  host: boolean,
  member: PublicSeatProjection | null,
  setMember: (member: PublicSeatProjection | null) => void
) {
  useEffect(() => {
    if (
      member &&
      (
        !host ||
        !room.seats.some((seat) => seat.accountId === member.accountId)
      )
    ) {
      setMember(null);
    }
  }, [host, member, room.seats, setMember]);
}

function MemberActionsMenu({
  language,
  anchor,
  member,
  onClose,
  onTransfer,
  onRemove
}: {
  language: Language;
  anchor: HTMLElement | null;
  member: PublicSeatProjection | null;
  onClose: () => void;
  onTransfer: (member: PublicSeatProjection) => void;
  onRemove: (member: PublicSeatProjection) => void;
}) {
  return (
    <AnchoredMenu
      anchor={anchor}
      open={Boolean(member)}
      label={t(language, "memberActions")}
      onClose={onClose}
    >
      {member && (
        <>
          <strong className="anchored-menu-title">
            {member.avatar} {member.username}
          </strong>
          <button
            role="menuitem"
            className="text-button"
            disabled={!member.connected}
            onClick={() => {
              onClose();
              onTransfer(member);
            }}
          >
            {t(language, "transferHost")}
          </button>
          <button
            role="menuitem"
            className="text-button danger-text"
            onClick={() => {
              onClose();
              onRemove(member);
            }}
          >
            {t(language, "removePlayer")}
          </button>
        </>
      )}
    </AnchoredMenu>
  );
}

function SpectatorTable({
  language,
  session,
  room,
  host,
  run,
  onLobby
}: {
  language: Language;
  session: Session;
  room: PokerRoomProjection;
  host: boolean;
  run: (type: string, payload?: Record<string, unknown>) => Promise<boolean>;
  onLobby: () => void;
}) {
  const [selectedMember, setSelectedMember] = useState<
    PublicSeatProjection | null
  >(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmation, setConfirmation] = useState<
    | { kind: "kick"; member: PublicSeatProjection }
    | { kind: "leave" | "close" }
    | null
  >(null);
  useMemberMenuValidity(room, host, selectedMember, setSelectedMember);

  return (
    <main className={`display-shell suit-theme-${room.suitColorPreset}`}>
      <RoomHeader
        roomName={room.name}
        gameLabel={t(language, "poker")}
        phaseLabel={phaseLabel(language, room.phase)}
        backLabel={t(language, "backLobby")}
        leaveLabel={t(language, "leaveRoom")}
        closeLabel={t(language, "endGame")}
        onBack={onLobby}
        onLeave={() => setConfirmation({ kind: "leave" })}
        onClose={
          host ? () => setConfirmation({ kind: "close" }) : undefined
        }
      />
      <PublicTableSurface
        language={language}
        room={room}
        activeMemberId={selectedMember?.accountId}
        memberMenuDisabledId={session.account.id}
        onMemberMenu={
          host
            ? (member, anchor) => {
                if (member.accountId !== session.account.id) {
                  setMenuAnchor(anchor);
                  setSelectedMember(member);
                }
              }
            : undefined
        }
      />
      <MemberActionsMenu
        language={language}
        anchor={menuAnchor}
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onTransfer={(member) =>
          void run("room.transfer-host", {
            targetAccountId: member.accountId
          })
        }
        onRemove={(member) => setConfirmation({ kind: "kick", member })}
      />
      {confirmation?.kind === "kick" && (
        <ConfirmDialog
          title={t(language, "confirmRemoveTitle")}
          description={t(language, "confirmRemoveDescription").replace(
            "{name}",
            confirmation.member.username
          )}
          confirmLabel={t(language, "removePlayer")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const member = confirmation.member;
            setConfirmation(null);
            void run("room.remove", {
              targetAccountId: member.accountId,
              confirmed: true
            });
          }}
        />
      )}
      {confirmation?.kind === "leave" && (
        <ConfirmDialog
          title={t(language, "confirmLeaveTitle")}
          description={
            host
              ? t(language, "confirmHostLeaveDescription")
              : t(language, "confirmLeaveDescription")
          }
          confirmLabel={t(language, "leaveRoom")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            void run("room.leave", { confirmed: true });
          }}
        />
      )}
      {confirmation?.kind === "close" && (
        <ConfirmDialog
          title={t(language, "confirmCloseTitle")}
          description={t(language, "confirmCloseDescription")}
          confirmLabel={t(language, "endGame")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            void run("room.close");
          }}
        />
      )}
    </main>
  );
}

function PlayerTable({
  language,
  session,
  room,
  host,
  volume,
  run,
  onLobby
}: {
  language: Language;
  session: Session;
  room: PokerRoomProjection;
  host: boolean;
  volume: number;
  run: (type: string, payload?: Record<string, unknown>) => Promise<boolean>;
  onLobby: () => void;
}) {
  const [cache, setCache] = useState<Record<string, number>>({});
  const [holeCardsVisible, setHoleCardsVisible] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<
    PublicSeatProjection | null
  >(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmation, setConfirmation] = useState<
    | { kind: "kick"; member: PublicSeatProjection }
    | { kind: "leave" | "close" | "start" }
    | null
  >(null);
  useMemberMenuValidity(room, host, selectedMember, setSelectedMember);
  const memberMenuGesture = useContextMenuGesture((accountId, anchor) => {
    const member = room.seats.find(
      (candidate) => candidate.accountId === accountId
    );
    if (host && member && member.accountId !== session.account.id) {
      setMenuAnchor(anchor);
      setSelectedMember(member);
    }
  });
  const seat = room.seats.find((candidate) => candidate.accountId === session.account.id);
  const denominations = room.effectiveDenominations;
  const authorityKey = JSON.stringify([
    room.id,
    room.status,
    room.phase,
    room.pokerVersion,
    room.actingAccountId,
    room.currentBet,
    room.minimumRaise,
    seat?.tableChips,
    seat?.currentBet
  ]);
  const previousAuthority = useRef(authorityKey);
  const total = Object.entries(cache).reduce(
    (sum, [value, count]) => sum + Number(value) * count,
    0
  );
  const cacheSize = Object.values(cache).reduce(
    (sum, count) => sum + count,
    0
  );
  const cachedDenominations = denominations.filter(
    (chip) => (cache[String(chip)] ?? 0) > 0
  );
  const canAct = room.status === "in_progress" && room.actingAccountId === session.account.id;
  const pendingHandStart = new Set(room.pendingHandStartAccountIds ?? []);
  const blindPosted = new Set(room.blindPostedAccountIds ?? []);
  const handStartConfirmed = new Set(
    room.handStartConfirmedAccountIds ?? []
  );
  const ownBlind =
    session.account.id === room.smallBlindAccountId
      ? "small"
      : session.account.id === room.bigBlindAccountId
        ? "big"
        : undefined;
  const ownBlindPosted = ownBlind
    ? blindPosted.has(session.account.id)
    : true;
  const ownHandStartConfirmed = handStartConfirmed.has(session.account.id);
  const showHandStartCard =
    room.phase === "blinds" &&
    seat?.role === "participant" &&
    !seat.folded;
  const canConfirmHandStart =
    showHandStartCard &&
    !ownHandStartConfirmed &&
    ownBlindPosted;
  const canViewHoleCards =
    room.mode === "chips-and-cards" &&
    Boolean(room.ownHoleCards?.length) &&
    ownHandStartConfirmed &&
    !["complete", "void"].includes(room.phase ?? "");
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
  const readyAccountIds = new Set(room.readyAccountIds ?? []);
  const eligibleReady = room.seats.filter(
    (entry) =>
      entry.accountId !== room.hostAccountId &&
      readyAccountIds.has(entry.accountId) &&
      entry.connected &&
      entry.tableChips > 0
  );
  const unreadyMembers = room.seats.filter(
    (entry) =>
      entry.accountId !== room.hostAccountId &&
      !eligibleReady.some(
        (candidate) => candidate.accountId === entry.accountId
      )
  );
  const hostSeat = room.seats.find(
    (entry) => entry.accountId === room.hostAccountId
  );
  const canStartNext = Boolean(
    host &&
    room.phase === "complete" &&
    room.status === "in_progress" &&
    hostSeat?.connected &&
    (hostSeat.tableChips ?? 0) > 0 &&
    eligibleReady.length > 0
  );
  const confirmLabel = isCall
    ? t(language, "confirmCall")
    : (room.currentBet ?? 0) === 0
      ? t(language, "confirmBet")
      : t(language, "confirmRaise");
  useEffect(() => {
    if (
      cacheSize > 0 &&
      authorityKey !== previousAuthority.current
    ) {
      setCache({});
    }
    previousAuthority.current = authorityKey;
  }, [authorityKey, cacheSize]);

  useEffect(() => {
    setHoleCardsVisible(false);
  }, [
    room.id,
    room.handNumber,
    room.phase,
    room.pokerVersion,
    room.status,
    seat?.connected,
    session.account.id,
    session.connectionId
  ]);

  useEffect(() => {
    if (!holeCardsVisible) return;
    const cover = () => setHoleCardsVisible(false);
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") cover();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") cover();
    };
    window.addEventListener("pointerup", cover);
    window.addEventListener("pointercancel", cover);
    window.addEventListener("blur", cover);
    window.addEventListener("offline", cover);
    window.addEventListener("pagehide", cover);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pointerup", cover);
      window.removeEventListener("pointercancel", cover);
      window.removeEventListener("blur", cover);
      window.removeEventListener("offline", cover);
      window.removeEventListener("pagehide", cover);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [holeCardsVisible]);

  useEffect(() => {
    if (!canViewHoleCards) setHoleCardsVisible(false);
  }, [canViewHoleCards]);

  useEffect(() => {
    if (!room.phase) return;
    playTone(volume);
  }, [room.phase, volume]);

  const submitAction = async (kind: string, amount?: number) => {
    await run("poker.action", {
      pokerVersion: room.pokerVersion,
      action: amount === undefined ? { kind } : { kind, amount }
    });
    setCache({});
  };

  const confirm = async () => {
    if (!legalAmount) return;
    if (isAllIn) await submitAction("all-in");
    else if (isCall) await submitAction("call");
    else if ((room.currentBet ?? 0) === 0) await submitAction("bet", target);
    else await submitAction("raise", target);
  };

  const startNextHand = () => {
    if (!canStartNext) return;
    if (unreadyMembers.length > 0) {
      setConfirmation({ kind: "start" });
      return;
    }
    void run("room.start", {
      gameType: "texas-holdem",
      pokerVersion: room.pokerVersion
    });
  };

  return (
    <main className={`table-shell suit-theme-${room.suitColorPreset}`}>
      <RoomHeader
        roomName={room.name}
        gameLabel={t(language, "poker")}
        phaseLabel={phaseLabel(language, room.phase)}
        backLabel={t(language, "backLobby")}
        leaveLabel={t(language, "leaveRoom")}
        closeLabel={t(language, "endGame")}
        onBack={onLobby}
        onLeave={() => setConfirmation({ kind: "leave" })}
        leaveDisabled={!host && room.phase !== "complete"}
        onClose={
          host ? () => setConfirmation({ kind: "close" }) : undefined
        }
      />
      <section
        className="poker-felt"
        aria-label={t(language, "poker")}
        {...memberMenuGesture}
      >
        <div className="table-seats">
          {room.seats.filter((entry) => entry.role === "participant").map((entry) => {
            const canManage = host && entry.accountId !== session.account.id;
            const isSelf = entry.accountId === session.account.id;
            const isActing = entry.accountId === room.actingAccountId;
            const needsHandStart = pendingHandStart.has(entry.accountId);
            const actionStatus = needsHandStart
              ? t(language, "handStartPending")
              : isActing
                ? t(language, "currentAction")
                : handStartConfirmed.has(entry.accountId)
                  ? t(language, "handStartConfirmed")
                  : "";
            return (
            <article
              key={entry.accountId}
              className={[
                "player-seat",
                isActing || needsHandStart ? "needs-action" : "",
                isSelf ? "is-self" : "",
                canManage ? "member-menu-trigger" : ""
              ].filter(Boolean).join(" ")}
              data-context-menu-id={canManage ? entry.accountId : undefined}
              tabIndex={canManage ? 0 : undefined}
              role={canManage ? "group" : undefined}
              aria-label={[
                entry.username,
                isSelf ? t(language, "you") : "",
                actionStatus,
                canManage ? t(language, "memberActions") : ""
              ].filter(Boolean).join(" · ")}
              aria-haspopup={canManage ? "menu" : undefined}
              aria-expanded={
                canManage
                  ? selectedMember?.accountId === entry.accountId
                  : undefined
              }
            >
              <span className="member-avatar" aria-hidden="true">
                {entry.avatar}
              </span>
              <span className="poker-seat-identity">
                <b>{entry.username}{entry.accountId === room.hostAccountId ? " ★" : ""}</b>
                <small className={entry.connected ? "online" : "offline"}>
                  {entry.connected ? t(language, "online") : t(language, "offline")}
                </small>
              </span>
              <span className="seat-values">
                <small>
                  <span>{t(language, "remainingChips")}</span>
                  <strong>{entry.tableChips.toLocaleString()}</strong>
                </small>
                <small>
                  <span>{t(language, "roundBet")}</span>
                  <strong>{entry.currentBet.toLocaleString()}</strong>
                </small>
              </span>
              {(isSelf || actionStatus) && (
                <span className="poker-seat-badges">
                  {isSelf && <b>{t(language, "you")}</b>}
                  {actionStatus && <b>{actionStatus}</b>}
                </span>
              )}
              {entry.position === room.dealerPosition && (
                <em className="dealer-marker" aria-label={t(language, "dealer")}>D</em>
              )}
              {entry.folded && <em>{t(language, "fold")}</em>}
            </article>
            );
          })}
        </div>
        {room.seats.some((entry) => entry.role === "spectator") && (
          <div className="spectator-strip" aria-label={t(language, "spectators")}>
            <strong>{t(language, "spectators")}</strong>
            {room.seats
              .filter((entry) => entry.role === "spectator")
              .map((entry) => (
                <div
                  key={entry.accountId}
                  className={`spectator-chip${host ? " member-menu-trigger" : ""}`}
                  data-context-menu-id={host ? entry.accountId : undefined}
                  tabIndex={host ? 0 : undefined}
                  role={host ? "group" : undefined}
                  aria-label={
                    host
                      ? `${entry.username} ${t(language, "memberActions")}`
                      : undefined
                  }
                  aria-haspopup={host ? "menu" : undefined}
                  aria-expanded={
                    host
                      ? selectedMember?.accountId === entry.accountId
                      : undefined
                  }
                >
                  <span
                    className="member-avatar compact-avatar"
                    aria-hidden="true"
                  >
                    {entry.avatar}
                  </span>
                  <span>{entry.username}</span>
                </div>
              ))}
          </div>
        )}
        <MemberActionsMenu
          language={language}
          anchor={menuAnchor}
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onTransfer={(member) =>
            void run("room.transfer-host", {
              targetAccountId: member.accountId
            })
          }
          onRemove={(member) =>
            setConfirmation({ kind: "kick", member })
          }
        />
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
        {showHandStartCard && (
          <section
            className={`poker-hand-start-card${
              pendingHandStart.has(session.account.id)
                ? " needs-action"
                : " is-complete"
            }`}
            aria-label={t(language, "handStartPending")}
          >
            {ownBlind && !ownBlindPosted ? (
              <>
                <strong>
                  {t(
                    language,
                    ownBlind === "small"
                      ? "smallBlindPrompt"
                      : "bigBlindPrompt"
                  )}
                </strong>
                <button
                  type="button"
                  className="primary"
                  disabled={!seat?.connected}
                  onClick={() =>
                    void run("poker.blind.post", {
                      pokerVersion: room.pokerVersion
                    })
                  }
                >
                  {t(language, "postBlind").replace(
                    "{amount}",
                    String(
                      Math.min(
                        ownBlind === "small"
                          ? room.config.smallBlind
                          : room.config.bigBlind,
                        seat?.tableChips ?? 0
                      )
                    )
                  )}
                </button>
              </>
            ) : ownHandStartConfirmed ? (
              <>
                <strong>{t(language, "handStartReady")}</strong>
                <small>{t(language, "handStartConfirmed")}</small>
              </>
            ) : (
              <>
                {ownBlind && (
                  <small className="poker-blind-posted">
                    ✓ {t(language, "blindPosted")}
                  </small>
                )}
                {room.mode === "chips-and-cards" &&
                  room.ownHoleCards &&
                  room.ownHoleCards.length > 0 && (
                    <div
                      className="poker-hand-start-cards"
                      aria-label={t(language, "myCards")}
                    >
                      {room.ownHoleCards.map((card, index) => (
                        <PlayingCard key={index} card={card} compact />
                      ))}
                    </div>
                  )}
                <button
                  type="button"
                  className="primary"
                  disabled={!canConfirmHandStart || !seat?.connected}
                  onClick={() =>
                    void run("poker.hand-start.confirm", {
                      pokerVersion: room.pokerVersion
                    })
                  }
                >
                  {t(
                    language,
                    room.mode === "chips-and-cards"
                      ? "confirmHoleCards"
                      : "confirmPhysicalCards"
                  )}
                </button>
              </>
            )}
          </section>
        )}
        <div className="board">
          <p>{phaseLabel(language, room.phase)} · {formatTemplate(t(language, "hand"), room.handNumber ?? 1)}</p>
          {room.mode === "chips-and-cards" && (
            <div className="cards" aria-label={t(language, "communityCards")}>
              {(room.communityCards ?? []).map((card, index) => (
                <PlayingCard key={index} card={card} />
              ))}
            </div>
          )}
          <div className="pot"><small>{t(language, "pot")}</small><strong>{room.potTotal.toLocaleString()}</strong></div>
          {room.advanceDeadline && (
            <CountdownTimer
              key={room.advanceDeadline}
              deadline={room.advanceDeadline}
              language={language}
            />
          )}
        </div>
        {holeCardsVisible &&
          canViewHoleCards &&
          room.ownHoleCards && (
            <div
              className="hole-card-reveal-layer"
              role="status"
              aria-label={t(language, "holeCardsRevealed")}
            >
              <div className="hole-card-reveal-cards">
                {room.ownHoleCards.map((card, index) => (
                  <PlayingCard key={index} card={card} />
                ))}
              </div>
            </div>
          )}
        {canAct && (
          <div
            className="bet-cache felt-bet-cache"
            aria-label={t(language, "betCache")}
            aria-live="polite"
          >
            <div className="cache-chips">
              {cachedDenominations.map((chip) => {
                const count = cache[String(chip)]!;
                return (
                  <span
                    key={chip}
                    className="cache-chip-slot"
                  >
                    <button
                      type="button"
                      className="poker-chip"
                      style={chipStyle(chip, denominations)}
                      aria-label={`${t(language, "removeChip").replace(
                        "{amount}",
                        chip.toLocaleString()
                      )} × ${count}`}
                      onClick={() =>
                        setCache((current) => removeChip(current, chip))
                      }
                    >
                      <span className="cache-chip-value">{chip.toLocaleString()}</span>
                      {count > 1 && <small className="cache-chip-count">×{count}</small>}
                    </button>
                  </span>
                );
              })}
            </div>
            <strong>{total.toLocaleString()}</strong>
            <button
              type="button"
              className="text-button"
              onClick={() => setCache({})}
            >
              {t(language, "clear")}
            </button>
          </div>
        )}
      </section>
      {room.phase === "complete" && room.lastResult && (
        <SettlementPanel
          language={language}
          room={room}
          currentAccountId={session.account.id}
          currentIsHost={host}
          onReady={
            host
              ? undefined
              : (nextReady) =>
                  void run("poker.ready", {
                    pokerVersion: room.pokerVersion,
                    ready: nextReady
                  })
          }
          onStart={host ? startNextHand : undefined}
          canStart={canStartNext}
          onTopUp={
            seat && seat.tableChips < room.config.maxBuyIn
              ? () => setTopUpOpen(true)
              : undefined
          }
          onUndo={
            host && room.mode === "chips-only"
              ? () => void run("poker.undo-settlement", {
                  pokerVersion: room.pokerVersion
                })
              : undefined
          }
        />
      )}
      <section className="action-dock">
        <div className="turn-line">
          <div><span className="pulse" />{canAct ? t(language, "yourTurn") : t(language, "notYourTurn")}</div>
          <div className="inline-actions">
            {room.lastAction?.accountId === session.account.id && room.lastAction.reversible && (
              <button className="text-button" onClick={() => void run("poker.undo", { pokerVersion: room.pokerVersion })}>
                {t(language, "undo")}
              </button>
            )}
            {canViewHoleCards && (
              <button
                type="button"
                className="secondary hole-card-peek-control"
                aria-label={`${t(language, "viewHoleCards")} · ${t(
                  language,
                  "holdToViewHint"
                )}`}
                aria-pressed={holeCardsVisible}
                onPointerDown={(event) => {
                  if (event.button === 0) setHoleCardsVisible(true);
                }}
                onPointerUp={() => setHoleCardsVisible(false)}
                onPointerCancel={() => setHoleCardsVisible(false)}
                onPointerLeave={() => setHoleCardsVisible(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setHoleCardsVisible(true);
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setHoleCardsVisible(false);
                  }
                }}
                onClick={(event) => {
                  event.preventDefault();
                  setHoleCardsVisible(false);
                }}
              >
                <strong>{t(language, "viewHoleCards")}</strong>
                <small>{t(language, "holdToViewHint")}</small>
              </button>
            )}
          </div>
        </div>
        {room.phase !== "complete" && <HandResultBanner language={language} room={room} />}
        {room.phase === "showdown" &&
          room.mode === "chips-only" &&
          room.status === "in_progress" &&
          host && (
          <WinnerPicker language={language} room={room} run={run} />
        )}
        <div
          className="chip-rack"
          aria-label={t(language, "chipDenominations")}
        >
          {denominations.map((value) => (
            <button
              type="button"
              key={value}
              className="poker-chip"
              style={chipStyle(value, denominations)}
              disabled={!canAct || total + value > (seat?.tableChips ?? 0)}
              onClick={() =>
                setCache((current) => addChip(current, value))
              }
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
              else setCache(amountToChipCounts(callAmount, denominations));
            }}
          >
            {callAmount === 0 ? t(language, "check") : t(language, "call")}
          </button>
          <button
            className="secondary"
            disabled={!canAct}
            onClick={() =>
              setCache(
                amountToChipCounts(seat?.tableChips ?? 0, denominations)
              )
            }
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
        </div>
      </section>
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
      {confirmation?.kind === "kick" && (
        <ConfirmDialog
          title={t(language, "confirmRemoveTitle")}
          description={t(language, "confirmRemoveDescription").replace(
            "{name}",
            confirmation.member.username
          )}
          confirmLabel={t(language, "removePlayer")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            const member = confirmation.member;
            setConfirmation(null);
            void run("room.remove", {
              targetAccountId: member.accountId,
              confirmed: true
            });
          }}
        />
      )}
      {confirmation?.kind === "leave" && (
        <ConfirmDialog
          title={t(language, "confirmLeaveTitle")}
          description={
            host
              ? t(language, "confirmHostLeaveDescription")
              : t(language, "confirmLeaveDescription")
          }
          confirmLabel={t(language, "leaveRoom")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            void run("room.leave", { confirmed: true });
          }}
        />
      )}
      {confirmation?.kind === "close" && (
        <ConfirmDialog
          title={t(language, "confirmCloseTitle")}
          description={t(language, "confirmCloseDescription")}
          confirmLabel={t(language, "endGame")}
          cancelLabel={t(language, "cancel")}
          danger
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            void run("room.close");
          }}
        />
      )}
      {confirmation?.kind === "start" && (
        <ConfirmDialog
          title={t(language, "confirmStartTitle")}
          description={t(language, "confirmStartDescription").replace(
            "{count}",
            String(unreadyMembers.length)
          )}
          confirmLabel={t(language, "startNextHand")}
          cancelLabel={t(language, "cancel")}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            setConfirmation(null);
            void run("room.start", {
              gameType: "texas-holdem",
              pokerVersion: room.pokerVersion,
              confirmUnready: true
            });
          }}
        />
      )}
    </main>
  );
}

function WinnerPicker({
  language,
  room,
  run
}: {
  language: Language;
  room: PokerRoomProjection;
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

function PublicTableSurface({
  language,
  room,
  activeMemberId,
  memberMenuDisabledId,
  onMemberMenu
}: {
  language: Language;
  room: PokerRoomProjection;
  activeMemberId?: string;
  memberMenuDisabledId?: string;
  onMemberMenu?: (
    member: PublicSeatProjection,
    anchor: HTMLElement
  ) => void;
}) {
  const participants = room.phase
    ? room.seats.filter((seat) => seat.role === "participant")
    : room.seats;
  const pendingHandStart = new Set(room.pendingHandStartAccountIds ?? []);
  const handStartConfirmed = new Set(
    room.handStartConfirmedAccountIds ?? []
  );
  const memberMenuGesture = useContextMenuGesture((accountId, anchor) => {
    const member = participants.find(
      (candidate) => candidate.accountId === accountId
    );
    if (member) onMemberMenu?.(member, anchor);
  });
  return (
    <section className="display-felt" {...memberMenuGesture}>
      <div className="display-seats">
        {participants.map((seat) => {
          const canManage = Boolean(
            onMemberMenu && seat.accountId !== memberMenuDisabledId
          );
          const isActing = seat.accountId === room.actingAccountId;
          const needsHandStart = pendingHandStart.has(seat.accountId);
          const actionStatus = needsHandStart
            ? t(language, "handStartPending")
            : isActing
              ? t(language, "currentAction")
              : handStartConfirmed.has(seat.accountId)
                ? t(language, "handStartConfirmed")
                : "";
          return (
          <article
            key={seat.accountId}
            className={[
              isActing || needsHandStart ? "needs-action" : "",
              canManage ? "member-menu-trigger" : ""
            ].filter(Boolean).join(" ")}
            data-context-menu-id={canManage ? seat.accountId : undefined}
            tabIndex={canManage ? 0 : undefined}
            role={canManage ? "group" : undefined}
            aria-label={[
              seat.username,
              actionStatus,
              canManage ? t(language, "memberActions") : ""
            ].filter(Boolean).join(" · ")}
            aria-haspopup={canManage ? "menu" : undefined}
            aria-expanded={
              canManage ? activeMemberId === seat.accountId : undefined
            }
          >
            <span className="member-avatar" aria-hidden="true">
              {seat.avatar}
            </span>
            <b>{seat.username}</b>
            <span className="seat-values">
              <small>
                <span>{t(language, "remainingChips")}</span>
                <strong>{seat.tableChips.toLocaleString()}</strong>
              </small>
              <small>
                <span>{t(language, "roundBet")}</span>
                <strong>{seat.currentBet.toLocaleString()}</strong>
              </small>
            </span>
            {actionStatus && (
              <span className="poker-seat-badges">
                <b>{actionStatus}</b>
              </span>
            )}
            {seat.position === room.dealerPosition && (
              <em className="dealer-marker" aria-label={t(language, "dealer")}>D</em>
            )}
          </article>
          );
        })}
      </div>
      <div className="display-board">
        {room.mode === "chips-and-cards" && (
          <div className="cards" data-testid="community-cards">
            {(room.communityCards ?? []).map((card, index) => (
              <PlayingCard key={index} card={card} />
            ))}
          </div>
        )}
        <p>{phaseLabel(language, room.phase)}</p>
        <div className="pot"><small>{t(language, "pot")}</small><strong>{room.potTotal.toLocaleString()}</strong></div>
        {room.phase !== "complete" && (
          <HandResultBanner language={language} room={room} />
        )}
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
      {room.phase === "complete" && room.lastResult && (
        <SettlementPanel language={language} room={room} display />
      )}
    </section>
  );
}

function PublicDisplay({
  language,
  roomId,
  themeMode
}: {
  language: Language;
  roomId: string;
  themeMode: ThemeMode;
}) {
  const [room, setRoom] = useState<RoomProjection | null>(null);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    applyProductTheme(
      room?.gameType === "avalon" ? "avalon" : "poker",
      themeMode
    );
  }, [room?.gameType, themeMode]);

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
  if (room.gameType === "avalon") {
    return <AvalonPublicDisplay language={language} room={room} />;
  }
  return (
    <main className={`display-shell suit-theme-${room.suitColorPreset}`}>
      <header className="display-header">
        <div>
          <p className="eyebrow">{t(language, "display")}</p>
          <h1>{room.name}</h1>
          <span>{t(language, "displayReadonly")}</span>
        </div>
      </header>
      <PublicTableSurface language={language} room={room} />
    </main>
  );
}

function Modal({
  language,
  title,
  onClose,
  narrow,
  className = "",
  footer,
  children
}: {
  language: Language;
  title: string;
  onClose: () => void;
  narrow?: boolean;
  className?: string;
  footer?: React.ReactNode;
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
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal ${narrow ? "narrow" : ""} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-title">
          <div><p className="eyebrow">HOME TABLE</p><h2>{title}</h2></div>
          <button ref={closeRef} className="icon-button" aria-label={t(language, "close")} onClick={onClose}>×</button>
        </div>
        <div className="modal-scroll-region">{children}</div>
        {footer !== undefined && (
          <div className="modal-footer">{footer}</div>
        )}
      </section>
    </div>,
    document.body
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
        inputMode="numeric"
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
  room: PokerRoomProjection;
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

function SettlementPanel({
  language,
  room,
  currentAccountId,
  currentIsHost = false,
  onReady,
  onStart,
  canStart = false,
  onTopUp,
  onUndo,
  display = false
}: {
  language: Language;
  room: PokerRoomProjection;
  currentAccountId?: string;
  currentIsHost?: boolean;
  onReady?: (ready: boolean) => void;
  onStart?: () => void;
  canStart?: boolean;
  onTopUp?: () => void;
  onUndo?: () => void;
  display?: boolean;
}) {
  const result = room.lastResult;
  if (!result) return null;
  const payoutByAccount = new Map(
    result.payouts.map((payout) => [payout.accountId, payout.amount])
  );
  const players = result.playerResults ?? result.participantAccountIds.map((accountId) => {
    const seat = room.seats.find((candidate) => candidate.accountId === accountId);
    return {
      accountId,
      username: seat?.username ?? accountId,
      avatar: seat?.avatar ?? "•",
      chipDelta: payoutByAccount.get(accountId) ?? 0,
      endingChips: seat?.tableChips
    };
  });
  const ready = new Set(room.readyAccountIds ?? []);
  const currentSeat = room.seats.find(
    (seat) => seat.accountId === currentAccountId
  );
  const currentReady = Boolean(currentAccountId && ready.has(currentAccountId));
  const canToggleReady = Boolean(
    currentSeat &&
    currentSeat.connected &&
    currentSeat.tableChips > 0 &&
    room.status === "in_progress" &&
    !currentIsHost
  );
  const resultAccountIds = new Set(players.map((player) => player.accountId));
  const waitingMembers = room.seats.filter(
    (seat) => !resultAccountIds.has(seat.accountId)
  );
  return (
    <div className={`settlement-layer${display ? " display-settlement" : ""}`}>
      <section
        className="settlement-panel"
        role={display ? "status" : "dialog"}
        aria-label={t(language, "settlementTitle")}
      >
        <header>
          <div>
            <p className="eyebrow">{formatTemplate(t(language, "hand"), result.handNumber)}</p>
            <h2>{t(language, "settlementTitle")}</h2>
          </div>
          <span>{t(language, "waitingForReady")}</span>
        </header>
        <div className="settlement-player-list">
          {players.map((player) => {
            const seat = room.seats.find(
              (candidate) => candidate.accountId === player.accountId
            );
            const totalChips = seat?.tableChips ?? player.endingChips;
            return (
              <article key={player.accountId}>
                <span className="result-avatar">{player.avatar}</span>
                <div>
                  <strong>{player.username}</strong>
                  {seat && (
                    <small className={ready.has(player.accountId) ? "ready" : ""}>
                      {player.accountId === room.hostAccountId
                        ? t(language, "hostReadyImplicit")
                        : ready.has(player.accountId)
                        ? `✓ ${t(language, "readyDone")}`
                        : t(language, "waitingForReady")}
                    </small>
                  )}
                </div>
                <div className="settlement-chip-summary">
                  <b className={player.chipDelta >= 0 ? "chip-positive" : "chip-negative"}>
                    {player.chipDelta >= 0 ? "+" : ""}
                    {player.chipDelta.toLocaleString()}
                  </b>
                  <small>
                    {t(language, "totalChips")}{" "}
                    {totalChips === undefined ? "—" : totalChips.toLocaleString()}
                  </small>
                </div>
              </article>
            );
          })}
          {waitingMembers.map((member) => (
            <article key={member.accountId} className="waiting-member">
              <span className="result-avatar">{member.avatar}</span>
              <div>
                <strong>{member.username}</strong>
                <small className={ready.has(member.accountId) ? "ready" : ""}>
                  {member.accountId === room.hostAccountId
                    ? t(language, "hostReadyImplicit")
                    : ready.has(member.accountId)
                      ? `✓ ${t(language, "readyDone")}`
                      : t(language, "waitingForReady")}
                </small>
              </div>
              <div className="settlement-chip-summary">
                <small>{t(language, "spectator")}</small>
                <b>{member.tableChips.toLocaleString()}</b>
              </div>
            </article>
          ))}
        </div>
        {result.showdown && (
          <section className="showdown-summary">
            <div className="cards settlement-board" aria-label={t(language, "communityCards")}>
              {result.showdown.communityCards.map((card, index) => (
                <PlayingCard key={index} card={card} compact />
              ))}
            </div>
            <div className="showdown-player-list">
              {result.showdown.players.map((player) => {
                const profile = players.find(
                  (candidate) => candidate.accountId === player.accountId
                );
                return (
                  <article
                    key={player.accountId}
                    className={player.winner ? "winner" : ""}
                  >
                    <div>
                      <strong>{profile?.avatar} {profile?.username ?? player.accountId}</strong>
                      {player.winner && (
                        <small>
                          {t(language, "winner")} · {handCategoryLabel(language, player.handCategory)}
                        </small>
                      )}
                    </div>
                    <div className="showdown-cards">
                      {player.cards.map((card, index) => (
                        <PlayingCard key={index} card={card} compact />
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
        {!display && (
          <footer>
            {currentSeat && currentSeat.tableChips <= 0 && (
              <span className="ready-warning">{t(language, "needsTopUpToReady")}</span>
            )}
            <div className="settlement-actions">
              {onUndo && (
                <button className="secondary" onClick={onUndo}>
                  {t(language, "undoSettlement")}
                </button>
              )}
              {onTopUp && (
                <button className="secondary" onClick={onTopUp}>
                  {t(language, "topUp")}
                </button>
              )}
              {onReady && (
                <button
                  className={currentReady ? "secondary" : "primary"}
                  disabled={!canToggleReady}
                  onClick={() => onReady(!currentReady)}
                >
                  {currentReady
                    ? t(language, "cancelReady")
                    : t(language, "ready")}
                </button>
              )}
              {onStart && (
                <button
                  className="primary"
                  disabled={!canStart}
                  onClick={onStart}
                >
                  {t(language, "startNextHand")}
                </button>
              )}
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}

function PlayingCard({
  card,
  compact = false
}: {
  card: Card | { hidden: true };
  compact?: boolean;
}) {
  if ("hidden" in card) {
    return (
      <span className={`playing-card card-back${compact ? " compact-card" : ""}`}>
        🂠
      </span>
    );
  }
  const suits = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
  return (
    <span
      className={`playing-card suit-${card.suit}${compact ? " compact-card" : ""}`}
      data-suit={card.suit}
    >
      {card.rank}{suits[card.suit]}
    </span>
  );
}

function CountdownTimer({
  deadline,
  language
}: {
  deadline: number;
  language: Language;
}) {
  const label = useRef<HTMLElement>(null);
  const remaining = Math.max(0, deadline - Date.now());
  const progress = Math.min(1, remaining / 3_000);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const next = Math.max(0, deadline - Date.now());
      if (label.current) label.current.textContent = `${(next / 1_000).toFixed(1)}s`;
      if (next > 0) frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [deadline]);

  return (
    <div className="timer" aria-label={t(language, "countdown")}>
      <span
        className="timer-fill"
        style={{
          "--timer-duration": `${remaining}ms`,
          "--timer-start": progress
        } as React.CSSProperties}
      />
      <b ref={label}>{(remaining / 1_000).toFixed(1)}s</b>
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
    <Modal
      language={language}
      title={t(language, "topUp")}
      onClose={onClose}
      narrow
      footer={
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            {t(language, "cancel")}
          </button>
          <button
            className="primary"
            disabled={amount <= 0 || amount > maximum}
            form="top-up-form"
          >
            {t(language, "confirm")}
          </button>
        </div>
      }
    >
      <form
        id="top-up-form"
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void onConfirm(amount);
        }}
      >
        <NumberField label={`${t(language, "topUp")} (≤ ${maximum.toLocaleString()})`} value={amount} onChange={setAmount} />
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
    <div className="language-toggle" aria-label={t(language, "languageSelection")}>
      <button className={language === "zh-CN" ? "active" : ""} onClick={() => setLanguage("zh-CN")} type="button">中</button>
      <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")} type="button">EN</button>
    </div>
  );
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

function amountToChipCounts(
  amount: number,
  denominations: readonly number[]
): Record<string, number> {
  const result: Record<string, number> = {};
  let remaining = amount;
  for (const denomination of [...denominations].reverse()) {
    const count = Math.floor(remaining / denomination);
    if (count > 0) {
      result[String(denomination)] = count;
      remaining -= denomination * count;
    }
  }
  return result;
}

function addChip(
  current: Record<string, number>,
  denomination: number
): Record<string, number> {
  const key = String(denomination);
  return { ...current, [key]: (current[key] ?? 0) + 1 };
}

function removeChip(
  current: Record<string, number>,
  denomination: number
): Record<string, number> {
  const key = String(denomination);
  const count = current[key] ?? 0;
  if (count <= 1) {
    const next = { ...current };
    delete next[key];
    return next;
  }
  return { ...current, [key]: count - 1 };
}

function chipStyle(
  denomination: number,
  denominations: readonly number[]
): React.CSSProperties {
  const index = Math.max(0, denominations.indexOf(denomination));
  const background =
    productConfig.chips.colors[index % productConfig.chips.colors.length]!;
  return {
    "--chip-color": background,
    "--chip-edge": productConfig.chips.edge,
    "--chip-text":
      index === 0
        ? productConfig.chips.textDark
        : productConfig.chips.textLight
  } as React.CSSProperties;
}

function validateDenominations(values: readonly number[]): boolean {
  return Boolean(normalizedDenominations(values));
}

function normalizedDenominations(values: readonly number[]): number[] | null {
  if (
    values.length < 1 ||
    values.length > 16 ||
    values.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
    new Set(values).size !== values.length ||
    !values.includes(1)
  ) {
    return null;
  }
  return [...values].sort((left, right) => left - right);
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

function phaseLabel(
  language: Language,
  phase?: PokerRoomProjection["phase"]
): string {
  const zh = {
    waiting: "等待",
    blinds: "盲注与开局确认",
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
    blinds: "Blinds & hand confirmation",
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

function handCategoryLabel(language: Language, category: HandCategory): string {
  const keys: Record<HandCategory, Parameters<typeof t>[1]> = {
    "high-card": "highCard",
    "one-pair": "onePair",
    "two-pair": "twoPair",
    "three-of-a-kind": "threeOfAKind",
    straight: "straight",
    flush: "flush",
    "full-house": "fullHouse",
    "four-of-a-kind": "fourOfAKind",
    "straight-flush": "straightFlush"
  };
  return t(language, keys[category]);
}

function formatTemplate(template: string, value: number): string {
  return template.replace("{number}", String(value));
}

function errorMessage(language: Language, reason: unknown): string {
  const code = reason instanceof Error ? reason.message : String(reason);
  const messages: Record<string, [string, string]> = {
    INVALID_USERNAME: ["用户名不能为空或超过 32 个字符", "Username is required and must be at most 32 characters"],
    INVALID_AVATAR: ["请选择当前可用的头像", "Choose an avatar from the current list"],
    USERNAME_TAKEN: ["该用户名已被使用", "That username is already in use"],
    STALE_CONNECTION: ["此账户已由新设备接管，请重新进入", "A newer device controls this account; enter again"],
    STALE_VERSION: ["状态已更新，请重试", "State changed; please try again"],
    ALREADY_IN_ROOM: ["该账户已经在另一房间", "This account is already in another room"],
    ROOM_ALREADY_STARTED: ["牌局已开始，不能加入新玩家", "The game already started; new players cannot join"],
    ROOM_NOT_JOINABLE: ["当前房间不能加入", "This room is not joinable"],
    ROOM_FULL: ["房间已满", "The room is full"],
    INVALID_BUY_IN: ["买入金额超出房间范围", "Buy-in is outside the room limits"],
    INSUFFICIENT_SCORE: ["账户分数不足", "Not enough account score"],
    BUY_IN_LIMIT: ["补充后会超过牌桌上限", "The top-up would exceed the table limit"],
    INVALID_AMOUNT: ["金额必须是正整数", "The amount must be a positive whole number"],
    INVALID_BASE_SCORE: ["基础分必须是非负整数", "Base score must be a non-negative whole number"],
    INVALID_ROOM_CONFIG: ["房间配置无效，请检查盲注和买入范围", "Room settings are invalid; check blinds and buy-in limits"],
    WRONG_GAME_TYPE: ["该操作不适用于当前游戏", "That action does not apply to this game"],
    INVALID_AVALON_SETTINGS: ["阿瓦隆全局设置无效", "Avalon global settings are invalid"],
    INVALID_AVALON_ROOM_CONFIG: ["阿瓦隆房间设置无效", "Avalon room settings are invalid"],
    INVALID_AVALON_ROLE_CONFIG: ["角色配置与参赛人数或阵营规则不匹配", "Roles do not fit the player count or alignment rules"],
    INVALID_AVALON_PLAYER_COUNT: ["阿瓦隆需要 5 到 10 名在线参赛者", "Avalon requires 5 to 10 online participants"],
    INVALID_AVALON_STAKE: ["押分必须是不小于 2 的安全整数", "Stake must be a safe whole number of at least 2"],
    INVALID_AVALON_PARTICIPANTS: ["本局参赛者状态无效", "The Avalon participant set is invalid"],
    INVALID_AVALON_TEAM: ["请选择当前任务要求数量且不重复的队员", "Choose the required number of distinct mission members"],
    INVALID_AVALON_TARGET: ["刺杀目标无效", "The assassination target is invalid"],
    INVALID_AVALON_PHASE: ["当前阿瓦隆阶段不允许此操作", "That action is unavailable in the current Avalon phase"],
    STALE_AVALON_VERSION: ["阿瓦隆局势已更新，请按最新状态重试", "Avalon state changed; retry from the latest state"],
    AVALON_GAME_IN_PROGRESS: ["活动局进行中，不能修改下一局设置", "The active game must finish before changing next-game settings"],
    AVALON_NOT_STARTED: ["阿瓦隆尚未开始", "Avalon has not started"],
    AVALON_PARTICIPANT_ONLY: ["只有本局参赛者可以执行此操作", "Only a participant in this game can do that"],
    AVALON_ALREADY_CONFIRMED: ["你已经确认过角色", "You already confirmed your role"],
    AVALON_ALREADY_SUBMITTED: ["本阶段已提交，不能重复或修改", "This phase was already submitted and cannot be changed"],
    AVALON_NIGHT_RESTART_UNAVAILABLE: ["首次组队开始后不能重启夜间流程", "Night recognition cannot restart after the first proposal begins"],
    AVALON_LEADER_ONLY: ["只有当前队长可以提交队伍", "Only the current leader can submit the team"],
    AVALON_MISSION_MEMBER_ONLY: ["只有任务队员可以提交任务选择", "Only mission members can submit a mission choice"],
    AVALON_GOOD_CANNOT_FAIL: ["善方只能提交任务成功", "Good players can only submit mission success"],
    AVALON_ASSASSIN_ONLY: ["只有刺客可以提交刺杀目标", "Only the Assassin can submit the target"],
    AVALON_VOID_CONFIRMATION_REQUIRED: ["请确认作废活动局并退还押分", "Confirm voiding the active game and refunding stakes"],
    AVALON_VERSION_OVERFLOW: ["阿瓦隆版本超出安全整数范围", "The Avalon version exceeded the safe integer range"],
    SAFE_INTEGER_OVERFLOW: ["运算会超出安全整数范围，操作已回滚", "The operation would exceed the safe integer range and was rolled back"],
    PLAYER_OFFLINE: ["该玩家当前离线", "That player is offline"],
    INVALID_DENOMINATIONS: ["筹码面值必须是 1–16 个不重复正整数并包含 1", "Chip values must be 1–16 unique positive whole numbers and include 1"],
    INVALID_LANGUAGE: ["不支持该界面语言", "That interface language is not supported"],
    INVALID_THEME: ["请选择亮色或暗色主题", "Choose the light or dark theme"],
    INVALID_VOLUME: ["音量必须是 0–100 的整数", "Volume must be a whole number from 0 to 100"],
    INVALID_ENTER_REQUEST: ["进入请求无效，请重新输入用户名", "The enter request is invalid; enter the username again"],
    INVALID_REGISTER_REQUEST: ["注册资料无效，请检查后重试", "Registration details are invalid; review them and try again"],
    REGISTER_FAILED: ["暂时无法注册账户，请重试", "The account could not be registered; try again"],
    NOT_ENOUGH_PLAYERS: ["至少需要两名玩家", "At least two players are required"],
    NOT_ENOUGH_READY_PLAYERS: ["房主之外至少需要一名已准备玩家", "At least one player besides the host must be ready"],
    UNREADY_PLAYERS_REQUIRE_CONFIRMATION: ["请确认未准备成员进入观众席", "Confirm that unready members will spectate"],
    HOST_NEEDS_TOP_UP: ["房主需要先补充筹码", "The host must top up first"],
    HOST_READY_IMPLICIT: ["房主会自动参赛，无需准备", "The host joins automatically and does not ready up"],
    HOST_ONLY: ["只有房主可以执行此操作", "Only the host can do that"],
    TRANSFER_HOST_FIRST: ["请先转让房主", "Transfer the host role first"],
    TARGET_OFFLINE: ["只能把房主转让给在线玩家", "The new host must be online"],
    CANNOT_REMOVE_HOST: ["房主不能移除自己，请先转让或关闭房间", "The host cannot remove themselves; transfer or close the room"],
    PLAYER_NEEDS_TOP_UP: ["至少两名玩家需要先补充筹码", "At least two players must top up first"],
    HAND_IN_PROGRESS: ["请在两手牌之间操作", "This action is available between hands"],
    ROOM_NOT_IN_PROGRESS: ["牌局尚未开始或已经暂停", "The room is not in progress"],
    ROOM_NOT_PAUSED: ["牌局当前没有暂停", "The room is not paused"],
    ROOM_PAUSED: ["牌局已暂停", "The room is paused"],
    POKER_NOT_STARTED: ["牌局尚未开始", "Poker has not started"],
    ROOMS_MUST_CLOSE: ["请先关闭全部房间，再管理平台数据", "Close every room before managing platform data"],
    WRONG_ACTOR: ["当前不是你的行动", "It is not your turn"],
    BLIND_NOT_ASSIGNED: ["只有指定的大小盲可以提交盲注", "Only the assigned blinds can post"],
    BLIND_ALREADY_POSTED: ["本手盲注已经提交", "This blind was already posted"],
    BLIND_REQUIRED: ["请先提交你的固定盲注", "Post your assigned blind first"],
    HAND_START_ALREADY_CONFIRMED: ["你已经确认本手开局", "You already confirmed this hand start"],
    PLAYER_FOLDED: ["你已不在本手行动中", "You are no longer active in this hand"],
    CANNOT_CHECK: ["当前需要跟注，不能过牌", "You must call or fold; checking is unavailable"],
    INVALID_BET: ["下注金额不合法", "The bet amount is invalid"],
    MINIMUM_RAISE: ["加注未达到最低额度", "Raise is below the minimum"],
    RAISE_NOT_REOPENED: ["较小的全押未重新开放加注，你只能跟注或弃牌", "A short all-in did not reopen raising; call or fold"],
    INVALID_PHASE: ["当前牌局阶段不允许此操作", "This action is unavailable in the current phase"],
    SETTLEMENT_UNDO_NOT_AVAILABLE: ["当前结算不能撤销", "This settlement cannot be undone"],
    SETTLEMENT_UNDO_UNAVAILABLE_AFTER_LEAVE: ["已有玩家离开，本次结算不能再撤销", "A player has left, so this settlement can no longer be undone"],
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
    SEASON_NOT_FOUND: ["历史赛季不存在或已删除", "The historical season does not exist or was deleted"],
    CURRENT_SEASON_PROTECTED: ["当前赛季受保护，不能删除", "The current season is protected and cannot be deleted"],
    ASSET_NOT_FOUND: ["账户资产状态不存在", "Account asset state is missing"],
    NO_CURRENT_SEASON: ["当前赛季状态不存在", "There is no current season"],
    DUPLICATE_USERNAME: ["用户名状态冲突", "Username state is inconsistent"],
    MULTIPLE_ROOM_OCCUPANCY: ["账户不能同时加入多个房间", "An account cannot occupy multiple rooms"],
    NEGATIVE_ASSET: ["资产状态异常，操作已回滚", "Asset state is invalid; the action was rolled back"],
    ORPHANED_ASSET: ["账户资产引用异常，操作已回滚", "An account asset reference is invalid; the action was rolled back"],
    ASSET_CONSERVATION_FAILED: ["资产守恒检查失败，操作已回滚", "Asset conservation failed; the action was rolled back"],
    INVALID_HAND: ["手牌状态无效", "The hand state is invalid"],
    ADVANCE_NOT_DUE: ["自动推进时间尚未到达", "The auto-advance deadline has not arrived"],
    HOST_TIMEOUT_CHANGED: ["房主连接状态已经变化", "The host connection state changed"],
    INVALID_HOST_CANDIDATE: ["无法选择新的房主", "A new host could not be selected"],
    ENTER_FAILED: ["无法进入家庭服务器", "Cannot enter the home server"],
    STATE_FAILED: ["暂时无法同步平台数据，请重新进入", "Platform data could not be synced; please enter again"],
    COMMAND_FAILED: ["操作未被服务器接受", "The server rejected the action"]
  };
  const friendly =
    messages[code]?.[language === "zh-CN" ? 0 : 1] ??
    (language === "zh-CN" ? "操作失败，请重试" : "The action failed; please try again");
  return `${friendly} · ${code}`;
}

function playTone(volume: number): void {
  if (!Number.isFinite(volume) || volume <= 0) return;
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(
      0.035 * Math.min(100, volume) / 100,
      context.currentTime
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Sound is optional and never blocks state changes.
  }
}

function Root() {
  return isAdminPath(location.pathname) ? <AdminApp /> : <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <Root />
    </ToastProvider>
  </StrictMode>
);
