<script setup lang="ts">
import { YADATHAN_ARMOR_NAME } from "@gaem/hellpiercers-content/combat-ui";
import type { PlayerArmor, PlayerClass, PlayerEquipment, PlayerGear, PlayerWeapon, UnlockCategory } from "@gaem/shared";
import { PLAYER_ARMOR, PLAYER_CLASSES, PLAYER_EQUIPMENT, PLAYER_GEAR, PLAYER_WEAPONS } from "@gaem/shared";
import { computed, ref } from "vue";

import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useCampaignUnlocks } from "../composables/useCampaignUnlocks.js";
import { useCharacterSheetSelection } from "../composables/useCharacterSheetSelection.js";
import { useExpandableSet } from "../composables/useExpandableSet.js";
import PanelShell from "./PanelShell.vue";
import PlayerItemDetail from "./PlayerItemDetail.vue";
import { getClientCombatBoard } from "../client-content-pack.js";

const props = defineProps<{
  category: "armor" | "classes" | "weapons" | "equipment" | "gear";
}>();

const { closeRightPanel } = useBoardSelection();
const { gearPick, gearPickCategory, cancelGearPick, equipGear } = useCharacterSheetSelection();
const { optionUnlocked } = useCampaignUnlocks();
const { isExpanded, toggle } = useExpandableSet();
const combatBoard = getClientCombatBoard();
const equipping = ref(false);
const equipError = ref<string | null>(null);
const towerModalOpen = ref(false);
const towerDraft = ref("");
const pendingYadathanEquip = ref(false);

const selectionMode = computed(
  () => !!gearPick.value && gearPickCategory.value === props.category,
);

const unlockCategory = computed((): UnlockCategory => {
  if (props.category === "classes") return "classes";
  if (props.category === "equipment") return "equipment";
  if (props.category === "gear") return "gear";
  return props.category;
});

const browseTitle = computed(() => {
  if (props.category === "armor") return "Armor";
  if (props.category === "classes") return "Classes";
  if (props.category === "equipment") return "Equipment";
  if (props.category === "gear") return "Gear";
  return "Weapons";
});

const selectionTitle = computed(() => {
  if (props.category === "armor") return "Select new armor";
  if (props.category === "classes") return "Select new class";
  if (props.category === "equipment") return "Select new equipment";
  if (props.category === "gear") return "Select new gear";
  return "Select new weapon";
});

const title = computed(() => (selectionMode.value ? selectionTitle.value : browseTitle.value));
const currentValue = computed(() => gearPick.value?.currentValue ?? "");
const currentTower = computed(() => gearPick.value?.yadathanTower ?? "");

const gearSlotFilter = computed(() => gearPick.value?.gearSlotFilter);

const items = computed(() => {
  let list: readonly (PlayerClass | PlayerArmor | PlayerWeapon | PlayerEquipment | PlayerGear)[];
  if (props.category === "armor") list = PLAYER_ARMOR;
  else if (props.category === "classes") list = PLAYER_CLASSES;
  else if (props.category === "equipment") list = PLAYER_EQUIPMENT;
  else if (props.category === "gear") {
    const slot = gearSlotFilter.value;
    list = slot ? PLAYER_GEAR.filter((g) => g.slot === slot) : PLAYER_GEAR;
  } else list = PLAYER_WEAPONS;

  const cat = unlockCategory.value;
  const equipped = currentValue.value;
  return [...list].sort((a, b) => {
    if (equipped) {
      const aEquipped = a.name === equipped;
      const bEquipped = b.name === equipped;
      if (aEquipped !== bEquipped) return aEquipped ? -1 : 1;
    }
    const aLocked = !optionUnlocked(cat, a.name);
    const bLocked = !optionUnlocked(cat, b.name);
    if (aLocked !== bLocked) return aLocked ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
});

function isLocked(name: string): boolean {
  return !optionUnlocked(unlockCategory.value, name);
}

function onClose() {
  if (selectionMode.value) cancelGearPick();
  else closeRightPanel();
}

async function onEquip(item: PlayerClass | PlayerArmor | PlayerWeapon | PlayerEquipment | PlayerGear) {
  if (equipping.value || isLocked(item.name)) return;
  if (item.name === YADATHAN_ARMOR_NAME && props.category === "armor") {
    if (item.name === currentValue.value) {
      openTowerModal(false);
      return;
    }
    openTowerModal(true);
    return;
  }
  if (item.name === currentValue.value) return;
  equipping.value = true;
  equipError.value = null;
  const err = await equipGear(item.name);
  if (err) equipError.value = err;
  equipping.value = false;
}

function openTowerModal(equipArmor: boolean) {
  towerDraft.value = currentTower.value;
  pendingYadathanEquip.value = equipArmor;
  towerModalOpen.value = true;
}

function closeTowerModal() {
  towerModalOpen.value = false;
  towerDraft.value = "";
  pendingYadathanEquip.value = false;
}

async function confirmTowerPick(tower: string) {
  equipping.value = true;
  equipError.value = null;
  const err = await equipGear(YADATHAN_ARMOR_NAME, { yadathanTower: tower });
  closeTowerModal();
  if (err) equipError.value = err;
  equipping.value = false;
}

function yadathanEquipLabel(name: string): string {
  if (name !== currentValue.value) return "Equip";
  return "Change tower";
}
</script>

<template>
  <PanelShell
    :title="title"
    :show-back="selectionMode"
    @back="cancelGearPick"
    @close="onClose"
  >
    <div class="panel-body">
      <p v-if="equipError" class="error">{{ equipError }}</p>
      <article
        v-for="item in items"
        :key="item.name"
        class="list-card"
        :class="{ 'list-card--locked': isLocked(item.name) }"
      >
        <div
          class="list-card-header"
          :class="{ expanded: isExpanded(item.name) }"
        >
          <button
            type="button"
            class="list-card-header-main"
            @click="toggle(item.name)"
          >
            <span class="item-name">{{ item.name }}</span>
          </button>
          <div class="list-card-actions">
            <span v-if="isLocked(item.name)" class="locked-chip">Locked</span>
            <button
              v-if="selectionMode && !isLocked(item.name)"
              type="button"
              class="equip-btn cta secondary"
              :disabled="
                item.name === YADATHAN_ARMOR_NAME && category === 'armor'
                  ? equipping
                  : item.name === currentValue || equipping
              "
              @click="onEquip(item)"
            >
              {{
                item.name === YADATHAN_ARMOR_NAME && category === 'armor'
                  ? yadathanEquipLabel(item.name)
                  : item.name === currentValue
                    ? "Equipped"
                    : "Equip"
              }}
            </button>
            <button
              type="button"
              class="chevron-toggle"
              :class="{ expanded: isExpanded(item.name) }"
              :aria-expanded="isExpanded(item.name)"
              :aria-label="`${isExpanded(item.name) ? 'Hide' : 'Show'} ${item.name} details`"
              @click="toggle(item.name)"
            >
              <span class="chevron" aria-hidden="true">{{ isExpanded(item.name) ? "▾" : "▸" }}</span>
            </button>
          </div>
        </div>

        <div v-if="isExpanded(item.name)" class="list-card-body">
          <p v-if="'summary' in item && item.summary" class="item-summary">{{ item.summary }}</p>
          <p v-if="item.description" class="item-description">{{ item.description }}</p>
          <PlayerItemDetail
            :item="item"
            :kind="category"
            :selected-tower="
              category === 'armor' && item.name === YADATHAN_ARMOR_NAME ? currentTower : undefined
            "
          />
        </div>
      </article>
    </div>

    <component
      :is="combatBoard.towerModal"
      v-if="combatBoard.towerModal"
      :open="towerModalOpen"
      :model-value="towerDraft"
      :title="pendingYadathanEquip ? 'Select tower type' : 'Change tower type'"
      @close="closeTowerModal"
      @confirm="confirmTowerPick"
    />
  </PanelShell>
</template>

<style scoped>
.list-card-header {
  justify-content: flex-start;
  gap: 0.35rem;
  padding: 0.35rem 0 0.35rem 0;
  cursor: default;
}

.chevron {
  color: var(--color-muted);
  font-size: 1.5rem;
  line-height: 1;
}

.item-summary {
  margin: 0 0 0.5rem;
  font-weight: 600;
  color: var(--color-text);
}

.list-card--locked .item-name {
  color: var(--color-muted);
}

.list-card-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 0.35rem;
  margin-right: 0.35rem;
}

.locked-chip {
  flex-shrink: 0;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--color-surface-raised);
  color: var(--color-muted);
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.list-card-header-main {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--color-text);
  padding: 0.25rem 0.5rem 0.25rem 0.75rem;
  font-family: var(--font-heading);
  font-weight: 500;
  font-size: 0.9rem;
  letter-spacing: 0.04rem;
  text-align: left;
  cursor: pointer;
}

.list-card-header-main .item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-card-header.expanded {
  align-items: flex-start;
}

.list-card-header.expanded .list-card-header-main {
  align-items: flex-start;
}

.list-card-header.expanded .list-card-header-main .item-name {
  overflow: visible;
  text-overflow: unset;
  white-space: normal;
  word-break: break-word;
}

.list-card-header.expanded .list-card-actions {
  padding-top: 0.2rem;
}

.list-card-header-main:hover,
.list-card-header.expanded .list-card-header-main {
  background: var(--color-surface-hover);
}

.chevron-toggle {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0;
}

.chevron-toggle:hover,
.chevron-toggle.expanded {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.equip-btn {
  flex-shrink: 0;
  padding: 0.3rem 0.55rem;
  font-size: 0.75rem;
}

.error {
  margin: 0 0 0.75rem;
  color: var(--color-danger);
}
</style>
