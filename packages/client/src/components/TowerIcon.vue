<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number;
  }>(),
  { size: 18 },
);
</script>

<template>
  <svg
    class="tower-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <!-- Rook: 3 merlons, platform, tapered shaft, plinth -->
    <path
      d="M5 4h2.2v5.2H5V4zm5.9 0h2.2v5.2h-2.2V4zm5.9 0H19v5.2h-2.2V4zM4.8 9.2h14.4v1.4H4.8V9.2zM7.2 10.6L16.8 10.6 18.2 19.2 5.8 19.2zM3.2 19.5h17.6v2.8H3.2V19.5z"
    />
  </svg>
</template>

<style scoped>
.tower-icon {
  display: block;
  flex-shrink: 0;
}
</style>
