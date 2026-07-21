<script setup lang="ts">
import { getReconTable } from "@vtt-core/shared";
import { computed, nextTick, ref, watch } from "vue";

import { useApi } from "../composables/useApi.js";
import { useBoardSelection } from "../composables/useBoardSelection.js";
import { selectedTableId } from "../composables/useTableSelection.js";
import PanelShell from "./PanelShell.vue";
import RuleText from "./RuleText.vue";

const { closeRightPanel } = useBoardSelection();
const { apiFetch } = useApi();

const table = computed(() => getReconTable(selectedTableId.value));
const lastRoll = ref<number | null>(null);
const rolling = ref(false);
const rollError = ref<string | null>(null);
const entryEls = new Map<number, HTMLElement>();

watch(selectedTableId, () => {
  lastRoll.value = null;
  rollError.value = null;
});

async function rollOnTable() {
  const t = table.value;
  if (!t || rolling.value) return;
  rolling.value = true;
  rollError.value = null;
  try {
    const res = await apiFetch("/api/random-integers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        n: 1,
        min: 1,
        max: t.die,
        bonus: 0,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Roll failed");
    }
    const data = (await res.json()) as { data: number[] };
    const roll = data.data[0];
    if (roll == null) throw new Error("Roll failed");
    lastRoll.value = roll;
    await nextTick();
    entryEls.get(roll)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    rollError.value = err instanceof Error ? err.message : "Roll failed";
  } finally {
    rolling.value = false;
  }
}

function setEntryEl(roll: number, el: Element | null) {
  if (el instanceof HTMLElement) entryEls.set(roll, el);
  else entryEls.delete(roll);
}
</script>

<template>
  <PanelShell
    v-if="table"
    :title="table.name"
    :subtitle="`Roll 1d${table.die}`"
    close-variant="ghost"
    @close="closeRightPanel"
  >
    <div class="panel-body">
      <div class="roll-bar">
        <button
          class="btn-primary"
          type="button"
          :disabled="rolling"
          @click="rollOnTable"
        >
          {{ rolling ? "Rolling…" : "Roll on table" }}
        </button>
        <p v-if="lastRoll != null" class="roll-result">Rolled {{ lastRoll }}</p>
        <p v-if="rollError" class="roll-error">{{ rollError }}</p>
      </div>

      <article
        v-for="entry in table.entries"
        :key="entry.roll"
        :ref="(el) => setEntryEl(entry.roll, el as Element | null)"
        class="list-card"
        :class="{ 'list-card--hit': lastRoll === entry.roll }"
      >
        <div class="entry-header">
          <span class="entry-roll">{{ entry.roll }}</span>
        </div>
        <div class="list-card-body">
          <p class="item-description">
            <RuleText :text="entry.text" />
          </p>
        </div>
      </article>
    </div>
  </PanelShell>
</template>

<style scoped>
.roll-bar {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  position: sticky;
  top: 0;
  z-index: 1;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  background: var(--color-bg);
}

.roll-result {
  margin: 0;
  color: var(--color-text);
  font-size: 0.85rem;
}

.roll-error {
  margin: 0;
  color: var(--color-danger, #f85149);
  font-size: 0.85rem;
}

.entry-header {
  padding: 0.6rem 0.75rem;
  font-family: var(--font-heading);
  font-weight: 500;
  font-size: 0.9rem;
  letter-spacing: 0.04rem;
  background: var(--color-surface);
}

.entry-roll {
  font-weight: 600;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}

.item-description {
  margin: 0;
}

.list-card--hit {
  outline: 1px solid var(--color-accent, #58a6ff);
  background: color-mix(in srgb, var(--color-accent, #58a6ff) 12%, transparent);
}

.list-card--hit .entry-roll {
  color: var(--color-accent, #58a6ff);
}
</style>
