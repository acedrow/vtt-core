<script setup lang="ts">
import type {
  PlayerArmor,
  PlayerClass,
  PlayerEquipment,
  PlayerGear,
  PlayerWeapon,
} from "@vtt-core/shared";
import { ref } from "vue";

import PlayerItemDetail from "./PlayerItemDetail.vue";

defineProps<{
  label: string;
  value: string;
  kind: "classes" | "armor" | "weapons" | "equipment" | "gear";
  item: PlayerClass | PlayerArmor | PlayerWeapon | PlayerEquipment | PlayerGear | undefined;
  canEdit?: boolean;
  weaponBombIndex?: number;
  weaponBombSelectable?: boolean;
  selectedTower?: string;
}>();

const emit = defineEmits<{
  startEdit: [];
  "update:weaponBombIndex": [index: number];
  requestWeaponBombSelect: [index: number];
}>();

const detailOpen = ref(false);

function toggleDetail() {
  detailOpen.value = !detailOpen.value;
}
</script>

<template>
  <div class="gear-field">
    <div class="gear-field-card" :class="{ expanded: detailOpen }">
      <div
        class="field-row"
        :class="{
          stacked: kind !== 'classes' && kind !== 'armor',
          inline: kind === 'classes' || kind === 'armor',
          expanded: detailOpen,
        }"
      >
        <span class="field-label">{{ label }}:</span>
        <span class="field-value">{{ value || "—" }}</span>
        <div class="field-heading-actions">
          <button
            v-if="canEdit"
            type="button"
            class="edit-btn"
            :aria-label="`Change ${label.toLowerCase()}`"
            @click="emit('startEdit')"
          >
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.387 8.387L2.5 14.5l1.126-3.666 8.387-8.387z"
                fill="currentColor"
              />
            </svg>
          </button>
          <button
            v-if="item"
            type="button"
            class="detail-toggle"
            :aria-expanded="detailOpen"
            :aria-label="`${detailOpen ? 'Hide' : 'Show'} ${label.toLowerCase()} details`"
            @click="toggleDetail"
          >
            <span class="chevron" aria-hidden="true">{{ detailOpen ? "▾" : "▸" }}</span>
          </button>
        </div>
      </div>

      <div v-if="$slots.subline" class="field-subline">
        <slot name="subline" />
      </div>

      <div v-if="$slots.actions" class="field-actions">
        <slot name="actions" />
      </div>

      <div v-if="detailOpen && item" class="field-detail">
        <p v-if="'summary' in item && item.summary" class="item-summary">{{ item.summary }}</p>
        <p v-if="item.description" class="item-description">{{ item.description }}</p>
        <PlayerItemDetail
          :item="item"
          :kind="kind"
          :weapon-bomb-index="weaponBombIndex"
          :weapon-bomb-selectable="weaponBombSelectable"
          :selected-tower="selectedTower"
          @update:weapon-bomb-index="emit('update:weaponBombIndex', $event)"
          @request-weapon-bomb-select="emit('requestWeaponBombSelect', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.gear-field-card {
  padding: 0.35rem 0.45rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.field-row {
  font-size: 0.9rem;
  line-height: 1.4;
}

.field-row.stacked {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  row-gap: 0.15rem;
}

.field-row.inline {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 1.35rem;
}

.field-label {
  flex-shrink: 0;
  color: var(--color-muted);
  font-weight: 500;
}

.field-value {
  min-width: 0;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.field-row.stacked .field-label {
  grid-column: 1;
  grid-row: 1;
}

.field-row.stacked .field-heading-actions {
  grid-column: 2;
  grid-row: 1;
}

.field-row.stacked .field-value {
  grid-column: 1 / -1;
  grid-row: 2;
}

.field-row.inline .field-value {
  flex: 1;
}

.field-heading-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.field-subline {
  margin-top: 0.1rem;
  font-size: 0.75rem;
  color: var(--color-muted);
  font-weight: 600;
}

.field-row.expanded .field-value {
  overflow: visible;
  text-overflow: unset;
  white-space: normal;
  word-break: break-word;
}

.detail-toggle {
  flex-shrink: 0;
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0;
}

.detail-toggle:hover {
  color: var(--color-text);
  background: var(--color-surface);
}

.chevron {
  font-size: 1.5rem;
  line-height: 0.65;
}

.edit-btn {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0;
}

.edit-btn:hover {
  color: var(--color-accent);
  background: var(--color-surface);
}

.edit-btn .icon {
  width: 0.75rem;
  height: 0.75rem;
}

.field-detail {
  margin-top: 0.55rem;
  padding-top: 0.55rem;
  border-top: 1px solid var(--color-border);
  font-size: 0.78rem;
  line-height: 1.45;
  color: var(--color-muted);
}

.item-summary {
  margin: 0 0 0.4rem;
  font-weight: 600;
  color: var(--color-text);
}

.field-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.35rem;
}
</style>
