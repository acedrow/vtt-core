<script setup lang="ts">
import { GM_TOOL_ICONS, type GmToolIconId } from "../lib/gmToolIcons.js";

defineProps<{
  icon: GmToolIconId;
  class?: string;
}>();
</script>

<template>
  <svg
    class="gm-tool-icon"
    :class="$props.class"
    :viewBox="GM_TOOL_ICONS[icon].viewBox"
    fill="none"
    aria-hidden="true"
  >
    <template v-if="icon === 'damageEffect'">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.25" />
      <path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" />
    </template>
    <template v-else>
      <path
        v-for="(d, i) in GM_TOOL_ICONS[icon].paths"
        :key="i"
        :d="d"
        stroke="currentColor"
        :stroke-width="icon === 'paintbrush' ? 2 : 1.25"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>
  </svg>
</template>

<style scoped>
.gm-tool-icon {
  display: block;
}
</style>
