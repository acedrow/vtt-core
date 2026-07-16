<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { useCombatActions } from "../composables/useCombatActions.js";
import ModalDialog from "./ModalDialog.vue";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [equipWeapon?: string];
}>();

const { activePlayer, thrownTrapWeapon } = useCombatActions();

const selected = ref<string | "recall-only">("recall-only");

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    selected.value = thrownTrapWeapon.value ?? "recall-only";
  },
);

const equipOptions = computed(() => {
  const player = activePlayer.value;
  const trapWeapon = thrownTrapWeapon.value;
  if (!trapWeapon) return [];
  const options: { value: string | "recall-only"; label: string }[] = [
    { value: trapWeapon, label: `Equip ${trapWeapon}` },
  ];
  if (player?.weapon && player.weapon !== trapWeapon) {
    options.push({ value: player.weapon, label: `Equip ${player.weapon} (main)` });
  }
  if (player?.weapon2 && player.weapon2 !== trapWeapon) {
    options.push({ value: player.weapon2, label: `Equip ${player.weapon2} (carried)` });
  }
  return options;
});

function onConfirm() {
  if (selected.value === "recall-only") {
    emit("confirm", undefined);
    return;
  }
  emit("confirm", selected.value);
}
</script>

<template>
  <ModalDialog
    title="Recall Weapon Trap"
    :open="open"
    ok-label="Recall"
    @close="emit('close')"
    @confirm="onConfirm"
  >
    <p class="recall-detail">Choose which weapon to equip after recall (free swap):</p>
    <label v-for="opt in equipOptions" :key="opt.value" class="equip-option">
      <input v-model="selected" type="radio" :value="opt.value" />
      {{ opt.label }}
    </label>
  </ModalDialog>
</template>

<style scoped>
.recall-detail {
  margin: 0 0 0.6rem;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.equip-option {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  font-size: 0.85rem;
  cursor: pointer;
  margin-bottom: 0.35rem;
}
</style>
