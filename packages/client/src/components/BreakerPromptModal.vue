<script setup lang="ts">
import { ref, watch } from "vue";

import ModalDialog from "./ModalDialog.vue";

const props = defineProps<{
  open: boolean;
  sethianHint?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [useBreaker: boolean];
}>();

const useBreaker = ref<boolean | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) useBreaker.value = null;
  },
);

function onConfirm() {
  if (useBreaker.value == null) return;
  emit("confirm", useBreaker.value);
}
</script>

<template>
  <ModalDialog
    title="Breaker"
    :open="open"
    ok-label="Attack"
    :ok-disabled="useBreaker == null"
    @close="emit('close')"
    @confirm="onConfirm"
  >
    <p class="prompt">
      This attack targets a Swarm and your weapon has Breaker. How do you want to attack?
    </p>
    <p v-if="sethianHint" class="hint">{{ sethianHint }}</p>
    <div class="actions">
      <button
        type="button"
        class="action-btn"
        :class="{ selected: useBreaker === true }"
        @click="useBreaker = true"
      >
        Break swarm
      </button>
      <button
        type="button"
        class="action-btn"
        :class="{ selected: useBreaker === false }"
        @click="useBreaker = false"
      >
        Attack as whole
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.prompt {
  margin: 0 0 1rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--color-text-secondary);
}

.hint {
  margin: -0.5rem 0 1rem;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--color-accent);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.action-btn {
  font-size: 0.8rem;
  padding: 0.35rem 0.65rem;
  background: var(--color-surface-raised);
}

.action-btn.selected {
  border-color: var(--color-accent-muted);
  background: var(--color-accent-subtle-bg);
  color: var(--color-accent);
  font-weight: 600;
}
</style>
