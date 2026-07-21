import type { MapPingSurface, ServerMessage } from "@vtt-core/shared";
import { computed, ref } from "vue";

import { useGameState } from "./useGameState.js";
import { useSession } from "./useSession.js";

export type ActiveMapPing = {
  fromId: string;
  fromName: string;
  role: "gm" | "player";
  surface: MapPingSurface;
  x: number;
  y: number;
};

const HOLD_MS = 350;
const MOVE_THROTTLE_MS = 40;

const activePings = ref(new Map<string, ActiveMapPing>());
let suppressClickAfterPing = false;

type LocalPingSession = {
  surface: MapPingSurface;
  x: number;
  y: number;
  activated: boolean;
  holdTimer: ReturnType<typeof setTimeout> | null;
  throttleTimer: ReturnType<typeof setTimeout> | null;
  pendingCell: { x: number; y: number } | null;
};

let localSession: LocalPingSession | null = null;

function setPing(ping: ActiveMapPing) {
  const next = new Map(activePings.value);
  next.set(ping.fromId, ping);
  activePings.value = next;
}

function removePing(fromId: string) {
  if (!activePings.value.has(fromId)) return;
  const next = new Map(activePings.value);
  next.delete(fromId);
  activePings.value = next;
}

export function applyRemoteMapPing(msg: Extract<ServerMessage, { type: "mapPing" }>) {
  if (!msg.active) {
    removePing(msg.fromId);
    return;
  }
  setPing({
    fromId: msg.fromId,
    fromName: msg.fromName,
    role: msg.role,
    surface: msg.surface,
    x: msg.x,
    y: msg.y,
  });
}

export function clearAllMapPings() {
  if (localSession?.holdTimer) clearTimeout(localSession.holdTimer);
  if (localSession?.throttleTimer) clearTimeout(localSession.throttleTimer);
  localSession = null;
  activePings.value = new Map();
}

function endLocalPingSessionInternal(
  sendClear: boolean,
  sendFn?: (active: boolean, surface: MapPingSurface, x: number, y: number) => void,
) {
  if (!localSession) return;
  const { surface, x, y, activated, holdTimer, throttleTimer } = localSession;
  if (holdTimer) clearTimeout(holdTimer);
  if (throttleTimer) clearTimeout(throttleTimer);
  localSession = null;
  if (activated && sendClear && sendFn) {
    sendFn(false, surface, x, y);
  }
}

export function consumeSuppressMapPingClick(): boolean {
  if (!suppressClickAfterPing) return false;
  suppressClickAfterPing = false;
  return true;
}

export function useMapPing() {
  const { send } = useGameState();
  const { role, playerProfile } = useSession();

  const myFromId = computed(() => {
    if (role.value === "gm") return "gm";
    return playerProfile.value?.id ?? null;
  });

  const myFromName = computed(() => {
    if (role.value === "gm") return "GM";
    return playerProfile.value?.name ?? "Player";
  });

  const myRole = computed<"gm" | "player">(() => (role.value === "gm" ? "gm" : "player"));

  const taccomPings = computed(() =>
    [...activePings.value.values()].filter((p) => p.surface === "taccom"),
  );
  const overworldPings = computed(() =>
    [...activePings.value.values()].filter((p) => p.surface === "overworld"),
  );

  const remotePingOnTaccom = computed(() => {
    const mine = myFromId.value;
    return taccomPings.value.some((p) => p.fromId !== mine);
  });
  const remotePingOnOverworld = computed(() => {
    const mine = myFromId.value;
    return overworldPings.value.some((p) => p.fromId !== mine);
  });

  function sendPing(
    surface: MapPingSurface,
    x: number,
    y: number,
    active: boolean,
    applyLocal: boolean,
  ) {
    const fromId = myFromId.value;
    if (!fromId) return;
    send({ type: "mapPing", surface, x, y, active });
    if (!applyLocal) return;
    if (active) {
      setPing({
        fromId,
        fromName: myFromName.value,
        role: myRole.value,
        surface,
        x,
        y,
      });
    } else {
      removePing(fromId);
    }
  }

  function flushPendingMove() {
    if (!localSession?.activated || !localSession.pendingCell) return;
    const { surface, pendingCell } = localSession;
    localSession.pendingCell = null;
    localSession.x = pendingCell.x;
    localSession.y = pendingCell.y;
    sendPing(surface, pendingCell.x, pendingCell.y, true, true);
  }

  function queueMoveUpdate(x: number, y: number) {
    if (!localSession?.activated) return;
    if (localSession.x === x && localSession.y === y && !localSession.pendingCell) return;
    localSession.pendingCell = { x, y };
    if (localSession.throttleTimer) return;
    localSession.throttleTimer = setTimeout(() => {
      if (localSession) localSession.throttleTimer = null;
      flushPendingMove();
    }, MOVE_THROTTLE_MS);
  }

  function activateLocalPing() {
    if (!localSession || localSession.activated) return;
    localSession.activated = true;
    suppressClickAfterPing = true;
    sendPing(localSession.surface, localSession.x, localSession.y, true, true);
  }

  function endLocalPingSession(sendClear: boolean) {
    endLocalPingSessionInternal(sendClear, (active, surface, x, y) => {
      sendPing(surface, x, y, active, true);
    });
  }

  function beginMapPingHold(opts: {
    e: PointerEvent;
    surface: MapPingSurface;
    getCell: (clientX: number, clientY: number) => { x: number; y: number } | null;
    canStart: () => boolean;
  }) {
    if (opts.e.button !== 0) return;
    if (!opts.canStart()) return;
    if (!myFromId.value) return;
    const startCell = opts.getCell(opts.e.clientX, opts.e.clientY);
    if (!startCell) return;

    endLocalPingSession(true);

    localSession = {
      surface: opts.surface,
      x: startCell.x,
      y: startCell.y,
      activated: false,
      holdTimer: setTimeout(activateLocalPing, HOLD_MS),
      throttleTimer: null,
      pendingCell: null,
    };

    const onMove = (ev: PointerEvent) => {
      if (!localSession) return;
      const cell = opts.getCell(ev.clientX, ev.clientY);
      if (!cell) return;
      if (!localSession.activated) {
        localSession.x = cell.x;
        localSession.y = cell.y;
        return;
      }
      queueMoveUpdate(cell.x, cell.y);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      endLocalPingSession(true);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
  }

  return {
    taccomPings,
    overworldPings,
    remotePingOnTaccom,
    remotePingOnOverworld,
    beginMapPingHold,
    endLocalPingSession,
  };
}
