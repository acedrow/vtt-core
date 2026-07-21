<script setup lang="ts">
import type { GameMap } from "@vtt-core/shared";
import { computed, ref, watch } from "vue";

import { useApi } from "../composables/useApi.js";
import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useGameState } from "../composables/useGameState.js";
import { useMapSelection } from "../composables/useMapSelection.js";
import { showToast } from "../composables/useToasts.js";
import PanelShell from "./PanelShell.vue";

const props = defineProps<{ mapId: string }>();

const { fetchMap, fetchMaps, deleteMap } = useApi();
const { closeRightPanel } = useBoardSelection();
const { gameState, send } = useGameState();
const { selectMap, notifyMapsChanged } = useMapSelection();

const map = ref<GameMap | null>(null);
const mapCount = ref(0);
const loading = ref(true);
const error = ref<string | null>(null);
const actionError = ref<string | null>(null);
const activating = ref(false);
const deleting = ref(false);
const savingStartingState = ref(false);
const resettingStartingState = ref(false);

const isActiveOnBoard = computed(
  () => map.value != null && gameState.value?.mapId === map.value.id,
);

const canActivate = computed(() => !isActiveOnBoard.value && !activating.value && !deleting.value);
const canDelete = computed(
  () => !isActiveOnBoard.value && mapCount.value > 1 && !activating.value && !deleting.value,
);
const hasStartingState = computed(() => map.value?.startingState != null);
const canSaveStartingState = computed(
  () =>
    isActiveOnBoard.value &&
    !savingStartingState.value &&
    !resettingStartingState.value &&
    !activating.value &&
    !deleting.value,
);
const canResetToStartingState = computed(
  () => canSaveStartingState.value && hasStartingState.value,
);

const tilePresetCount = computed(() => Object.keys(map.value?.tilePresets ?? {}).length);

async function loadMapCount() {
  mapCount.value = (await fetchMaps()).length;
}

async function loadMap(id: string) {
  loading.value = true;
  error.value = null;
  map.value = null;
  try {
    const [result] = await Promise.all([fetchMap(id), loadMapCount()]);
    if (!result) throw new Error("Map not found");
    map.value = result;
  } catch {
    error.value = "Unable to load map";
  } finally {
    loading.value = false;
  }
}

function activateMap() {
  if (!canActivate.value) return;
  activating.value = true;
  actionError.value = null;
  send({ type: "activateMap", mapId: props.mapId });
  activating.value = false;
}

function saveStartingState() {
  if (!canSaveStartingState.value) return;
  savingStartingState.value = true;
  actionError.value = null;
  send({ type: "saveStartingState" });
  savingStartingState.value = false;
  showToast("Starting state saved", "success");
  void loadMap(props.mapId);
}

function resetToStartingState() {
  if (!canResetToStartingState.value) return;
  if (
    !confirm(
      "Reset the board to the saved starting state? This overwrites current tile terrain and enemy positions/HP.",
    )
  ) {
    return;
  }
  resettingStartingState.value = true;
  actionError.value = null;
  send({ type: "resetToStartingState" });
  resettingStartingState.value = false;
}

async function removeMap() {
  if (!canDelete.value || !map.value) return;
  if (!confirm(`Delete map "${map.value.name}"?`)) return;
  deleting.value = true;
  actionError.value = null;
  try {
    await deleteMap(props.mapId);
    notifyMapsChanged();
    selectMap(null);
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : "Unable to delete map";
  } finally {
    deleting.value = false;
  }
}

watch(
  () => props.mapId,
  (id) => {
    void loadMap(id);
  },
  { immediate: true },
);
</script>

<template>
  <PanelShell :title="map?.name ?? mapId" @close="closeRightPanel">
    <div class="panel-body">
      <p v-if="loading" class="panel-muted">Loading…</p>
      <p v-else-if="error" class="panel-error">{{ error }}</p>
      <template v-else-if="map">
        <p v-if="isActiveOnBoard" class="active-badge">Active on board</p>
        <dl class="map-details">
          <div class="detail-row">
            <dt>Dimensions</dt>
            <dd>{{ map.width }}×{{ map.height }}</dd>
          </div>
          <div class="detail-row">
            <dt>Tiles</dt>
            <dd>{{ map.tiles.length }}</dd>
          </div>
          <div class="detail-row">
            <dt>Enemy spawns</dt>
            <dd>{{ map.enemies?.length ?? 0 }}</dd>
          </div>
          <div class="detail-row">
            <dt>Tile presets</dt>
            <dd>{{ tilePresetCount }}</dd>
          </div>
          <div class="detail-row">
            <dt>Starting state</dt>
            <dd>{{ hasStartingState ? "Saved" : "Not saved" }}</dd>
          </div>
        </dl>
        <p v-if="actionError" class="panel-error">{{ actionError }}</p>
        <div class="map-actions">
          <button class="cta" type="button" :disabled="!canActivate" @click="activateMap">
            {{ activating ? "Activating…" : "Activate" }}
          </button>
          <button
            class="cta"
            type="button"
            :disabled="!canSaveStartingState"
            @click="saveStartingState"
          >
            {{ savingStartingState ? "Saving…" : "Save starting state" }}
          </button>
          <button
            class="cta danger"
            type="button"
            :disabled="!canResetToStartingState"
            @click="resetToStartingState"
          >
            {{ resettingStartingState ? "Resetting…" : "Reset to starting state" }}
          </button>
          <button class="cta danger" type="button" :disabled="!canDelete" @click="removeMap">
            {{ deleting ? "Deleting…" : "Delete" }}
          </button>
        </div>
      </template>
    </div>
  </PanelShell>
</template>

<style scoped>
.panel-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel-muted {
  margin: 0;
  color: var(--color-muted-subtle);
  font-size: 0.85rem;
}

.panel-error {
  margin: 0;
  color: var(--color-danger);
  font-size: 0.85rem;
}

.active-badge {
  margin: 0;
  padding: 0.25rem 0.5rem;
  width: fit-content;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 600;
}

.map-details {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.85rem;
}

.detail-row dt {
  margin: 0;
  color: var(--color-muted);
  font-weight: 600;
}

.detail-row dd {
  margin: 0;
  color: var(--color-text);
}

.map-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
</style>
