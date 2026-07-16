<script setup lang="ts">
import {
  defaultGmIchor,
  GM_STRATCOM_ACTIONS,
  type RuleTermTooltip,
} from "@gaem/shared";
import { computed } from "vue";

import { useGameState } from "@gaem/client/composables/useGameState.js";
import NumberStepper from "@gaem/client/components/NumberStepper.vue";
import RuleTerm from "@gaem/client/components/RuleTerm.vue";

const { gameState, send } = useGameState();

const ichor = computed(() => gameState.value?.campaign?.gmIchor ?? defaultGmIchor());

const stratcomActionTooltips = GM_STRATCOM_ACTIONS.map(
  (action): { name: string; tooltip: RuleTermTooltip } => ({
    name: action.name,
    tooltip: {
      title: action.name,
      summary: action.summary,
      description: action.summary,
    },
  }),
);

function onIchorAdjust(delta: number) {
  send({ type: "factionCampaignAction", action: { kind: "adjustIchor", delta } });
}
</script>

<template>
  <div class="ichor-overlay">
    <div class="ichor-row">
      <span class="ichor-label">Ichor</span>
      <NumberStepper :model-value="ichor" :min="0" @adjust="onIchorAdjust" />
    </div>
    <div class="stratcom-section">
      <div class="stratcom-heading">STRATCOM actions</div>
      <div class="stratcom-tags">
        <RuleTerm
          v-for="action in stratcomActionTooltips"
          :key="action.name"
          class="stratcom-tag"
          :text="action.name"
          :tooltip="action.tooltip"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ichor-overlay {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  min-width: 11rem;
  max-width: 16rem;
  box-shadow: var(--shadow-popover);
}

.ichor-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.ichor-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
}

.stratcom-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--color-border);
}

.stratcom-heading {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.stratcom-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.stratcom-tags :deep(.stratcom-tag) {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
  background: var(--color-surface-raised);
  text-decoration: none;
}
</style>
