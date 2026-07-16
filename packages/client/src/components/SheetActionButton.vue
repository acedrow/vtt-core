<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

const props = defineProps<{
  disabled?: boolean;
  active?: boolean;
  tooltipPinned?: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();

const wrapEl = ref<HTMLElement | null>(null);
const tooltipEl = ref<HTMLElement | null>(null);
const showTooltip = ref(false);
const tooltipStyle = ref<{ top: string; left: string; maxWidth: string }>();

function positionTooltip() {
  const wrap = wrapEl.value;
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

async function openTooltip() {
  showTooltip.value = true;
  await nextTick();
  positionTooltip();
  await nextTick();
  positionTooltip();
}

async function onEnter() {
  await openTooltip();
}

function onLeave() {
  if (!props.tooltipPinned) showTooltip.value = false;
}

watch(
  () => props.tooltipPinned,
  async (pinned) => {
    if (pinned) await openTooltip();
  },
  { immediate: true },
);
</script>

<template>
  <div
    ref="wrapEl"
    class="sheet-action-wrap"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onEnter"
    @focusout="onLeave"
  >
    <button
      type="button"
      class="sheet-action-btn"
      :class="{ active }"
      :disabled="disabled"
      @click="emit('click')"
    >
      <slot />
    </button>

    <Teleport to="body">
      <div
        v-if="showTooltip && $slots.tooltip"
        ref="tooltipEl"
        class="sheet-action-tooltip"
        :style="tooltipStyle"
        @mouseenter="onEnter"
        @mouseleave="onLeave"
      >
        <slot name="tooltip" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.sheet-action-wrap {
  display: inline-flex;
}

.sheet-action-btn {
  font-size: 0.72rem;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
}

.sheet-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sheet-action-btn:not(:disabled):hover {
  border-color: var(--color-accent-muted);
  color: var(--color-accent-bright);
}

.sheet-action-btn.active {
  border-color: var(--color-accent-bright);
  background: var(--color-accent-tint-bg);
  color: var(--color-text);
}
</style>

<style>
.sheet-action-tooltip {
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

.sheet-action-tooltip .tooltip-summary {
  margin: 0 0 0.35rem;
  font-weight: 600;
  color: var(--color-text);
}

.sheet-action-tooltip .ability-block {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
}

.sheet-action-tooltip .weapon-pattern {
  margin-top: 0.35rem;
}

.sheet-action-tooltip .weapon-pattern-meta {
  margin-bottom: 0.35rem;
}
</style>
