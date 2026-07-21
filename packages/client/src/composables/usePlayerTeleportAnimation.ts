import type { GameState } from "@vtt-core/shared";
import type { Ref } from "vue";
import { computed, readonly, ref, watch } from "vue";

export type TeleportAnimation = {
  playerId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  animating: boolean;
};

export function usePlayerTeleportAnimation(gameState: Ref<GameState | null>) {
  const active = ref<TeleportAnimation | null>(null);

  const teleportingPlayerIds = computed(() => {
    const anim = active.value;
    if (!anim?.animating) return new Set<string>();
    return new Set([anim.playerId]);
  });

  function startTeleport(
    playerId: string,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) {
    active.value = {
      playerId,
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      animating: false,
    };
  }

  function beginAnimation() {
    if (!active.value) return;
    active.value = { ...active.value, animating: true };
  }

  function finishTeleport() {
    active.value = null;
  }

  watch(
    () => gameState.value,
    (state) => {
      const anim = active.value;
      if (!anim || anim.animating || !state) return;
      const player = state.players.find((p) => p.id === anim.playerId);
      if (player && player.x === anim.toX && player.y === anim.toY) {
        beginAnimation();
      }
    },
  );

  return {
    active: readonly(active),
    teleportingPlayerIds,
    startTeleport,
    finishTeleport,
  };
}
