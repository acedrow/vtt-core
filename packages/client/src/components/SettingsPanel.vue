<script setup lang="ts">
import { ref } from "vue";

import { usePlayerSettings } from "../composables/usePlayerSettings.js";
import { useSession } from "../composables/useSession.js";
import { useTheme } from "../composables/useTheme.js";
import ManagePlayersModal from "./ManagePlayersModal.vue";

const { showHealthBars, showConnectionsInConsole, showLineOfSightIndicator, showElevationContours } = usePlayerSettings();
const { theme, themes } = useTheme();
const { hasGmCapabilities } = useSession();

const managePlayersOpen = ref(false);
</script>

<template>
  <div class="settings-panel">
    <header class="panel-header">
      <h2 class="panel-heading">Settings</h2>
    </header>

    <div class="settings-list">
      <section class="settings-category">
        <h3 class="settings-section-heading">Map</h3>
        <label class="setting-row">
          <span class="setting-label">Show line of sight indicator</span>
          <button
            type="button"
            role="switch"
            class="toggle"
            :class="{ on: showLineOfSightIndicator }"
            :aria-checked="showLineOfSightIndicator"
            @click="showLineOfSightIndicator = !showLineOfSightIndicator"
          >
            <span class="toggle-thumb" />
          </button>
        </label>
        <label class="setting-row">
          <span class="setting-label">Show elevation contours</span>
          <button
            type="button"
            role="switch"
            class="toggle"
            :class="{ on: showElevationContours }"
            :aria-checked="showElevationContours"
            @click="showElevationContours = !showElevationContours"
          >
            <span class="toggle-thumb" />
          </button>
        </label>
      </section>

      <section class="settings-category">
        <h3 class="settings-section-heading">Tokens</h3>
        <label class="setting-row">
          <span class="setting-label">Show health bars</span>
          <button
            type="button"
            role="switch"
            class="toggle"
            :class="{ on: showHealthBars }"
            :aria-checked="showHealthBars"
            @click="showHealthBars = !showHealthBars"
          >
            <span class="toggle-thumb" />
          </button>
        </label>
      </section>

      <section class="settings-category">
        <h3 class="settings-section-heading">Console</h3>
        <label class="setting-row">
          <span class="setting-label">Show connections in console</span>
          <button
            type="button"
            role="switch"
            class="toggle"
            :class="{ on: showConnectionsInConsole }"
            :aria-checked="showConnectionsInConsole"
            @click="showConnectionsInConsole = !showConnectionsInConsole"
          >
            <span class="toggle-thumb" />
          </button>
        </label>
      </section>

      <h3 class="settings-section-heading">Themes</h3>

      <div class="theme-options" role="radiogroup" aria-label="Color theme">
        <button
          v-for="option in themes"
          :key="option.id"
          type="button"
          role="radio"
          class="theme-option"
          :class="{ active: theme === option.id }"
          :aria-checked="theme === option.id"
          @click="theme = option.id"
        >
          <span class="theme-swatch" aria-hidden="true">
            <span
              v-for="(color, index) in option.swatch"
              :key="index"
              class="theme-swatch-chip"
              :style="{ background: color }"
            />
          </span>
          <span class="theme-label">{{ option.label }}</span>
        </button>
      </div>

      <template v-if="hasGmCapabilities">
        <h3 class="settings-section-heading">Game master</h3>
        <button type="button" class="manage-players-btn" @click="managePlayersOpen = true">
          Manage players
        </button>
      </template>
    </div>

    <ManagePlayersModal :open="managePlayersOpen" @close="managePlayersOpen = false" />
  </div>
</template>

<style scoped>
.settings-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  flex-shrink: 0;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.panel-heading {
  margin: 0;
}

.settings-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
}

.settings-category {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings-section-heading {
  margin: 0.5rem 0 0;
  text-transform: uppercase;
  color: var(--color-muted);
}

.settings-category:first-child .settings-section-heading {
  margin-top: 0;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.setting-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.toggle {
  position: relative;
  flex-shrink: 0;
  width: 2.25rem;
  height: 1.25rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface-raised);
  padding: 0;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.toggle.on {
  background: var(--color-success-dark);
  border-color: var(--color-success-bright);
}

.toggle-thumb {
  position: absolute;
  top: 1px;
  left: 1px;
  width: calc(1.25rem - 4px);
  height: calc(1.25rem - 4px);
  border-radius: 50%;
  background: var(--color-text);
  transition: transform 0.15s;
}

.toggle.on .toggle-thumb {
  transform: translateX(1rem);
}

.theme-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0.55rem 0.65rem;
  cursor: pointer;
  text-align: left;
}

.theme-option:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}

.theme-option.active {
  border-color: var(--color-accent);
  background: var(--color-accent-tint-bg-faint);
}

.theme-swatch {
  display: flex;
  flex-shrink: 0;
  overflow: hidden;
  width: 2.75rem;
  height: 1.25rem;
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

.theme-swatch-chip {
  flex: 1;
}

.theme-label {
  font-size: 0.85rem;
  font-weight: 600;
}

.manage-players-btn {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0.55rem 0.65rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  text-align: left;
}

.manage-players-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}
</style>
