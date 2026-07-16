<script setup lang="ts">
import { TERRAIN_TYPES, TILE_EFFECTS, terrainTypeDisplayName } from "@gaem/shared";
import { ref } from "vue";

import {
  useGmTools,
  GM_TILE_EFFECT_NONE,
} from "../composables/useGmTools.js";
import { useTileBrushGalleryUi } from "../composables/useTileBrushGalleryUi.js";
import EffectIcon from "./EffectIcon.vue";
import NumberStepper from "./NumberStepper.vue";
import TerrainTypeIcon from "./TerrainTypeIcon.vue";
import TileBaseColorModal from "./TileBaseColorModal.vue";
import TileColorTintModal from "./TileColorTintModal.vue";

const {
  paintbrushElevation,
  paintbrushTerrain,
  paintbrushEffectId,
  paintbrushEffectStacks,
  paintbrushTileName,
  paintbrushObstacleHp,
  paintbrushBaseColor,
  paintbrushAppearanceTint,
  paintbrushOverlayTint,
  paintbrushFeatureTint,
  paintbrushAppearancePreviewUrl,
  paintbrushEnableElevation,
  paintbrushEnableTerrain,
  paintbrushEnableEffect,
  paintbrushEnableName,
  paintbrushEnableColor,
  paintbrushEnableAppearance,
  paintbrushEnableOverlay,
  paintbrushEnableFeature,
  paintbrushEnableAppearanceTint,
  paintbrushEnableOverlayTint,
  paintbrushEnableFeatureTint,
  paintbrushEnableRotation,
  paintbrushEnableFlip,
  paintbrushImageRotation,
  paintbrushImageFlip,
  paintbrushAutoRotate,
  paintbrushPresetLoadId,
  paintbrushPresetNames,
  paintbrushPresetError,
  paintbrushOverlayPreviewUrl,
  paintbrushFeaturePreviewUrl,
  resetPaintbrushSettings,
  enableAllPaintbrushOptions,
  disableAllPaintbrushOptions,
  loadSelectedPreset,
  saveCurrentPreset,
  deleteSelectedPreset,
  clearPaintbrushAppearance,
  clearPaintbrushOverlay,
  clearPaintbrushFeature,
  bundledTileSets,
  bundledTileAppearancesForSet,
  bundledTileOverlaySets,
  bundledTileOverlaysForSet,
  bundledTileFeatureSets,
  bundledTileFeaturesForSet,
  paintbrushAppearanceSetId,
  paintbrushOverlaySetId,
  paintbrushFeatureSetId,
} = useGmTools();

const {
  appearanceGalleryOpen,
  overlayGalleryOpen,
  featureGalleryOpen,
  openAppearanceGallery,
  openOverlayGallery,
  openFeatureGallery,
  toggleAppearanceGallery,
  toggleOverlayGallery,
  toggleFeatureGallery,
} = useTileBrushGalleryUi();

const colorModalOpen = ref(false);
const appearanceTintModalOpen = ref(false);
const overlayTintModalOpen = ref(false);
const featureTintModalOpen = ref(false);
</script>

<template>
  <div class="paintbrush-controls">
    <div class="action-row">
      <button type="button" class="mini-btn" @click="enableAllPaintbrushOptions">Enable all</button>
      <button type="button" class="mini-btn" @click="disableAllPaintbrushOptions">Disable all</button>
      <button type="button" class="reset-btn" @click="resetPaintbrushSettings">Reset</button>
    </div>

    <div class="control-group">
      <span class="control-label">Name</span>
      <input
        v-model="paintbrushEnableName"
        type="checkbox"
        class="option-enable"
        aria-label="Enable name"
      />
      <input
        v-model="paintbrushTileName"
        type="text"
        class="text-input"
        placeholder="Optional"
        @input="paintbrushEnableName = true"
      />
    </div>

    <div class="control-group effect-group">
      <span class="control-label">Terrain</span>
      <input
        v-model="paintbrushEnableTerrain"
        type="checkbox"
        class="option-enable"
        aria-label="Enable terrain"
      />
      <select
        v-model="paintbrushTerrain"
        class="effect-select"
        @change="paintbrushEnableTerrain = true"
      >
        <option v-for="terrain in TERRAIN_TYPES" :key="terrain" :value="terrain">
          {{ terrainTypeDisplayName(terrain) }}
        </option>
      </select>
      <TerrainTypeIcon :terrain-type="paintbrushTerrain" :size="16" />
      <template v-if="paintbrushTerrain === 'obstacle'">
        <span class="inline-label">HP</span>
        <NumberStepper
          :model-value="paintbrushObstacleHp"
          compact
          :min="1"
          :max="99"
          @update:model-value="
            (v) => {
              paintbrushObstacleHp = v;
              paintbrushEnableTerrain = true;
            }
          "
        />
      </template>
    </div>
    <div class="control-group effect-group">
      <span class="control-label">Effect</span>
      <input
        v-model="paintbrushEnableEffect"
        type="checkbox"
        class="option-enable"
        aria-label="Enable effect"
      />
      <select
        v-model="paintbrushEffectId"
        class="effect-select"
        @change="paintbrushEnableEffect = true"
      >
        <option :value="GM_TILE_EFFECT_NONE">None</option>
        <option v-for="effect in TILE_EFFECTS" :key="effect.id" :value="effect.id">
          {{ effect.id }}
        </option>
      </select>
      <EffectIcon v-if="paintbrushEffectId" :effect-id="paintbrushEffectId" :size="16" />
    </div>
    <div v-if="paintbrushEffectId" class="control-group">
      <span class="control-label">Stacks</span>
      <span class="option-enable-spacer" aria-hidden="true" />
      <NumberStepper
        :model-value="paintbrushEffectStacks"
        compact
        :min="-99"
        :max="99"
        @update:model-value="
          (v) => {
            paintbrushEffectStacks = v;
            paintbrushEnableEffect = true;
          }
        "
      />
    </div>

    <div class="control-group">
      <span class="control-label">Elevation</span>
      <input
        v-model="paintbrushEnableElevation"
        type="checkbox"
        class="option-enable"
        aria-label="Enable elevation"
      />
      <NumberStepper
        :model-value="paintbrushElevation"
        compact
        :min="-3"
        :max="3"
        @update:model-value="
          (v) => {
            paintbrushElevation = v;
            paintbrushEnableElevation = true;
          }
        "
      />
    </div>

    <div class="control-group">
      <span class="control-label">Color</span>
      <input
        v-model="paintbrushEnableColor"
        type="checkbox"
        class="option-enable"
        aria-label="Enable color"
      />
      <button
        type="button"
        class="color-swatch-btn"
        :style="paintbrushBaseColor ? { background: paintbrushBaseColor } : undefined"
        @click="
          paintbrushEnableColor = true;
          colorModalOpen = true;
        "
      >
        <span v-if="!paintbrushBaseColor" class="color-swatch-placeholder">—</span>
      </button>
    </div>

    <p class="section-header">Tile appearance</p>

    <div class="control-group appearance-group">
      <span class="control-label">Base</span>
      <input
        v-model="paintbrushEnableAppearance"
        type="checkbox"
        class="option-enable"
        aria-label="Enable base"
      />
      <div class="appearance-row">
        <div class="appearance-row-main">
          <select
            v-if="bundledTileSets.length"
            v-model="paintbrushAppearanceSetId"
            class="effect-select set-select"
            aria-label="Tile set"
            @change="openAppearanceGallery"
          >
            <option v-for="set in bundledTileSets" :key="set.id" :value="set.id">
              {{ set.label }}
            </option>
          </select>
          <button
            v-if="bundledTileAppearancesForSet.length"
            type="button"
            class="appearance-thumb-btn"
            :aria-expanded="appearanceGalleryOpen"
            aria-haspopup="listbox"
            aria-label="Choose tile base"
            @click="toggleAppearanceGallery"
          >
            <img
              v-if="paintbrushAppearancePreviewUrl"
              :src="paintbrushAppearancePreviewUrl"
              alt=""
              class="appearance-thumb tile-image"
            />
            <span v-else class="appearance-thumb-placeholder">—</span>
          </button>
          <img
            v-else-if="paintbrushAppearancePreviewUrl"
            :src="paintbrushAppearancePreviewUrl"
            alt=""
            class="appearance-thumb tile-image"
          />
          <button type="button" class="mini-btn" @click="clearPaintbrushAppearance">Clear</button>
        </div>
        <div class="appearance-tint-row">
          <span class="inline-label">Tint</span>
          <input
            v-model="paintbrushEnableAppearanceTint"
            type="checkbox"
            class="option-enable"
            aria-label="Enable base tint"
          />
          <button
            type="button"
            class="color-swatch-btn"
            :style="paintbrushAppearanceTint ? { background: paintbrushAppearanceTint.color } : undefined"
            aria-label="Base tint"
            @click="
              paintbrushEnableAppearanceTint = true;
              appearanceTintModalOpen = true;
            "
          >
            <span v-if="!paintbrushAppearanceTint" class="color-swatch-placeholder">—</span>
          </button>
        </div>
      </div>
    </div>

    <div class="control-group appearance-group">
      <span class="control-label">Overlay</span>
      <input
        v-model="paintbrushEnableOverlay"
        type="checkbox"
        class="option-enable"
        aria-label="Enable overlay"
      />
      <div class="appearance-row">
        <div class="appearance-row-main">
          <select
            v-if="bundledTileOverlaySets.length"
            v-model="paintbrushOverlaySetId"
            class="effect-select set-select"
            aria-label="Overlay set"
            @change="openOverlayGallery"
          >
            <option v-for="set in bundledTileOverlaySets" :key="set.id" :value="set.id">
              {{ set.label }}
            </option>
          </select>
          <button
            v-if="bundledTileOverlaysForSet.length"
            type="button"
            class="appearance-thumb-btn"
            :aria-expanded="overlayGalleryOpen"
            aria-haspopup="listbox"
            aria-label="Choose tile overlay"
            @click="toggleOverlayGallery"
          >
            <img
              v-if="paintbrushOverlayPreviewUrl"
              :src="paintbrushOverlayPreviewUrl"
              alt=""
              class="appearance-thumb tile-image"
            />
            <span v-else class="appearance-thumb-placeholder">—</span>
          </button>
          <img
            v-else-if="paintbrushOverlayPreviewUrl"
            :src="paintbrushOverlayPreviewUrl"
            alt=""
            class="appearance-thumb tile-image"
          />
          <button type="button" class="mini-btn" @click="clearPaintbrushOverlay">Clear</button>
        </div>
        <div class="appearance-tint-row">
          <span class="inline-label">Tint</span>
          <input
            v-model="paintbrushEnableOverlayTint"
            type="checkbox"
            class="option-enable"
            aria-label="Enable overlay tint"
          />
          <button
            type="button"
            class="color-swatch-btn"
            :style="paintbrushOverlayTint ? { background: paintbrushOverlayTint.color } : undefined"
            aria-label="Overlay tint"
            @click="
              paintbrushEnableOverlayTint = true;
              overlayTintModalOpen = true;
            "
          >
            <span v-if="!paintbrushOverlayTint" class="color-swatch-placeholder">—</span>
          </button>
        </div>
      </div>
    </div>

    <div class="control-group appearance-group">
      <span class="control-label">Feature</span>
      <input
        v-model="paintbrushEnableFeature"
        type="checkbox"
        class="option-enable"
        aria-label="Enable feature"
      />
      <div class="appearance-row">
        <div class="appearance-row-main">
          <select
            v-if="bundledTileFeatureSets.length"
            v-model="paintbrushFeatureSetId"
            class="effect-select set-select"
            aria-label="Feature set"
            @change="openFeatureGallery"
          >
            <option v-for="set in bundledTileFeatureSets" :key="set.id" :value="set.id">
              {{ set.label }}
            </option>
          </select>
          <button
            v-if="bundledTileFeaturesForSet.length"
            type="button"
            class="appearance-thumb-btn"
            :aria-expanded="featureGalleryOpen"
            aria-haspopup="listbox"
            aria-label="Choose tile feature"
            @click="toggleFeatureGallery"
          >
            <img
              v-if="paintbrushFeaturePreviewUrl"
              :src="paintbrushFeaturePreviewUrl"
              alt=""
              class="appearance-thumb tile-image"
            />
            <span v-else class="appearance-thumb-placeholder">—</span>
          </button>
          <img
            v-else-if="paintbrushFeaturePreviewUrl"
            :src="paintbrushFeaturePreviewUrl"
            alt=""
            class="appearance-thumb tile-image"
          />
          <button type="button" class="mini-btn" @click="clearPaintbrushFeature">Clear</button>
        </div>
        <div class="appearance-tint-row">
          <span class="inline-label">Tint</span>
          <input
            v-model="paintbrushEnableFeatureTint"
            type="checkbox"
            class="option-enable"
            aria-label="Enable feature tint"
          />
          <button
            type="button"
            class="color-swatch-btn"
            :style="paintbrushFeatureTint ? { background: paintbrushFeatureTint.color } : undefined"
            aria-label="Feature tint"
            @click="
              paintbrushEnableFeatureTint = true;
              featureTintModalOpen = true;
            "
          >
            <span v-if="!paintbrushFeatureTint" class="color-swatch-placeholder">—</span>
          </button>
        </div>
      </div>
    </div>

    <div class="control-group">
      <span class="control-label">Rotate</span>
      <input
        v-model="paintbrushEnableRotation"
        type="checkbox"
        class="option-enable"
        aria-label="Enable rotation"
      />
      <label class="auto-rotate">
        <input
          v-model="paintbrushAutoRotate"
          type="checkbox"
          aria-label="Auto rotate"
          @change="paintbrushEnableRotation = true"
        />
        Auto
      </label>
      <span class="transform-value">
        {{ paintbrushAutoRotate ? "Random" : `${paintbrushImageRotation}°` }}
      </span>
      <span class="transform-hint">R</span>
    </div>
    <div class="control-group">
      <span class="control-label">Flip</span>
      <input
        v-model="paintbrushEnableFlip"
        type="checkbox"
        class="option-enable"
        aria-label="Enable flip"
      />
      <span class="transform-value">{{ paintbrushImageFlip ? "On" : "Off" }}</span>
      <span class="transform-hint">F</span>
    </div>

    <div class="control-group preset-group">
      <span class="control-label">Preset</span>
      <div class="preset-controls">
        <select v-model="paintbrushPresetLoadId" class="effect-select">
          <option value="">Load…</option>
          <option v-for="name in paintbrushPresetNames" :key="name" :value="name">
            {{ name }}
          </option>
        </select>
        <div class="preset-actions">
          <button type="button" class="mini-btn" :disabled="!paintbrushPresetLoadId" @click="loadSelectedPreset">
            Load
          </button>
          <button type="button" class="mini-btn" @click="saveCurrentPreset">Save</button>
          <button
            type="button"
            class="mini-btn"
            :disabled="!paintbrushPresetLoadId"
            @click="deleteSelectedPreset"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <p v-if="paintbrushPresetError" class="preset-error">{{ paintbrushPresetError }}</p>

    <p class="eyedropper-hint">Hold E to sample · Hold S to select · R rotate · F flip</p>

    <TileBaseColorModal v-model="paintbrushBaseColor" :open="colorModalOpen" @close="colorModalOpen = false" />
    <TileColorTintModal
      v-model="paintbrushAppearanceTint"
      title="Base tint"
      :open="appearanceTintModalOpen"
      :preview-url="paintbrushAppearancePreviewUrl"
      @close="appearanceTintModalOpen = false"
    />
    <TileColorTintModal
      v-model="paintbrushOverlayTint"
      title="Overlay tint"
      :open="overlayTintModalOpen"
      :preview-url="paintbrushOverlayPreviewUrl"
      @close="overlayTintModalOpen = false"
    />
    <TileColorTintModal
      v-model="paintbrushFeatureTint"
      title="Feature tint"
      :open="featureTintModalOpen"
      :preview-url="paintbrushFeaturePreviewUrl"
      @close="featureTintModalOpen = false"
    />
  </div>
</template>

<style scoped>
.paintbrush-controls {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.control-label {
  flex: 0 0 5.75rem;
  width: 5.75rem;
  min-width: 5.75rem;
  font-size: 0.72rem;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-header {
  margin: 0.15rem 0 0;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: center;
}

.option-enable {
  flex-shrink: 0;
  margin: 0;
  cursor: pointer;
}

.option-enable-spacer {
  width: 1rem;
  flex-shrink: 0;
}

.effect-group {
  gap: 0.45rem;
}

.inline-label {
  flex-shrink: 0;
  font-size: 0.72rem;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.effect-select,
.text-input {
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

.set-select {
  flex: 1 1 6rem;
  min-width: 5rem;
}

.color-swatch-btn {
  width: 1.6rem;
  height: 1.6rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-raised);
  cursor: pointer;
  padding: 0;
}

.color-swatch-placeholder {
  font-size: 0.75rem;
  color: var(--color-muted);
}

.appearance-group {
  align-items: flex-start;
}

.appearance-group > .control-label,
.appearance-group > .option-enable {
  margin-top: 0.35rem;
}

.appearance-row {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.appearance-row-main,
.appearance-tint-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: nowrap;
  min-width: 0;
}

.appearance-row-main .set-select {
  flex: 1;
  min-width: 0;
}

.appearance-thumb {
  width: 1.6rem;
  height: 1.6rem;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  display: block;
  flex-shrink: 0;
}

.appearance-thumb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface-raised);
  cursor: pointer;
  flex-shrink: 0;
}

.appearance-thumb-btn:hover,
.appearance-thumb-btn[aria-expanded="true"] {
  border-color: var(--color-text-muted);
}

.appearance-thumb-btn .appearance-thumb {
  border: none;
  border-radius: 3px;
}

.appearance-thumb-placeholder {
  font-size: 0.75rem;
  color: var(--color-muted);
  line-height: 1;
}

.preset-controls {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.preset-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid var(--color-border);
}

.mini-btn,
.reset-btn {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-muted);
  font-size: 0.78rem;
  font-weight: 600;
  font-family: inherit;
  padding: 0.2rem 0.45rem;
  cursor: pointer;
  flex-shrink: 0;
}

.mini-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mini-btn:hover:not(:disabled),
.reset-btn:hover {
  color: var(--color-text);
  background: var(--color-surface-raised);
}

.preset-error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-danger);
}

.eyedropper-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.transform-value {
  font-size: 0.8rem;
  color: var(--color-text);
  min-width: 2.5rem;
}

.auto-rotate {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  user-select: none;
}

.auto-rotate input {
  margin: 0;
}

.auto-rotate:has(input:disabled) {
  opacity: 0.5;
  cursor: default;
}

.transform-hint {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
