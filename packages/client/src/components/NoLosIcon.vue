<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number;
  }>(),
  { size: 20 },
);
</script>

<template>
  <span class="no-los-icon" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.25 8C3.4 4.6 12.6 4.6 13.75 8C12.6 11.4 3.4 11.4 2.25 8Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <circle cx="8" cy="8" r="2.25" fill="currentColor" />
      <path
        d="M13.25 2.75L2.75 13.25"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  </span>
</template>

<style scoped>
.no-los-icon {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--color-text);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75));
}
</style>
