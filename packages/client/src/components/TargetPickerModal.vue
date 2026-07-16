<script setup lang="ts">
import { computed, ref, watch } from "vue";

import ModalDialog from "./ModalDialog.vue";

export type TargetPickerEnemy = {
  id: string;
  name: string;
  hp?: number;
  maxHp?: number;
};

const props = defineProps<{
  open: boolean;
  enemies: readonly TargetPickerEnemy[];
  maxSelectable: number;
  preSelectedIds?: readonly string[];
  showHp?: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [selectedIds: string[]];
}>();

const selectedIds = ref<string[]>([]);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    const pre = props.preSelectedIds ?? [];
    selectedIds.value = props.enemies
      .map((e) => e.id)
      .filter((id) => pre.includes(id))
      .slice(0, props.maxSelectable);
  },
);

const canTargetAll = computed(
  () => props.enemies.length > 0 && props.enemies.length <= props.maxSelectable,
);
const multiSelect = computed(() => props.maxSelectable > 1);

function isSelected(id: string): boolean {
  return selectedIds.value.includes(id);
}

function toggle(id: string) {
  if (multiSelect.value) {
    if (isSelected(id)) {
      selectedIds.value = selectedIds.value.filter((x) => x !== id);
      return;
    }
    if (selectedIds.value.length >= props.maxSelectable) return;
    selectedIds.value = [...selectedIds.value, id];
    return;
  }
  selectedIds.value = isSelected(id) ? [] : [id];
}

function targetAll() {
  selectedIds.value = props.enemies.map((e) => e.id).slice(0, props.maxSelectable);
}

function labelFor(enemy: TargetPickerEnemy): string {
  if (props.showHp && enemy.hp != null && enemy.maxHp != null) {
    return `${enemy.name} (${enemy.hp}/${enemy.maxHp})`;
  }
  return enemy.name;
}

function onConfirm() {
  emit("confirm", [...selectedIds.value]);
}
</script>

<template>
  <ModalDialog
    :title="title ?? 'Select targets'"
    :open="open"
    ok-label="Confirm"
    @close="emit('close')"
    @confirm="onConfirm"
  >
    <p class="hint">
      {{
        multiSelect
          ? `Select up to ${maxSelectable} target${maxSelectable === 1 ? "" : "s"} in this square.`
          : "Select a target in this square."
      }}
    </p>

    <div class="target-list">
      <button
        v-for="enemy in enemies"
        :key="enemy.id"
        type="button"
        class="target-option"
        :class="{ selected: isSelected(enemy.id) }"
        @click="toggle(enemy.id)"
      >
        <span class="target-check" aria-hidden="true">{{ isSelected(enemy.id) ? "✓" : "" }}</span>
        <span class="target-name">{{ labelFor(enemy) }}</span>
      </button>
    </div>

    <button
      v-if="canTargetAll && multiSelect"
      type="button"
      class="btn-secondary"
      @click="targetAll"
    >
      Target all in square
    </button>
  </ModalDialog>
</template>

<style scoped>
.hint {
  margin: 0 0 0.75rem;
  font-size: 0.82rem;
  color: var(--color-muted);
}

.target-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.35rem;
  margin-bottom: 0.75rem;
}

.target-option {
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

.target-option:hover {
  background: var(--color-surface-raised);
}

.target-option.selected {
  background: var(--color-accent-muted);
  outline: 1px solid var(--color-accent);
}

.target-check {
  width: 1rem;
  text-align: center;
  font-weight: 700;
  color: var(--color-accent);
}

.target-name {
  font-weight: 600;
}

.btn-secondary {
  width: 100%;
  margin-bottom: 0.25rem;
  padding: 0.45rem 0.85rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: 0.85rem;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
}

.btn-secondary:hover {
  border-color: var(--color-accent);
}
</style>
