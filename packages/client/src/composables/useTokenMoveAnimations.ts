import type { GameState } from "@vtt-core/shared";
import type { Ref } from "vue";
import { computed, readonly, ref, watch } from "vue";

import { useGameConnection } from "./useGameConnection.js";

export type TokenMoveKind = "player" | "enemy";

export type TokenMoveAnimation = {
  id: string;
  kind: TokenMoveKind;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  animating: boolean;
  optimistic: boolean;
  acknowledged: boolean;
  pending: boolean;
  path?: { x: number; y: number }[];
  expectIntermediateStates?: boolean;
};

type PrevPos = { x: number; y: number; kind: TokenMoveKind };

const optimisticPlayerIds = ref(new Set<string>());
const optimisticEnemyIds = ref(new Set<string>());
const OPTIMISTIC_MOVE_TIMEOUT_MS = 10_000;

export function usePendingTokenMoves() {
  return {
    optimisticPlayerIds: readonly(optimisticPlayerIds),
    optimisticEnemyIds: readonly(optimisticEnemyIds),
  };
}

function snapshotPositions(state: GameState): Map<string, PrevPos> {
  const next = new Map<string, PrevPos>();
  for (const player of state.players) {
    next.set(player.id, { x: player.x, y: player.y, kind: "player" });
  }
  for (const enemy of state.enemies) {
    next.set(enemy.id, { x: enemy.x, y: enemy.y, kind: "enemy" });
  }
  return next;
}

export function useTokenMoveAnimations(
  gameState: Ref<GameState | null>,
  boardKey: Ref<string | null>,
  onOptimisticFailure?: (message: string) => void,
) {
  const { connection, serverErrorVersion } = useGameConnection();
  const active = ref(new Map<string, TokenMoveAnimation>());
  const optimisticTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  let prevPositions: Map<string, PrevPos> | null = null;
  let prevBoardKey: string | null = null;

  const activeEnemyMoves = computed(() =>
    [...active.value.values()].filter((a) => a.kind === "enemy"),
  );
  const activePlayerMoves = computed(() =>
    [...active.value.values()].filter((a) => a.kind === "player"),
  );
  const animatingEnemyIds = computed(() => new Set(activeEnemyMoves.value.map((a) => a.id)));
  const animatingPlayerIds = computed(() => new Set(activePlayerMoves.value.map((a) => a.id)));

  function syncOptimisticIds() {
    optimisticPlayerIds.value = new Set(
      [...active.value.values()]
        .filter((move) => move.kind === "player" && move.optimistic && !move.acknowledged)
        .map((move) => move.id),
    );
    optimisticEnemyIds.value = new Set(
      [...active.value.values()]
        .filter((move) => move.kind === "enemy" && move.optimistic && !move.acknowledged)
        .map((move) => move.id),
    );
  }

  function upsert(anim: TokenMoveAnimation) {
    const next = new Map(active.value);
    next.set(anim.id, anim);
    active.value = next;
    syncOptimisticIds();
  }

  function remove(id: string) {
    if (!active.value.has(id)) return;
    const timeout = optimisticTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      optimisticTimeouts.delete(id);
    }
    const next = new Map(active.value);
    next.delete(id);
    active.value = next;
    syncOptimisticIds();
  }

  function clearAll() {
    for (const timeout of optimisticTimeouts.values()) clearTimeout(timeout);
    optimisticTimeouts.clear();
    if (active.value.size > 0) active.value = new Map();
    syncOptimisticIds();
  }

  function beginAnimating(id: string) {
    const anim = active.value.get(id);
    if (!anim || anim.animating) return;
    upsert({ ...anim, animating: true });
  }

  function scheduleBegin(id: string) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        beginAnimating(id);
      });
    });
  }

  function startMove(
    kind: TokenMoveKind,
    id: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    if (from.x === to.x && from.y === to.y) return;
    const existing = active.value.get(id);
    if (existing && existing.toX === to.x && existing.toY === to.y) {
      if (!existing.animating) scheduleBegin(id);
      return;
    }
    upsert({
      id,
      kind,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      animating: false,
      optimistic: false,
      acknowledged: false,
      pending: false,
    });
    scheduleBegin(id);
  }

  function startEnemyMove(
    enemyId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    startMove("enemy", enemyId, from, to);
  }

  function startPlayerMove(
    playerId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    startMove("player", playerId, from, to);
  }

  function startOptimisticMove(
    kind: TokenMoveKind,
    id: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    path?: { x: number; y: number }[],
    expectIntermediateStates = false,
  ): boolean {
    const existing = active.value.get(id);
    if (existing?.optimistic && !existing.acknowledged) return false;
    if (from.x === to.x && from.y === to.y) return false;
    upsert({
      id,
      kind,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      animating: false,
      optimistic: true,
      acknowledged: false,
      pending: false,
      path,
      expectIntermediateStates,
    });
    optimisticTimeouts.set(
      id,
      setTimeout(() => {
        const move = active.value.get(id);
        if (!move?.optimistic || move.acknowledged) return;
        remove(id);
        onOptimisticFailure?.("Move confirmation timed out; restored server position");
      }, OPTIMISTIC_MOVE_TIMEOUT_MS),
    );
    scheduleBegin(id);
    return true;
  }

  function startOptimisticEnemyMove(
    enemyId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    path?: { x: number; y: number }[],
    expectIntermediateStates = false,
  ) {
    return startOptimisticMove("enemy", enemyId, from, to, path, expectIntermediateStates);
  }

  function startOptimisticPlayerMove(
    playerId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
    path?: { x: number; y: number }[],
    expectIntermediateStates = false,
  ) {
    return startOptimisticMove("player", playerId, from, to, path, expectIntermediateStates);
  }

  function finishMove(id: string) {
    const move = active.value.get(id);
    if (!move) return;
    if (move.optimistic && !move.acknowledged) {
      upsert({ ...move, animating: false, pending: true });
      return;
    }
    remove(id);
  }

  function reconcileOptimisticMove(
    id: string,
    position: { x: number; y: number },
    prev: PrevPos | undefined,
  ) {
    const move = active.value.get(id);
    if (!move?.optimistic) return false;
    if (position.x === move.toX && position.y === move.toY) {
      const timeout = optimisticTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        optimisticTimeouts.delete(id);
      }
      if (move.pending || !move.animating) remove(id);
      else upsert({ ...move, acknowledged: true });
      return true;
    }
    const isExpectedIntermediate = move.path?.slice(0, -1).some(
      (step) => step.x === position.x && step.y === position.y,
    );
    if (
      prev &&
      (prev.x !== position.x || prev.y !== position.y) &&
      !(isExpectedIntermediate && move.expectIntermediateStates)
    ) {
      remove(id);
      onOptimisticFailure?.("Server corrected token position");
    }
    return true;
  }

  watch(
    [gameState, boardKey],
    () => {
      const state = gameState.value;
      const key = boardKey.value;
      if (!state || !key) {
        prevPositions = null;
        prevBoardKey = null;
        clearAll();
        return;
      }

      if (prevBoardKey !== key || prevPositions === null) {
        prevBoardKey = key;
        prevPositions = snapshotPositions(state);
        clearAll();
        return;
      }

      const nextPrev = new Map<string, PrevPos>();
      const livingIds = new Set<string>();

      for (const player of state.players) {
        livingIds.add(player.id);
        const prev = prevPositions.get(player.id);
        nextPrev.set(player.id, { x: player.x, y: player.y, kind: "player" });
        if (reconcileOptimisticMove(player.id, player, prev)) {
          continue;
        }
        if (prev?.kind === "player" && (prev.x !== player.x || prev.y !== player.y)) {
          startMove("player", player.id, { x: prev.x, y: prev.y }, { x: player.x, y: player.y });
        }
      }

      for (const enemy of state.enemies) {
        livingIds.add(enemy.id);
        const prev = prevPositions.get(enemy.id);
        nextPrev.set(enemy.id, { x: enemy.x, y: enemy.y, kind: "enemy" });
        if (reconcileOptimisticMove(enemy.id, enemy, prev)) {
          continue;
        }
        if (prev?.kind === "enemy" && (prev.x !== enemy.x || prev.y !== enemy.y)) {
          startMove("enemy", enemy.id, { x: prev.x, y: prev.y }, { x: enemy.x, y: enemy.y });
        }
      }

      for (const id of [...active.value.keys()]) {
        if (!livingIds.has(id)) remove(id);
      }

      prevPositions = nextPrev;
    },
    { immediate: true },
  );

  watch(connection, (status, previous) => {
    if (previous !== undefined && status !== "connected") clearAll();
  });

  watch(serverErrorVersion, () => {
    for (const move of active.value.values()) {
      if (move.optimistic && !move.acknowledged) remove(move.id);
    }
  });

  return {
    active: readonly(active),
    activeEnemyMoves,
    activePlayerMoves,
    animatingEnemyIds,
    animatingPlayerIds,
    startEnemyMove,
    startPlayerMove,
    startOptimisticEnemyMove,
    startOptimisticPlayerMove,
    finishMove,
    clearAll,
  };
}
