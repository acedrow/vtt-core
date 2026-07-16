import type { GameState } from "@gaem/shared";
import type { Ref } from "vue";
import { computed, readonly, ref } from "vue";

export type EnemyMoveAnimation = {
  enemyId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  animating: boolean;
};

export function useEnemyMoveAnimation(_gameState: Ref<GameState | null>) {
  const active = ref<EnemyMoveAnimation | null>(null);

  const animatingEnemyId = computed(() => active.value?.enemyId ?? null);

  function startMove(
    enemyId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    active.value = {
      enemyId,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      animating: false,
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (active.value?.enemyId === enemyId) {
          active.value = { ...active.value, animating: true };
        }
      });
    });
  }

  function finishMove() {
    active.value = null;
  }

  return {
    active: readonly(active),
    animatingEnemyId,
    startMove,
    finishMove,
  };
}
