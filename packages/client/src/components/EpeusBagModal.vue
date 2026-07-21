<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { PLAYER_GEAR } from "@vtt-core/shared";

import { useCampaignUnlocks } from "../composables/useCampaignUnlocks.js";
import { useCombatActions } from "../composables/useCombatActions.js";
import ModalDialog from "./ModalDialog.vue";

const props = defineProps<{
  open: boolean;
  initialSlot?: "weapon" | "armor" | null;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [slot: "weapon" | "armor", gearName: string];
}>();

const { activePlayer } = useCombatActions();
const { unlockedSets } = useCampaignUnlocks();

const step = ref<"slot" | "gear">("slot");
const selectedSlot = ref<"weapon" | "armor" | null>(null);
const selectedGear = ref<string | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    if (props.initialSlot) {
      selectedSlot.value = props.initialSlot;
      step.value = "gear";
    } else {
      selectedSlot.value = null;
      step.value = "slot";
    }
    selectedGear.value = null;
  },
);

const gearOptions = computed(() => {
  const slot = selectedSlot.value;
  const player = activePlayer.value;
  if (!slot) return [];
  const current = slot === "weapon" ? player?.gear : player?.gearArmor;
  return PLAYER_GEAR.filter(
    (g) =>
      g.slot === slot &&
      unlockedSets.value.gear.has(g.name) &&
      g.name !== current,
  );
});

function pickSlot(slot: "weapon" | "armor") {
  selectedSlot.value = slot;
  step.value = "gear";
}

function onConfirm() {
  if (!selectedSlot.value || !selectedGear.value) return;
  emit("confirm", selectedSlot.value, selectedGear.value);
}
</script>

<template>
  <ModalDialog
    title="Bag of Tricks"
    :open="open"
    ok-label="Swap gear"
    :ok-disabled="!selectedGear"
    @close="emit('close')"
    @confirm="onConfirm"
  >
    <div v-if="step === 'slot'" class="picker">
      <p class="picker-label">Choose gear slot to swap:</p>
      <button type="button" class="slot-btn" @click="pickSlot('weapon')">Weapon gear</button>
      <button type="button" class="slot-btn" @click="pickSlot('armor')">Armor gear</button>
    </div>
    <div v-else class="picker">
      <p class="picker-label">
        Choose replacement {{ selectedSlot === "weapon" ? "weapon" : "armor" }} gear:
      </p>
      <p v-if="gearOptions.length === 0" class="muted">No other unlocked gear in this slot.</p>
      <label v-for="gear in gearOptions" :key="gear.name" class="gear-option">
        <input v-model="selectedGear" type="radio" :value="gear.name" />
        {{ gear.name }}
      </label>
    </div>
  </ModalDialog>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.picker-label {
  margin: 0;
  font-size: 0.9rem;
}

.slot-btn {
  padding: 0.45rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  cursor: pointer;
  text-align: left;
}

.gear-option {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  font-size: 0.85rem;
  cursor: pointer;
}

.muted {
  color: var(--color-muted);
  font-size: 0.85rem;
  margin: 0;
}
</style>
