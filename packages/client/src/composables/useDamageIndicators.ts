import type { GameState } from "@vtt-core/shared";
import { getEnemyMaxHp, getPlayerMaxHp } from "@vtt-core/shared";
import type { Ref } from "vue";
import { onUnmounted, ref, watch } from "vue";

import { getCombatBoardHelpers } from "../combat-board-helpers.js";
import { DAMAGE_ANIMATION_DURATION_MS } from "../lib/damageAnimationTiming.js";

export type DamageIndicator = {
  id: string;
  x: number;
  y: number;
  amount: number;
};

function snapshotUnitHp(state: GameState): Map<string, { hp: number; x: number; y: number }> {
  const m = new Map<string, { hp: number; x: number; y: number }>();
  for (const p of state.players) {
    m.set(`p:${p.id}`, { hp: p.hp ?? getPlayerMaxHp(p), x: p.x, y: p.y });
  }
  for (const e of state.enemies) {
    m.set(`e:${e.id}`, { hp: e.hp ?? getEnemyMaxHp(e), x: e.x, y: e.y });
  }
  return m;
}

export function useDamageIndicators(gameState: Ref<GameState | null>) {
  const indicators = ref<DamageIndicator[]>([]);
  let prev: Map<string, { hp: number; x: number; y: number }> | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  function dismiss(id: string) {
    indicators.value = indicators.value.filter((i) => i.id !== id);
  }

  function addIndicator(x: number, y: number, amount: number) {
    const id = crypto.randomUUID();
    indicators.value = [...indicators.value, { id, x, y, amount }];
    const timer = setTimeout(() => {
      dismiss(id);
      timers.delete(timer);
    }, DAMAGE_ANIMATION_DURATION_MS);
    timers.add(timer);
  }

  watch(gameState, (state) => {
    if (!state) {
      prev = null;
      return;
    }
    const silent = new Set(state.silentHpEnemyIds ?? []);
    if (state.damageEvents?.length) {
      for (const evt of state.damageEvents) {
        addIndicator(evt.x, evt.y, evt.amount);
      }
    } else if (prev) {
      const next = snapshotUnitHp(state);
      const seenSwarmKeys = new Set<string>();
      for (const [key, cur] of next) {
        const old = prev.get(key);
        if (!old) continue;
        const delta = old.hp - cur.hp;
        if (delta <= 0) continue;
        if (key.startsWith("e:")) {
          const enemyId = key.slice(2);
          if (silent.has(enemyId)) continue;
          const group = getCombatBoardHelpers().swarmGroupForEnemy(state, enemyId);
          if (group) {
            const swarmKey = group.canonicalId;
            if (seenSwarmKeys.has(swarmKey)) continue;
            seenSwarmKeys.add(swarmKey);
            const displayId = getCombatBoardHelpers().swarmCanonicalDisplayId(state, group.memberIds);
            const anchor = state.enemies.find((e) => e.id === displayId);
            if (anchor) addIndicator(anchor.x, anchor.y, delta);
            continue;
          }
        }
        addIndicator(cur.x, cur.y, delta);
      }
      prev = next;
      return;
    }
    prev = snapshotUnitHp(state);
  });

  onUnmounted(() => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  });

  return { indicators };
}
