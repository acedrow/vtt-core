<script setup lang="ts">
import { TILE_EFFECTS } from "@gaem/shared";
import { computed, ref } from "vue";

import { useGameState } from "../composables/useGameState.js";
import EffectPickerModal from "./EffectPickerModal.vue";

const props = defineProps<{
  open: boolean;
  coords: { x: number; y: number } | null;
  bulkCoords?: { x: number; y: number }[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const { send } = useGameState();

const selectedId = ref(TILE_EFFECTS[0]?.id ?? "");
const stacks = ref(1);

const applyCoords = computed(() =>
  props.bulkCoords?.length ? props.bulkCoords : props.coords ? [props.coords] : [],
);
const headerLabel = computed(() =>
  props.coords ? `Tile (${props.coords.x}, ${props.coords.y})` : undefined,
);

function apply() {
  const token = `${selectedId.value}:${stacks.value}`;
  for (const coords of applyCoords.value) {
    send({ type: "applyTileEffect", x: coords.x, y: coords.y, effects: [token] });
  }
  emit("close");
}

function clearTileEffects() {
  if (!applyCoords.value.length) return;
  for (const coords of applyCoords.value) {
    send({ type: "clearTileEffects", x: coords.x, y: coords.y });
  }
  emit("close");
}
</script>

<template>
  <EffectPickerModal
    v-model:selected-id="selectedId"
    v-model:stacks="stacks"
    title="Add tile effect"
    :open="open"
    :effects="TILE_EFFECTS"
    :header-label="headerLabel"
    :apply-enabled="applyCoords.length > 0"
    show-clear
    clear-label="Clear tile effects"
    :clear-disabled="!coords"
    @apply="apply"
    @clear="clearTileEffects"
    @close="emit('close')"
  />
</template>
