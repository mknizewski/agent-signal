import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  Download,
  Moon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  WifiOff
} from "lucide-react";
import type {
  MobileSnapshot,
  SessionStatus
} from "../shared/types";
import { SIGNAL_ORDER, formatRelativeTime, statusLabel } from "../shared/status";
import { AgentMark } from "../components/AgentMark";

type ConnectionState =
  | "connecting"
  | "online"
  | "offline"
  | "unpaired"
  | "error";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function MobileApp() {
  const [snapshot, setSnapshot] = useState<MobileSnapshot>();
  const [connection, setConnection] =
    useState<ConnectionState>("connecting");
  const [message, setMessage] = useState("Łączenie z komputerem…");
  const [now, setNow] = useState(new Date());
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent>();
  const [installed, setInstalled] = useState(() =>
    window.matchMedia("(display-mode: standalone)").matches
  );
  const [notificationState, setNotificationState] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    window.localStorage.getItem("agent-signal-mobile-theme") === "light"
      ? "light"
      : "dark"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("agent-signal-mobile-theme", theme);
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(undefined);
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/mobile-sw.js");
    }
    let events: EventSource | undefined;
    let cancelled = false;

    const connect = async () => {
      try {
        const secret = new URLSearchParams(
          window.location.hash.replace(/^#/, "")
        ).get("pair");
        if (secret) {
          const paired = await fetch("/api/v1/pair", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret,
              name: androidDeviceName()
            })
          });
          if (!paired.ok) {
            const error = await responseError(paired);
            throw new Error(error);
          }
          const body = (await paired.json()) as { snapshot: MobileSnapshot };
          if (!cancelled) setSnapshot(body.snapshot);
          window.history.replaceState(null, "", "/");
        }

        const response = await fetch("/api/v1/snapshot", {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (
          import.meta.env.DEV &&
          (response.status === 404 ||
            response.headers.get("content-type")?.includes("text/html"))
        ) {
          if (!cancelled) {
            setSnapshot(mobileDemoSnapshot);
            setConnection("online");
            setMessage("Tryb podglądu mobilnego");
          }
          return;
        }
        if (response.status === 401) {
          if (!cancelled) {
            setConnection("unpaired");
            setMessage("Ten telefon nie jest sparowany.");
          }
          return;
        }
        if (!response.ok) throw new Error(await responseError(response));
        if (!cancelled) {
          setSnapshot((await response.json()) as MobileSnapshot);
          setConnection("online");
          setMessage("Połączono z komputerem");
        }

        events = new EventSource("/api/v1/events", { withCredentials: true });
        events.addEventListener("snapshot", (event) => {
          if (cancelled) return;
          setSnapshot(JSON.parse((event as MessageEvent).data) as MobileSnapshot);
          setConnection("online");
          setMessage("Połączono z komputerem");
        });
        events.addEventListener("revoked", () => {
          if (cancelled) return;
          setSnapshot(undefined);
          setConnection("unpaired");
          setMessage("Dostęp tego telefonu został odwołany.");
          events?.close();
        });
        events.onopen = () => {
          if (!cancelled) setConnection("online");
        };
        events.onerror = () => {
          if (!cancelled) {
            setConnection("offline");
            setMessage("Komputer jest chwilowo niedostępny");
          }
        };
      } catch (error) {
        if (!cancelled) {
          setConnection("error");
          setMessage(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void connect();
    return () => {
      cancelled = true;
      events?.close();
    };
  }, []);

  const sessions = useMemo(
    () =>
      [...(snapshot?.sessions ?? [])].sort((left, right) => {
        const statusDifference =
          SIGNAL_ORDER.indexOf(left.status) -
          SIGNAL_ORDER.indexOf(right.status);
        if (statusDifference !== 0) return statusDifference;
        return (
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime()
        );
      }),
    [snapshot]
  );

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") setInstallPrompt(undefined);
  };

  const enableNotifications = async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setNotificationState("unsupported");
        return;
      }
      const permission = await Notification.requestPermission();
      setNotificationState(permission);
      if (permission !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      const keyResponse = await fetch("/api/v1/vapid-key", {
        credentials: "same-origin",
        cache: "no-store"
      });
      if (!keyResponse.ok) throw new Error(await responseError(keyResponse));
      const { publicKey } = (await keyResponse.json()) as { publicKey: string };
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey)
        }));
      const response = await fetch("/api/v1/push-subscription", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription)
      });
      if (!response.ok) throw new Error(await responseError(response));
      setMessage("Powiadomienia są włączone");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  if (connection === "unpaired") {
    return (
      <MobileStateScreen
        icon={<ShieldCheck size={34} />}
        title="Telefon nie jest sparowany"
        description="Otwórz Agent Signal na komputerze, wybierz Urządzenia mobilne i zeskanuj nowy kod QR."
      />
    );
  }

  if (connection === "error" && !snapshot) {
    return (
      <MobileStateScreen
        icon={<WifiOff size={34} />}
        title="Nie udało się połączyć"
        description={message}
      />
    );
  }

  return (
    <div className="mobile-shell">
      <header className="mobile-header">
        <div className="mobile-brand">
          <span className="mobile-brand__mark">
            <i />
            <i />
            <i />
          </span>
          <div>
            <strong>Agent Signal</strong>
            <span
              className={`mobile-connection mobile-connection--${connection}`}
            >
              <i />
              {message}
            </span>
          </div>
        </div>
        <button
          className="mobile-icon-button"
          type="button"
          aria-label={theme === "dark" ? "Jasny motyw" : "Ciemny motyw"}
          onClick={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="mobile-main">
        <section className="mobile-title">
          <div>
            <span>Dashboard agentów</span>
            <h1>Obserwowane czaty</h1>
          </div>
          <RefreshCw
            className={connection === "connecting" ? "is-spinning" : ""}
            size={18}
          />
        </section>

        <section className="mobile-signals">
          <MobileSignal
            status="working"
            count={snapshot?.counts.working ?? 0}
          />
          <MobileSignal
            status="attention"
            count={snapshot?.counts.attention ?? 0}
          />
          <MobileSignal
            status="idle"
            count={snapshot?.counts.idle ?? 0}
          />
        </section>

        {(!installed || notificationState !== "granted") && (
          <section className="mobile-actions">
            {!installed && installPrompt && (
              <button
                type="button"
                onClick={install}
              >
                <Download size={17} />
                Zainstaluj aplikację
              </button>
            )}
            {notificationState !== "granted" &&
              notificationState !== "unsupported" && (
                <button
                  type="button"
                  onClick={enableNotifications}
                >
                  <Bell size={17} />
                  Włącz powiadomienia
                </button>
              )}
          </section>
        )}

        <section className="mobile-list">
          <div className="mobile-list__heading">
            <strong>Sesje</strong>
            <span>{sessions.length}</span>
          </div>
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <article
                className="mobile-session"
                key={session.key}
              >
                <i
                  className={`mobile-session__rail mobile-status--${session.status}`}
                />
                <AgentMark agent={session.agent} />
                <div className="mobile-session__body">
                  <strong>{session.title}</strong>
                  <span>
                    <i className={`mobile-dot mobile-status--${session.status}`} />
                    {statusLabel(session.status)}
                    <small>·</small>
                    {formatRelativeTime(session.updatedAt, now)}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="mobile-empty">
              <Smartphone size={28} />
              <strong>Brak obserwowanych czatów</strong>
              <span>Dodaj sesje w aplikacji na komputerze.</span>
            </div>
          )}
        </section>

        <footer className="mobile-footer">
          {notificationState === "granted" ? (
            <>
              <BellRing size={13} />
              Powiadomienia aktywne
            </>
          ) : (
            <>Aktualizacja: {snapshot ? formatRelativeTime(snapshot.updatedAt, now) : "—"}</>
          )}
        </footer>
      </main>
    </div>
  );
}

function MobileSignal({
  status,
  count
}: {
  status: Extract<SessionStatus, "working" | "attention" | "idle">;
  count: number;
}) {
  return (
    <div>
      <i className={`mobile-signal mobile-status--${status}`} />
      <span>
        <strong>{count}</strong>
        <small>{statusLabel(status)}</small>
      </span>
    </div>
  );
}

function MobileStateScreen({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main className="mobile-state-screen">
      <span>{icon}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  );
}

async function responseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Błąd HTTP ${response.status}`;
  } catch {
    return `Błąd HTTP ${response.status}`;
  }
}

function androidDeviceName(): string {
  const match = navigator.userAgent.match(/Android[^;]*;\s*([^;)]+)/i);
  const model = match?.[1]?.replace(/\s+Build\/.*/, "").trim();
  return model ? `Android · ${model}` : "Telefon z Androidem";
}

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
}

const mobileDemoSnapshot: MobileSnapshot = {
  sessions: [
    {
      key: "demo-claude",
      agent: "claude",
      title: "Błąd logowania SSO",
      status: "attention",
      statusText: "Sesja czeka na decyzję",
      updatedAt: new Date(Date.now() - 42_000).toISOString()
    },
    {
      key: "demo-codex-working",
      agent: "codex",
      title: "Refaktor modułu płatności",
      status: "working",
      statusText: "Agent wykonuje zadanie",
      updatedAt: new Date(Date.now() - 5_000).toISOString()
    },
    {
      key: "demo-codex-idle",
      agent: "codex",
      title: "Walidacja formularza",
      status: "idle",
      statusText: "Agent nie wykonuje teraz pracy",
      updatedAt: new Date(Date.now() - 31 * 60_000).toISOString()
    }
  ],
  providers: {
    codex: { id: "codex", label: "Codex", available: true },
    claude: { id: "claude", label: "Claude Code", available: true }
  },
  counts: {
    working: 1,
    attention: 1,
    idle: 1,
    error: 0,
    unavailable: 0
  },
  updatedAt: new Date().toISOString()
};
