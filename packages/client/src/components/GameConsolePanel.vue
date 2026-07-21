<script setup lang="ts">
import { CONSOLE_MSG_CONNECTED, CONSOLE_MSG_DISCONNECTED } from "@vtt-core/shared";
import { computed, nextTick, onMounted, ref, watch } from "vue";

import { useApi } from "../composables/useApi.js";
import { useGameConsole } from "../composables/useGameConsole.js";
import { usePlayerSettings } from "../composables/usePlayerSettings.js";
import NumberStepper from "./NumberStepper.vue";
import SegmentedControl from "./SegmentedControl.vue";

const { entries, activeTab } = useGameConsole();
const { showConnectionsInConsole } = usePlayerSettings();
const { apiFetch } = useApi();

const visibleEntries = computed(() => {
  if (showConnectionsInConsole.value) return entries.value;
  return entries.value.filter(
    (e) => e.message !== CONSOLE_MSG_CONNECTED && e.message !== CONSOLE_MSG_DISCONNECTED,
  );
});

const listEl = ref<HTMLElement | null>(null);
const quantity = ref(1);
const diceMax = ref<6 | 10>(6);
const bonus = ref(0);
const rolling = ref(false);

const bonusMagnitude = computed({
  get: () => Math.abs(bonus.value),
  set: (raw) => {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    const mag = Math.abs(n);
    if (n < 0 || bonus.value < 0) bonus.value = -mag;
    else bonus.value = mag;
  },
});

function formatTime(at: number): string {
  const d = new Date(at);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

function clampQuantity(value: number): number {
  return Math.max(1, Math.min(100, value));
}

async function rollDice() {
  if (rolling.value) return;
  rolling.value = true;
  try {
    const res = await apiFetch("/api/random-integers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        n: quantity.value,
        min: 1,
        max: diceMax.value,
        bonus: bonus.value,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Roll failed");
    }
  } catch {
    // console sync handles successful rolls; errors stay silent in UI for now
  } finally {
    rolling.value = false;
  }
}

async function scrollLogToBottom() {
  await nextTick();
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight;
}

watch(() => visibleEntries.value.length, scrollLogToBottom);

watch(activeTab, (tab) => {
  if (tab === "console") void scrollLogToBottom();
});

onMounted(() => {
  if (activeTab.value === "console") void scrollLogToBottom();
});
</script>

<template>
  <div class="console-panel">
    <div class="log-area">
      <div v-if="visibleEntries.length === 0" class="empty">No game events yet.</div>
      <ul v-else ref="listEl" class="log">
        <li v-for="entry in visibleEntries" :key="entry.id" class="entry">
          <time class="time">{{ formatTime(entry.at) }}</time>
          <span class="message">
            <span class="actor" :class="entry.actor.role">{{ entry.actor.name }}</span>
            {{ " " + entry.message }}
          </span>
        </li>
      </ul>
    </div>

    <form class="dice-bar" @submit.prevent="rollDice">
      <NumberStepper
        v-model="quantity"
        :min="1"
        :max="100"
        :disabled="rolling"
        :clamp="clampQuantity"
      />

      <SegmentedControl
        v-model="diceMax"
        :disabled="rolling"
        :options="[
          { value: 6, label: 'd6' },
          { value: 10, label: 'd10' },
        ]"
      />

      <span class="plus-icon" aria-hidden="true">{{ bonus < 0 ? "−" : "+" }}</span>

      <NumberStepper
        v-model="bonusMagnitude"
        :disabled="rolling"
        :invert-buttons="bonus < 0"
      />

      <button type="submit" class="roll-btn" :disabled="rolling">
        {{ rolling ? "…" : "Roll" }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.console-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty {
  padding: 1rem;
  color: var(--color-muted);
  font-size: 0.85rem;
}

.log {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0.75rem 0.75rem;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.entry {
  display: flex;
  gap: 0.5rem;
  padding: 0.35rem 0;
  font-size: 0.8rem;
  line-height: 1.4;
  border-bottom: 1px solid var(--color-surface-raised);
}

.entry:last-child {
  border-bottom: none;
}

.time {
  flex-shrink: 0;
  color: var(--color-muted-subtle);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  padding-top: 0.1rem;
}

.message {
  color: var(--color-text-secondary);
  min-width: 0;
}

.actor {
  font-weight: 600;
}

.actor.gm {
  color: var(--color-success);
}

.actor.player {
  color: var(--color-accent);
}

.dice-bar {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  row-gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.stepper {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
}

.step-btn {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.step-btn:first-child {
  border-radius: 0;
}

.step-btn:last-child {
  border-radius: 0;
}

.step-btn:hover:not(:disabled) {
  background: var(--color-border);
  color: var(--color-text);
}

.step-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.step-input {
  width: 2.25rem;
  height: 1.75rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-left: none;
  border-right: none;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.85rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
  appearance: textfield;
}

.step-input::-webkit-outer-spin-button,
.step-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.step-input:disabled {
  opacity: 0.5;
}

.dice-type {
  display: flex;
  gap: 0;
  flex-shrink: 0;
}

.dice-btn {
  padding: 0.3rem 0.55rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.dice-btn:first-child {
  border-radius: 6px 0 0 6px;
}

.dice-btn:last-child {
  border-radius: 0 6px 6px 0;
  border-left: none;
}

.dice-btn:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-border);
}

.dice-btn.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-on-accent);
}

.dice-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plus-icon {
  flex-shrink: 0;
  font-size: 1.35rem;
  font-weight: 300;
  color: var(--color-muted-subtle);
  line-height: 1;
  user-select: none;
  pointer-events: none;
}

.roll-btn {
  margin-left: auto;
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--color-success-dark);
  border-radius: 6px;
  background: var(--color-success-dark);
  color: var(--color-on-accent);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  flex-grow: 1;
}

.roll-btn:hover:not(:disabled) {
  background: var(--color-success-bright);
  border-color: var(--color-success-bright);
}

.roll-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
