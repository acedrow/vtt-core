<script setup lang="ts">
import { computed } from "vue";

import { getWeaponAttackSpec } from "@vtt-core/shared";

import { useCombatActions } from "../composables/useCombatActions.js";
import { useCombatModeActions } from "../composables/useCombatModeActions.js";
import { useCombatModeHints } from "../composables/useCombatModeHints.js";
import { useBoardActionMode } from "../composables/useBoardActionMode.js";
import { useGameState } from "../composables/useGameState.js";
import ActionBudgetChips from "./ActionBudgetChips.vue";
import WeaponPatternDiagram from "./WeaponPatternDiagram.vue";

const {
  showPlayerActionBar,
  budget,
  canMain,
  canSupport,
  canUseEquipment,
  canAux,
  hasteRemaining,
  actionBudgetChips,
  sandboxMode,
  commitHaste,
  canStartSprint,
  hasWeaponAttack,
  canUseWeaponActive,
  armorStructured,
  canTowerTeleport,
  canInteractSeed,
  showAssistedLaunch,
  canAssistedLaunch,
  showAegis,
  canUseAegis,
  aegisLabel,
  activePlayer,
  sendPlayerAction,
  canUseClassActive,
  hasFreeWeaponSwap,
} = useCombatActions();

const { gameState } = useGameState();

const weaponName = computed(() => activePlayer.value?.weapon ?? null);

const {
  mode,
  omnistrikeStep,
  omnistrikeBombs,
  kataptyTargetIds,
  classModeActive,
  showHephaestusRestore,
  showHarpeRecall,
  pickMode,
  pickAegisMode,
  pickArmorMode,
  pickTowerTeleportMode,
  pickAssistedLaunchMode,
  useClassActive,
  useHephaestusRestore,
  recallHarpeTrap,
  useWeaponActive,
  confirmKatapty,
  canConfirmRangeAttack,
  submitRangeAttack,
  onDualBombIndices,
  onDualBombComplete,
  clearMode,
} = useCombatModeActions();

const { armorPush } = useBoardActionMode();

const { boardHintRows } = useCombatModeHints({
  player: activePlayer,
  weaponName,
});

const speedLabel = computed(() => {
  if (!budget.value) return "—";
  return `${budget.value.movementRemaining}/${budget.value.movementMax}`;
});

const sabaothAttackSpec = computed(() => {
  const weapon = activePlayer.value?.weapon;
  if (!weapon) return null;
  return getWeaponAttackSpec(weapon);
});

const boardObjectLegend = computed(() => {
  const combat = gameState.value?.combat;
  if (!combat) return [];
  const items: string[] = [];
  if ((combat.thrownTraps ?? []).length) items.push("Trap");
  if ((combat.boardTokens ?? []).length) items.push("Token");
  if ((combat.attractors ?? []).length) items.push("Attractor");
  const marks = combat.marks;
  if (marks && Object.keys(marks).length) items.push("Marked");
  return items;
});

function useEquipment() {
  sendPlayerAction({ action: "useEquipment" });
}

function useInteract() {
  sendPlayerAction({ action: "interact" });
}

function weaponSwap() {
  sendPlayerAction({ action: "weaponSwap" });
  clearMode();
}
</script>

<template>
  <div v-if="showPlayerActionBar" class="action-bar">
    <div class="budget-row">
      <ActionBudgetChips
        :interactive="showPlayerActionBar && !sandboxMode"
        v-bind="actionBudgetChips"
        :haste-stacks="hasteRemaining"
        @commit-haste="commitHaste"
      />
      <span class="chip speed">Speed {{ speedLabel }}</span>
    </div>
    <div class="actions-row">
      <button type="button" class="action-btn" :class="{ active: mode === 'move' }" @click="pickMode('move')">
        Move
      </button>
      <button
        type="button"
        class="action-btn"
        :class="{ active: mode === 'attack' }"
        :disabled="!canMain || !hasWeaponAttack"
        @click="pickMode('attack')"
      >
        Attack
      </button>
      <button
        type="button"
        class="action-btn"
        :class="{ active: mode === 'shove' }"
        :disabled="!canAux"
        @click="pickMode('shove')"
      >
        Shove
      </button>
      <button
        type="button"
        class="action-btn"
        :class="{ active: mode === 'sprint' }"
        :disabled="mode !== 'sprint' && !canStartSprint"
        @click="pickMode('sprint')"
      >
        Sprint
      </button>
      <button
        v-if="showAegis"
        type="button"
        class="action-btn"
        :class="{ active: mode === 'aegis' }"
        :disabled="mode !== 'aegis' && !canUseAegis"
        @click="pickAegisMode"
      >
        Aegis {{ aegisLabel }}
      </button>
      <button
        v-if="showAssistedLaunch"
        type="button"
        class="action-btn"
        :class="{ active: mode === 'assistedLaunch' }"
        :disabled="mode !== 'assistedLaunch' && !canAssistedLaunch"
        @click="pickAssistedLaunchMode"
      >
        Launch
      </button>
      <button type="button" class="action-btn" :disabled="!canAux && !hasFreeWeaponSwap" @click="weaponSwap">
        Swap{{ hasFreeWeaponSwap ? " (free)" : "" }}
      </button>
    </div>
    <div class="actions-row">
      <button
        type="button"
        class="action-btn"
        :class="{ active: classModeActive }"
        :disabled="!canUseClassActive"
        @click="useClassActive"
      >
        Class
      </button>
      <button
        v-if="showHephaestusRestore"
        type="button"
        class="action-btn"
        :class="{ active: mode === 'hephaestusRestore' }"
        @click="useHephaestusRestore"
      >
        Restore EQ
      </button>
      <button
        v-if="showHarpeRecall"
        type="button"
        class="action-btn"
        @click="recallHarpeTrap"
      >
        Recall
      </button>
      <button
        type="button"
        class="action-btn"
        :class="{
          active:
            mode === 'armorTeleport' || mode === 'armorPush' || mode === 'armorPlaceTower',
        }"
        :disabled="!canSupport || !armorStructured"
        @click="pickArmorMode()"
      >
        Armor
      </button>
      <button
        v-if="canTowerTeleport"
        type="button"
        class="action-btn"
        :class="{ active: mode === 'towerTeleport' }"
        @click="pickTowerTeleportMode"
      >
        Tower step
      </button>
      <button
        type="button"
        class="action-btn"
        :class="{ active: mode === 'omnistrike' || mode === 'warhook' }"
        :disabled="!canUseWeaponActive"
        @click="useWeaponActive()"
      >
        Weapon
      </button>
      <button type="button" class="action-btn" :disabled="!canUseEquipment" @click="useEquipment">
        Equip
      </button>
      <button type="button" class="action-btn" :disabled="!canSupport && !canInteractSeed" @click="useInteract">
        Use
      </button>
      <button
        type="button"
        class="action-btn"
        :class="{ active: mode === 'rez' }"
        :disabled="!canMain"
        @click="pickMode('rez')"
      >
        Rez
      </button>
    </div>
    <div
      v-if="mode === 'omnistrike' && omnistrikeStep === 'selectBombs' && sabaothAttackSpec"
      class="omnistrike-picker-row"
    >
      <WeaponPatternDiagram
        :attack="sabaothAttackSpec"
        dual-select
        compact
        :dual-bomb-indices="omnistrikeBombs"
        @update:dual-bomb-indices="onDualBombIndices"
        @dual-complete="onDualBombComplete"
      />
    </div>
    <div v-if="mode === 'armorPush'" class="hint-row">
      <span class="hint">Push:</span>
      <button
        v-for="n in 3"
        :key="n"
        type="button"
        class="action-btn"
        :class="{ active: armorPush === n }"
        @click="armorPush = n as 1 | 2 | 3"
      >
        {{ n }}
      </button>
    </div>
    <div v-for="row in boardHintRows" :key="row.key" class="hint-row">
      <span class="hint">{{ row.text }}</span>
      <button
        v-if="row.key === 'katapty' && kataptyTargetIds.length"
        type="button"
        class="action-btn"
        :disabled="kataptyTargetIds.length !== 3"
        @click="confirmKatapty"
      >
        Confirm Katapty
      </button>
      <button
        v-if="row.key === 'attack' && canConfirmRangeAttack"
        type="button"
        class="action-btn"
        @click="submitRangeAttack"
      >
        Attack
      </button>
    </div>
    <div v-if="boardObjectLegend.length" class="hint-row legend-row">
      <span v-for="item in boardObjectLegend" :key="item" class="legend-chip">{{ item }}</span>
    </div>
    <button v-if="mode" type="button" class="action-btn cancel" @click="clearMode">
      Cancel
    </button>
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
.actions-row,
.hint-row,
.omnistrike-picker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.chip.speed {
  margin-left: auto;
}

.action-btn {
  background: var(--color-surface-raised);
}

.action-btn.active {
  border-color: var(--color-accent-bright);
  background: var(--color-accent-tint-bg);
}

.action-btn.cancel {
  align-self: flex-start;
  color: var(--color-muted);
}

.hint {
  font-size: 0.72rem;
  color: var(--color-muted);
}

.legend-chip {
  font-size: 0.68rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  color: var(--color-muted);
}
</style>
