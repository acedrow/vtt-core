<script setup lang="ts">
import {
  defaultPartyResources,
  getPartyResourceLabel,
  listPartyResourceKeys,
  type PartyResourceKey,
} from "@vtt-core/shared";
import { computed } from "vue";

import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useGameState } from "../composables/useGameState.js";
import NumberStepper from "./NumberStepper.vue";
import PanelShell from "./PanelShell.vue";

const RESOURCE_ROWS = listPartyResourceKeys().map((key) => ({
  key,
  label: getPartyResourceLabel(key),
}));

const { closeRightPanel } = useBoardSelection();
const { gameState, send } = useGameState();

const partyResources = computed(() => gameState.value?.campaign?.partyResources ?? defaultPartyResources());

function onResourceAdjust(resource: PartyResourceKey, delta: number) {
  send({ type: "baseCampaignAction", action: { kind: "adjustResource", resource, delta } });
}
</script>

<template>
  <PanelShell title="Party Stores" @close="closeRightPanel">
    <div class="panel-body">
      <div
        v-for="row in RESOURCE_ROWS"
        :key="row.key"
        class="resource-row"
      >
        <span class="resource-label">{{ row.label }}</span>
        <NumberStepper
          :model-value="partyResources[row.key]"
          :min="0"
          @adjust="onResourceAdjust(row.key, $event)"
        />
      </div>
    </div>
  </PanelShell>
</template>

<style scoped>
.resource-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.resource-row:last-child {
  margin-bottom: 0;
}

.resource-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
}
</style>
