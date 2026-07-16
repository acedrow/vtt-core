<script setup lang="ts">
import { computed, nextTick, ref, type Ref } from "vue";

import { useHpBar } from "../composables/useHpBar.js";

const props = defineProps<{
  currentHp: number;
  maxHp: number;
  editable?: boolean;
  compact?: boolean;
  inline?: boolean;
}>();

const emit = defineEmits<{
  commit: [hp: number];
}>();

const editing = ref(false);
const draft = ref(0);
const inputEl = ref<HTMLInputElement | null>(null);

const currentHpRef = computed(() => props.currentHp) as Ref<number>;
const maxHpRef = computed(() => props.maxHp) as Ref<number>;
const { hpPercent, hpBarLevel } = useHpBar(currentHpRef, maxHpRef);

function startEdit() {
  if (!props.editable) return;
  draft.value = props.currentHp;
  editing.value = true;
  nextTick(() => {
    inputEl.value?.focus();
    inputEl.value?.select();
  });
}

function commitEdit() {
  if (!editing.value) return;
  editing.value = false;
  const hp = Math.trunc(draft.value);
  if (!Number.isFinite(hp)) return;
  if (hp === props.currentHp) return;
  emit("commit", hp);
}

function cancelEdit() {
  editing.value = false;
  draft.value = props.currentHp;
}
</script>

<template>
  <div class="hp-bar-block" :class="{ compact, inline }">
    <span v-if="!compact" class="hp-bar-label">HP</span>
    <span v-if="!compact" class="hp-bar-values">
      <input
        v-if="editing"
        ref="inputEl"
        v-model.number="draft"
        class="hp-inline-input"
        type="number"
        min="0"
        :max="maxHp"
        @blur="commitEdit"
        @keydown.enter.prevent="commitEdit"
        @keydown.esc.prevent="cancelEdit"
      />
      <button
        v-else-if="editable"
        type="button"
        class="hp-current hp-editable"
        @click="startEdit"
      >
        {{ currentHp }}
      </button>
      <span v-else class="hp-current">{{ currentHp }}</span>
      <span class="hp-max"> / {{ maxHp }}</span>
    </span>
    <div class="hp-bar-track">
      <div class="hp-bar-fill" :class="hpBarLevel" :style="{ width: `${hpPercent}%` }" />
    </div>
  </div>
</template>

<style scoped>
.hp-bar-block.compact {
  margin-bottom: 0;
}

.hp-bar-block.compact .hp-bar-track {
  height: 3px;
  border-radius: 0;
}

.hp-bar-values {
  display: inline-flex;
  align-items: baseline;
}

.hp-editable {
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  padding: 0;
  cursor: pointer;
  border-bottom: 1px dashed var(--color-accent-muted);
}

.hp-editable:hover {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.hp-inline-input {
  width: 2.75rem;
  border: 1px solid var(--color-accent);
  border-radius: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  padding: 0 0.2rem;
  text-align: right;
  -moz-appearance: textfield;
}

.hp-inline-input::-webkit-outer-spin-button,
.hp-inline-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
