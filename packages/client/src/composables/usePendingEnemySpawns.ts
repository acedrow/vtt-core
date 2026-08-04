import type { GameState } from "@vtt-core/shared";
import type { Ref } from "vue";
import { readonly, ref, watch } from "vue";

import { useGameConnection } from "./useGameConnection.js";

export type PendingEnemySpawn = {
  id: string;
  x: number;
  y: number;
  name: string;
};

const PENDING_SPAWN_TIMEOUT_MS = 10_000;

let nextId = 0;

/**
 * addEnemy is fire-and-forget with no server ack, unlike tile paint (sticky
 * preview) and token move (optimistic + reconcile). This tracks a client-local
 * "ghost" spawn marker from click until the real enemy shows up in gameState,
 * so a lost/delayed broadcast reads as "pending" instead of "nothing happened".
 */
export function usePendingEnemySpawns(
  gameState: Ref<GameState | null>,
  onTimeout?: (message: string) => void,
) {
  const { connection, serverErrorVersion } = useGameConnection();
  const pending = ref(new Map<string, PendingEnemySpawn>());
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  function clearPendingSpawn(id: string) {
    const timeout = timeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.delete(id);
    }
    if (!pending.value.has(id)) return;
    const next = new Map(pending.value);
    next.delete(id);
    pending.value = next;
  }

  function clearAllPendingSpawns() {
    for (const timeout of timeouts.values()) clearTimeout(timeout);
    timeouts.clear();
    if (pending.value.size > 0) pending.value = new Map();
  }

  function startPendingSpawn(x: number, y: number, name: string): string {
    const id = `pending-spawn-${++nextId}`;
    const next = new Map(pending.value);
    next.set(id, { id, x, y, name });
    pending.value = next;
    timeouts.set(
      id,
      setTimeout(() => {
        clearPendingSpawn(id);
        onTimeout?.(`Spawn of ${name} wasn't confirmed by the server — check connection and try again`);
      }, PENDING_SPAWN_TIMEOUT_MS),
    );
    return id;
  }

  watch(gameState, (state) => {
    if (!state || pending.value.size === 0) return;
    for (const spawn of pending.value.values()) {
      const confirmed = state.enemies.some(
        (e) => e.x === spawn.x && e.y === spawn.y && e.name === spawn.name,
      );
      if (confirmed) clearPendingSpawn(spawn.id);
    }
  });

  watch(connection, (status, previous) => {
    if (previous !== undefined && status !== "connected") clearAllPendingSpawns();
  });

  watch(serverErrorVersion, () => {
    clearAllPendingSpawns();
  });

  return {
    pendingEnemySpawns: readonly(pending),
    startPendingSpawn,
    clearAllPendingSpawns,
  };
}
