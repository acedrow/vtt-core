<script setup lang="ts">
import type { Enemy, GameMap, MapTile } from "@vtt-core/shared";
import { boardCellKey, tileAt } from "@vtt-core/shared";
import { computed, onUnmounted, ref, watch } from "vue";

import { useApi } from "../composables/useApi.js";
import { useBoardViewport } from "../composables/useBoardViewport.js";
import { previewMapName } from "../composables/useMapSelection.js";
import { useTileAppearanceCache } from "../composables/useTileAppearanceCache.js";
import { boardContentHeightPx, boardContentWidthPx } from "../lib/boardLayout.js";
import BoardCell, { type CellRenderState } from "./BoardCell.vue";

const props = defineProps<{ mapId: string }>();

const { fetchMap, enemyPortraitUrlForName } = useApi();

const map = ref<GameMap | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const viewportEl = ref<HTMLElement | null>(null);

const { tileAppearanceUrlFor } = useTileAppearanceCache(map);

async function loadMap(id: string) {
  loading.value = true;
  error.value = null;
  map.value = null;
  previewMapName.value = null;
  try {
    const result = await fetchMap(id);
    if (!result) throw new Error("Map not found");
    map.value = result;
    previewMapName.value = result.name ?? result.id;
  } catch {
    error.value = "Unable to load map preview";
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.mapId,
  (id) => {
    void loadMap(id);
  },
  { immediate: true },
);

onUnmounted(() => {
  previewMapName.value = null;
});

const boardWidth = computed(() => map.value?.width ?? 1);
const boardHeight = computed(() => map.value?.height ?? 1);
const boardWidthPx = computed(() => boardContentWidthPx(boardWidth.value));
const contentHeightPx = computed(() =>
  boardContentHeightPx(boardWidth.value, boardHeight.value),
);
const boardAspectRatio = computed(() => `${boardWidth.value} / ${boardHeight.value}`);
const boardKey = computed(() =>
  map.value ? `preview:${map.value.id}:${map.value.width}x${map.value.height}` : null,
);
const isReady = computed(() => !!map.value);

const { stageStyle, observeViewport, disconnect: disconnectViewport } = useBoardViewport(
  viewportEl,
  boardWidthPx,
  contentHeightPx,
  isReady,
  boardKey,
  ref(0),
  { interaction: "lockedFit" },
);

watch(viewportEl, (el, prev) => {
  observeViewport(el, prev);
});

onUnmounted(() => {
  disconnectViewport();
});

function terrainClass(tile: MapTile | undefined): string | null {
  if (!tile) return null;
  if (tile.terrain.includes("impassable")) return "impassable";
  if (tile.terrain.includes("obstacle")) return "obstacle";
  if (tile.terrain.includes("void")) return "void";
  return null;
}

function emptyCellFlags(): Omit<
  CellRenderState,
  | "terrainClass"
  | "tile"
  | "player"
  | "enemyAnchor"
  | "tileAppearanceUrl"
  | "tileOverlayUrl"
  | "tileFeatureUrl"
  | "tileBaseColor"
  | "appearanceTint"
  | "overlayTint"
  | "featureTint"
  | "appearanceRotation"
  | "appearanceFlip"
  | "overlayRotation"
  | "overlayFlip"
  | "featureRotation"
  | "featureFlip"
  | "tileEffects"
  | "enemyPortraitUrl"
  | "enemyPortraitBg"
> {
  return {
    movable: false,
    moveSecondary: false,
    moveAegis: false,
    deployable: false,
    deploymentZoneHighlight: false,
    allyThroughFog: false,
    gmMovable: false,
    gmSpawnable: false,
    patternPrimary: false,
    patternSecondary: false,
    combatTargetPrimary: false,
    combatTargetSecondary: false,
    combatTargetHeal: false,
    combatTargetInvalid: false,
    patternRecoil: false,
  };
}

const enemyByAnchorKey = computed(() => {
  const byKey = new Map<string, Enemy>();
  for (const enemy of map.value?.enemies ?? []) {
    byKey.set(boardCellKey(enemy.x, enemy.y), enemy);
  }
  return byKey;
});

const cells = computed(() => {
  const m = map.value;
  if (!m) return [] as { x: number; y: number; key: string; cell: CellRenderState }[];
  const out: { x: number; y: number; key: string; cell: CellRenderState }[] = [];
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      const key = boardCellKey(x, y);
      const tile = tileAt(m.tiles, x, y);
      const enemyAnchor = enemyByAnchorKey.value.get(key);
      out.push({
        x,
        y,
        key,
        cell: {
          ...emptyCellFlags(),
          terrainClass: terrainClass(tile),
          tile,
          player: undefined,
          enemyAnchor,
          tileEffects: tile?.tileEffects,
          tileAppearanceUrl: tileAppearanceUrlFor(tile?.appearanceKey),
          tileOverlayUrl: tileAppearanceUrlFor(tile?.overlayKey),
          tileFeatureUrl: tileAppearanceUrlFor(tile?.featureKey),
          tileBaseColor: tile?.baseColor ?? null,
          appearanceTint: tile?.appearanceTint ?? null,
          overlayTint: tile?.overlayTint ?? null,
          featureTint: tile?.featureTint ?? null,
          appearanceRotation: tile?.appearanceRotation,
          appearanceFlip: tile?.appearanceFlip,
          overlayRotation: tile?.overlayRotation,
          overlayFlip: tile?.overlayFlip,
          featureRotation: tile?.featureRotation,
          featureFlip: tile?.featureFlip,
          enemyPortraitUrl:
            enemyAnchor && enemyAnchor.kind !== "tower"
              ? enemyPortraitUrlForName(enemyAnchor.name)
              : null,
          enemyPortraitBg: null,
        },
      });
    }
  }
  return out;
});

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${boardWidth.value}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${boardHeight.value}, minmax(0, 1fr))`,
  width: `${boardWidthPx.value}px`,
}));
</script>

<template>
  <div class="map-preview-board">
    <div v-if="map" class="board-display">
      <div ref="viewportEl" class="board-viewport">
        <div class="board-stage" :style="stageStyle">
          <div class="board" :style="gridStyle">
            <BoardCell
              v-for="row in cells"
              :key="row.key"
              :x="row.x"
              :y="row.y"
              :cell="row.cell"
              :is-hovered="false"
              :dragging-deploy="false"
              :player-hue="null"
              :can-drag-deploy="false"
              :is-player-selected="false"
              :is-enemy-selected="false"
              :show-health-bars="false"
              :show-enemy-health-bars="false"
              :show-token-backgrounds="true"
            />
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="loading" class="board-loading" role="status" aria-live="polite">
      <span class="board-loading-spinner" aria-hidden="true" />
      <p class="board-loading-message">Loading map preview…</p>
    </div>
    <p v-else class="board-error">{{ error ?? "Unable to load map preview" }}</p>
  </div>
</template>

<style scoped>
.map-preview-board {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.board-display {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.board-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.board-stage {
  transform-origin: 0 0;
  will-change: transform;
}

.board {
  --board-cell-gap: 3px;
  position: relative;
  width: fit-content;
  display: grid;
  gap: var(--board-cell-gap);
  aspect-ratio: v-bind(boardAspectRatio);
}

.board-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: var(--color-text-muted);
}

.board-loading-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: preview-spin 0.8s linear infinite;
}

.board-loading-message,
.board-error {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.board-error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes preview-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
