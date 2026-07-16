<script setup lang="ts">
import type { PhaseAction } from "@gaem/shared";
import { canResetPhase, canRewindPhase, formatTurnHolder } from "@gaem/shared";
import { computed } from "vue";

import { useGameState } from "../composables/useGameState.js";
import { useSession } from "../composables/useSession.js";

const { hasGmCapabilities } = useSession();
const { gameState, send } = useGameState();

const round = computed(() => gameState.value?.round ?? null);
const sandboxMode = computed(() => gameState.value?.sandboxMode === true);
const canStepBack = computed(() => (gameState.value ? canRewindPhase(gameState.value) : false));
const canReset = computed(() => (gameState.value ? canResetPhase(gameState.value) : false));

function setSandboxMode(value: boolean) {
  send({ type: "setSandboxMode", sandboxMode: value });
}

const roundGroups = computed(() => {
  const s = gameState.value;
  if (!s?.turnLog.length) return [];
  return [...s.turnLog].sort((a, b) => a.round - b.round);
});

const gmActionConfirm: Partial<Record<PhaseAction, string>> = {
  endCombat: "End combat? Player HP, effects, and currencies reset to TACCOM Not Started.",
  resetCombat:
    "Reset combat? This clears turn history, returns to TACCOM Not Started, and restores the board to its saved starting state (if any).",
  resetRound: "Reset the current round to its start?",
  gmEndRound: "End the current round and start the next one?",
  gmEndTurn: "End the current turn?",
  removeAllEnemies: "Remove all enemies from the board?",
  rewindPhase:
    "Step back to the previous phase? In-progress player actions will be reset.",
  resetPhase: "Reset actions for the current turn?",
};

function sendGmAction(action: PhaseAction) {
  const message = gmActionConfirm[action];
  if (message && !confirm(message)) return;
  send({ type: "phaseAction", action });
}
</script>

<template>
  <div class="turn-order-panel">
    <header class="panel-header">
      <h2 v-if="round !== null" class="round-heading">Round {{ round }}</h2>
      <p v-else class="round-heading muted">—</p>
    </header>

    <div v-if="hasGmCapabilities" class="gm-controls">
      <div class="gm-controls-main">
        <label class="sandbox-toggle">
          <span class="sandbox-label">Sandbox mode</span>
          <button
            type="button"
            role="switch"
            class="toggle"
            :class="{ on: sandboxMode }"
            :aria-checked="sandboxMode"
            @click="setSandboxMode(!sandboxMode)"
          >
            <span class="toggle-thumb" />
          </button>
        </label>
        <button
          type="button"
          class="control-btn"
          :disabled="!canStepBack"
          @click="sendGmAction('rewindPhase')"
        >
          Step back
        </button>
        <button
          type="button"
          class="control-btn"
          :disabled="!canReset"
          @click="sendGmAction('resetPhase')"
        >
          Reset phase
        </button>
        <button type="button" class="control-btn" @click="sendGmAction('gmEndRound')">
          End round
        </button>
        <button type="button" class="control-btn" @click="sendGmAction('gmEndTurn')">
          End turn
        </button>
      </div>
      <div class="gm-controls-danger">
        <button type="button" class="control-btn danger" @click="sendGmAction('removeAllEnemies')">
          Remove all enemies
        </button>
        <button type="button" class="control-btn danger" @click="sendGmAction('endCombat')">
          End combat
        </button>
        <button type="button" class="control-btn danger" @click="sendGmAction('resetCombat')">
          Reset combat
        </button>
        <button type="button" class="control-btn danger" @click="sendGmAction('resetRound')">
          Reset round
        </button>
      </div>
    </div>

    <div class="history">
      <p v-if="roundGroups.length === 0" class="empty">No turns recorded yet.</p>
      <section v-for="group in roundGroups" :key="group.round" class="round-group">
        <h3 class="round-label">Round {{ group.round }}</h3>
        <ol class="turn-list">
          <li v-for="(turn, i) in group.turns" :key="`${group.round}-${i}`" class="turn-item">
            {{ gameState ? formatTurnHolder(gameState, turn) : "—" }}
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.turn-order-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  flex-shrink: 0;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.round-heading {
  margin: 0;
}

.round-heading.muted {
  color: var(--color-muted);
}

.gm-controls {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.gm-controls-main,
.gm-controls-danger {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.gm-controls-danger {
  padding-top: 0.65rem;
  border-top: 1px solid var(--color-border);
}

.sandbox-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: 0.25rem;
}

.sandbox-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
}

.toggle {
  position: relative;
  width: 2.25rem;
  height: 1.25rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface-raised);
  padding: 0;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.toggle.on {
  background: var(--color-success-dark);
  border-color: var(--color-success-bright);
}

.toggle-thumb {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--color-text);
  transition: transform 0.15s;
}

.toggle.on .toggle-thumb {
  transform: translateX(1rem);
}

.control-btn {
  border: 1px solid var(--color-accent-muted);
  border-radius: 8px;
  background: var(--color-accent-subtle-bg);
  color: var(--color-accent-bright);
  padding: 0.35rem 0.65rem;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
}

.control-btn:hover:not(:disabled) {
  background: var(--color-accent-hover-bg);
  border-color: var(--color-accent-bright);
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.control-btn.danger {
  border-color: var(--color-danger-muted-border);
  background: var(--color-danger-subtle-bg);
  color: var(--color-danger);
}

.control-btn.danger:hover:not(:disabled) {
  background: var(--color-danger-hover-bg);
  border-color: var(--color-danger);
}

.history {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem 1rem 1rem;
}

.empty {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.round-group + .round-group {
  margin-top: 1rem;
}

.round-label {
  margin: 0 0 0.4rem;
  text-transform: uppercase;
  color: var(--color-muted);
}

.turn-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.turn-item {
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  font-size: 0.9rem;
  color: var(--color-text);
}

.turn-item:nth-child(odd) {
  background: var(--color-surface);
}
</style>
