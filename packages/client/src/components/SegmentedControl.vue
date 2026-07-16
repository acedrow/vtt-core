<script setup lang="ts" generic="T extends string | number">
defineProps<{
  options: { value: T; label: string }[];
  disabled?: boolean;
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="segmented-control">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      class="segmented-btn"
      :class="{ active: model === opt.value }"
      :disabled="disabled"
      @click="model = opt.value"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
