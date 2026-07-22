<script setup lang="ts">
import { getCombatBoardHelpers } from "../combat-board-helpers.js";
import { getEnemyListingByName, getEnemySpeed, isAutoResolvableEnemyAttack, isDirectTargetEnemyAttack, isPatternEnemyAttack, isSelectTargetEnemyAttack } from "@vtt-core/shared";
import { computed, ref, watch } from "vue";

import { useBoardActionMode } from "../composables/useBoardActionMode.js";
import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useCombatActions } from "../composables/useCombatActions.js";
import { useGameState } from "../composables/useGameState.js";

const { showGmCombatUi } = useCombatActions();
const { selectedEnemyId } = useBoardSelection();
const { gameState, send } = useGameState();
const { mode, gmEnemyAttack, attackAimed, startGmEnemyAttack, startGmSwarmAttack, clearMode } =
  useBoardActionMode();

const attackIndex = ref(0);

const activeEnemy = computed(() => {
  const id = selectedEnemyId.value;
  if (!id) return null;
  return gameState.value?.enemies.find((e) => e.id === id) ?? null;
});

const activeIsTower = computed(() =>
  activeEnemy.value ? getCombatBoardHelpers().isTowerEnemy(activeEnemy.value) : false,
);

const listing = computed(() => getEnemyListingByName(activeEnemy.value?.name));

const isInSwarm = computed(() => {
  const s = gameState.value;
  const enemy = activeEnemy.value;
  if (!s || !enemy) return false;
  const group = getCombatBoardHelpers().swarmGroupForEnemy(s, enemy.id);
  return (group?.size ?? 0) > 1;
});

const swarmDirectAttackIndex = computed(() => {
  const attacks = listing.value?.attacks ?? [];
  return attacks.findIndex((entry) => isDirectTargetEnemyAttack(entry.attack));
});

const showSwarmAttack = computed(
  () => !!activeEnemy.value && !activeIsTower.value && isInSwarm.value && swarmDirectAttackIndex.value >= 0,
);

const speedLabel = computed(() => {
  const enemy = activeEnemy.value;
  const s = gameState.value;
  if (!enemy || !s) return "—";
  const max = getEnemySpeed(enemy);
  const group = getCombatBoardHelpers().swarmGroupForEnemy(s, enemy.id);
  if (group && group.size > 1) {
    return `${getCombatBoardHelpers().getSwarmMovementRemaining(s, group.memberIds)}/${max}`;
  }
  const remaining = enemy.movementRemaining ?? max;
  return `${remaining}/${max}`;
});

const resolvableAttackIndices = computed(() => {
  const attacks = listing.value?.attacks ?? [];
  return attacks
    .map((entry, i) => (isAutoResolvableEnemyAttack(entry.attack) ? i : -1))
    .filter((i) => i >= 0);
});

const hasResolvableAttacks = computed(() => resolvableAttackIndices.value.length > 0);

const selectedAttack = computed(() => listing.value?.attacks?.[attackIndex.value]?.attack);

const isSelectTarget = computed(() =>
  selectedAttack.value ? isSelectTargetEnemyAttack(selectedAttack.value) : false,
);

const isPatternAttack = computed(() =>
  selectedAttack.value ? isPatternEnemyAttack(selectedAttack.value) : false,
);

const needsStainTeleport = computed(() => {
  const spec = listing.value?.attacks?.[attackIndex.value]?.attack;
  return spec?.specialId === "stain-teleport";
});

const needsFlowerbudPlant = computed(() => {
  const spec = listing.value?.attacks?.[attackIndex.value]?.attack;
  return spec?.specialId === "flowerbud-plant";
});

const usesBoardTargeting = computed(
  () =>
    needsStainTeleport.value ||
    needsFlowerbudPlant.value ||
    isSelectTarget.value ||
    isPatternAttack.value,
);

const targetingAttack = computed(
  () =>
    mode.value === "gmEnemyAttack" &&
    gmEnemyAttack.value?.enemyId === activeEnemy.value?.id &&
    (gmEnemyAttack.value?.swarm
      ? gmEnemyAttack.value.attackIndex === swarmDirectAttackIndex.value
      : gmEnemyAttack.value?.attackIndex === attackIndex.value),
);

const targetingSwarmAttack = computed(
  () => targetingAttack.value && !!gmEnemyAttack.value?.swarm,
);

const targetingPatternAttack = computed(
  () => targetingAttack.value && isPatternAttack.value,
);

const targetingStainDest = computed(
  () =>
    targetingAttack.value &&
    !!gmEnemyAttack.value?.stainTeleport &&
    !!(gmEnemyAttack.value.targetPlayerId || gmEnemyAttack.value.targetEnemyId),
);

const targetingFlowerbudPlant = computed(
  () => targetingAttack.value && (!!gmEnemyAttack.value?.plantFlowerbud || needsFlowerbudPlant.value),
);

watch(selectedEnemyId, () => {
  attackIndex.value = resolvableAttackIndices.value[0] ?? 0;
  clearMode();
});

watch(listing, () => {
  if (!resolvableAttackIndices.value.includes(attackIndex.value)) {
    attackIndex.value = resolvableAttackIndices.value[0] ?? 0;
  }
});

watch(attackIndex, () => {
  if (mode.value === "gmEnemyAttack") clearMode();
});

function runSwarmAttack() {
  const enemy = activeEnemy.value;
  const index = swarmDirectAttackIndex.value;
  if (!enemy || index < 0) return;
  startGmSwarmAttack(enemy.id, index);
}

function runAttack() {
  const enemy = activeEnemy.value;
  if (!enemy) return;
  const attackSpec = listing.value?.attacks?.[attackIndex.value]?.attack;
  if (!attackSpec || !isAutoResolvableEnemyAttack(attackSpec)) return;
  if (
    needsFlowerbudPlant.value ||
    needsStainTeleport.value ||
    isSelectTarget.value ||
    isPatternAttack.value
  ) {
    startGmEnemyAttack(enemy.id, attackIndex.value, undefined, {
      stainTeleport: needsStainTeleport.value,
      plantFlowerbud: needsFlowerbudPlant.value,
    });
  }
}

function exhaustEnemy() {
  const enemy = activeEnemy.value;
  if (!enemy) return;
  send({ type: "gmEnemyAction", action: { action: "exhaust", enemyId: enemy.id } });
}
</script>

<template>
  <div v-if="showGmCombatUi && activeEnemy" class="action-bar gm-bar">
    <div class="budget-row">
      <span class="chip enemy-name">{{ activeEnemy.name ?? activeEnemy.id }}</span>
      <span v-if="activeEnemy.exhausted && !activeIsTower" class="chip spent">Exhausted</span>
      <span v-else-if="!activeIsTower" class="chip speed">Speed {{ speedLabel }}</span>
    </div>
    <div v-if="showSwarmAttack" class="actions-row">
      <button type="button" class="action-btn primary" @click="runSwarmAttack">
        {{ targetingSwarmAttack ? "Targeting…" : "Swarm attack" }}
      </button>
      <button type="button" class="action-btn" @click="exhaustEnemy">Exhaust</button>
    </div>
    <div v-else-if="hasResolvableAttacks && !activeIsTower" class="actions-row">
      <select v-model="attackIndex" class="select">
        <option
          v-for="i in resolvableAttackIndices"
          :key="i"
          :value="i"
        >
          Attack {{ i + 1 }}
        </option>
      </select>
      <button type="button" class="action-btn" @click="runAttack">
        {{
          usesBoardTargeting
            ? targetingAttack
              ? "Targeting…"
              : "Target"
            : "Attack"
        }}
      </button>
      <button type="button" class="action-btn" @click="exhaustEnemy">Exhaust</button>
    </div>
    <div v-else-if="!activeIsTower" class="actions-row">
      <button type="button" class="action-btn" @click="exhaustEnemy">Exhaust</button>
    </div>
    <p v-if="targetingSwarmAttack" class="attack-hint">Click a highlighted player to attack</p>
    <p v-else-if="targetingStainDest" class="attack-hint">Click a stained square to move the target</p>
    <p v-else-if="targetingFlowerbudPlant" class="attack-hint">Click an adjacent empty square to plant a Flowerbud</p>
    <p v-else-if="targetingAttack && needsStainTeleport" class="attack-hint">Click an adjacent unit, then a stained square</p>
    <p v-else-if="targetingPatternAttack && !attackAimed" class="attack-hint">
      Click a pattern tile to aim, then click the pattern to attack
    </p>
    <p v-else-if="targetingPatternAttack" class="attack-hint">Click the highlighted pattern to attack</p>
    <p v-else-if="targetingAttack" class="attack-hint">Click a highlighted unit to attack</p>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.budget-row,
.actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.chip.spent {
  opacity: 0.45;
}

.chip.enemy-name {
  font-weight: 600;
}

.select {
  max-width: 10rem;
  padding: 0.25rem 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: inherit;
  font: inherit;
}

.action-btn {
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.action-btn.primary {
  border-color: var(--color-accent);
  background: var(--color-accent-subtle-bg);
}

.attack-hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-muted);
}
</style>
