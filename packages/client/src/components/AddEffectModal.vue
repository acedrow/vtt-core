<script setup lang="ts">
import { UNIT_EFFECTS } from "@vtt-core/shared";
import { computed, ref } from "vue";

import { useGameState } from "../composables/useGameState.js";
import { useSession } from "../composables/useSession.js";
import EffectPickerModal from "./EffectPickerModal.vue";

const props = defineProps<{
  open: boolean;
  target: { kind: "player" | "enemy"; id: string } | null;
  bulkTargets?: { kind: "player" | "enemy"; id: string }[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const { send } = useGameState();
const { hasGmCapabilities } = useSession();

const selectedId = ref(UNIT_EFFECTS[0]?.id ?? "");
const stacks = ref(1);

const applyTargets = computed(() =>
  props.bulkTargets?.length ? props.bulkTargets : props.target ? [props.target] : [],
);

function apply() {
  const token = `${selectedId.value}:${stacks.value}`;
  for (const target of applyTargets.value) {
    send({ type: "applyEffect", target, effects: [token] });
  }
  emit("close");
}

function clearEffects() {
  if (!applyTargets.value.length) return;
  for (const target of applyTargets.value) {
    send({ type: "clearEffects", target });
  }
  emit("close");
}
</script>

<template>
  <EffectPickerModal
    v-model:selected-id="selectedId"
    v-model:stacks="stacks"
    title="Add effect"
    :open="open"
    :effects="UNIT_EFFECTS"
    :apply-enabled="applyTargets.length > 0"
    :show-clear="hasGmCapabilities"
    clear-label="Clear effects"
    :clear-disabled="!applyTargets.length"
    @apply="apply"
    @clear="clearEffects"
    @close="emit('close')"
  />
</template>
