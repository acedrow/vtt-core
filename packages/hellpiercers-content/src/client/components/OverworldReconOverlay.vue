<script setup lang="ts">
import {
  defaultOverworldParty,
  RECON_MOVES,
  type RuleTermTooltip,
} from "@gaem/shared";
import { computed } from "vue";

import { useGameState } from "@gaem/client/composables/useGameState.js";
import NumberStepper from "@gaem/client/components/NumberStepper.vue";
import RuleTerm from "@gaem/client/components/RuleTerm.vue";

const props = defineProps<{
  travelMode: boolean;
  deployMode: boolean;
}>();

const emit = defineEmits<{
  "update:travelMode": [value: boolean];
  "update:deployMode": [value: boolean];
}>();

const SPEED_TOOLTIP: RuleTermTooltip = {
  title: "Map Speed",
  summary: "Map Speed 1 ≈ 2.5 inches of travel.",
  description:
    "On this map, each major square is 1 inch and each quarter square is 0.5 inch. Travel moves the party up to that distance on the quarter grid (rounded up).",
};

const FUEL_TOOLTIP: RuleTermTooltip = {
  title: "Fuel",
  summary: "Spend 2 Fuel to Travel on the STRATCOM map.",
  description:
    "Fuel is a journey currency for hellscape travel. Remaining Fuel is erased when the party returns to DIS.",
};

const REVELATIONS_TOOLTIP: RuleTermTooltip = {
  title: "Revelations",
  summary: "Currency for scouting and catacomb exploration.",
  description:
    "Gain Revelation from Scavenge and similar moves; spend it on Scout and under-DIS exploration. Not spent on Travel.",
};

const reconMoveTooltips = RECON_MOVES.map(
  (move): { name: string; tooltip: RuleTermTooltip } => ({
    name: move.name,
    tooltip: {
      title: move.name,
      summary: move.summary,
      description: move.summary,
    },
  }),
);

const { gameState, send } = useGameState();

const party = computed(() => gameState.value?.campaign?.overworldParty ?? defaultOverworldParty());
const atDis = computed(() => party.value.atDis === true);

function onMapSpeedAdjust(delta: number) {
  send({ type: "overworldCampaignAction", action: { kind: "adjustMapSpeed", delta } });
}

function onFuelAdjust(delta: number) {
  send({ type: "overworldCampaignAction", action: { kind: "adjustFuel", delta } });
}

function onRevelationsAdjust(delta: number) {
  send({ type: "overworldCampaignAction", action: { kind: "adjustRevelations", delta } });
}

function toggleTravelMode() {
  if (atDis.value) return;
  if (!props.travelMode) emit("update:deployMode", false);
  emit("update:travelMode", !props.travelMode);
}

function onDisHellAction() {
  if (atDis.value) {
    if (!props.deployMode) emit("update:travelMode", false);
    emit("update:deployMode", !props.deployMode);
    return;
  }
  emit("update:travelMode", false);
  emit("update:deployMode", false);
  send({ type: "overworldCampaignAction", action: { kind: "returnToDis" } });
}
</script>

<template>
  <div class="recon-overlay">
    <div class="recon-row">
      <RuleTerm text="Speed" :tooltip="SPEED_TOOLTIP" />
      <NumberStepper
        :model-value="party.mapSpeed"
        :min="0"
        :step="0.5"
        @adjust="onMapSpeedAdjust"
      />
    </div>
    <div class="recon-row">
      <RuleTerm text="Fuel" :tooltip="FUEL_TOOLTIP" />
      <NumberStepper
        :model-value="party.fuel"
        :min="0"
        @adjust="onFuelAdjust"
      />
    </div>
    <div class="recon-row">
      <RuleTerm text="Revelations" :tooltip="REVELATIONS_TOOLTIP" />
      <NumberStepper
        :model-value="party.revelations"
        :min="0"
        @adjust="onRevelationsAdjust"
      />
    </div>
    <button
      type="button"
      class="action-btn move-btn"
      :class="{ active: travelMode }"
      :disabled="atDis"
      @click="toggleTravelMode"
    >
      Move
    </button>
    <button
      type="button"
      class="action-btn move-btn"
      :class="{ active: deployMode }"
      @click="onDisHellAction"
    >
      {{ atDis ? "Deploy to Hell" : "Return to DIS" }}
    </button>
    <div class="recon-moves-section">
      <div class="recon-moves-heading">RECON moves</div>
      <div class="recon-moves-tags">
        <RuleTerm
          v-for="move in reconMoveTooltips"
          :key="move.name"
          class="recon-move-tag"
          :text="move.name"
          :tooltip="move.tooltip"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.recon-overlay {
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

.recon-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.recon-row :deep(.rule-term) {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
}

.move-btn {
  margin-top: 0.15rem;
  background: var(--color-surface-raised);
}

.move-btn.active {
  border-color: var(--color-accent-bright);
  background: var(--color-accent-tint-bg);
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.recon-moves-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--color-border);
}

.recon-moves-heading {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.recon-moves-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.recon-moves-tags :deep(.recon-move-tag) {
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
