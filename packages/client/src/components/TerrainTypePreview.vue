<script setup lang="ts">
import type { TerrainType } from "@vtt-core/shared";

import TerrainTypeIcon from "./TerrainTypeIcon.vue";

withDefaults(
  defineProps<{
    terrainType: TerrainType;
    size?: number;
  }>(),
  {
    size: 28,
  },
);
</script>

<template>
  <span
    v-if="terrainType === 'standard'"
    class="terrain-preview terrain-preview--standard"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
  <span
    v-else
    class="terrain-preview terrain-preview--icon"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <TerrainTypeIcon :terrain-type="terrainType" :size="size - 8" />
  </span>
</template>

<style scoped>
.terrain-preview {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
}

.terrain-preview--standard {
  background: var(--color-surface-raised);
}
</style>
