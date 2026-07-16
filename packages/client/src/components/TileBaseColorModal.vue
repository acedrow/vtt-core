<script setup lang="ts">
import { ref, watch } from "vue";
import { SketchPicker, tinycolor } from "vue-color";
import "vue-color/style.css";

import ModalDialog from "./ModalDialog.vue";

const props = defineProps<{
  open: boolean;
  modelValue: string | null;
}>();

const emit = defineEmits<{
  close: [];
  "update:modelValue": [value: string | null];
}>();

const pickerColor = ref("#2d4a3e");

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function pickerHex(): string {
  return tinycolor(pickerColor.value).toHexString();
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    pickerColor.value = props.modelValue ?? "#2d4a3e";
  },
);

function onConfirm() {
  const hex = pickerHex();
  if (HEX_RE.test(hex)) {
    emit("update:modelValue", hex);
  }
  emit("close");
}

function onClear() {
  emit("update:modelValue", null);
  emit("close");
}
</script>

<template>
  <ModalDialog
    title="Tile base color"
    :open="open"
    ok-label="Apply"
    cancel-label="Cancel"
    @close="emit('close')"
    @confirm="onConfirm"
  >
    <div class="color-modal-body">
      <div class="tile-color-picker">
        <SketchPicker v-model="pickerColor" :disable-alpha="true" />
      </div>
      <button type="button" class="clear-btn" @click="onClear">Clear color</button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.color-modal-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tile-color-picker {
  --vc-body-bg: var(--color-surface);
  --vc-input-bg: var(--color-bg);
  --vc-input-text: var(--color-text);
  --vc-input-label: var(--color-muted);
  --vc-input-border: var(--color-border);
  --vc-sketch-input-label: var(--color-muted);
  --vc-sketch-presets-border: var(--color-border);
  --vc-picker-bg: var(--color-surface-raised);
}

.tile-color-picker :deep(.vc-sketch-picker) {
  width: 100%;
  box-sizing: border-box;
  box-shadow: none;
  padding: 0;
  font-family: inherit;
}

.clear-btn {
  align-self: flex-start;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 600;
  font-family: inherit;
  padding: 0.25rem 0.55rem;
  cursor: pointer;
}

.clear-btn:hover {
  color: var(--color-text);
  background: var(--color-surface-raised);
}
</style>
