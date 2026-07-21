<script setup lang="ts">
import type { RuleTermTooltip, RuleTextLink } from "@vtt-core/shared";
import { factionHasEnemyListings, getEnemyFactionId } from "@vtt-core/shared";
import { nextTick, ref } from "vue";

import { useBoardSelection } from "../composables/useBoardSelection.js";
import { activeTab } from "../composables/useGameConsole.js";
import { useInfoDataSelection } from "../composables/useInfoDataSelection.js";

const props = defineProps<{
  text: string;
  tooltip?: RuleTermTooltip;
  link?: RuleTextLink;
}>();

const { clearBoardSelection } = useBoardSelection();
const { selectDataFocus } = useInfoDataSelection();

const wrapEl = ref<HTMLElement | null>(null);
const tooltipEl = ref<HTMLElement | null>(null);
const showTooltip = ref(false);
const tooltipStyle = ref<{ top: string; left: string; maxWidth: string }>();

function positionTooltip() {
  const wrap = wrapEl.value;
  const tip = tooltipEl.value;
  if (!wrap) return;
  const rect = wrap.getBoundingClientRect();
  const maxWidth = Math.min(320, window.innerWidth - 16);
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
  if (!props.tooltip) return;
  showTooltip.value = true;
  await nextTick();
  positionTooltip();
  await nextTick();
  positionTooltip();
}

function closeTooltip() {
  showTooltip.value = false;
}

function openLink() {
  if (!props.link) return;
  closeTooltip();
  clearBoardSelection();
  const factionId = getEnemyFactionId(props.link.name);
  const returnTo =
    factionId && factionHasEnemyListings(factionId) ? factionId : undefined;
  selectDataFocus(
    { kind: "enemy", name: props.link.name },
    returnTo ? { returnTo } : undefined,
  );
  activeTab.value = "info";
}

function onActivate(event: MouseEvent | KeyboardEvent) {
  if (!props.link) return;
  if ("key" in event && event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  openLink();
}
</script>

<template>
  <span
    v-if="tooltip || link"
    ref="wrapEl"
    class="rule-term"
    :class="{
      'rule-term--defined': tooltip && !link,
      'rule-term--link': !!link,
    }"
    :tabindex="tooltip || link ? 0 : undefined"
    :role="link ? 'link' : undefined"
    @mouseenter="openTooltip"
    @mouseleave="closeTooltip"
    @focusin="openTooltip"
    @focusout="closeTooltip"
    @click="onActivate"
    @keydown="onActivate"
  >
    {{ text }}
    <Teleport to="body">
      <div
        v-if="showTooltip && tooltip"
        ref="tooltipEl"
        class="rule-term-tooltip"
        :style="tooltipStyle"
        @mouseenter="openTooltip"
        @mouseleave="closeTooltip"
      >
        <div class="rule-term-tooltip-title">{{ tooltip.title }}</div>
        <p v-if="tooltip.summary !== tooltip.description" class="rule-term-tooltip-summary">
          {{ tooltip.summary }}
        </p>
        <p class="rule-term-tooltip-body">{{ tooltip.description }}</p>
        <p v-if="link" class="rule-term-tooltip-hint">Click to open bestiary entry</p>
      </div>
    </Teleport>
  </span>
  <span v-else class="rule-term">{{ text }}</span>
</template>

<style>
.rule-term--defined {
  cursor: help;
  text-decoration: underline dotted;
  text-underline-offset: 0.12em;
}

.rule-term.rule-term--link {
  cursor: pointer;
  color: var(--color-accent-bright);
  text-decoration: underline;
  text-underline-offset: 0.12em;
}

.rule-term-tooltip {
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

.rule-term-tooltip-title {
  margin: 0 0 0.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.rule-term-tooltip-summary {
  margin: 0 0 0.35rem;
  color: var(--color-text);
}

.rule-term-tooltip-body {
  margin: 0;
  color: var(--color-muted);
  font-style: italic;
}

.rule-term-tooltip-hint {
  margin: 0.4rem 0 0;
  color: var(--color-accent-bright);
  font-size: 0.7rem;
}
</style>
