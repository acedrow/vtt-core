<script setup lang="ts">
import {
  CONVOY_TYPES,
  FACTIONS,
  getConvoyTypeInfo,
  getRegionFactionId,
  regionIdForQuarter,
  type FactionId,
  type OverworldConvoyType,
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

const selectedType = ref<OverworldConvoyType>(CONVOY_TYPES[0]?.id ?? "supply");
const selectedFactionId = ref<FactionId>(FACTIONS[0]?.id ?? "");

const FACTION_OPTIONS = computed(() =>
  FACTIONS.map((f) => ({ id: f.id as FactionId, name: f.name })),
);

const regionId = computed((): OverworldRegionId | null => {
  if (props.qx == null) return null;
  return regionIdForQuarter(props.qx);
});

const typeInfo = computed(() => getConvoyTypeInfo(selectedType.value));

watch(
  () => [props.open, props.qx] as const,
  ([isOpen, qx]) => {
    if (!isOpen) return;
    selectedType.value = CONVOY_TYPES[0]?.id ?? "supply";
    if (qx != null) {
      selectedFactionId.value =
        getRegionFactionId(regionIdForQuarter(qx)) ?? FACTIONS[0]?.id ?? "";
    }
  },
);

function deploy() {
  if (props.qx == null || props.qy == null) return;
  send({
    type: "overworldConvoyAction",
    action: {
      kind: "place",
      qx: props.qx,
      qy: props.qy,
      type: selectedType.value,
      factionId: selectedFactionId.value,
    },
  });
  emit("close");
}
</script>

<template>
  <ModalDialog
    title="Deploy convoy"
    :open="open"
    ok-label="Deploy"
    @close="emit('close')"
    @confirm="deploy"
  >
    <p v-if="qx != null && qy != null" class="coords-label">
      Quarter ({{ qx }}, {{ qy }})
      <span v-if="regionId"> · {{ regionId }}</span>
    </p>

    <label class="field-label" for="convoy-type">Type</label>
    <select id="convoy-type" v-model="selectedType" class="field-input">
      <option v-for="entry in CONVOY_TYPES" :key="entry.id" :value="entry.id">
        {{ entry.name }}
      </option>
    </select>

    <label class="field-label" for="convoy-faction">Faction</label>
    <select id="convoy-faction" v-model="selectedFactionId" class="field-input">
      <option v-for="faction in FACTION_OPTIONS" :key="faction.id" :value="faction.id">
        {{ faction.name }}
      </option>
    </select>

    <div v-if="typeInfo" class="type-info">
      <p class="type-summary">{{ typeInfo.summary }}</p>
      <p class="type-section-label">Escort</p>
      <p class="type-body">{{ typeInfo.escort }}</p>
      <p class="type-section-label">On completion</p>
      <ul class="completion-list">
        <li v-for="opt in typeInfo.completionOptions" :key="opt.name">
          <strong>{{ opt.name }}.</strong>
          {{ opt.description }}
        </li>
      </ul>
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

.type-info {
  margin-top: 0.25rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-raised);
}

.type-summary {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
  line-height: 1.4;
}

.type-section-label {
  margin: 0 0 0.35rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.type-body {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.completion-list {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--color-text-secondary);
}

.completion-list li {
  margin-bottom: 0.45rem;
}

.completion-list li:last-child {
  margin-bottom: 0;
}

.completion-list strong {
  color: var(--color-text);
}
</style>
