<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useCharacterSheetSelection } from "../composables/useCharacterSheetSelection.js";
import { useCharacterSheets } from "../composables/useCharacterSheets.js";
import { useInfoDataSelection } from "../composables/useInfoDataSelection.js";
import {
  kindLabel,
  searchGameData,
  type GameDataSearchResult,
} from "../lib/game-data-search.js";

const query = ref("");
const debouncedQuery = ref("");
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const { clearBoardSelection } = useBoardSelection();
const { selectDataFocus } = useInfoDataSelection();
const { selectSheet } = useCharacterSheetSelection();
const { sheets, loadSheets } = useCharacterSheets();

watch(query, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = value;
  }, 150);
});

const results = computed(() =>
  searchGameData(debouncedQuery.value, {
    characterSheets: sheets.value,
  }),
);

const placeholder = "Classes, armor, weapons, enemies, character sheets…";

const hint = "Search classes, armor, weapons, enemies, and character sheets by name or keyword.";

function onSelect(result: GameDataSearchResult) {
  if (result.kind === "characterSheet" && result.sheetId) {
    clearBoardSelection();
    selectSheet(result.sheetId);
  } else if (result.kind !== "characterSheet") {
    selectDataFocus({ kind: result.kind, name: result.name });
  }
}

onMounted(() => {
  void loadSheets();
});
</script>

<template>
  <div class="search-panel">
    <label class="search-label">
      <span class="search-label-text">Search game data</span>
      <input
        v-model="query"
        class="search-input"
        type="search"
        :placeholder="placeholder"
        autocomplete="off"
        spellcheck="false"
      />
    </label>

    <ul v-if="query.trim() && results.length" class="results">
      <li v-for="result in results" :key="`${result.kind}:${result.sheetId ?? result.name}`">
        <button class="result-btn" type="button" @click="onSelect(result)">
          <span class="result-name">{{ result.name }}</span>
          <span class="result-meta">
            <span class="result-kind">{{ kindLabel(result.kind) }}</span>
            <span v-if="result.subtitle" class="result-subtitle">{{ result.subtitle }}</span>
          </span>
        </button>
      </li>
    </ul>

    <p v-else-if="query.trim()" class="empty">No matches for “{{ query.trim() }}”.</p>
    <p v-else class="hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.search-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
}

.search-label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.search-label-text {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
}

.search-input {
  border: 1px solid var(--color-border);
  border-radius: 0;
  background: var(--color-bg);
  color: var(--color-text);
  padding: 0.55rem 0.75rem;
  font-size: 0.9rem;
}

.results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.result-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  border: 1px solid var(--color-border);
  border-radius: 0;
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0.55rem 0.75rem;
  text-align: left;
  cursor: pointer;
}

.result-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-accent-muted);
}

.result-name {
  font-size: 0.9rem;
  font-weight: 600;
}

.result-meta {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.result-kind {
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.empty,
.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-muted);
  line-height: 1.45;
}
</style>
