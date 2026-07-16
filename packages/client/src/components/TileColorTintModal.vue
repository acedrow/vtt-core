<script setup lang="ts">
import type { TileColorTint } from "@gaem/shared";
import { computed, ref, watch } from "vue";
import { SketchPicker, tinycolor } from "vue-color";
import "vue-color/style.css";

import { tileImageLayerStyle } from "../lib/tileColorTint.js";
import ModalDialog from "./ModalDialog.vue";

const DEFAULT_TINT: TileColorTint = {
  color: "#c44c4c",
  opacity: 0.5,
};

const props = defineProps<{
  open: boolean;
  modelValue: TileColorTint | null;
  previewUrl: string | null;
  title?: string;
}>();

const emit = defineEmits<{
  close: [];
  "update:modelValue": [value: TileColorTint | null];
}>();

const pickerColor = ref(DEFAULT_TINT.color);
const opacityPct = ref(Math.round(DEFAULT_TINT.opacity * 100));

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const draftTint = computed((): TileColorTint => {
  const hex = tinycolor(pickerColor.value).toHexString();
  return {
    color: HEX_RE.test(hex) ? hex : DEFAULT_TINT.color,
    opacity: Math.min(1, Math.max(0, opacityPct.value / 100)),
  };
});

const previewLayerStyle = computed(() =>
  props.previewUrl ? tileImageLayerStyle(props.previewUrl, draftTint.value) : undefined,
);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    const tint = props.modelValue ?? DEFAULT_TINT;
    pickerColor.value = tint.color;
    opacityPct.value = Math.round(tint.opacity * 100);
  },
);

function onConfirm() {
  emit("update:modelValue", draftTint.value);
  emit("close");
}

function onClear() {
  emit("update:modelValue", null);
  emit("close");
}
</script>

<template>
  <ModalDialog
    :title="title ?? 'Color tint'"
    :open="open"
    ok-label="Apply"
    cancel-label="Cancel"
    @close="emit('close')"
    @confirm="onConfirm"
  >
    <div class="tint-modal-body">
      <div class="tile-color-picker">
        <SketchPicker v-model="pickerColor" :disable-alpha="true" />
      </div>

      <label class="slider-row">
        <span class="slider-label">Opacity</span>
        <input v-model.number="opacityPct" type="range" min="0" max="100" step="1" />
        <span class="slider-value">{{ opacityPct }}%</span>
      </label>

      <div class="preview-block">
        <span class="preview-label">Preview</span>
        <div class="preview-tile">
          <span
            v-if="previewUrl && previewLayerStyle"
            class="preview-image"
            :style="previewLayerStyle"
          />
          <span v-else-if="!previewUrl" class="preview-empty">No tile selected</span>
        </div>
      </div>

      <button type="button" class="clear-btn" @click="onClear">Clear tint</button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.tint-modal-body {
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

.slider-row {
  display: grid;
  grid-template-columns: 5.5rem 1fr 2.75rem;
  align-items: center;
  gap: 0.5rem;
}

.slider-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.slider-row input[type="range"] {
  width: 100%;
  margin: 0;
  accent-color: var(--color-accent);
}

.slider-value {
  font-size: 0.78rem;
  color: var(--color-text);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.preview-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.preview-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.preview-tile {
  position: relative;
  width: 64px;
  height: 64px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);
  overflow: hidden;
  image-rendering: pixelated;
}

.preview-image {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.preview-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.35rem;
  text-align: center;
  font-size: 0.65rem;
  color: var(--color-muted);
  line-height: 1.2;
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
