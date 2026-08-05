<script setup lang="ts">
import { computed } from "vue";

import { getWeaponAttackSpec } from "@vtt-core/shared";

import { boardModeForWeapon } from "../client-content-pack.js";
import { useCombatActions } from "../composables/useCombatActions.js";
import { useCombatModeActions } from "../composables/useCombatModeActions.js";
import { useCombatModeHints } from "../composables/useCombatModeHints.js";
import { useBoardActionMode } from "../composables/useBoardActionMode.js";
import { useGameState } from "../composables/useGameState.js";
import { usePhaseAction } from "../composables/usePhaseAction.js";
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
  showAssistedLaunch,
  canAssistedLaunch,
  showAegis,
  canUseAegis,
  aegisLabel,
  activePlayer,
  playerMovePending,
  sendPlayerAction,
  classActiveTier,
  canUseClassActive,
  hasFreeWeaponSwap,
} = useCombatActions();

const { gameState } = useGameState();
const { phaseAction, onPhaseAction } = usePhaseAction();

const showEndTurnHere = computed(() => phaseAction.value?.action === "endPlayerTurn");

const weaponName = computed(() => activePlayer.value?.weapon ?? null);
const weaponActiveModeActive = computed(() => {
  if (mode.value === "omnistrike") return true;
  return !!weaponName.value && boardModeForWeapon(weaponName.value) === mode.value;
});

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

const sprintLabel = computed(() => {
  const b = budget.value;
  if (!b || (b.sprintRemaining ?? 0) <= 0) return null;
  return `${b.sprintRemaining}/${b.sprintMax ?? b.sprintRemaining}`;
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

function weaponSwap() {
  sendPlayerAction({ action: "weaponSwap" });
  clearMode();
}
</script>

<template>
  <div
    v-if="showPlayerActionBar"
    class="action-bar"
    :class="{ pending: playerMovePending }"
    :inert="playerMovePending || undefined"
    :aria-disabled="playerMovePending"
  >
    <div class="top-row">
      <div class="movement-group">
        <span class="chip speed">Speed {{ speedLabel }}</span>
        <button type="button" class="action-btn" :class="{ active: mode === 'move' }" @click="pickMode('move')">
          Move
        </button>
        <span v-if="sprintLabel" class="chip sprint" data-testid="sprint-remaining">
          Sprint {{ sprintLabel }}
        </span>
        <button
          type="button"
          class="action-btn"
          :class="{ active: mode === 'sprint' || !!sprintLabel }"
          :disabled="mode !== 'sprint' && !canStartSprint"
          @click="pickMode('sprint')"
        >
          Sprint
        </button>
      </div>
      <button v-if="showEndTurnHere" type="button" class="end-turn-btn" @click="onPhaseAction">
        {{ phaseAction!.label }}
      </button>
    </div>
    <div class="budget-row">
      <ActionBudgetChips
        :interactive="showPlayerActionBar && !sandboxMode"
        v-bind="actionBudgetChips"
        :haste-stacks="hasteRemaining"
        @commit-haste="commitHaste"
      />
    </div>
    <div class="tier-columns">
      <div class="tier-column">
        <h3 class="tier-column-heading">Main</h3>
        <div class="tier-column-buttons">
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
            v-if="classActiveTier === 'main'"
            type="button"
            class="action-btn"
            :class="{ active: classModeActive }"
            :disabled="!canUseClassActive"
            @click="useClassActive"
          >
            Class
          </button>
          <button
            type="button"
            class="action-btn"
            :class="{ active: weaponActiveModeActive }"
            :disabled="!canUseWeaponActive"
            @click="useWeaponActive()"
          >
            Weapon
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
      </div>
      <div class="tier-column">
        <h3 class="tier-column-heading">Support</h3>
        <div class="tier-column-buttons">
          <button
            v-if="classActiveTier === 'support'"
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
          <button type="button" class="action-btn" :disabled="!canUseEquipment" @click="useEquipment">
            Equip
          </button>
        </div>
      </div>
      <div class="tier-column">
        <h3 class="tier-column-heading">Aux</h3>
        <div class="tier-column-buttons">
          <button
            v-if="classActiveTier === 'aux'"
            type="button"
            class="action-btn"
            :class="{ active: classModeActive }"
            :disabled="!canUseClassActive"
            @click="useClassActive"
          >
            Class
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
          <button type="button" class="action-btn" :disabled="!canAux && !hasFreeWeaponSwap" @click="weaponSwap">
            Swap{{ hasFreeWeaponSwap ? " (free)" : "" }}
          </button>
        </div>
      </div>
      <div class="tier-column misc-column">
        <h3 class="tier-column-heading">Other</h3>
        <div class="tier-column-buttons">
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
          <button
            v-if="canTowerTeleport"
            type="button"
            class="action-btn"
            :class="{ active: mode === 'towerTeleport' }"
            @click="pickTowerTeleportMode"
          >
            Tower step
          </button>
        </div>
      </div>
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
  border-radius: 3px;
  background: var(--color-surface);
  box-shadow: var(--shadow-emboss-lo);
}

.action-bar.pending {
  opacity: 0.55;
}

.budget-row,
.hint-row,
.omnistrike-picker-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.movement-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.chip.sprint {
  color: var(--color-purple);
  border-color: var(--color-purple-outline);
}

.end-turn-btn {
  flex-shrink: 0;
  border: 1px solid var(--color-accent-muted);
  border-radius: 3px;
  background: var(--color-accent-subtle-bg);
  color: var(--color-accent-bright);
  padding: 0.3rem 0.85rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.end-turn-btn:hover {
  background: var(--color-accent-hover-bg);
  border-color: var(--color-accent-bright);
}

.tier-columns {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.tier-column {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-surface-raised);
}

.misc-column {
  margin-left: auto;
}

.tier-column-heading {
  margin: 0;
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.tier-column-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
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
  border-radius: 3px;
  border: 1px solid var(--color-border);
  color: var(--color-muted);
}
</style>
