<script setup lang="ts">
import { YADATHAN_ARMOR_NAME } from "@gaem/hellpiercers-content/combat-ui";
import { getArmorByName } from "@gaem/shared";
import { computed, nextTick, ref } from "vue";

import RuleText from "./RuleText.vue";

const props = defineProps<{
  modelValue: string;
  disabled?: boolean;
  label?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const towers = computed(() => getArmorByName(YADATHAN_ARMOR_NAME)?.towers ?? []);

const hoveredTower = ref<string | null>(null);
const pillEl = ref<HTMLElement | null>(null);
const tooltipEl = ref<HTMLElement | null>(null);
const tooltipStyle = ref<{ top: string; left: string; maxWidth: string }>();

const activeTower = computed(() =>
  towers.value.find((t) => t.name === hoveredTower.value),
);

function towerSummary(tower: (typeof towers.value)[number]) {
  const scale = tower.scale > 1 ? `, scale ${tower.scale}` : "";
  return `${tower.tags}, HP ${tower.hp}${scale}. ${tower.special}`;
}

function select(name: string) {
  if (props.disabled) return;
  emit("update:modelValue", name);
}

async function positionTooltip() {
  const wrap = pillEl.value;
  const tip = tooltipEl.value;
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const maxWidth = Math.min(288, window.innerWidth - 16);
  let left = rect.left;
  if (left + maxWidth > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - 8 - maxWidth);
  }

  const gap = 4;
  const pastMidpoint = rect.top + rect.height / 2 > window.innerHeight / 2;
  let top = rect.bottom + gap;
  if (pastMidpoint && tip) {
    top = Math.max(8, rect.top - tip.offsetHeight - gap);
  }

  tooltipStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    maxWidth: `${maxWidth}px`,
  };
}

async function onPillEnter(name: string, el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return;
  hoveredTower.value = name;
  pillEl.value = el;
  await nextTick();
  await positionTooltip();
  await nextTick();
  await positionTooltip();
}

function onPillLeave() {
  hoveredTower.value = null;
  pillEl.value = null;
}
</script>

<template>
  <div class="tower-picker">
    <span v-if="label" class="tower-picker-label">{{ label }}</span>
    <div class="tower-pills" role="listbox" :aria-label="label ?? 'Tower type'">
      <button
        v-for="tower in towers"
        :key="tower.name"
        type="button"
        role="option"
        class="tower-pill"
        :class="{ selected: modelValue === tower.name }"
        :aria-selected="modelValue === tower.name"
        :disabled="disabled"
        @click="select(tower.name)"
        @mouseenter="onPillEnter(tower.name, $event.currentTarget)"
        @mouseleave="onPillLeave"
        @focusin="onPillEnter(tower.name, $event.currentTarget)"
        @focusout="onPillLeave"
      >
        {{ tower.name }}
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="hoveredTower && activeTower"
        ref="tooltipEl"
        class="tower-pill-tooltip"
        :style="tooltipStyle"
        @mouseenter="hoveredTower = activeTower.name"
        @mouseleave="onPillLeave"
      >
        <div class="tower-pill-tooltip-title">{{ activeTower.name }}</div>
        <RuleText :text="towerSummary(activeTower)" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tower-picker {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.tower-picker-label {
  color: var(--color-muted);
  font-weight: 500;
  font-size: 0.9rem;
}

.tower-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tower-pill {
  font-size: 0.78rem;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
  font-family: inherit;
}

.tower-pill:not(:disabled):hover {
  border-color: var(--color-accent-muted);
  color: var(--color-accent-bright);
}

.tower-pill.selected {
  border-color: var(--color-accent-bright);
  background: var(--color-accent-tint-bg);
  color: var(--color-text);
}

.tower-pill:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>

<style>
.tower-pill-tooltip {
  position: fixed;
  z-index: 1000;
  min-width: 9rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.75rem;
  line-height: 1.45;
  box-shadow: var(--shadow-popover);
  pointer-events: auto;
}

.tower-pill-tooltip-title {
  margin: 0 0 0.35rem;
  font-weight: 600;
  color: var(--color-text);
}
</style>
