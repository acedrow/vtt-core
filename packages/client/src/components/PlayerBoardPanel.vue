<script setup lang="ts">
import { getPlayerMaxHp } from "@gaem/shared";
import { computed } from "vue";

import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useGameState } from "../composables/useGameState.js";
import HpBar from "./HpBar.vue";
import PanelShell from "./PanelShell.vue";

const props = defineProps<{ playerId: string }>();

const { gameState } = useGameState();
const { closeRightPanel } = useBoardSelection();

const player = computed(() => gameState.value?.players.find((p) => p.id === props.playerId));
const displayName = computed(() => player.value?.nickname ?? player.value?.id ?? "Player");
const maxHp = computed(() => (player.value ? getPlayerMaxHp(player.value) : 0));
const currentHp = computed(() => player.value?.hp ?? 0);
</script>

<template>
  <PanelShell :title="displayName" close-variant="ghost" @close="closeRightPanel">
    <div v-if="player" class="panel-body">
      <p v-if="player.class" class="meta">Class: {{ player.class }}</p>
      <HpBar :current-hp="currentHp" :max-hp="maxHp" />
      <p class="meta">Position ({{ player.x }}, {{ player.y }})</p>
      <p class="muted">No character sheet linked.</p>
    </div>

    <p v-else class="muted">Player not found.</p>
  </PanelShell>
</template>

<style scoped>
.panel-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.muted {
  margin: 0.5rem 0 0;
  color: var(--color-muted);
  font-size: 0.85rem;
}
</style>
