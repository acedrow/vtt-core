<script setup lang="ts">
import { computed, watch } from "vue";

import EffectIcon from "./EffectIcon.vue";
import ModalDialog from "./ModalDialog.vue";
import NumberStepper from "./NumberStepper.vue";

const props = defineProps<{
  open: boolean;
  title: string;
  effects: readonly { id: string; summary?: string }[];
  headerLabel?: string;
  applyEnabled: boolean;
  showClear?: boolean;
  clearLabel: string;
  clearDisabled?: boolean;
}>();

const selectedId = defineModel<string>("selectedId", { required: true });
const stacks = defineModel<number>("stacks", { required: true });

const emit = defineEmits<{
  close: [];
  apply: [];
  clear: [];
}>();

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    selectedId.value = props.effects[0]?.id ?? "";
    stacks.value = 1;
  },
);

const selectedEffect = computed(() => props.effects.find((e) => e.id === selectedId.value));
const canApply = computed(
  () => props.applyEnabled && !!selectedId.value && stacks.value !== 0,
);
</script>

<template>
  <ModalDialog
    :title="title"
    :open="open"
    ok-label="Apply"
    :ok-disabled="!canApply"
    @close="emit('close')"
    @confirm="emit('apply')"
  >
    <p v-if="headerLabel" class="coords-label">{{ headerLabel }}</p>

    <div class="effect-picker">
      <label class="field-label">Effect</label>
      <div class="effect-list">
        <button
          v-for="effect in effects"
          :key="effect.id"
          type="button"
          class="effect-option"
          :class="{ selected: selectedId === effect.id }"
          @click="selectedId = effect.id"
        >
          <EffectIcon :effect-id="effect.id" :size="18" />
          <span class="effect-name">{{ effect.id }}</span>
        </button>
      </div>
    </div>

    <p v-if="selectedEffect?.summary" class="effect-summary">{{ selectedEffect.summary }}</p>

    <div class="stacks-row">
      <span class="field-label">Stacks</span>
      <NumberStepper v-model="stacks" :min="-99" :max="99" />
    </div>

    <button
      v-if="showClear"
      type="button"
      class="btn-danger"
      :disabled="clearDisabled"
      @click="emit('clear')"
    >
      {{ clearLabel }}
    </button>
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

.effect-picker {
  margin-bottom: 0.75rem;
}

.effect-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.35rem;
}

.effect-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4rem 0.5rem;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.85rem;
}

.effect-option:hover {
  background: var(--color-surface-raised);
}

.effect-option.selected {
  background: var(--color-accent-muted);
  outline: 1px solid var(--color-accent);
}

.effect-name {
  font-weight: 600;
}

.effect-summary {
  margin: 0 0 0.75rem;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--color-muted);
}

.stacks-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.btn-danger {
  width: 100%;
  margin-bottom: 0.75rem;
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  border: 1px solid var(--color-danger-muted-border);
  background: var(--color-danger-subtle-bg);
  color: var(--color-danger);
  font-size: 0.85rem;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
}

.btn-danger:hover:not(:disabled) {
  background: var(--color-danger-hover-bg);
  border-color: var(--color-danger);
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
