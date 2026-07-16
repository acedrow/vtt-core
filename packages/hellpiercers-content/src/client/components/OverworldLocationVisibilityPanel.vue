<script setup lang="ts">
import { computed } from "vue";

import { useGameState } from "@gaem/client/composables/useGameState.js";
import { useOverworldEntitySelection } from "@gaem/client/composables/useOverworldEntitySelection.js";
import { useSession } from "@gaem/client/composables/useSession.js";

const { gameState, send } = useGameState();
const { hasGmCapabilities } = useSession();
const { selectedOverworldLocationId } = useOverworldEntitySelection();

const location = computed(() => {
  const id = selectedOverworldLocationId.value;
  if (!id) return null;
  return gameState.value?.campaign?.overworldLocations?.find((loc) => loc.id === id) ?? null;
});

const infoVisible = computed(() => location.value?.infoVisibleToPlayers !== false);

function setInfoVisible(visible: boolean) {
  if (!location.value) return;
  send({
    type: "overworldLocationAction",
    action: { kind: "setInfoVisible", locationId: location.value.id, visible },
  });
}
</script>

<template>
  <div v-if="hasGmCapabilities && location" class="location-visibility">
    <span class="location-name">{{ location.name }}</span>
    <label class="visibility-toggle">
      <input
        type="checkbox"
        :checked="infoVisible"
        @change="setInfoVisible(($event.target as HTMLInputElement).checked)"
      />
      Show to players
    </label>
  </div>
</template>

<style scoped>
.location-visibility {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.75rem;
  margin: 0 0 0.75rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-raised);
}

.location-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.visibility-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  color: var(--color-text);
  cursor: pointer;
}
</style>
