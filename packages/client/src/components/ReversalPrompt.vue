<script setup lang="ts">
import { getPlayerTower, isYadathanArmorName } from "@gaem/hellpiercers-content/combat-ui";
import { computed, watch } from "vue";

import { useCombatActions } from "../composables/useCombatActions.js";
import { useGameState } from "../composables/useGameState.js";

const {
  pendingReaction,
  activePlayer,
  triggerReversal,
  declineReversal,
  reversalExtraAllyIds,
  reversalTowerAnchorAllyIds,
} = useCombatActions();
const { gameState } = useGameState();

const allyOptions = computed(() => {
  const me = activePlayer.value;
  const s = gameState.value;
  if (!me || !s) return [];
  return s.players.filter((p) => p.id !== me.id && (p.hp ?? 0) > 0);
});

// YADATHAN's Reversal lets each extra line run from either the player or their tower.
const hasTowerAnchorOption = computed(() => {
  const me = activePlayer.value;
  const s = gameState.value;
  if (!me || !s || !isYadathanArmorName(me.armor)) return false;
  return !!getPlayerTower(s, me.id);
});

const extraChargeCost = computed(() => reversalExtraAllyIds.value.length);

function toggleAlly(id: string) {
  const ids = reversalExtraAllyIds.value;
  const idx = ids.indexOf(id);
  if (idx >= 0) reversalExtraAllyIds.value = ids.filter((x) => x !== id);
  else reversalExtraAllyIds.value = [...ids, id];
}

function toggleTowerAnchor(id: string) {
  const ids = reversalTowerAnchorAllyIds.value;
  const idx = ids.indexOf(id);
  if (idx >= 0) reversalTowerAnchorAllyIds.value = ids.filter((x) => x !== id);
  else reversalTowerAnchorAllyIds.value = [...ids, id];
}

function onTrigger() {
  const extraLines = reversalExtraAllyIds.value.map((allyId) => ({
    allyId,
    anchor: reversalTowerAnchorAllyIds.value.includes(allyId) ? ("tower" as const) : undefined,
  }));
  triggerReversal(extraLines);
}

function onDecline() {
  declineReversal();
}

watch(pendingReaction, (r) => {
  if (!r) {
    reversalExtraAllyIds.value = [];
    reversalTowerAnchorAllyIds.value = [];
  }
});
</script>

<template>
  <div v-if="pendingReaction" class="reversal-banner">
    <div class="reversal-copy">
      <strong>{{ pendingReaction.label }}</strong>
      <p class="reversal-trigger">{{ pendingReaction.trigger }}</p>
      <p v-if="pendingReaction.incomingDamage != null" class="reversal-dmg">
        Incoming damage: {{ pendingReaction.incomingDamage }}
      </p>
    </div>
    <div v-if="allyOptions.length" class="reversal-allies">
      <span class="reversal-allies-label">Extra lines (1 charge each):</span>
      <label v-for="ally in allyOptions" :key="ally.id" class="reversal-ally">
        <input
          type="checkbox"
          :checked="reversalExtraAllyIds.includes(ally.id)"
          @change="toggleAlly(ally.id)"
        />
        {{ ally.nickname ?? ally.id }}
        <label v-if="hasTowerAnchorOption && reversalExtraAllyIds.includes(ally.id)" class="reversal-ally-anchor">
          <input
            type="checkbox"
            :checked="reversalTowerAnchorAllyIds.includes(ally.id)"
            @change="toggleTowerAnchor(ally.id)"
          />
          from tower
        </label>
      </label>
    </div>
    <div class="reversal-actions">
      <button type="button" class="action-btn" @click="onTrigger">
        Trigger{{ extraChargeCost ? ` (−${1 + extraChargeCost} charges)` : "" }}
      </button>
      <button type="button" class="action-btn reject" @click="onDecline">Decline</button>
    </div>
  </div>
</template>

<style scoped>
.reversal-banner {
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  background: var(--color-surface-raised);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.reversal-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.reversal-trigger,
.reversal-dmg {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-muted);
}

.reversal-allies {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  align-items: center;
  font-size: 0.78rem;
}

.reversal-allies-label {
  color: var(--color-muted);
}

.reversal-ally {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.reversal-ally-anchor {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  margin-left: 0.35rem;
  color: var(--color-muted);
}

.reversal-actions {
  display: flex;
  gap: 0.35rem;
}
</style>
