<script setup lang="ts">
import { TERRAIN_TYPES, terrainTypeDisplayName, tileAt, type TerrainType } from "@vtt-core/shared";
import { computed, ref, watch } from "vue";

import { useGameState } from "../composables/useGameState.js";
import ModalDialog from "./ModalDialog.vue";
import TerrainTypePreview from "./TerrainTypePreview.vue";

const props = defineProps<{
  open: boolean;
  coords: { x: number; y: number } | null;
  bulkCoords?: { x: number; y: number }[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const { gameState, send } = useGameState();

const selectedTerrain = ref<TerrainType>("standard");

watch(
  () => [props.open, props.coords, props.bulkCoords] as const,
  ([isOpen, coords, bulkCoords]) => {
    const point = bulkCoords?.[0] ?? coords;
    if (!isOpen || !point) return;
    const tile = gameState.value ? tileAt(gameState.value.tiles, point.x, point.y) : undefined;
    selectedTerrain.value = tile?.terrain[0] ?? "standard";
  },
);

const canApply = computed(() => applyCoords.value.length > 0);

const applyCoords = computed(() =>
  props.bulkCoords?.length ? props.bulkCoords : props.coords ? [props.coords] : [],
);

function terrainLabel(terrain: TerrainType): string {
  return terrainTypeDisplayName(terrain);
}

function apply() {
  if (!canApply.value) return;
  for (const coords of applyCoords.value) {
    send({
      type: "setTileTerrain",
      x: coords.x,
      y: coords.y,
      terrain: selectedTerrain.value,
    });
  }
  emit("close");
}
</script>

<template>
  <ModalDialog
    title="Change terrain type"
    :open="open"
    ok-label="Apply"
    :ok-disabled="!canApply"
    @close="emit('close')"
    @confirm="apply"
  >
    <p v-if="coords" class="coords-label">Tile ({{ coords.x }}, {{ coords.y }})</p>

    <div class="terrain-picker">
      <label class="field-label">Terrain</label>
      <div class="terrain-list">
        <button
          v-for="terrain in TERRAIN_TYPES"
          :key="terrain"
          type="button"
          class="terrain-option"
          :class="{ selected: selectedTerrain === terrain }"
          @click="selectedTerrain = terrain"
        >
          <TerrainTypePreview :terrain-type="terrain" :size="28" />
          <span class="terrain-name">{{ terrainLabel(terrain) }}</span>
        </button>
      </div>
    </div>
  </ModalDialog>
</template>

<style scoped>
.coords-label {
  margin: 0 0 0.75rem;
  font-size: 0.82rem;
  color: var(--color-muted);
}

.field-label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.terrain-picker {
  margin-bottom: 0.75rem;
}

.terrain-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.35rem;
}

.terrain-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
}

.terrain-option:hover {
  background: var(--color-surface-raised);
}

.terrain-option.selected {
  border-color: var(--color-accent-muted);
  background: var(--color-accent-faint-bg);
}

.terrain-name {
  font-size: 0.9rem;
}
</style>
