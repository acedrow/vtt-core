<script setup lang="ts">
const model = defineModel<number>({ required: true });

const props = defineProps<{
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  compact?: boolean;
  clamp?: (value: number) => number;
  invertButtons?: boolean;
}>();

const emit = defineEmits<{
  adjust: [delta: number];
}>();

function clampValue(value: number): number {
  let next = value;
  if (props.clamp) next = props.clamp(next);
  if (props.min != null) next = Math.max(props.min, next);
  if (props.max != null) next = Math.min(props.max, next);
  return next;
}

function onChange() {
  model.value = clampValue(model.value);
}

function adjust(delta: number) {
  const step = props.step ?? 1;
  const applied = (props.invertButtons ? -delta : delta) * step;
  model.value = clampValue(model.value + applied);
  emit("adjust", applied);
}
</script>

<template>
  <div :class="['stepper', { 'stepper--compact': compact }]">
    <button
      type="button"
      class="step-btn"
      :disabled="disabled"
      @click="adjust(-1)"
    >
      −
    </button>
    <input
      v-model.number="model"
      type="number"
      class="step-input"
      :min="min"
      :max="max"
      :step="step ?? 1"
      :disabled="disabled"
      @change="onChange"
    />
    <button
      type="button"
      class="step-btn"
      :disabled="disabled"
      @click="adjust(1)"
    >
      +
    </button>
  </div>
</template>
