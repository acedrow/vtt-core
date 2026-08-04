import type { ClientMessage, ConsoleLogEntry, ServerMessage } from "@vtt-core/shared";
import type { Ref } from "vue";

import { appendConsoleEntry, setConsoleEntries } from "./useGameConsole.js";
import { useGameConnection } from "./useGameConnection.js";
import { useGameState } from "./useGameState.js";
import { applyRemoteMapPing, clearAllMapPings } from "./useMapPing.js";
import { useSession } from "./useSession.js";

export const gameWsUrl = import.meta.env.VITE_CF_DEV
  ? `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`
  : (import.meta.env.VITE_WS_URL ??
    (import.meta.env.DEV
      ? `ws://${location.hostname}:3001/ws`
      : `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`));

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 15_000;
// A dead socket's readyState stays OPEN indefinitely if the browser never
// observes the underlying transport close (backgrounded-tab throttling, an
// idle proxy/NAT dropping the connection, etc). This heartbeat sends an
// application-level ping so a lapse forces a reconnect instead of a silent
// hang.
const HEARTBEAT_INTERVAL_MS = 10_000;
const HEARTBEAT_TIMEOUT_MS = 25_000;

export function useGameSocket(opts: {
  wsUrl: string;
  role: Ref<"gm" | "player">;
  playerProfile: Ref<{ id: string; name: string } | null | undefined>;
  selectedSheetId: Ref<string | null>;
  onError: (message: string) => void;
  onSelectionInvalidated?: (state: ServerMessage & { type: "state" }) => void;
  onConsoleEntry?: (entry: ConsoleLogEntry) => void;
}) {
  const { connection, reportServerError } = useGameConnection();
  const { setGameState, registerSend, clearGameState } = useGameState();
  const { token, clearSession } = useSession();
  let socket: WebSocket | null = null;
  let socketGen = 0;
  let intentionalClose = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let lastMessageAt = 0;
  // Tracks the highest "state" seq applied for the current socket generation, so an
  // out-of-order/stale broadcast (e.g. from message reordering) is ignored instead
  // of overwriting newer state already on screen. Reset per generation because the
  // server's own counter restarts whenever its process/Durable Object restarts.
  let lastStateGen = -1;
  let lastStateSeq = -1;

  function send(msg: ClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(msg));
      return;
    }
    opts.onError("Not connected — action wasn't sent. Reconnecting…");
  }

  function clearReconnect() {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function stopHeartbeat() {
    if (heartbeatTimer != null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat(ws: WebSocket, gen: number) {
    stopHeartbeat();
    lastMessageAt = Date.now();
    heartbeatTimer = setInterval(() => {
      if (gen !== socketGen || socket !== ws) {
        stopHeartbeat();
        return;
      }
      const idleFor = Date.now() - lastMessageAt;
      if (idleFor > HEARTBEAT_TIMEOUT_MS) {
        // No response (not even a pong) within the timeout — the socket is
        // dead even though readyState still reports OPEN. Force it closed so
        // the existing close/reconnect path runs.
        stopHeartbeat();
        ws.close();
        return;
      }
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" } satisfies ClientMessage));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  function checkStaleConnection() {
    if (socket?.readyState !== WebSocket.OPEN) return;
    if (Date.now() - lastMessageAt > HEARTBEAT_TIMEOUT_MS) {
      socket.close();
    }
  }

  function scheduleReconnect() {
    clearReconnect();
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS);
    reconnectAttempt += 1;
    connection.value = "connecting";
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSocket();
    }, delay);
  }

  function openSocket() {
    const gen = ++socketGen;
    if (socket) {
      socket.close();
      socket = null;
    }
    const ws = new WebSocket(opts.wsUrl);
    socket = ws;
    registerSend(send);

    ws.addEventListener("open", () => {
      if (gen !== socketGen) return;
      reconnectAttempt = 0;
      connection.value = "connected";
      startHeartbeat(ws, gen);
      send({
        type: "join",
        role: opts.role.value,
        token: token.value ?? undefined,
        playerKey: opts.role.value === "player" ? opts.playerProfile.value?.id : undefined,
        nickname: opts.role.value === "player" ? opts.playerProfile.value?.name : undefined,
        characterSheetId:
          opts.role.value === "player" ? opts.selectedSheetId.value ?? undefined : undefined,
      });
    });

    ws.addEventListener("close", () => {
      if (gen !== socketGen) return;
      stopHeartbeat();
      socket = null;
      if (intentionalClose) {
        connection.value = "disconnected";
        return;
      }
      scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      if (gen !== socketGen) return;
      opts.onError("Connection error");
    });

    ws.addEventListener("message", (ev) => {
      if (gen !== socketGen) return;
      lastMessageAt = Date.now();
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        opts.onError("Invalid message from server");
        return;
      }
      if (msg.type === "pong") {
        return;
      } else if (msg.type === "state") {
        if (gen !== lastStateGen) {
          lastStateGen = gen;
          lastStateSeq = -1;
        }
        if (msg.seq < lastStateSeq) return;
        lastStateSeq = msg.seq;
        setGameState(msg.state, msg.yourPlayerId);
        opts.onSelectionInvalidated?.(msg);
      } else if (msg.type === "consoleSync") {
        setConsoleEntries(msg.entries);
      } else if (msg.type === "console") {
        appendConsoleEntry(msg.entry);
        opts.onConsoleEntry?.(msg.entry);
      } else if (msg.type === "mapPing") {
        applyRemoteMapPing(msg);
      } else if (msg.type === "error") {
        reportServerError();
        opts.onError(msg.message);
        if (msg.message === "Authentication required") {
          intentionalClose = true;
          clearReconnect();
          clearSession();
          location.assign("/");
        }
      }
    });
  }

  function handleVisibilityChange() {
    // A backgrounded tab can miss the heartbeat's own dead-socket detection
    // (throttled timers) or come back from a suspend/resume where the OS
    // silently dropped the connection. Re-check as soon as the tab is
    // foregrounded rather than waiting for the next heartbeat tick.
    if (document.visibilityState === "visible") {
      checkStaleConnection();
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }

  function connect() {
    intentionalClose = false;
    clearReconnect();
    reconnectAttempt = 0;
    connection.value = "connecting";
    openSocket();
  }

  function disconnect() {
    intentionalClose = true;
    clearReconnect();
    stopHeartbeat();
    socketGen += 1;
    socket?.close();
    socket = null;
    clearAllMapPings();
    clearGameState();
    connection.value = "disconnected";
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  }

  return { send, connect, disconnect };
}
