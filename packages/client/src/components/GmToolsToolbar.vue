<script setup lang="ts">
import { useGmTools } from "../composables/useGmTools.js";
import GmToolIcon from "./GmToolIcon.vue";

const { activeTool, setActiveTool } = useGmTools();
</script>

<template>
  <div class="gm-tools-toolbar chrome-tabs">
    <button
      type="button"
      class="chrome-tab"
      :class="{ active: activeTool === 'select' }"
      data-tooltip="Select"
      aria-label="Select"
      @click="setActiveTool('select')"
    >
      <GmToolIcon icon="select" class="chrome-tab-icon" />
    </button>
    <button
      type="button"
      class="chrome-tab"
      :class="{ active: activeTool === 'damageEffect' }"
      data-tooltip="Damage / Effect"
      aria-label="Damage / Effect"
      @click="setActiveTool('damageEffect')"
    >
      <GmToolIcon icon="damageEffect" class="chrome-tab-icon" />
    </button>
    <button
      type="button"
      class="chrome-tab"
      :class="{ active: activeTool === 'forceMove' }"
      data-tooltip="Force Move"
      aria-label="Force Move"
      @click="setActiveTool('forceMove')"
    >
      <GmToolIcon icon="forceMove" class="chrome-tab-icon" />
    </button>
    <button
      type="button"
      class="chrome-tab"
      :class="{ active: activeTool === 'paintbrush' }"
      data-tooltip="Paintbrush"
      aria-label="Paintbrush"
      @click="setActiveTool('paintbrush')"
    >
      <GmToolIcon icon="paintbrush" class="chrome-tab-icon" />
    </button>
  </div>
</template>

<style scoped>
.gm-tools-toolbar {
  padding: 0 0.75rem;
  border-bottom: 1px solid var(--color-border);
}
</style>
