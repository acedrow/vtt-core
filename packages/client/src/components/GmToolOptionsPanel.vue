<script setup lang="ts">
import { UNIT_EFFECTS } from "@gaem/shared";
import { computed } from "vue";

import {
  useGmTools,
  type GmSelectTargetKind,
  clearActiveTool,
  GM_EFFECT_NONE,
} from "../composables/useGmTools.js";
import EffectIcon from "./EffectIcon.vue";
import GmPaintbrushControls from "./GmPaintbrushControls.vue";
import NumberStepper from "./NumberStepper.vue";
import PanelShell from "./PanelShell.vue";

const {
  activeTool,
  selectTargetKind,
  selectSameEnemyType,
  bulkSelection,
  bulkSelectionCount,
  damageAmount,
  effectId,
  effectStacks,
} = useGmTools();

const title = computed(() => {
  switch (activeTool.value) {
    case "select":
      return "Select";
    case "damageEffect":
      return "Damage & Effect";
    case "forceMove":
      return "Force Move";
    case "paintbrush":
      return "Paintbrush";
    default:
      return "Tool";
  }
});

const targetKinds: { id: GmSelectTargetKind; label: string }[] = [
  { id: "tiles", label: "Tiles" },
  { id: "enemies", label: "Enemies" },
  { id: "players", label: "Players" },
];

const bulkLabel = computed(() => {
  const count = bulkSelectionCount.value;
  if (!count || !bulkSelection.value) return "";
  const noun =
    bulkSelection.value.kind === "tiles"
      ? count === 1
        ? "tile"
        : "tiles"
      : bulkSelection.value.kind === "enemies"
        ? count === 1
          ? "enemy"
          : "enemies"
        : count === 1
          ? "player"
          : "players";
  return `${count} ${noun} selected`;
});
</script>

<template>
  <PanelShell :title="title" @close="clearActiveTool">
    <div v-if="activeTool === 'select'" class="tool-options">
      <div class="segmented">
        <button
          v-for="kind in targetKinds"
          :key="kind.id"
          type="button"
          class="segment-btn"
          :class="{ active: selectTargetKind === kind.id }"
          @click="selectTargetKind = kind.id"
        >
          {{ kind.label }}
        </button>
      </div>
      <label v-if="selectTargetKind === 'enemies'" class="control-group same-type-row">
        <input
          v-model="selectSameEnemyType"
          type="checkbox"
          class="option-enable"
          aria-label="Same type"
        />
        <span class="control-label same-type-label">Same type</span>
      </label>
      <p v-if="bulkLabel" class="bulk-count">{{ bulkLabel }}</p>
      <p v-else class="hint">
        {{
          selectTargetKind === "enemies" && selectSameEnemyType
            ? "Click or drag to select all of that type"
            : "Drag on the board to select"
        }}
      </p>
    </div>

    <div v-else-if="activeTool === 'damageEffect'" class="tool-options">
      <div class="control-group">
        <span class="control-label">Damage</span>
        <NumberStepper v-model="damageAmount" :min="0" :max="99" />
      </div>
      <div class="control-group effect-group">
        <span class="control-label">Effect</span>
        <select v-model="effectId" class="effect-select">
          <option :value="GM_EFFECT_NONE">None</option>
          <option v-for="effect in UNIT_EFFECTS" :key="effect.id" :value="effect.id">
            {{ effect.id }}
          </option>
        </select>
        <EffectIcon v-if="effectId" :effect-id="effectId" :size="16" />
      </div>
      <div class="control-group">
        <span class="control-label">Stacks</span>
        <NumberStepper v-model="effectStacks" :min="-99" :max="99" />
      </div>
      <p class="hint">Click players or enemies to apply</p>
    </div>

    <div v-else-if="activeTool === 'forceMove'" class="tool-options">
      <p class="hint">Click a unit, then click a destination tile</p>
    </div>

    <div v-else-if="activeTool === 'paintbrush'" class="tool-options">
      <GmPaintbrushControls />
    </div>
  </PanelShell>
</template>

<style scoped>
.tool-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0 0.15rem 0.5rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-muted);
}

.bulk-count {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-muted);
}

.segmented {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
}

.segment-btn {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-muted);
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.segment-btn + .segment-btn {
  border-left: 1px solid var(--color-border);
}

.segment-btn.active {
  background: var(--color-accent-subtle-bg);
  color: var(--color-accent-bright);
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.control-label {
  flex: 0 0 4.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.effect-group {
  gap: 0.35rem;
}

.effect-select {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.8rem;
  font-family: inherit;
  padding: 0.25rem 0.4rem;
}

.same-type-row {
  cursor: pointer;
  gap: 0.4rem;
}

.same-type-label {
  flex: 0 0 auto;
  text-transform: none;
  letter-spacing: normal;
  font-size: 0.8rem;
  color: var(--color-text);
}

.option-enable {
  margin: 0;
  accent-color: var(--color-accent);
}
</style>
