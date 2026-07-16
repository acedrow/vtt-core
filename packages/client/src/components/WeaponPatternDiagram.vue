<script setup lang="ts">
import type { WeaponAttackSpec, WeaponBombPattern, WeaponPatternLevel } from "@gaem/shared";
import { attackSpecHasDiagram, buildPatternGrid } from "@gaem/shared";
import { computed, ref, watch } from "vue";

import RuleText from "./RuleText.vue";

const props = defineProps<{
  attack: WeaponAttackSpec;
  bombIndex?: number;
  combatLevelIndex?: number;
  selectable?: boolean;
  dualSelect?: boolean;
  dualBombIndices?: [number | null, number | null];
  compact?: boolean;
}>();

const emit = defineEmits<{
  "update:bombIndex": [index: number];
  requestSelect: [index: number];
  "update:dualBombIndices": [indices: [number | null, number | null]];
  dualComplete: [];
}>();

const levelIndex = ref(0);
const localBombIndex = ref(0);
const hoverBombIndex = ref<number | null>(null);

watch(
  () => props.combatLevelIndex,
  (index) => {
    if (index != null) levelIndex.value = index;
  },
  { immediate: true },
);

watch(
  () => props.bombIndex,
  (index) => {
    if (index != null) localBombIndex.value = index;
  },
  { immediate: true },
);

const equippedBombIndex = computed((): number | undefined => {
  if (props.bombIndex !== undefined) return props.bombIndex;
  if (props.selectable) return undefined;
  return localBombIndex.value;
});
const displayBombIndex = computed((): number | undefined => {
  if (hoverBombIndex.value != null) return hoverBombIndex.value;
  if (props.dualSelect && props.dualBombIndices) {
    return props.dualBombIndices[0] ?? props.dualBombIndices[1] ?? undefined;
  }
  return equippedBombIndex.value;
});

const hasDiagram = computed(() => attackSpecHasDiagram(props.attack));

const activeLevel = computed((): WeaponPatternLevel | null => {
  const levels = props.attack.levels;
  if (!levels?.length) return null;
  return levels[levelIndex.value] ?? levels[0] ?? null;
});

const displayBomb = computed((): WeaponBombPattern | null => {
  const bombs = props.attack.bombs;
  const index = displayBombIndex.value;
  if (!bombs?.length || index == null) return null;
  return bombs[index] ?? null;
});

const damageLabel = computed(() => {
  if (activeLevel.value) return activeLevel.value.damage;
  if (displayBomb.value) return displayBomb.value.damage;
  return props.attack.damage;
});

const patternNote = computed(() => {
  if (props.attack.rangeTargets) {
    return `Up to ${props.attack.rangeTargets.maxTargets} targets within Range:${props.attack.rangeTargets.range}`;
  }
  if (displayBomb.value?.range) return `Range ${displayBomb.value.range}`;
  return null;
});

const displayGrid = computed(() => {
  if (props.attack.rangeTargets) {
    const r = props.attack.rangeTargets.range;
    const tiles: [number, number][] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= r && (dx !== 0 || dy !== 0)) {
          tiles.push([dx, dy]);
        }
      }
    }
    return buildPatternGrid(tiles);
  }

  const tiles = activeLevel.value?.tiles ?? displayBomb.value?.tiles ?? props.attack.tiles ?? [];
  const healTiles =
    displayBomb.value?.healTiles ??
    (displayBomb.value?.heal ? displayBomb.value.tiles : undefined);
  return buildPatternGrid(tiles, {
    healTiles,
    boundsTiles: displayBomb.value?.boundsTiles,
    showOrigin: !displayBomb.value,
  });
});

function dualSelectionSlots(index: number): (1 | 2)[] {
  if (!props.dualSelect || !props.dualBombIndices) return [];
  const slots: (1 | 2)[] = [];
  if (props.dualBombIndices[0] === index) slots.push(1);
  if (props.dualBombIndices[1] === index) slots.push(2);
  return slots;
}

function toggleDualBomb(index: number) {
  const current = props.dualBombIndices ?? [null, null];
  const [a, b] = current;

  if (a === index && b === index) {
    emit("update:dualBombIndices", [index, null]);
    return;
  }
  if (a === index && b == null) {
    const next: [number | null, number | null] = [index, index];
    emit("update:dualBombIndices", next);
    emit("dualComplete");
    return;
  }
  if (a === index) {
    emit("update:dualBombIndices", [null, b]);
    return;
  }
  if (b === index) {
    emit("update:dualBombIndices", [a, null]);
    return;
  }
  if (a == null) {
    const next: [number | null, number | null] = [index, b];
    emit("update:dualBombIndices", next);
    if (next[1] != null) emit("dualComplete");
    return;
  }
  if (b == null) {
    const next: [number | null, number | null] = [a, index];
    emit("update:dualBombIndices", next);
    emit("dualComplete");
    return;
  }
  emit("update:dualBombIndices", [a, index]);
  emit("dualComplete");
}

function resetDualSelection() {
  emit("update:dualBombIndices", [null, null]);
}

const hasDualSelection = computed(() => {
  if (!props.dualSelect || !props.dualBombIndices) return false;
  return props.dualBombIndices[0] != null || props.dualBombIndices[1] != null;
});

function selectBomb(index: number) {
  if (props.dualSelect) {
    toggleDualBomb(index);
    return;
  }
  if (equippedBombIndex.value != null && index === equippedBombIndex.value) return;
  if (props.selectable) {
    emit("requestSelect", index);
    return;
  }
  if (props.bombIndex == null) {
    localBombIndex.value = index;
    emit("update:bombIndex", index);
  }
}
</script>

<template>
  <div v-if="hasDiagram" class="weapon-pattern" :class="{ compact }">
    <div v-if="!compact" class="weapon-pattern-meta">
      <span class="weapon-pattern-damage">Damage {{ damageLabel }}</span>
      <span v-if="patternNote" class="weapon-pattern-note">{{ patternNote }}</span>
    </div>

    <div v-if="attack.levels?.length" class="variant-tabs">
      <button
        v-for="(level, i) in attack.levels"
        :key="level.label"
        type="button"
        class="variant-tab"
        :class="{ active: levelIndex === i }"
        @click="levelIndex = i"
      >
        {{ level.label }}
      </button>
    </div>

    <div v-if="attack.bombs?.length" class="variant-tabs-row">
      <div class="variant-tabs">
        <button
          v-for="(bomb, i) in attack.bombs"
          :key="bomb.name"
          type="button"
          class="variant-tab"
          :class="{
            active: !dualSelect && equippedBombIndex === i,
            selectable: selectable || dualSelect,
            preview: hoverBombIndex === i && equippedBombIndex !== i,
            'dual-selected-1': dualSelectionSlots(i).includes(1),
            'dual-selected-2': dualSelectionSlots(i).includes(2),
          }"
          @mouseenter="hoverBombIndex = i"
          @mouseleave="hoverBombIndex = null"
          @click.stop="selectBomb(i)"
        >
          {{ bomb.name }}
        </button>
      </div>
      <button
        v-if="dualSelect && hasDualSelection"
        type="button"
        class="dual-reset-btn"
        @click.stop="resetDualSelection"
      >
        Reset choices
      </button>
    </div>

    <p
      v-if="attack.bombs?.length && displayBombIndex == null && !dualSelect"
      class="weapon-pattern-empty"
    >
      Select a bomb type (costs 1 charge).
    </p>

    <div
      v-else-if="!compact || displayBombIndex != null"
      class="pattern-grid"
      :style="{
        gridTemplateColumns: `repeat(${displayGrid.width}, 1.35rem)`,
        gridTemplateRows: `repeat(${displayGrid.height}, 1.35rem)`,
      }"
    >
      <span
        v-for="(cell, index) in displayGrid.cells.flat()"
        :key="index"
        class="pattern-cell"
        :class="[cell, { 'heal-blue': cell === 'heal' }]"
      >
        <span v-if="cell === 'origin'" class="origin-mark" aria-hidden="true">▶</span>
      </span>
    </div>

    <p v-if="displayBomb?.description" class="weapon-pattern-description">
      <RuleText :text="displayBomb.description" />
    </p>
  </div>
</template>

<style scoped>
.weapon-pattern {
  margin-top: 0.5rem;
}

.weapon-pattern-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  margin-bottom: 0.45rem;
  font-size: 0.8rem;
}

.weapon-pattern-damage {
  font-weight: 600;
  color: var(--color-text);
}

.weapon-pattern-note {
  color: var(--color-muted);
}

.variant-tabs-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  margin-bottom: 0.45rem;
}

.variant-tabs-row .variant-tabs {
  margin-bottom: 0;
}

.dual-reset-btn {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-muted);
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.12rem 0.45rem;
  cursor: pointer;
}

.dual-reset-btn:hover {
  border-color: var(--color-accent-muted);
  color: var(--color-text);
}

.variant-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.45rem;
}

.variant-tab {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-muted);
  font-family: inherit;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.12rem 0.45rem;
  cursor: default;
}

.variant-tab.selectable {
  cursor: pointer;
}

.variant-tab.selectable:not(.active):hover,
.variant-tab.preview {
  border-color: var(--color-accent-muted);
  color: var(--color-text);
}

.variant-tab.active,
.variant-tab.dual-selected-1,
.variant-tab.dual-selected-2 {
  border-color: var(--color-accent);
  color: var(--color-text);
  background: var(--color-accent-muted);
}

.weapon-pattern.compact .variant-tabs-row {
  margin-bottom: 0;
}

.weapon-pattern.compact .variant-tabs {
  margin-bottom: 0;
}

.weapon-pattern.compact .pattern-grid,
.weapon-pattern.compact .weapon-pattern-description {
  display: none;
}

.pattern-grid {
  display: inline-grid;
  gap: 2px;
  padding: 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-raised);
}

.pattern-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: var(--color-surface);
}

.pattern-cell.attack {
  background: var(--color-pattern-orange);
  border-color: var(--color-pattern-orange-dark);
}

.pattern-cell.heal-blue {
  background: var(--color-board-target-heal);
  border-color: var(--color-board-target-heal-outline);
}

.pattern-cell.origin {
  background: var(--color-success);
  border-color: var(--color-success-bright);
  color: var(--color-on-dark);
}

.origin-mark {
  font-size: 0.62rem;
  line-height: 1;
}

.weapon-pattern-description {
  margin: 0.45rem 0 0;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.weapon-pattern-empty {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-muted);
  font-style: italic;
}
</style>
