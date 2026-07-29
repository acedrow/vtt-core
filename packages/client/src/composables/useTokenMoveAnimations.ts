import type { GameState } from "@vtt-core/shared";
import type { Ref } from "vue";
import { computed, readonly, ref, watch } from "vue";

export type TokenMoveKind = "player" | "enemy";

export type TokenMoveAnimation = {
  id: string;
  kind: TokenMoveKind;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  animating: boolean;
};

type PrevPos = { x: number; y: number; kind: TokenMoveKind };

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
) {
  const active = ref(new Map<string, TokenMoveAnimation>());
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

  function upsert(anim: TokenMoveAnimation) {
    const next = new Map(active.value);
    next.set(anim.id, anim);
    active.value = next;
  }

  function remove(id: string) {
    if (!active.value.has(id)) return;
    const next = new Map(active.value);
    next.delete(id);
    active.value = next;
  }

  function clearAll() {
    if (active.value.size === 0) return;
    active.value = new Map();
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

  function finishMove(id: string) {
    remove(id);
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
        if (prev?.kind === "player" && (prev.x !== player.x || prev.y !== player.y)) {
          startMove("player", player.id, { x: prev.x, y: prev.y }, { x: player.x, y: player.y });
        }
      }

      for (const enemy of state.enemies) {
        livingIds.add(enemy.id);
        const prev = prevPositions.get(enemy.id);
        nextPrev.set(enemy.id, { x: enemy.x, y: enemy.y, kind: "enemy" });
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

  return {
    active: readonly(active),
    activeEnemyMoves,
    activePlayerMoves,
    animatingEnemyIds,
    animatingPlayerIds,
    startEnemyMove,
    startPlayerMove,
    finishMove,
  };
}
