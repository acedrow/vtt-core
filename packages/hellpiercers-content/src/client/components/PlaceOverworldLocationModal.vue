<script setup lang="ts">
import {
  getFactionForRegion,
  regionIdForQuarter,
  type FactionLocation,
  type OverworldRegionId,
} from "@gaem/shared";
import { computed, ref, watch } from "vue";

import { useGameState } from "@gaem/client/composables/useGameState.js";
import ModalDialog from "@gaem/client/components/ModalDialog.vue";

const props = defineProps<{
  open: boolean;
  qx: number | null;
  qy: number | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { send } = useGameState();

const customName = ref("");
const selectedCatalogName = ref<string | null>(null);

const regionId = computed((): OverworldRegionId | null => {
  if (props.qx == null) return null;
  return regionIdForQuarter(props.qx);
});

const faction = computed(() => (regionId.value ? getFactionForRegion(regionId.value) : null));

const canPlace = computed(() => customName.value.trim().length > 0);

watch(
  () => [props.open, props.qx, props.qy] as const,
  ([isOpen]) => {
    if (!isOpen) return;
    customName.value = "";
    selectedCatalogName.value = null;
  },
);

function selectCatalog(loc: FactionLocation) {
  selectedCatalogName.value = loc.name;
  customName.value = loc.name;
}

function onCustomInput() {
  if (selectedCatalogName.value != null && customName.value !== selectedCatalogName.value) {
    selectedCatalogName.value = null;
  }
}

function place() {
  if (!canPlace.value || props.qx == null || props.qy == null || !faction.value || !regionId.value) {
    return;
  }
  send({
    type: "overworldLocationAction",
    action: {
      kind: "place",
      qx: props.qx,
      qy: props.qy,
      name: customName.value.trim(),
      factionId: faction.value.id,
    },
  });
  emit("close");
}
</script>

<template>
  <ModalDialog
    title="Place location"
    :open="open"
    ok-label="Place"
    :ok-disabled="!canPlace"
    @close="emit('close')"
    @confirm="place"
  >
    <p v-if="qx != null && qy != null" class="coords-label">
      Quarter ({{ qx }}, {{ qy }})
      <span v-if="faction"> · {{ faction.name }}</span>
    </p>

    <label class="field-label" for="location-custom-name">Name</label>
    <input
      id="location-custom-name"
      v-model="customName"
      class="field-input"
      type="text"
      placeholder="Custom location name"
      @input="onCustomInput"
    />

    <template v-if="faction">
      <div class="catalog-section">
        <span class="field-label">Starting locations</span>
        <div class="location-list">
          <button
            v-for="loc in faction.startingLocations"
            :key="`start-${loc.name}`"
            type="button"
            class="location-option"
            :class="{ selected: selectedCatalogName === loc.name }"
            @click="selectCatalog(loc)"
          >
            {{ loc.name }}
          </button>
        </div>
      </div>

      <div class="catalog-section">
        <span class="field-label">Unique locations</span>
        <div class="location-list">
          <button
            v-for="loc in faction.uniqueLocations"
            :key="`unique-${loc.name}`"
            type="button"
            class="location-option"
            :class="{ selected: selectedCatalogName === loc.name }"
            @click="selectCatalog(loc)"
          >
            {{ loc.name }}
          </button>
        </div>
      </div>
    </template>
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

.field-input {
  width: 100%;
  margin-bottom: 0.85rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.9rem;
}

.catalog-section {
  margin-bottom: 0.75rem;
}

.location-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.35rem;
}

.location-option {
  display: block;
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  font-size: 0.9rem;
}

.location-option:hover {
  background: var(--color-surface-raised);
}

.location-option.selected {
  border-color: var(--color-accent-muted);
  background: var(--color-accent-faint-bg);
}
</style>
