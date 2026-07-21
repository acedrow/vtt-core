import type { ClientMessage, ServerMessage } from "@vtt-core/shared";
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

export function useGameSocket(opts: {
  wsUrl: string;
  role: Ref<"gm" | "player">;
  playerProfile: Ref<{ id: string; name: string } | null | undefined>;
  selectedSheetId: Ref<string | null>;
  onError: (message: string) => void;
  onSelectionInvalidated?: (state: ServerMessage & { type: "state" }) => void;
}) {
  const { connection } = useGameConnection();
  const { setGameState, registerSend, clearGameState } = useGameState();
  const { token, clearSession } = useSession();
  let socket: WebSocket | null = null;
  let socketGen = 0;
  let intentionalClose = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function send(msg: ClientMessage) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  }

  function clearReconnect() {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
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
      socket = null;
      if (intentionalClose) {
        connection.value = "disconnected";
        return;
      }
      scheduleReconnect();
    });

    ws.addEventListener("message", (ev) => {
      if (gen !== socketGen) return;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        opts.onError("Invalid message from server");
        return;
      }
      if (msg.type === "state") {
        setGameState(msg.state, msg.yourPlayerId);
        opts.onSelectionInvalidated?.(msg);
      } else if (msg.type === "consoleSync") {
        setConsoleEntries(msg.entries);
      } else if (msg.type === "console") {
        appendConsoleEntry(msg.entry);
      } else if (msg.type === "mapPing") {
        applyRemoteMapPing(msg);
      } else if (msg.type === "error") {
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
    socketGen += 1;
    socket?.close();
    socket = null;
    clearAllMapPings();
    clearGameState();
    connection.value = "disconnected";
  }

  return { send, connect, disconnect };
}
