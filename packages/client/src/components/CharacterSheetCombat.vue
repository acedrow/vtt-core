<script setup lang="ts">
import { isYadathanArmorName } from "@vtt-core/hellpiercers-content/combat-ui";
import { computed } from "vue";

import { getEffectSummary, getArmorByName, KUSHIEL_ARMOR_NAME } from "@vtt-core/shared";

import { useBoardActionMode } from "../composables/useBoardActionMode.js";
import { useCombatActions } from "../composables/useCombatActions.js";
import { useCombatModeActions } from "../composables/useCombatModeActions.js";
import AbilityBlock from "./AbilityBlock.vue";
import ActionBudgetChips from "./ActionBudgetChips.vue";
import SheetActionButton from "./SheetActionButton.vue";

const props = defineProps<{ playerId: string }>();

const {
  showPlayerActionBar,
  showSheetCombatPanel,
  canGmRestoreActionTier,
  budget,
  canMain,
  canAux,
  hasteRemaining,
  actionBudgetChips,
  sandboxMode,
  commitHaste,
  restorePlayerActionTier,
  canStartSprint,
  canResetMovement,
  canTowerTeleport,
  showAssistedLaunch,
  canAssistedLaunch,
  showAegis,
  canUseAegis,
  aegisLabel,
  activePlayer,
  hasEquipmentCharge,
  effectPills,
  resetMovement,
} = useCombatActions(() => props.playerId);

const { mode, setMode, clearMode } = useBoardActionMode();

const { pickTowerTeleportMode, pickAssistedLaunchMode, pickAegisMode } = useCombatModeActions({
  playerId: () => props.playerId,
});

const speedLabel = computed(() => {
  if (!budget.value) return "—";
  return `${budget.value.movementRemaining}/${budget.value.movementMax}`;
});

const pills = computed(() => (activePlayer.value ? effectPills(activePlayer.value) : []));

const showTowerStep = computed(
  () => activePlayer.value && isYadathanArmorName(activePlayer.value.armor),
);

const assistedLaunchAbility = computed(() => getArmorByName(KUSHIEL_ARMOR_NAME)?.specialMovement);

function pillTitle(token: string) {
  const id = token.split(":")[0] ?? token;
  return getEffectSummary(id) ?? token;
}

function onResetMovement() {
  clearMode();
  resetMovement();
}

function pickSprintMode() {
  if (mode.value === "sprint") clearMode();
  else {
    if (mode.value === "aegis") clearMode();
    setMode("sprint");
  }
}

function pickAegisToggle() {
  pickAegisMode();
}

function pickRezMode() {
  if (mode.value === "rez") clearMode();
  else setMode("rez");
}

function pickShoveMode() {
  if (mode.value === "shove") clearMode();
  else setMode("shove");
}
</script>

<template>
  <div v-if="activePlayer && (showSheetCombatPanel || pills.length)" class="sheet-combat-wrap">
    <div v-if="showSheetCombatPanel" class="sheet-combat">
      <div class="budget-row">
        <ActionBudgetChips
          fill
          :interactive="showPlayerActionBar && !sandboxMode"
          :gm-restore="canGmRestoreActionTier"
          v-bind="actionBudgetChips"
          :haste-stacks="hasteRemaining"
          @commit-haste="commitHaste"
          @restore-tier="restorePlayerActionTier"
        />
        <span class="stat equip-charges" :data-charges="activePlayer.equipmentUses ?? 1">
          Equip {{ hasEquipmentCharge ? "●" : "○" }}
        </span>
      </div>

      <div class="speed-row">
        <span class="stat">Speed {{ speedLabel }}</span>
        <template v-if="showPlayerActionBar">
          <SheetActionButton
            :disabled="!canResetMovement"
            @click="onResetMovement"
          >
            Reset movement
          </SheetActionButton>
          <SheetActionButton
            :active="mode === 'sprint'"
            :disabled="mode !== 'sprint' && !canStartSprint"
            @click="pickSprintMode"
          >
            Sprint
            <template #tooltip>
              <AbilityBlock tier-label="Aux action" content="Sprint — Move up to half your Speed." />
            </template>
          </SheetActionButton>
          <SheetActionButton
            v-if="showAegis"
            :active="mode === 'aegis'"
            :disabled="mode !== 'aegis' && !canUseAegis"
            @click="pickAegisToggle"
          >
            Aegis {{ aegisLabel }}
            <template #tooltip>
              <AbilityBlock
                tier-label="Movement"
                content="Fly over terrain for up to your Aegis stacks this turn. Does not Provoke."
              />
            </template>
          </SheetActionButton>
          <SheetActionButton
            v-if="showTowerStep"
            :active="mode === 'towerTeleport'"
            :disabled="!canTowerTeleport"
            @click="pickTowerTeleportMode"
          >
            Tower step
            <template #tooltip>
              <AbilityBlock
                tier-label="Special movement"
                content="Spend all remaining Speed to teleport adjacent to your tower."
              />
            </template>
          </SheetActionButton>
          <SheetActionButton
            v-if="showAssistedLaunch"
            :active="mode === 'assistedLaunch'"
            :disabled="mode !== 'assistedLaunch' && !canAssistedLaunch"
            @click="pickAssistedLaunchMode"
          >
            Launch
            <template #tooltip>
              <AbilityBlock tier-label="Special movement" :content="assistedLaunchAbility" />
            </template>
          </SheetActionButton>
        </template>
      </div>

      <div v-if="showPlayerActionBar" class="action-row">
        <SheetActionButton
          :active="mode === 'rez'"
          :disabled="mode !== 'rez' && !canMain"
          @click="pickRezMode"
        >
          Rez
          <template #tooltip>
            <AbilityBlock
              tier-label="Main action"
              content="Get a downed ally back on their feet. They instantly rejoin the fight and recover all HP."
            />
          </template>
        </SheetActionButton>
        <SheetActionButton
          :active="mode === 'shove'"
          :disabled="mode !== 'shove' && !canAux"
          @click="pickShoveMode"
        >
          Shove
          <template #tooltip>
            <AbilityBlock
              tier-label="Aux action"
              content="Push an adjacent Scale:1 character or enemy 1 space away from you."
            />
          </template>
        </SheetActionButton>
      </div>
    </div>

    <div v-if="pills.length" class="effect-pills">
      <span v-for="pill in pills" :key="pill" class="effect-pill" :title="pillTitle(pill)">
        {{ pill }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.sheet-combat-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.sheet-combat {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.budget-row {
  width: 100%;
}

.budget-row,
.action-row,
.speed-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.action-row,
.speed-row {
  justify-content: center;
}

.stat {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-muted);
}

.equip-charges {
  margin-left: auto;
  letter-spacing: 0.02em;
}

.effect-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.effect-pill {
  font-size: 0.68rem;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
}
</style>
