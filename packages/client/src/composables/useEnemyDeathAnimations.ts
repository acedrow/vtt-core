import type { GameState } from "@gaem/shared";
import { getEnemyMaxHp } from "@gaem/shared";
import type { Ref } from "vue";
import { onUnmounted, readonly, ref, watch } from "vue";

import { DAMAGE_ANIMATION_DURATION_MS } from "../lib/damageAnimationTiming.js";

export function useEnemyDeathAnimations(
  gameState: Ref<GameState | null>,
  onRemove: (enemyId: string) => void,
) {
  const dyingEnemyIds = ref<ReadonlySet<string>>(new Set());
  const defeatedEnemyIds = ref<ReadonlySet<string>>(new Set());
  let prevHp: Map<string, number> | null = null;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function setDying(ids: Set<string>) {
    dyingEnemyIds.value = ids;
  }

  function setDefeated(ids: Set<string>) {
    defeatedEnemyIds.value = ids;
  }

  function clearDeath(enemyId: string) {
    const timer = timers.get(enemyId);
    if (timer) {
      clearTimeout(timer);
      timers.delete(enemyId);
    }
    if (dyingEnemyIds.value.has(enemyId)) {
      const next = new Set(dyingEnemyIds.value);
      next.delete(enemyId);
      setDying(next);
    }
    if (defeatedEnemyIds.value.has(enemyId)) {
      const next = new Set(defeatedEnemyIds.value);
      next.delete(enemyId);
      setDefeated(next);
    }
  }

  function startDeath(enemyId: string) {
    if (dyingEnemyIds.value.has(enemyId) || timers.has(enemyId)) return;
    const next = new Set(dyingEnemyIds.value);
    next.add(enemyId);
    setDying(next);
    const timer = setTimeout(() => {
      timers.delete(enemyId);
      const defeated = new Set(defeatedEnemyIds.value);
      defeated.add(enemyId);
      setDefeated(defeated);
      onRemove(enemyId);
    }, DAMAGE_ANIMATION_DURATION_MS);
    timers.set(enemyId, timer);
  }

  function isEnemyPendingRemoval(enemyId: string): boolean {
    return dyingEnemyIds.value.has(enemyId);
  }

  function isEnemyDying(enemyId: string): boolean {
    return dyingEnemyIds.value.has(enemyId) && !defeatedEnemyIds.value.has(enemyId);
  }

  function isEnemyDefeated(enemyId: string): boolean {
    return defeatedEnemyIds.value.has(enemyId);
  }

  watch(
    () => gameState.value,
    (state) => {
      if (!state) {
        prevHp = null;
        return;
      }

      const nextHp = new Map<string, number>();
      for (const enemy of state.enemies) {
        nextHp.set(enemy.id, enemy.hp ?? getEnemyMaxHp(enemy));
      }

      if (prevHp) {
        for (const [enemyId, hp] of nextHp) {
          const before = prevHp.get(enemyId);
          if (before !== undefined && before > 0 && hp <= 0) {
            startDeath(enemyId);
          }
        }
      }

      if (state.damageEvents?.length) {
        for (const enemy of state.enemies) {
          const hp = enemy.hp ?? getEnemyMaxHp(enemy);
          if (hp > 0 || dyingEnemyIds.value.has(enemy.id)) continue;
          const before = prevHp?.get(enemy.id);
          if (before === undefined || before > 0) startDeath(enemy.id);
        }
      }

      for (const enemyId of dyingEnemyIds.value) {
        if (!nextHp.has(enemyId)) clearDeath(enemyId);
      }

      prevHp = nextHp;
    },
  );

  onUnmounted(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    setDying(new Set());
    setDefeated(new Set());
    prevHp = null;
  });

  return {
    isEnemyDying,
    isEnemyDefeated,
    isEnemyPendingRemoval,
    dyingEnemyIds: readonly(dyingEnemyIds),
  };
}
