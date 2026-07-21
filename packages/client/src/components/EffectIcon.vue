<script setup lang="ts">
import { getEffectById } from "@vtt-core/shared";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    effectId: string;
    stacks?: number;
    size?: number;
    showStacks?: boolean;
  }>(),
  {
    size: 16,
    showStacks: false,
  },
);

const effect = computed(() => getEffectById(props.effectId));
const iconPath = computed(() => effect.value?.icon ?? "M2 8 H14");
const iconFill = computed(() => effect.value?.iconFill === true);
</script>

<template>
  <span
    class="effect-icon"
    :class="{ 'has-stacks': showStacks && stacks != null && stacks > 0 }"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 16 16"
      :fill="iconFill ? 'currentColor' : 'none'"
      :stroke="iconFill ? 'none' : 'currentColor'"
      stroke-width="1.25"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path :d="iconPath" :fill-rule="iconFill ? 'evenodd' : undefined" />
    </svg>
    <span v-if="showStacks && stacks != null && stacks > 0" class="stack-badge">{{ stacks }}</span>
  </span>
</template>

<style scoped>
.effect-icon {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  color: var(--color-text);
}

.stack-badge {
  position: absolute;
  top: -3px;
  right: -4px;
  font-size: 0.55rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
  opacity: 0.5;
}
</style>
