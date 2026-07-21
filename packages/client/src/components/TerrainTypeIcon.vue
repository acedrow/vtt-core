<script setup lang="ts">
import { terrainTypeIcon, type TerrainType } from "@vtt-core/shared";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    terrainType: TerrainType;
    size?: number;
  }>(),
  {
    size: 16,
  },
);

const iconPath = computed(() => terrainTypeIcon(props.terrainType));
</script>

<template>
  <span v-if="iconPath" class="terrain-type-icon" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.25"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path :d="iconPath" />
    </svg>
  </span>
</template>

<style scoped>
.terrain-type-icon {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--color-text);
}
</style>
