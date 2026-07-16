<script setup lang="ts">
import { computed, nextTick, onUnmounted, watch } from "vue";

import { useGmTools } from "../composables/useGmTools.js";
import { useTileBrushGalleryUi } from "../composables/useTileBrushGalleryUi.js";
import TileBrushGallery from "./TileBrushGallery.vue";

const {
  bundledTileSets,
  bundledTileOverlaySets,
  bundledTileFeatureSets,
  bundledTileAppearancesForSet,
  bundledTileOverlaysForSet,
  bundledTileFeaturesForSet,
  paintbrushAppearanceKey,
  paintbrushOverlayKey,
  paintbrushFeatureKey,
  paintbrushAppearanceSetId,
  paintbrushOverlaySetId,
  paintbrushFeatureSetId,
  selectBundledPaintbrushAppearance,
  selectBundledPaintbrushOverlay,
  selectBundledPaintbrushFeature,
  clearPaintbrushAppearance,
  clearPaintbrushOverlay,
  clearPaintbrushFeature,
  activeTool,
} = useGmTools();

const {
  galleryOpen,
  appearanceGalleryOpen,
  overlayGalleryOpen,
  closeGalleries,
} = useTileBrushGalleryUi();

let backdropArmed = false;

const setOptions = computed(() => {
  if (appearanceGalleryOpen.value) return bundledTileSets;
  if (overlayGalleryOpen.value) return bundledTileOverlaySets;
  return bundledTileFeatureSets;
});

const activeSetId = computed({
  get: () => {
    if (appearanceGalleryOpen.value) return paintbrushAppearanceSetId.value;
    if (overlayGalleryOpen.value) return paintbrushOverlaySetId.value;
    return paintbrushFeatureSetId.value;
  },
  set: (id: string) => {
    if (appearanceGalleryOpen.value) paintbrushAppearanceSetId.value = id;
    else if (overlayGalleryOpen.value) paintbrushOverlaySetId.value = id;
    else paintbrushFeatureSetId.value = id;
  },
});

const activeSetLabel = computed(() => {
  const id = activeSetId.value;
  return setOptions.value.find((set) => set.id === id)?.label ?? id;
});

function stepSet(delta: number) {
  const sets = setOptions.value;
  if (sets.length === 0) return;
  const current = sets.findIndex((set) => set.id === activeSetId.value);
  const index = current < 0 ? 0 : (current + delta + sets.length) % sets.length;
  activeSetId.value = sets[index]!.id;
}

function onSelectAppearance(key: string) {
  selectBundledPaintbrushAppearance(key);
  closeGalleries();
}

function onSelectAppearanceNone() {
  clearPaintbrushAppearance();
  closeGalleries();
}

function onSelectOverlay(key: string) {
  selectBundledPaintbrushOverlay(key);
  closeGalleries();
}

function onSelectOverlayNone() {
  clearPaintbrushOverlay();
  closeGalleries();
}

function onSelectFeature(key: string) {
  selectBundledPaintbrushFeature(key);
  closeGalleries();
}

function onSelectFeatureNone() {
  clearPaintbrushFeature();
  closeGalleries();
}

function onBackdropClick() {
  if (!backdropArmed) return;
  closeGalleries();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Escape") return;
  if (!galleryOpen.value) return;
  e.preventDefault();
  e.stopPropagation();
  closeGalleries();
}

watch(galleryOpen, (open) => {
  backdropArmed = false;
  if (open) {
    document.addEventListener("keydown", onKeydown, true);
    void nextTick(() => {
      requestAnimationFrame(() => {
        backdropArmed = true;
      });
    });
  } else {
    document.removeEventListener("keydown", onKeydown, true);
  }
});

watch(activeTool, (tool) => {
  if (tool !== "paintbrush") closeGalleries();
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown, true);
});
</script>

<template>
  <template v-if="galleryOpen">
    <div class="gallery-backdrop" @click="onBackdropClick" />
    <div class="gallery-overlay" @click.stop>
      <div class="gallery-set-bar">
        <button
          type="button"
          class="set-step-btn"
          aria-label="Previous tile set"
          @click="stepSet(-1)"
        >
          ‹
        </button>
        <span class="set-title" :title="activeSetLabel">{{ activeSetLabel }}</span>
        <button
          type="button"
          class="set-step-btn"
          aria-label="Next tile set"
          @click="stepSet(1)"
        >
          ›
        </button>
      </div>
      <TileBrushGallery
        v-if="appearanceGalleryOpen"
        :entries="bundledTileAppearancesForSet"
        :selected-key="paintbrushAppearanceKey"
        ariaLabel="Choose tile base"
        @select="onSelectAppearance"
        @select-none="onSelectAppearanceNone"
      />
      <TileBrushGallery
        v-else-if="overlayGalleryOpen"
        :entries="bundledTileOverlaysForSet"
        :selected-key="paintbrushOverlayKey"
        ariaLabel="Choose tile overlay"
        @select="onSelectOverlay"
        @select-none="onSelectOverlayNone"
      />
      <TileBrushGallery
        v-else
        :entries="bundledTileFeaturesForSet"
        :selected-key="paintbrushFeatureKey"
        ariaLabel="Choose tile feature"
        @select="onSelectFeature"
        @select-none="onSelectFeatureNone"
      />
    </div>
  </template>
</template>

<style scoped>
.gallery-backdrop {
  position: fixed;
  inset: 0;
  z-index: 19;
}

.gallery-overlay {
  position: absolute;
  z-index: 20;
  top: 0.75rem;
  left: 0.5rem;
  right: 0.5rem;
  height: min(18rem, calc(100% - 1.5rem));
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: var(--shadow-menu);
  overflow: hidden;
}

.gallery-set-bar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  padding: 0.45rem 0.55rem;
  border-bottom: 1px solid var(--color-border);
}

.set-title {
  flex: 1;
  min-width: 0;
  text-align: center;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.set-step-btn {
  flex-shrink: 0;
  width: 1.6rem;
  height: 1.6rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-raised);
  color: var(--color-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.set-step-btn:hover {
  color: var(--color-text);
}
</style>
