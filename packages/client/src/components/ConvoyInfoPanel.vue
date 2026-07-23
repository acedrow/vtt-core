<script setup lang="ts">
import {
  getConvoyTypeInfo,
  getFactionById,
  type OverworldConvoy,
} from "@vtt-core/shared";
import { computed } from "vue";

import { useGameState } from "../composables/useGameState.js";
import { useOverworldEntitySelection } from "../composables/useOverworldEntitySelection.js";
import { useSession } from "../composables/useSession.js";
import PanelShell from "./PanelShell.vue";

const props = defineProps<{
  convoyId: string;
}>();

const { gameState, send } = useGameState();
const { hasGmCapabilities } = useSession();
const { selectOverworldConvoy } = useOverworldEntitySelection();

const convoy = computed((): OverworldConvoy | null => {
  return gameState.value?.campaign?.mapConvoys?.find((c) => c.id === props.convoyId) ?? null;
});

const typeInfo = computed(() => (convoy.value ? getConvoyTypeInfo(convoy.value.type) : undefined));
const faction = computed(() =>
  convoy.value ? getFactionById(convoy.value.factionId) : undefined,
);

const showDetails = computed(
  () => hasGmCapabilities.value || convoy.value?.infoVisibleToPlayers === true,
);

const title = computed(() => {
  if (!showDetails.value) return "Convoy";
  return typeInfo.value?.name ?? "Convoy";
});

const subtitle = computed(() => {
  if (!showDetails.value || !faction.value) return undefined;
  return faction.value.name;
});

function onClose() {
  selectOverworldConvoy(null);
}

function setInfoVisible(visible: boolean) {
  if (!convoy.value) return;
  send({
    type: "overworldConvoyAction",
    action: { kind: "setInfoVisible", convoyId: convoy.value.id, visible },
  });
}
</script>

<template>
  <PanelShell
    v-if="convoy"
    :title="title"
    :subtitle="subtitle"
    kicker="Overworld"
    @close="onClose"
  >
    <template v-if="!showDetails">
      <p class="stub">A convoy is moving across the wastes.</p>
    </template>
    <template v-else-if="typeInfo">
      <p class="summary">{{ typeInfo.summary }}</p>
      <p class="section-label">Escort</p>
      <p class="body">{{ typeInfo.escort }}</p>
      <p class="section-label">On completion</p>
      <ul class="completion-list">
        <li v-for="opt in typeInfo.completionOptions" :key="opt.name">
          <strong>{{ opt.name }}.</strong>
          {{ opt.description }}
        </li>
      </ul>
    </template>

    <label v-if="hasGmCapabilities" class="visibility-toggle">
      <input
        type="checkbox"
        :checked="convoy.infoVisibleToPlayers"
        @change="setInfoVisible(($event.target as HTMLInputElement).checked)"
      />
      Show to players
    </label>
  </PanelShell>
</template>

<style scoped>
.stub,
.summary,
.body {
  margin: 0 0 0.85rem;
  font-size: 0.9rem;
  line-height: 1.45;
}

.body {
  color: var(--color-text-secondary);
}

.section-label {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.completion-list {
  margin: 0 0 1rem;
  padding-left: 1.1rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--color-text-secondary);
}

.completion-list li {
  margin-bottom: 0.45rem;
}

.completion-list strong {
  color: var(--color-text);
}

.visibility-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text);
  cursor: pointer;
}
</style>
