import {
  DEFAULT_OBSTACLE_HP,
  coordKey,
  getObstacleHp,
  tileAt,
  TILE_IMAGE_ROTATIONS,
  type MapTile,
  type TerrainType,
  type TileColorTint,
  type TileImageRotation,
  type TilePaintPreset,
} from "@vtt-core/shared";
import { computed, ref, watch } from "vue";

import {
  BUNDLED_TILE_SETS,
  bundledTileAppearanceUrl,
  galleryEntriesForSet,
  isAppearanceGroupKey,
  isBundledTileAppearanceKey,
  resolveAppearanceKeyForPaint,
  setIdFromAppearanceKey,
} from "../lib/bundledTileAppearances.js";
import {
  BUNDLED_TILE_FEATURE_SETS,
  bundledTileFeatureUrl,
  galleryEntriesForFeatureSet,
  isBundledTileFeatureKey,
  isFeatureGroupKey,
  resolveFeatureKeyForPaint,
  setIdFromFeatureKey,
} from "../lib/bundledTileFeatures.js";
import {
  BUNDLED_TILE_OVERLAY_SETS,
  bundledTileOverlayUrl,
  galleryEntriesForOverlaySet,
  isBundledTileOverlayKey,
  isOverlayGroupKey,
  resolveOverlayKeyForPaint,
  setIdFromOverlayKey,
} from "../lib/bundledTileOverlays.js";
import { useApi } from "./useApi.js";
import { useBoardActionMode } from "./useBoardActionMode.js";
import { useEnemySpawnSelection } from "./useEnemySpawnSelection.js";
import { activeTab } from "./useGameConsole.js";
import { useGameState } from "./useGameState.js";
import { activeMainTab } from "./useMainSectionTab.js";
import { readPersistedUi, type PersistedGmTools } from "./uiPersist.js";

export type GmTool = "select" | "damageEffect" | "forceMove" | "paintbrush";
export type GmSelectTargetKind = "tiles" | "enemies" | "players";

export type GmBulkSelection =
  | { kind: "tiles"; coords: { x: number; y: number }[] }
  | { kind: "players"; ids: string[] }
  | { kind: "enemies"; ids: string[] };

export const GM_EFFECT_NONE = "";
export const GM_TILE_EFFECT_NONE = "";

const persistedGm = readPersistedUi().gmTools;

const activeTool = ref<GmTool | null>(persistedGm.activeTool);
const selectTargetKind = ref<GmSelectTargetKind>(persistedGm.selectTargetKind);
const selectSameEnemyType = ref(persistedGm.selectSameEnemyType);
const bulkSelection = ref<GmBulkSelection | null>(null);
const damageAmount = ref(persistedGm.damageAmount);
const effectId = ref(persistedGm.effectId);
const effectStacks = ref(persistedGm.effectStacks);
const paintbrushElevation = ref(persistedGm.paintbrushElevation);
const paintbrushTerrain = ref<TerrainType>(persistedGm.paintbrushTerrain);
const paintbrushEffectId = ref(persistedGm.paintbrushEffectId);
const paintbrushEffectStacks = ref(persistedGm.paintbrushEffectStacks);
const paintbrushTileName = ref(persistedGm.paintbrushTileName);
const paintbrushObstacleHp = ref(persistedGm.paintbrushObstacleHp);
const paintbrushBaseColor = ref<string | null>(persistedGm.paintbrushBaseColor);
const paintbrushAppearanceTint = ref<TileColorTint | null>(persistedGm.paintbrushAppearanceTint);
const paintbrushOverlayTint = ref<TileColorTint | null>(persistedGm.paintbrushOverlayTint);
const paintbrushFeatureTint = ref<TileColorTint | null>(persistedGm.paintbrushFeatureTint);
const paintbrushAppearanceKey = ref<string | null | undefined>(persistedGm.paintbrushAppearanceKey);
const paintbrushAppearancePreviewUrl = ref<string | null>(null);
const paintbrushAppearanceSetId = ref(persistedGm.paintbrushAppearanceSetId);
const paintbrushOverlayKey = ref<string | null | undefined>(persistedGm.paintbrushOverlayKey);
const paintbrushOverlayPreviewUrl = ref<string | null>(null);
const paintbrushOverlaySetId = ref(persistedGm.paintbrushOverlaySetId);
const paintbrushFeatureKey = ref<string | null | undefined>(persistedGm.paintbrushFeatureKey);
const paintbrushFeaturePreviewUrl = ref<string | null>(null);
const paintbrushFeatureSetId = ref(persistedGm.paintbrushFeatureSetId);
const paintbrushEnableElevation = ref(persistedGm.paintbrushEnableElevation);
const paintbrushEnableTerrain = ref(persistedGm.paintbrushEnableTerrain);
const paintbrushEnableEffect = ref(persistedGm.paintbrushEnableEffect);
const paintbrushEnableName = ref(persistedGm.paintbrushEnableName);
const paintbrushEnableColor = ref(persistedGm.paintbrushEnableColor);
const paintbrushEnableAppearance = ref(persistedGm.paintbrushEnableAppearance);
const paintbrushEnableOverlay = ref(persistedGm.paintbrushEnableOverlay);
const paintbrushEnableFeature = ref(persistedGm.paintbrushEnableFeature);
const paintbrushEnableAppearanceTint = ref(persistedGm.paintbrushEnableAppearanceTint);
const paintbrushEnableOverlayTint = ref(persistedGm.paintbrushEnableOverlayTint);
const paintbrushEnableFeatureTint = ref(persistedGm.paintbrushEnableFeatureTint);
const paintbrushImageRotation = ref<TileImageRotation>(persistedGm.paintbrushImageRotation);
const paintbrushImageFlip = ref(persistedGm.paintbrushImageFlip);
const paintbrushEnableRotation = ref(persistedGm.paintbrushEnableRotation);
const paintbrushEnableFlip = ref(persistedGm.paintbrushEnableFlip);
const paintbrushAutoRotate = ref(persistedGm.paintbrushAutoRotate);
const paintbrushPresets = ref<Record<string, TilePaintPreset>>({});
const paintbrushPresetLoadId = ref("");
const paintbrushPresetError = ref("");
const paintbrushEyedropperActive = ref(false);
const paintbrushSelectHeld = ref(false);
const paintbrushSuppressPreviewKey = ref<string | null>(null);

export type PaintbrushStickyPreview = {
  baseColor: string | null;
  appearanceUrl: string | null;
  overlayUrl: string | null;
  featureUrl: string | null;
  appearanceTint: TileColorTint | null;
  overlayTint: TileColorTint | null;
  featureTint: TileColorTint | null;
  appearanceRotation: TileImageRotation;
  appearanceFlip: boolean;
  overlayRotation: TileImageRotation;
  overlayFlip: boolean;
  featureRotation: TileImageRotation;
  featureFlip: boolean;
};

type PaintbrushDragPaintFields = {
  elevation?: number;
  terrain?: TerrainType;
  tileEffects?: string[];
  tileName?: string;
  obstacleHp?: number;
  baseColor?: string | null;
  appearanceKey?: string | null;
  overlayKey?: string | null;
  featureKey?: string | null;
  appearanceTint?: TileColorTint | null;
  overlayTint?: TileColorTint | null;
  featureTint?: TileColorTint | null;
  appearanceRotation?: TileImageRotation | null;
  appearanceFlip?: boolean | null;
  overlayRotation?: TileImageRotation | null;
  overlayFlip?: boolean | null;
  featureRotation?: TileImageRotation | null;
  featureFlip?: boolean | null;
};

type PendingDragPaint = {
  coord: { x: number; y: number };
  fieldsKey: string;
  fields: PaintbrushDragPaintFields;
};

const DRAG_FLUSH_IDLE_MS = 120;
const DRAG_FLUSH_MAX_SIZE = 32;

type StickyDragEntry = {
  preview: PaintbrushStickyPreview;
  fields: PaintbrushDragPaintFields;
};

const paintbrushDragStickyPreviews = ref<Record<string, StickyDragEntry>>({});
let pendingDragPaints: PendingDragPaint[] = [];
let dragFlushTimer: ReturnType<typeof setTimeout> | null = null;

function tileKeyFieldMatches(
  tileValue: string | undefined,
  field: string | null | undefined,
): boolean {
  if (field === undefined) return true;
  if (field == null || !field.trim()) return !tileValue;
  return tileValue === field.trim();
}

function tileTintMatches(
  tileValue: TileColorTint | undefined,
  field: TileColorTint | null | undefined,
): boolean {
  if (field === undefined) return true;
  if (field == null) return !tileValue;
  return (
    !!tileValue && tileValue.color === field.color && tileValue.opacity === field.opacity
  );
}

function tileRotationMatches(
  tileValue: TileImageRotation | undefined,
  field: TileImageRotation | null | undefined,
): boolean {
  if (field === undefined) return true;
  if (field == null || field === 0) return tileValue == null || tileValue === 0;
  return tileValue === field;
}

function tileFlipMatches(tileValue: boolean | undefined, field: boolean | null | undefined): boolean {
  if (field === undefined) return true;
  if (field) return !!tileValue;
  return !tileValue;
}

function tileMatchesDragPaint(tile: MapTile, fields: PaintbrushDragPaintFields): boolean {
  if (fields.elevation !== undefined && tile.elevation !== fields.elevation) return false;
  if (fields.terrain !== undefined && tile.terrain[0] !== fields.terrain) return false;
  if (fields.obstacleHp !== undefined && getObstacleHp(tile) !== fields.obstacleHp) return false;
  if (fields.tileName !== undefined) {
    const expected = fields.tileName.trim();
    if (expected) {
      if (tile.name !== expected) return false;
    } else if (tile.name) {
      return false;
    }
  }
  if (fields.tileEffects !== undefined) {
    const live = Object.entries(tile.tileEffects ?? {})
      .filter(([, stacks]) => stacks !== 0)
      .map(([id, stacks]) => `${id}:${stacks}`)
      .sort()
      .join("|");
    const expected = fields.tileEffects.slice().sort().join("|");
    if (live !== expected) return false;
  }
  if (fields.baseColor !== undefined) {
    if (fields.baseColor) {
      if (tile.baseColor !== fields.baseColor) return false;
    } else if (tile.baseColor) {
      return false;
    }
  }
  if (!tileKeyFieldMatches(tile.appearanceKey, fields.appearanceKey)) return false;
  if (!tileKeyFieldMatches(tile.overlayKey, fields.overlayKey)) return false;
  if (!tileKeyFieldMatches(tile.featureKey, fields.featureKey)) return false;
  if (!tileTintMatches(tile.appearanceTint, fields.appearanceTint)) return false;
  if (!tileTintMatches(tile.overlayTint, fields.overlayTint)) return false;
  if (!tileTintMatches(tile.featureTint, fields.featureTint)) return false;
  if (!tileRotationMatches(tile.appearanceRotation, fields.appearanceRotation)) return false;
  if (!tileRotationMatches(tile.overlayRotation, fields.overlayRotation)) return false;
  if (!tileRotationMatches(tile.featureRotation, fields.featureRotation)) return false;
  if (!tileFlipMatches(tile.appearanceFlip, fields.appearanceFlip)) return false;
  if (!tileFlipMatches(tile.overlayFlip, fields.overlayFlip)) return false;
  if (!tileFlipMatches(tile.featureFlip, fields.featureFlip)) return false;
  return true;
}

const effectiveActiveTool = computed(() =>
  activeTool.value === "paintbrush" && paintbrushSelectHeld.value
    ? "select"
    : activeTool.value,
);

type PendingTilePlacement = {
  brushAppearance: string | null | undefined;
  brushOverlay: string | null | undefined;
  brushFeature: string | null | undefined;
  appearanceKey: string | null | undefined;
  overlayKey: string | null | undefined;
  featureKey: string | null | undefined;
  imageRotation: TileImageRotation | undefined;
};

const pendingTilePlacements = new Map<string, PendingTilePlacement>();

function clearPendingTilePlacements() {
  pendingTilePlacements.clear();
}

function clearPaintbrushSuppressPreview() {
  paintbrushSuppressPreviewKey.value = null;
}

function clearPaintbrushDragStickyPreviews() {
  if (Object.keys(paintbrushDragStickyPreviews.value).length === 0) return;
  paintbrushDragStickyPreviews.value = {};
}

function clearDragFlushTimer() {
  if (dragFlushTimer != null) {
    clearTimeout(dragFlushTimer);
    dragFlushTimer = null;
  }
}

export function snapshotGmTools(): PersistedGmTools {
  return {
    activeTool: activeTool.value,
    selectTargetKind: selectTargetKind.value,
    selectSameEnemyType: selectSameEnemyType.value,
    damageAmount: damageAmount.value,
    effectId: effectId.value,
    effectStacks: effectStacks.value,
    paintbrushElevation: paintbrushElevation.value,
    paintbrushTerrain: paintbrushTerrain.value,
    paintbrushEffectId: paintbrushEffectId.value,
    paintbrushEffectStacks: paintbrushEffectStacks.value,
    paintbrushTileName: paintbrushTileName.value,
    paintbrushObstacleHp: paintbrushObstacleHp.value,
    paintbrushBaseColor: paintbrushBaseColor.value,
    paintbrushAppearanceTint: paintbrushAppearanceTint.value,
    paintbrushOverlayTint: paintbrushOverlayTint.value,
    paintbrushFeatureTint: paintbrushFeatureTint.value,
    paintbrushAppearanceKey: paintbrushAppearanceKey.value,
    paintbrushAppearanceSetId: paintbrushAppearanceSetId.value,
    paintbrushOverlayKey: paintbrushOverlayKey.value,
    paintbrushOverlaySetId: paintbrushOverlaySetId.value,
    paintbrushFeatureKey: paintbrushFeatureKey.value,
    paintbrushFeatureSetId: paintbrushFeatureSetId.value,
    paintbrushImageRotation: paintbrushImageRotation.value,
    paintbrushImageFlip: paintbrushImageFlip.value,
    paintbrushAutoRotate: paintbrushAutoRotate.value,
    paintbrushEnableElevation: paintbrushEnableElevation.value,
    paintbrushEnableTerrain: paintbrushEnableTerrain.value,
    paintbrushEnableEffect: paintbrushEnableEffect.value,
    paintbrushEnableName: paintbrushEnableName.value,
    paintbrushEnableColor: paintbrushEnableColor.value,
    paintbrushEnableAppearance: paintbrushEnableAppearance.value,
    paintbrushEnableOverlay: paintbrushEnableOverlay.value,
    paintbrushEnableFeature: paintbrushEnableFeature.value,
    paintbrushEnableAppearanceTint: paintbrushEnableAppearanceTint.value,
    paintbrushEnableOverlayTint: paintbrushEnableOverlayTint.value,
    paintbrushEnableFeatureTint: paintbrushEnableFeatureTint.value,
    paintbrushEnableRotation: paintbrushEnableRotation.value,
    paintbrushEnableFlip: paintbrushEnableFlip.value,
  };
}

export const gmToolsWatchSources = [
  activeTool,
  selectTargetKind,
  selectSameEnemyType,
  damageAmount,
  effectId,
  effectStacks,
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
  paintbrushAppearanceKey,
  paintbrushAppearanceSetId,
  paintbrushOverlayKey,
  paintbrushOverlaySetId,
  paintbrushFeatureKey,
  paintbrushFeatureSetId,
  paintbrushImageRotation,
  paintbrushImageFlip,
  paintbrushAutoRotate,
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
];

export function clearActiveTool() {
  activeTool.value = null;
}

watch(activeMainTab, (tab) => {
  if (tab !== "taccom") clearActiveTool();
});

let syncPaintbrushPreviewsFromKeys: (() => void) | null = null;

export function applyPersistedGmTools(gm: PersistedGmTools) {
  activeTool.value = gm.activeTool;
  selectTargetKind.value = gm.selectTargetKind;
  selectSameEnemyType.value = gm.selectSameEnemyType;
  damageAmount.value = gm.damageAmount;
  effectId.value = gm.effectId;
  effectStacks.value = gm.effectStacks;
  paintbrushElevation.value = gm.paintbrushElevation;
  paintbrushTerrain.value = gm.paintbrushTerrain;
  paintbrushEffectId.value = gm.paintbrushEffectId;
  paintbrushEffectStacks.value = gm.paintbrushEffectStacks;
  paintbrushTileName.value = gm.paintbrushTileName;
  paintbrushObstacleHp.value = gm.paintbrushObstacleHp;
  paintbrushBaseColor.value = gm.paintbrushBaseColor;
  paintbrushAppearanceTint.value = gm.paintbrushAppearanceTint;
  paintbrushOverlayTint.value = gm.paintbrushOverlayTint;
  paintbrushFeatureTint.value = gm.paintbrushFeatureTint;
  paintbrushAppearanceKey.value = gm.paintbrushAppearanceKey;
  paintbrushAppearanceSetId.value = gm.paintbrushAppearanceSetId;
  paintbrushOverlayKey.value = gm.paintbrushOverlayKey;
  paintbrushOverlaySetId.value = gm.paintbrushOverlaySetId;
  paintbrushFeatureKey.value = gm.paintbrushFeatureKey;
  paintbrushFeatureSetId.value = gm.paintbrushFeatureSetId;
  paintbrushImageRotation.value = gm.paintbrushImageRotation;
  paintbrushImageFlip.value = gm.paintbrushImageFlip;
  paintbrushAutoRotate.value = gm.paintbrushAutoRotate;
  paintbrushEnableElevation.value = gm.paintbrushEnableElevation;
  paintbrushEnableTerrain.value = gm.paintbrushEnableTerrain;
  paintbrushEnableEffect.value = gm.paintbrushEnableEffect;
  paintbrushEnableName.value = gm.paintbrushEnableName;
  paintbrushEnableColor.value = gm.paintbrushEnableColor;
  paintbrushEnableAppearance.value = gm.paintbrushEnableAppearance;
  paintbrushEnableOverlay.value = gm.paintbrushEnableOverlay;
  paintbrushEnableFeature.value = gm.paintbrushEnableFeature;
  paintbrushEnableAppearanceTint.value = gm.paintbrushEnableAppearanceTint;
  paintbrushEnableOverlayTint.value = gm.paintbrushEnableOverlayTint;
  paintbrushEnableFeatureTint.value = gm.paintbrushEnableFeatureTint;
  paintbrushEnableRotation.value = gm.paintbrushEnableRotation;
  paintbrushEnableFlip.value = gm.paintbrushEnableFlip;
  syncPaintbrushPreviewsFromKeys?.();
}

export function useGmTools() {
  const { clearMode } = useBoardActionMode();
  const { clearSpawnEnemySelection } = useEnemySpawnSelection();
  const { send, gameState } = useGameState();
  const {
    fetchTilePresets,
    saveTilePreset,
    deleteTilePreset,
    fetchTileAppearanceUrl,
  } = useApi();

  const bulkSelectionCount = computed(() => {
    const sel = bulkSelection.value;
    if (!sel) return 0;
    if (sel.kind === "tiles") return sel.coords.length;
    return sel.ids.length;
  });

  const paintbrushPresetNames = computed(() =>
    Object.keys(paintbrushPresets.value).sort((a, b) => a.localeCompare(b)),
  );

  const bundledTileAppearancesForSet = computed(() =>
    galleryEntriesForSet(paintbrushAppearanceSetId.value),
  );

  const bundledTileOverlaysForSet = computed(() =>
    galleryEntriesForOverlaySet(paintbrushOverlaySetId.value),
  );

  const bundledTileFeaturesForSet = computed(() =>
    galleryEntriesForFeatureSet(paintbrushFeatureSetId.value),
  );

  function syncPaintbrushAppearanceSetFromKey(key: string | null | undefined) {
    if (!key) return;
    const setId = setIdFromAppearanceKey(key);
    if (setId) paintbrushAppearanceSetId.value = setId;
  }

  function syncPaintbrushOverlaySetFromKey(key: string | null | undefined) {
    if (!key) return;
    const setId = setIdFromOverlayKey(key);
    if (setId) paintbrushOverlaySetId.value = setId;
  }

  function syncPaintbrushFeatureSetFromKey(key: string | null | undefined) {
    if (!key) return;
    const setId = setIdFromFeatureKey(key);
    if (setId) paintbrushFeatureSetId.value = setId;
  }

  async function refreshPaintbrushPresets() {
    const mapId = gameState.value?.mapId;
    if (!mapId) {
      paintbrushPresets.value = {};
      return;
    }
    paintbrushPresets.value = await fetchTilePresets(mapId);
  }

  watch(activeTool, (tool) => {
    if (tool === "paintbrush") void refreshPaintbrushPresets();
    if (tool !== "paintbrush") {
      paintbrushEyedropperActive.value = false;
      paintbrushSelectHeld.value = false;
      clearPendingTilePlacements();
      clearPaintbrushSuppressPreview();
      flushPaintbrushDrag();
      clearPaintbrushDragStickyPreviews();
    }
  });

  watch(
    [
      paintbrushAppearanceKey,
      paintbrushOverlayKey,
      paintbrushFeatureKey,
      paintbrushAutoRotate,
      paintbrushEnableRotation,
    ],
    () => {
      clearPendingTilePlacements();
      clearPaintbrushDragStickyPreviews();
    },
  );

  watch(
    () => gameState.value?.tiles,
    (tiles) => {
      const stickies = paintbrushDragStickyPreviews.value;
      const stickyKeys = Object.keys(stickies);
      if (!tiles || stickyKeys.length === 0) return;
      let changed = false;
      const next = { ...stickies };
      for (const key of stickyKeys) {
        const [xs, ys] = key.split(",");
        const x = Number(xs);
        const y = Number(ys);
        if (pendingDragPaints.some((p) => p.coord.x === x && p.coord.y === y)) continue;
        const tile = tileAt(tiles, x, y);
        if (!tile || tileMatchesDragPaint(tile, stickies[key]!.fields)) {
          delete next[key];
          changed = true;
        }
      }
      if (changed) paintbrushDragStickyPreviews.value = next;
    },
  );

  watch([paintbrushEnableRotation, paintbrushAutoRotate], () => {
    paintbrushImageRotation.value = 0;
  });

  function setPaintbrushEyedropperActive(active: boolean) {
    if (activeTool.value !== "paintbrush") {
      paintbrushEyedropperActive.value = false;
      return;
    }
    paintbrushEyedropperActive.value = active;
  }

  function setPaintbrushSelectHeld(active: boolean) {
    if (activeTool.value !== "paintbrush") {
      paintbrushSelectHeld.value = false;
      return;
    }
    paintbrushSelectHeld.value = active;
  }

  function tileToPaintPreset(tile: MapTile): TilePaintPreset {
    const effects = Object.entries(tile.tileEffects ?? {})
      .filter(([, stacks]) => stacks !== 0)
      .sort(([a], [b]) => a.localeCompare(b));
    const [effectId, effectStacks] = effects[0] ?? [GM_TILE_EFFECT_NONE, 1];
    const terrain = tile.terrain[0] ?? "standard";
    return {
      elevation: tile.elevation,
      terrain,
      tileEffectId: effectId,
      tileEffectStacks: effectStacks,
      tileName: tile.name ?? "",
      ...(terrain === "obstacle" ? { obstacleHp: getObstacleHp(tile) } : {}),
      ...(tile.baseColor ? { baseColor: tile.baseColor } : {}),
      ...(tile.appearanceKey ? { appearanceKey: tile.appearanceKey } : {}),
      ...(tile.overlayKey ? { overlayKey: tile.overlayKey } : {}),
      ...(tile.featureKey ? { featureKey: tile.featureKey } : {}),
      ...(tile.appearanceTint ? { appearanceTint: { ...tile.appearanceTint } } : {}),
      ...(tile.overlayTint ? { overlayTint: { ...tile.overlayTint } } : {}),
      ...(tile.featureTint ? { featureTint: { ...tile.featureTint } } : {}),
      ...(tile.appearanceRotation ? { appearanceRotation: tile.appearanceRotation } : {}),
      ...(tile.appearanceFlip ? { appearanceFlip: true } : {}),
      ...(tile.overlayRotation ? { overlayRotation: tile.overlayRotation } : {}),
      ...(tile.overlayFlip ? { overlayFlip: true } : {}),
      ...(tile.featureRotation ? { featureRotation: tile.featureRotation } : {}),
      ...(tile.featureFlip ? { featureFlip: true } : {}),
    };
  }

  function samplePaintbrushFromTile(x: number, y: number) {
    const s = gameState.value;
    if (!s) return;
    const tile = tileAt(s.tiles, x, y);
    if (!tile) return;
    applyPresetToBrush(tileToPaintPreset(tile));
  }

  function setActiveTool(tool: GmTool) {
    if (activeTool.value === tool) {
      clearActiveTool();
      return;
    }
    clearMode();
    clearSpawnEnemySelection();
    if (tool === "damageEffect") {
      effectId.value = GM_EFFECT_NONE;
    }
    activeTool.value = tool;
    activeTab.value = "info";
  }

  function setBulkSelection(selection: GmBulkSelection | null) {
    bulkSelection.value = selection;
  }

  function clearBulkSelection() {
    bulkSelection.value = null;
  }

  function isTileBulkSelected(x: number, y: number): boolean {
    const sel = bulkSelection.value;
    if (sel?.kind !== "tiles") return false;
    return sel.coords.some((c) => c.x === x && c.y === y);
  }

  function isPlayerBulkSelected(playerId: string): boolean {
    const sel = bulkSelection.value;
    if (sel?.kind !== "players") return false;
    return sel.ids.includes(playerId);
  }

  function isEnemyBulkSelected(enemyId: string): boolean {
    const sel = bulkSelection.value;
    if (sel?.kind !== "enemies") return false;
    return sel.ids.includes(enemyId);
  }

  function isCellInBulkSelection(x: number, y: number, occ?: {
    playerByKey: Map<string, { id: string }>;
    enemyByKey: Map<string, { id: string }>;
  }): boolean {
    const sel = bulkSelection.value;
    if (!sel) return false;
    if (sel.kind === "tiles") return isTileBulkSelected(x, y);
    if (!occ) return false;
    const key = coordKey(x, y);
    if (sel.kind === "players") {
      const player = occ.playerByKey.get(key);
      return !!player && sel.ids.includes(player.id);
    }
    const enemy = occ.enemyByKey.get(key);
    return !!enemy && sel.ids.includes(enemy.id);
  }

  function applyDamageEffectToToken(
    target:
      | { kind: "player" | "enemy"; id: string }
      | { kind: "obstacle"; x: number; y: number },
  ) {
    const damage = damageAmount.value;
    if (damage > 0) {
      send({ type: "gmApplyDamage", target, amount: damage });
    }
    if (target.kind !== "obstacle" && effectId.value && effectStacks.value !== 0) {
      send({
        type: "applyEffect",
        target,
        effects: [`${effectId.value}:${effectStacks.value}`],
      });
    }
  }

  function clearPaintbrushAppearancePreview() {
    const url = paintbrushAppearancePreviewUrl.value;
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    paintbrushAppearancePreviewUrl.value = null;
  }

  function setPaintbrushAppearancePreview(key: string) {
    clearPaintbrushAppearancePreview();
    if (isBundledTileAppearanceKey(key)) {
      paintbrushAppearancePreviewUrl.value = bundledTileAppearanceUrl(key);
      return;
    }
    void fetchTileAppearanceUrl(key).then((url) => {
      if (url) paintbrushAppearancePreviewUrl.value = url;
    });
  }

  function clearPaintbrushFeaturePreview() {
    const url = paintbrushFeaturePreviewUrl.value;
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    paintbrushFeaturePreviewUrl.value = null;
  }

  function setPaintbrushFeaturePreview(key: string) {
    clearPaintbrushFeaturePreview();
    if (isBundledTileFeatureKey(key)) {
      paintbrushFeaturePreviewUrl.value = bundledTileFeatureUrl(key);
      return;
    }
    void fetchTileAppearanceUrl(key).then((url) => {
      if (url) paintbrushFeaturePreviewUrl.value = url;
    });
  }

  function clearPaintbrushOverlayPreview() {
    const url = paintbrushOverlayPreviewUrl.value;
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
    paintbrushOverlayPreviewUrl.value = null;
  }

  function setPaintbrushOverlayPreview(key: string) {
    clearPaintbrushOverlayPreview();
    if (isBundledTileOverlayKey(key)) {
      paintbrushOverlayPreviewUrl.value = bundledTileOverlayUrl(key);
      return;
    }
    void fetchTileAppearanceUrl(key).then((url) => {
      if (url) paintbrushOverlayPreviewUrl.value = url;
    });
  }

  syncPaintbrushPreviewsFromKeys = () => {
    const appearance = paintbrushAppearanceKey.value;
    if (typeof appearance === "string") setPaintbrushAppearancePreview(appearance);
    else clearPaintbrushAppearancePreview();
    const overlay = paintbrushOverlayKey.value;
    if (typeof overlay === "string") setPaintbrushOverlayPreview(overlay);
    else clearPaintbrushOverlayPreview();
    const feature = paintbrushFeatureKey.value;
    if (typeof feature === "string") setPaintbrushFeaturePreview(feature);
    else clearPaintbrushFeaturePreview();
  };
  syncPaintbrushPreviewsFromKeys();

  function resetPaintbrushSettings() {
    paintbrushElevation.value = 0;
    paintbrushTerrain.value = "standard";
    paintbrushEffectId.value = GM_TILE_EFFECT_NONE;
    paintbrushEffectStacks.value = 1;
    paintbrushTileName.value = "";
    paintbrushObstacleHp.value = DEFAULT_OBSTACLE_HP;
    paintbrushBaseColor.value = null;
    paintbrushAppearanceTint.value = null;
    paintbrushOverlayTint.value = null;
    paintbrushFeatureTint.value = null;
    paintbrushAppearanceKey.value = undefined;
    clearPaintbrushAppearancePreview();
    paintbrushOverlayKey.value = undefined;
    clearPaintbrushOverlayPreview();
    paintbrushFeatureKey.value = undefined;
    clearPaintbrushFeaturePreview();
    paintbrushImageRotation.value = 0;
    paintbrushImageFlip.value = false;
    paintbrushEnableAppearanceTint.value = false;
    paintbrushEnableOverlayTint.value = false;
    paintbrushEnableFeatureTint.value = false;
    paintbrushEnableRotation.value = false;
    paintbrushEnableFlip.value = false;
    paintbrushAutoRotate.value = false;
    paintbrushPresetLoadId.value = "";
    paintbrushPresetError.value = "";
  }

  function buildPresetFromBrush(): TilePaintPreset {
    return {
      elevation: paintbrushElevation.value,
      terrain: paintbrushTerrain.value,
      tileEffectId: paintbrushEffectId.value,
      tileEffectStacks: paintbrushEffectStacks.value,
      tileName: paintbrushTileName.value.trim(),
      ...(paintbrushTerrain.value === "obstacle"
        ? { obstacleHp: paintbrushObstacleHp.value }
        : {}),
      ...(paintbrushBaseColor.value ? { baseColor: paintbrushBaseColor.value } : {}),
      ...(paintbrushAppearanceKey.value ? { appearanceKey: paintbrushAppearanceKey.value } : {}),
      ...(paintbrushOverlayKey.value ? { overlayKey: paintbrushOverlayKey.value } : {}),
      ...(paintbrushFeatureKey.value ? { featureKey: paintbrushFeatureKey.value } : {}),
      ...(paintbrushAppearanceTint.value
        ? { appearanceTint: { ...paintbrushAppearanceTint.value } }
        : {}),
      ...(paintbrushOverlayTint.value ? { overlayTint: { ...paintbrushOverlayTint.value } } : {}),
      ...(paintbrushFeatureTint.value ? { featureTint: { ...paintbrushFeatureTint.value } } : {}),
      ...(paintbrushAppearanceKey.value && paintbrushImageRotation.value
        ? { appearanceRotation: paintbrushImageRotation.value }
        : {}),
      ...(paintbrushAppearanceKey.value && paintbrushImageFlip.value
        ? { appearanceFlip: true }
        : {}),
      ...(paintbrushOverlayKey.value && paintbrushImageRotation.value
        ? { overlayRotation: paintbrushImageRotation.value }
        : {}),
      ...(paintbrushOverlayKey.value && paintbrushImageFlip.value ? { overlayFlip: true } : {}),
      ...(paintbrushFeatureKey.value && paintbrushImageRotation.value
        ? { featureRotation: paintbrushImageRotation.value }
        : {}),
      ...(paintbrushFeatureKey.value && paintbrushImageFlip.value ? { featureFlip: true } : {}),
    };
  }

  function applyPresetToBrush(preset: TilePaintPreset) {
    paintbrushElevation.value = preset.elevation;
    paintbrushTerrain.value = preset.terrain;
    paintbrushEffectId.value = preset.tileEffectId;
    paintbrushEffectStacks.value = preset.tileEffectStacks;
    paintbrushTileName.value = preset.tileName;
    paintbrushObstacleHp.value =
      preset.terrain === "obstacle"
        ? (preset.obstacleHp ?? DEFAULT_OBSTACLE_HP)
        : DEFAULT_OBSTACLE_HP;
    paintbrushBaseColor.value = preset.baseColor ?? null;
    paintbrushAppearanceTint.value = preset.appearanceTint
      ? { ...preset.appearanceTint }
      : null;
    paintbrushOverlayTint.value = preset.overlayTint ? { ...preset.overlayTint } : null;
    paintbrushFeatureTint.value = preset.featureTint ? { ...preset.featureTint } : null;
    paintbrushAppearanceKey.value = preset.appearanceKey ?? null;
    syncPaintbrushAppearanceSetFromKey(preset.appearanceKey);
    if (preset.appearanceKey) setPaintbrushAppearancePreview(preset.appearanceKey);
    else clearPaintbrushAppearancePreview();
    paintbrushOverlayKey.value = preset.overlayKey ?? null;
    syncPaintbrushOverlaySetFromKey(preset.overlayKey);
    if (preset.overlayKey) setPaintbrushOverlayPreview(preset.overlayKey);
    else clearPaintbrushOverlayPreview();
    paintbrushFeatureKey.value = preset.featureKey ?? null;
    syncPaintbrushFeatureSetFromKey(preset.featureKey);
    if (preset.featureKey) setPaintbrushFeaturePreview(preset.featureKey);
    else clearPaintbrushFeaturePreview();
    paintbrushImageRotation.value =
      preset.appearanceRotation ?? preset.overlayRotation ?? preset.featureRotation ?? 0;
    paintbrushImageFlip.value = !!(
      preset.appearanceFlip ||
      preset.overlayFlip ||
      preset.featureFlip
    );
  }

  function selectBundledPaintbrushAppearance(key: string) {
    paintbrushEnableAppearance.value = true;
    paintbrushAppearanceKey.value = key;
    syncPaintbrushAppearanceSetFromKey(key);
    setPaintbrushAppearancePreview(key);
  }

  function selectBundledPaintbrushOverlay(key: string) {
    paintbrushEnableOverlay.value = true;
    paintbrushOverlayKey.value = key;
    syncPaintbrushOverlaySetFromKey(key);
    setPaintbrushOverlayPreview(key);
  }

  function selectBundledPaintbrushFeature(key: string) {
    paintbrushEnableFeature.value = true;
    paintbrushFeatureKey.value = key;
    syncPaintbrushFeatureSetFromKey(key);
    setPaintbrushFeaturePreview(key);
  }

  function loadSelectedPreset() {
    const name = paintbrushPresetLoadId.value;
    if (!name) return;
    const preset = paintbrushPresets.value[name];
    if (preset) applyPresetToBrush(preset);
  }

  async function saveCurrentPreset() {
    paintbrushPresetError.value = "";
    const name = paintbrushTileName.value.trim();
    if (!name) {
      paintbrushPresetError.value = "Enter a tile name to save a preset";
      return;
    }
    const mapId = gameState.value?.mapId;
    if (!mapId) return;
    const result = await saveTilePreset(mapId, name, buildPresetFromBrush());
    if (!result.ok) {
      paintbrushPresetError.value = result.error;
      return;
    }
    paintbrushPresets.value = result.presets;
    paintbrushPresetLoadId.value = name;
  }

  async function deleteSelectedPreset() {
    paintbrushPresetError.value = "";
    const name = paintbrushPresetLoadId.value;
    if (!name) return;
    const mapId = gameState.value?.mapId;
    if (!mapId) return;
    paintbrushPresets.value = await deleteTilePreset(mapId, name);
    paintbrushPresetLoadId.value = "";
  }

  function clearPaintbrushAppearance() {
    paintbrushEnableAppearance.value = true;
    paintbrushAppearanceKey.value = null;
    clearPaintbrushAppearancePreview();
  }

  function clearPaintbrushOverlay() {
    paintbrushEnableOverlay.value = true;
    paintbrushOverlayKey.value = null;
    clearPaintbrushOverlayPreview();
  }

  function clearPaintbrushFeature() {
    paintbrushEnableFeature.value = true;
    paintbrushFeatureKey.value = null;
    clearPaintbrushFeaturePreview();
  }

  function setAllPaintbrushOptionsEnabled(enabled: boolean) {
    paintbrushEnableElevation.value = enabled;
    paintbrushEnableTerrain.value = enabled;
    paintbrushEnableEffect.value = enabled;
    paintbrushEnableName.value = enabled;
    paintbrushEnableColor.value = enabled;
    paintbrushEnableAppearance.value = enabled;
    paintbrushEnableOverlay.value = enabled;
    paintbrushEnableFeature.value = enabled;
    paintbrushEnableAppearanceTint.value = enabled;
    paintbrushEnableOverlayTint.value = enabled;
    paintbrushEnableFeatureTint.value = enabled;
    paintbrushEnableRotation.value = enabled;
    paintbrushEnableFlip.value = enabled;
  }

  function enableAllPaintbrushOptions() {
    setAllPaintbrushOptionsEnabled(true);
  }

  function disableAllPaintbrushOptions() {
    setAllPaintbrushOptionsEnabled(false);
  }

  function cyclePaintbrushImageRotation() {
    if (!paintbrushEnableRotation.value) {
      paintbrushEnableRotation.value = true;
      paintbrushImageRotation.value = 0;
      return;
    }
    paintbrushImageRotation.value = ((paintbrushImageRotation.value + 90) % 360) as TileImageRotation;
  }

  function togglePaintbrushImageFlip() {
    if (!paintbrushEnableFlip.value) paintbrushEnableFlip.value = true;
    paintbrushImageFlip.value = !paintbrushImageFlip.value;
  }

  function ensurePendingTilePlacement(x: number, y: number): PendingTilePlacement {
    const key = coordKey(x, y);
    const brushAppearance = paintbrushEnableAppearance.value
      ? paintbrushAppearanceKey.value
      : undefined;
    // Enabled + no selection clears existing overlays/features (null), unlike appearance which
    // leaves the tile unchanged when unset (undefined).
    const brushOverlay = paintbrushEnableOverlay.value
      ? (paintbrushOverlayKey.value ?? null)
      : undefined;
    const brushFeature = paintbrushEnableFeature.value
      ? (paintbrushFeatureKey.value ?? null)
      : undefined;
    const autoRotate = paintbrushEnableRotation.value && paintbrushAutoRotate.value;
    const existing = pendingTilePlacements.get(key);
    if (
      existing &&
      existing.brushAppearance === brushAppearance &&
      existing.brushOverlay === brushOverlay &&
      existing.brushFeature === brushFeature &&
      (existing.imageRotation !== undefined) === autoRotate
    ) {
      return existing;
    }
    const placement: PendingTilePlacement = {
      brushAppearance,
      brushOverlay,
      brushFeature,
      appearanceKey:
        brushAppearance !== undefined
          ? resolveAppearanceKeyForPaint(brushAppearance)
          : undefined,
      overlayKey:
        brushOverlay !== undefined ? resolveOverlayKeyForPaint(brushOverlay) : undefined,
      featureKey:
        brushFeature !== undefined ? resolveFeatureKeyForPaint(brushFeature) : undefined,
      imageRotation: autoRotate
        ? TILE_IMAGE_ROTATIONS[Math.floor(Math.random() * TILE_IMAGE_ROTATIONS.length)]
        : undefined,
    };
    pendingTilePlacements.set(key, placement);
    return placement;
  }

  function takePendingTilePlacement(x: number, y: number): PendingTilePlacement {
    const placement = ensurePendingTilePlacement(x, y);
    pendingTilePlacements.delete(coordKey(x, y));
    return placement;
  }

  function paintbrushAssetUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    if (isBundledTileOverlayKey(key)) return bundledTileOverlayUrl(key);
    if (isBundledTileFeatureKey(key)) return bundledTileFeatureUrl(key);
    if (isBundledTileAppearanceKey(key)) return bundledTileAppearanceUrl(key);
    if (key.startsWith("tiles/")) return `/${key}`;
    if (key === paintbrushAppearanceKey.value) return paintbrushAppearancePreviewUrl.value;
    if (key === paintbrushOverlayKey.value) return paintbrushOverlayPreviewUrl.value;
    if (key === paintbrushFeatureKey.value) return paintbrushFeaturePreviewUrl.value;
    return null;
  }

  /** Resolved placement for hover preview — matches the next paint on this cell. */
  function peekPaintbrushPlacement(x: number, y: number) {
    const placement = ensurePendingTilePlacement(x, y);
    return {
      appearanceKey: placement.appearanceKey,
      overlayKey: placement.overlayKey,
      featureKey: placement.featureKey,
      appearanceUrl:
        placement.appearanceKey !== undefined ? paintbrushAssetUrl(placement.appearanceKey) : null,
      overlayUrl: placement.overlayKey !== undefined ? paintbrushAssetUrl(placement.overlayKey) : null,
      featureUrl: placement.featureKey !== undefined ? paintbrushAssetUrl(placement.featureKey) : null,
      imageRotation: placement.imageRotation,
    };
  }

  function buildPaintbrushSharedFields(): {
    shared: Omit<PaintbrushDragPaintFields, "appearanceKey" | "overlayKey" | "featureKey">;
    brushAppearance: string | null | undefined;
    brushOverlay: string | null | undefined;
    brushFeature: string | null | undefined;
    autoRotate: boolean;
    paintAppearance: boolean;
    paintOverlay: boolean;
    paintFeature: boolean;
  } {
    const autoRotate = paintbrushEnableRotation.value && paintbrushAutoRotate.value;
    const paintAppearance = paintbrushEnableAppearance.value;
    const paintOverlay = paintbrushEnableOverlay.value;
    const paintFeature = paintbrushEnableFeature.value;
    const rotateOn = paintbrushEnableRotation.value;
    const flipOn = paintbrushEnableFlip.value;
    const brushRotation = paintbrushImageRotation.value || null;
    const brushFlip = paintbrushImageFlip.value || null;

    const shared: Omit<PaintbrushDragPaintFields, "appearanceKey" | "overlayKey" | "featureKey"> = {};
    if (paintbrushEnableElevation.value) shared.elevation = paintbrushElevation.value;
    if (paintbrushEnableTerrain.value) {
      shared.terrain = paintbrushTerrain.value;
      if (paintbrushTerrain.value === "obstacle") {
        shared.obstacleHp = paintbrushObstacleHp.value;
      }
    }
    if (paintbrushEnableEffect.value) {
      shared.tileEffects =
        paintbrushEffectId.value && paintbrushEffectStacks.value !== 0
          ? [`${paintbrushEffectId.value}:${paintbrushEffectStacks.value}`]
          : [];
    }
    if (paintbrushEnableName.value) shared.tileName = paintbrushTileName.value;
    if (paintbrushEnableColor.value) shared.baseColor = paintbrushBaseColor.value;
    if (paintbrushEnableAppearanceTint.value) {
      shared.appearanceTint = paintbrushAppearanceTint.value;
    }
    if (paintbrushEnableOverlayTint.value) {
      shared.overlayTint = paintbrushOverlayTint.value;
    }
    if (paintbrushEnableFeatureTint.value) {
      shared.featureTint = paintbrushFeatureTint.value;
    }
    if (rotateOn && !autoRotate) {
      if (paintAppearance) shared.appearanceRotation = brushRotation;
      if (paintOverlay) shared.overlayRotation = brushRotation;
      if (paintFeature) shared.featureRotation = brushRotation;
    }
    if (flipOn) {
      if (paintAppearance) shared.appearanceFlip = brushFlip;
      if (paintOverlay) shared.overlayFlip = brushFlip;
      if (paintFeature) shared.featureFlip = brushFlip;
    }

    return {
      shared,
      brushAppearance: paintAppearance ? paintbrushAppearanceKey.value : undefined,
      // Enabled + no selection clears existing overlays/features (null), unlike appearance which
      // leaves the tile unchanged when unset (undefined).
      brushOverlay: paintOverlay ? (paintbrushOverlayKey.value ?? null) : undefined,
      brushFeature: paintFeature ? (paintbrushFeatureKey.value ?? null) : undefined,
      autoRotate,
      paintAppearance,
      paintOverlay,
      paintFeature,
    };
  }

  function hasAnyPaintbrushFields(
    shared: Omit<PaintbrushDragPaintFields, "appearanceKey" | "overlayKey" | "featureKey">,
    brushAppearance: string | null | undefined,
    brushOverlay: string | null | undefined,
    brushFeature: string | null | undefined,
  ): boolean {
    return !(
      shared.elevation === undefined &&
      shared.terrain === undefined &&
      shared.tileEffects === undefined &&
      shared.tileName === undefined &&
      shared.obstacleHp === undefined &&
      shared.baseColor === undefined &&
      shared.appearanceTint === undefined &&
      shared.overlayTint === undefined &&
      shared.featureTint === undefined &&
      shared.appearanceRotation === undefined &&
      shared.appearanceFlip === undefined &&
      shared.overlayRotation === undefined &&
      shared.overlayFlip === undefined &&
      shared.featureRotation === undefined &&
      shared.featureFlip === undefined &&
      brushAppearance === undefined &&
      brushOverlay === undefined &&
      brushFeature === undefined
    );
  }

  function resolveDragPaintFields(
    x: number,
    y: number,
  ): PaintbrushDragPaintFields | null {
    const {
      shared,
      brushAppearance,
      brushOverlay,
      brushFeature,
      autoRotate,
      paintAppearance,
      paintOverlay,
      paintFeature,
    } = buildPaintbrushSharedFields();
    if (!hasAnyPaintbrushFields(shared, brushAppearance, brushOverlay, brushFeature)) return null;

    const placement = takePendingTilePlacement(x, y);
    const rotation = autoRotate ? (placement.imageRotation ?? null) : undefined;
    return {
      ...shared,
      ...(placement.appearanceKey !== undefined ? { appearanceKey: placement.appearanceKey } : {}),
      ...(placement.overlayKey !== undefined ? { overlayKey: placement.overlayKey } : {}),
      ...(placement.featureKey !== undefined ? { featureKey: placement.featureKey } : {}),
      ...(autoRotate && paintAppearance ? { appearanceRotation: rotation } : {}),
      ...(autoRotate && paintOverlay ? { overlayRotation: rotation } : {}),
      ...(autoRotate && paintFeature ? { featureRotation: rotation } : {}),
    };
  }

  function buildStickyPreviewForFields(
    x: number,
    y: number,
    fields: PaintbrushDragPaintFields,
  ): PaintbrushStickyPreview {
    const tile = gameState.value ? tileAt(gameState.value.tiles, x, y) : undefined;
    const paintingAppearance = fields.appearanceKey !== undefined;
    const paintingOverlay = fields.overlayKey !== undefined;
    const paintingFeature = fields.featureKey !== undefined;
    const appearanceRotation =
      fields.appearanceRotation !== undefined
        ? (fields.appearanceRotation ?? 0)
        : (tile?.appearanceRotation ?? 0);
    const overlayRotation =
      fields.overlayRotation !== undefined
        ? (fields.overlayRotation ?? 0)
        : (tile?.overlayRotation ?? 0);
    const featureRotation =
      fields.featureRotation !== undefined
        ? (fields.featureRotation ?? 0)
        : (tile?.featureRotation ?? 0);
    return {
      baseColor:
        fields.baseColor !== undefined ? fields.baseColor : (tile?.baseColor ?? null),
      appearanceUrl: paintingAppearance
        ? paintbrushAssetUrl(fields.appearanceKey)
        : tile?.appearanceKey
          ? paintbrushAssetUrl(tile.appearanceKey)
          : null,
      overlayUrl: paintingOverlay
        ? paintbrushAssetUrl(fields.overlayKey)
        : tile?.overlayKey
          ? paintbrushAssetUrl(tile.overlayKey)
          : null,
      featureUrl: paintingFeature
        ? paintbrushAssetUrl(fields.featureKey)
        : tile?.featureKey
          ? paintbrushAssetUrl(tile.featureKey)
          : null,
      appearanceTint:
        fields.appearanceTint !== undefined
          ? fields.appearanceTint
          : (tile?.appearanceTint ?? null),
      overlayTint:
        fields.overlayTint !== undefined ? fields.overlayTint : (tile?.overlayTint ?? null),
      featureTint:
        fields.featureTint !== undefined ? fields.featureTint : (tile?.featureTint ?? null),
      appearanceRotation,
      appearanceFlip:
        fields.appearanceFlip !== undefined ? !!fields.appearanceFlip : !!tile?.appearanceFlip,
      overlayRotation,
      overlayFlip: fields.overlayFlip !== undefined ? !!fields.overlayFlip : !!tile?.overlayFlip,
      featureRotation,
      featureFlip: fields.featureFlip !== undefined ? !!fields.featureFlip : !!tile?.featureFlip,
    };
  }

  function scheduleDragFlush() {
    clearDragFlushTimer();
    dragFlushTimer = setTimeout(() => {
      dragFlushTimer = null;
      flushPaintbrushDrag();
    }, DRAG_FLUSH_IDLE_MS);
  }

  function flushPaintbrushDrag() {
    clearDragFlushTimer();
    if (pendingDragPaints.length === 0) return;
    const batch = pendingDragPaints;
    pendingDragPaints = [];
    const groups = new Map<string, { fields: PaintbrushDragPaintFields; coords: { x: number; y: number }[] }>();
    for (const paint of batch) {
      const existing = groups.get(paint.fieldsKey);
      if (existing) existing.coords.push(paint.coord);
      else groups.set(paint.fieldsKey, { fields: paint.fields, coords: [paint.coord] });
    }
    for (const group of groups.values()) {
      send({ type: "gmPaintTile", coords: group.coords, ...group.fields });
    }
  }

  function queuePaintbrushDragTile(x: number, y: number) {
    const fields = resolveDragPaintFields(x, y);
    if (!fields) return;
    const key = coordKey(x, y);
    const preview = buildStickyPreviewForFields(x, y, fields);
    paintbrushDragStickyPreviews.value = {
      ...paintbrushDragStickyPreviews.value,
      [key]: { preview, fields },
    };
    pendingDragPaints.push({ coord: { x, y }, fieldsKey: JSON.stringify(fields), fields });
    if (pendingDragPaints.length >= DRAG_FLUSH_MAX_SIZE) flushPaintbrushDrag();
    else scheduleDragFlush();
  }

  function endPaintbrushDrag() {
    flushPaintbrushDrag();
  }

  function applyPaintbrushToTile(x: number, y: number) {
    const sel = bulkSelection.value;
    const coords =
      sel?.kind === "tiles" && sel.coords.some((c) => c.x === x && c.y === y)
        ? sel.coords
        : [{ x, y }];
    const {
      shared,
      brushAppearance,
      brushOverlay,
      brushFeature,
      autoRotate,
      paintAppearance,
      paintOverlay,
      paintFeature,
    } = buildPaintbrushSharedFields();

    if (!hasAnyPaintbrushFields(shared, brushAppearance, brushOverlay, brushFeature)) {
      return;
    }

    const needsPerTileResolve =
      autoRotate ||
      (brushAppearance !== undefined &&
        brushAppearance !== null &&
        isAppearanceGroupKey(brushAppearance)) ||
      (brushOverlay !== undefined && brushOverlay !== null && isOverlayGroupKey(brushOverlay)) ||
      (brushFeature !== undefined && brushFeature !== null && isFeatureGroupKey(brushFeature));

    // Per-tile resolve (groups + auto-rotate + any cell with a pending hover pick) so preview matches paint.
    if (needsPerTileResolve || coords.length === 1) {
      for (const coord of coords) {
        const placement = takePendingTilePlacement(coord.x, coord.y);
        const rotation = autoRotate ? (placement.imageRotation ?? null) : undefined;
        send({
          type: "gmPaintTile",
          coords: [coord],
          ...shared,
          ...(placement.appearanceKey !== undefined
            ? { appearanceKey: placement.appearanceKey }
            : {}),
          ...(placement.overlayKey !== undefined ? { overlayKey: placement.overlayKey } : {}),
          ...(placement.featureKey !== undefined ? { featureKey: placement.featureKey } : {}),
          ...(autoRotate && paintAppearance ? { appearanceRotation: rotation } : {}),
          ...(autoRotate && paintOverlay ? { overlayRotation: rotation } : {}),
          ...(autoRotate && paintFeature ? { featureRotation: rotation } : {}),
        });
      }
      paintbrushSuppressPreviewKey.value = coordKey(x, y);
      return;
    }

    send({
      type: "gmPaintTile",
      coords,
      ...shared,
      ...(brushAppearance !== undefined
        ? { appearanceKey: resolveAppearanceKeyForPaint(brushAppearance) }
        : {}),
      ...(brushOverlay !== undefined
        ? { overlayKey: resolveOverlayKeyForPaint(brushOverlay) }
        : {}),
      ...(brushFeature !== undefined
        ? { featureKey: resolveFeatureKeyForPaint(brushFeature) }
        : {}),
    });
    paintbrushSuppressPreviewKey.value = coordKey(x, y);
  }

  return {
    activeTool,
    effectiveActiveTool,
    selectTargetKind,
    selectSameEnemyType,
    bulkSelection,
    bulkSelectionCount,
    damageAmount,
    effectId,
    effectStacks,
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
    paintbrushAppearanceKey,
    paintbrushAppearancePreviewUrl,
    paintbrushAppearanceSetId,
    paintbrushOverlayKey,
    paintbrushOverlayPreviewUrl,
    paintbrushOverlaySetId,
    paintbrushFeatureKey,
    paintbrushFeaturePreviewUrl,
    paintbrushFeatureSetId,
    paintbrushImageRotation,
    paintbrushImageFlip,
    paintbrushAutoRotate,
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
    paintbrushSuppressPreviewKey,
    paintbrushDragStickyPreviews,
    paintbrushPresets,
    paintbrushPresetLoadId,
    paintbrushPresetNames,
    paintbrushPresetError,
    paintbrushEyedropperActive,
    paintbrushSelectHeld,
    setActiveTool,
    setBulkSelection,
    clearBulkSelection,
    isTileBulkSelected,
    isPlayerBulkSelected,
    isEnemyBulkSelected,
    isCellInBulkSelection,
    applyDamageEffectToToken,
    resetPaintbrushSettings,
    enableAllPaintbrushOptions,
    disableAllPaintbrushOptions,
    cyclePaintbrushImageRotation,
    togglePaintbrushImageFlip,
    peekPaintbrushPlacement,
    clearPaintbrushSuppressPreview,
    queuePaintbrushDragTile,
    endPaintbrushDrag,
    applyPaintbrushToTile,
    samplePaintbrushFromTile,
    setPaintbrushEyedropperActive,
    setPaintbrushSelectHeld,
    loadSelectedPreset,
    saveCurrentPreset,
    deleteSelectedPreset,
    clearPaintbrushAppearance,
    selectBundledPaintbrushAppearance,
    clearPaintbrushOverlay,
    selectBundledPaintbrushOverlay,
    clearPaintbrushFeature,
    selectBundledPaintbrushFeature,
    bundledTileSets: BUNDLED_TILE_SETS,
    bundledTileAppearancesForSet,
    bundledTileOverlaySets: BUNDLED_TILE_OVERLAY_SETS,
    bundledTileOverlaysForSet,
    bundledTileFeatureSets: BUNDLED_TILE_FEATURE_SETS,
    bundledTileFeaturesForSet,
    refreshPaintbrushPresets,
  };
}
