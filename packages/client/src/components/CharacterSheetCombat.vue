<script setup lang="ts">
import { computed } from "vue";

import {
  getClassActiveTier,
  getEffectSummary,
  getArmorByName,
  getWeaponAttackSpec,
  hasSabaothBombSelected,
  isHeavenBurningWeaponName,
  isSabaothWeaponName,
  ASSISTED_ASCENSION_GEAR,
} from "@vtt-core/shared";
import { boardModeForEquipment, sheetFieldForArmor } from "../client-content-pack.js";
import { sheetTierMenuItems } from "../lib/sheetTierActions.js";

import { useBoardActionMode, type BoardActionMode } from "../composables/useBoardActionMode.js";
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
  canSupport,
  canAux,
  canUseEquipment,
  hasteRemaining,
  actionBudgetChips,
  sandboxMode,
  commitHaste,
  restorePlayerActionTier,
  canStartSprint,
  canTowerTeleport,
  showAssistedLaunch,
  canAssistedLaunch,
  showAegis,
  canUseAegis,
  aegisLabel,
  activePlayer,
  playerMovePending,
  hasEquipmentCharge,
  hasWeaponAttack,
  canUseWeaponActive,
  canUseHeavenBurningUnfold,
  canUseClassActive,
  hasFreeWeaponSwap,
  armorStructured,
  classActiveTier,
  sendPlayerAction,
  effectPills,
  isGm,
} = useCombatActions(() => props.playerId);

const { mode, setMode, clearMode, attackAimed, attackAnchor } = useBoardActionMode();

const {
  pickTowerTeleportMode,
  pickAssistedLaunchMode,
  pickAegisMode,
  pickArmorMode,
  useClassActive,
  useWeaponActive,
  toggleWeaponAttack,
  recallHarpeTrap,
  showHarpeRecall,
} = useCombatModeActions({
  playerId: () => props.playerId,
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

const pills = computed(() => (activePlayer.value ? effectPills(activePlayer.value) : []));

const showTowerStep = computed(
  () => !!activePlayer.value && !!sheetFieldForArmor(activePlayer.value.armor ?? ""),
);

const assistedLaunchAbility = computed(() =>
  activePlayer.value ? getArmorByName(activePlayer.value.armor ?? "")?.specialMovement : undefined,
);

const canUseWeaponAttack = computed(() => {
  const p = activePlayer.value;
  if (!p || !hasWeaponAttack.value) return false;
  if (isSabaothWeaponName(p.weapon) && !hasSabaothBombSelected(p)) return false;
  return true;
});

const replacesWeaponActive = computed(() => isHeavenBurningWeaponName(activePlayer.value?.weapon));

const tierMenuItems = computed(() => {
  const p = activePlayer.value;
  if (!p || !showPlayerActionBar.value) return undefined;
  const classTier = classActiveTier.value ?? getClassActiveTier(p.class);
  return sheetTierMenuItems([
    {
      id: "attack",
      label: "Attack",
      tier: "main",
      include: !!getWeaponAttackSpec(p.weapon),
      disabled: !canMain.value || !canUseWeaponAttack.value,
    },
    { id: "rez", label: "Rez", tier: "main", include: true, disabled: !canMain.value },
    {
      id: "weaponActive",
      label: "Weapon",
      tier: "main",
      include: !!p.weapon && !replacesWeaponActive.value,
      disabled: !canUseWeaponActive.value,
    },
    {
      id: "classActive",
      label: "Class",
      tier: classTier,
      include: !!p.class,
      disabled: !canUseClassActive.value,
    },
    {
      id: "armor",
      label: "Armor",
      tier: "support",
      include: !!armorStructured.value,
      disabled: !canSupport.value || !armorStructured.value,
    },
    {
      id: "equipment",
      label: "Equip",
      tier: "support",
      include: !!p.equipment,
      disabled: !canUseEquipment.value,
    },
    {
      id: "gear",
      label: "Gear",
      tier: "support",
      include: !!p.gear && p.gear !== ASSISTED_ASCENSION_GEAR,
      disabled: !canSupport.value,
    },
    {
      id: "harpeRecall",
      label: "Recall trap",
      tier: "support",
      include: showHarpeRecall.value,
      disabled: !canSupport.value,
    },
    { id: "shove", label: "Shove", tier: "aux", include: true, disabled: !canAux.value },
    {
      id: "sprint",
      label: "Sprint",
      tier: "aux",
      include: true,
      disabled: mode.value !== "sprint" && !canStartSprint.value,
    },
    {
      id: "swap",
      label: hasFreeWeaponSwap.value ? "Swap (free)" : "Swap",
      tier: "aux",
      include: !!p.weapon2 || hasFreeWeaponSwap.value,
      disabled: !canAux.value && !hasFreeWeaponSwap.value,
    },
    {
      id: "unfold",
      label: "Unfold",
      tier: "aux",
      include: replacesWeaponActive.value,
      disabled: !canUseHeavenBurningUnfold.value,
    },
  ]);
});

function pillTitle(token: string) {
  const id = token.split(":")[0] ?? token;
  return getEffectSummary(id) ?? token;
}

function pickSprintMode() {
  if (mode.value === "sprint") clearMode();
  else setMode("sprint");
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

function useEquipmentItem() {
  const equipment = activePlayer.value?.equipment;
  if (!equipment) return;
  const boardMode = boardModeForEquipment(equipment);
  if (boardMode) {
    if (mode.value === boardMode) clearMode();
    else {
      attackAimed.value = false;
      attackAnchor.value = null;
      setMode(boardMode as BoardActionMode);
    }
    return;
  }
  sendPlayerAction({ action: "useEquipment", detail: equipment });
}

function onSelectMenuItem(id: string) {
  if (id === "attack") toggleWeaponAttack();
  else if (id === "rez") pickRezMode();
  else if (id === "weaponActive") useWeaponActive(activePlayer.value?.weapon);
  else if (id === "classActive") useClassActive();
  else if (id === "armor") pickArmorMode(armorStructured.value);
  else if (id === "equipment") useEquipmentItem();
  else if (id === "gear") sendPlayerAction({ action: "interact", detail: activePlayer.value?.gear });
  else if (id === "harpeRecall") recallHarpeTrap();
  else if (id === "shove") pickShoveMode();
  else if (id === "sprint") pickSprintMode();
  else if (id === "swap") {
    clearMode();
    sendPlayerAction({ action: "weaponSwap" });
  } else if (id === "unfold") useWeaponActive(activePlayer.value?.weapon);
}
</script>

<template>
  <div v-if="activePlayer && (showSheetCombatPanel || pills.length)" class="sheet-combat-wrap">
    <div
      v-if="showSheetCombatPanel"
      class="sheet-combat"
      :class="{ pending: playerMovePending }"
      :inert="playerMovePending || undefined"
      :aria-disabled="playerMovePending"
    >
      <div class="budget-row">
        <ActionBudgetChips
          fill
          :interactive="showPlayerActionBar && !sandboxMode"
          :gm-restore="canGmRestoreActionTier"
          :menu-enabled="showPlayerActionBar"
          :menu-items="tierMenuItems"
          v-bind="actionBudgetChips"
          :haste-stacks="hasteRemaining"
          @commit-haste="commitHaste"
          @restore-tier="restorePlayerActionTier"
          @select-menu-item="onSelectMenuItem"
        />
        <span class="stat equip-charges" :data-charges="activePlayer.equipmentUses ?? 1">
          Equip {{ hasEquipmentCharge ? "●" : "○" }}
        </span>
      </div>

      <div class="speed-row">
        <span class="stat">Speed {{ speedLabel }}</span>
        <span v-if="sprintLabel" class="stat sprint-budget" data-testid="sprint-remaining">
          Sprint {{ sprintLabel }}
        </span>
        <template v-if="!isGm">
          <SheetActionButton
            :active="mode === 'sprint' || !!sprintLabel"
            :disabled="!showPlayerActionBar || (mode !== 'sprint' && !canStartSprint)"
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
            :disabled="!showPlayerActionBar || (mode !== 'aegis' && !canUseAegis)"
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
            :disabled="!showPlayerActionBar || !canTowerTeleport"
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
            :disabled="!showPlayerActionBar || (mode !== 'assistedLaunch' && !canAssistedLaunch)"
            @click="pickAssistedLaunchMode"
          >
            Launch
            <template #tooltip>
              <AbilityBlock tier-label="Special movement" :content="assistedLaunchAbility" />
            </template>
          </SheetActionButton>
        </template>
      </div>

      <div v-if="!isGm" class="action-row">
        <SheetActionButton
          :active="mode === 'rez'"
          :disabled="!showPlayerActionBar || (mode !== 'rez' && !canMain)"
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
          :disabled="!showPlayerActionBar || (mode !== 'shove' && !canAux)"
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

.sheet-combat.pending {
  opacity: 0.55;
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

.stat.sprint-budget {
  color: var(--color-purple);
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
