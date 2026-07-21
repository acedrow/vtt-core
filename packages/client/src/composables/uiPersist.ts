import { watch, type Ref } from "vue";
import type { FactionId, VttRole, ReconTableId, TerrainType, TileColorTint, TileImageRotation } from "@vtt-core/shared";
import {
  DEFAULT_OBSTACLE_HP,
  getFactionById,
  getReconTable,
  TERRAIN_TYPES,
  TILE_IMAGE_ROTATIONS,
  parseTileColorTint,
} from "@vtt-core/shared";

import type { BoardSelection } from "./useBoardSelection.js";
import { isMainSectionTab } from "../client-content-pack.js";
import { isDataCategory, type DataCategory, type DataFocus } from "./dataCategories.js";
import type { RightPanelTab } from "./useGameConsole.js";
import type { MainSectionTab } from "./useMainSectionTab.js";
import { useSession } from "./useSession.js";

const LEGACY_STORAGE_KEY = "vtt-core-ui";

const RIGHT_PANEL_TABS = new Set<RightPanelTab>(["console", "info", "turnOrder", "settings"]);

const GM_TOOLS = new Set<string>(["select", "damageEffect", "forceMove", "paintbrush"]);
const GM_SELECT_TARGET_KINDS = new Set<string>(["tiles", "enemies", "players"]);
const TERRAIN_TYPE_SET = new Set<string>(TERRAIN_TYPES);
const TILE_ROTATION_SET = new Set<number>(TILE_IMAGE_ROTATIONS);

export type PersistedGmTool = "select" | "damageEffect" | "forceMove" | "paintbrush";
export type PersistedGmSelectTargetKind = "tiles" | "enemies" | "players";

export type PersistedGmTools = {
  activeTool: PersistedGmTool | null;
  selectTargetKind: PersistedGmSelectTargetKind;
  selectSameEnemyType: boolean;
  damageAmount: number;
  effectId: string;
  effectStacks: number;
  paintbrushElevation: number;
  paintbrushTerrain: TerrainType;
  paintbrushEffectId: string;
  paintbrushEffectStacks: number;
  paintbrushTileName: string;
  paintbrushObstacleHp: number;
  paintbrushBaseColor: string | null;
  paintbrushAppearanceTint: TileColorTint | null;
  paintbrushOverlayTint: TileColorTint | null;
  paintbrushFeatureTint: TileColorTint | null;
  paintbrushAppearanceKey: string | null | undefined;
  paintbrushAppearanceSetId: string;
  paintbrushOverlayKey: string | null | undefined;
  paintbrushOverlaySetId: string;
  paintbrushFeatureKey: string | null | undefined;
  paintbrushFeatureSetId: string;
  paintbrushImageRotation: TileImageRotation;
  paintbrushImageFlip: boolean;
  paintbrushAutoRotate: boolean;
  paintbrushEnableElevation: boolean;
  paintbrushEnableTerrain: boolean;
  paintbrushEnableEffect: boolean;
  paintbrushEnableName: boolean;
  paintbrushEnableColor: boolean;
  paintbrushEnableAppearance: boolean;
  paintbrushEnableOverlay: boolean;
  paintbrushEnableFeature: boolean;
  paintbrushEnableAppearanceTint: boolean;
  paintbrushEnableOverlayTint: boolean;
  paintbrushEnableFeatureTint: boolean;
  paintbrushEnableRotation: boolean;
  paintbrushEnableFlip: boolean;
};

export type PersistedViewport = {
  boardKey: string;
  scale: number;
  panX: number;
  panY: number;
};

export type PersistedUi = {
  boardSelection: BoardSelection | null;
  selectedSheetId: string | null;
  selectedMapId: string | null;
  selectedFactionId: FactionId | null;
  selectedTableId: ReconTableId | null;
  dataCategory: DataCategory | null;
  dataFocus: DataFocus | null;
  dataFocusReturnCategory: DataCategory | null;
  dataCategoryReturnFactionId: FactionId | null;
  activeTab: RightPanelTab;
  activeMainTab: MainSectionTab;
  sheetsExpanded: boolean;
  dataExpanded: boolean;
  mapsExpanded: boolean;
  factionsExpanded: boolean;
  tablesExpanded: boolean;
  viewport: PersistedViewport | null;
  gmTools: PersistedGmTools;
};

export const DEFAULT_GM_TOOLS: PersistedGmTools = {
  activeTool: null,
  selectTargetKind: "enemies",
  selectSameEnemyType: false,
  damageAmount: 0,
  effectId: "",
  effectStacks: 1,
  paintbrushElevation: 0,
  paintbrushTerrain: "standard",
  paintbrushEffectId: "",
  paintbrushEffectStacks: 1,
  paintbrushTileName: "",
  paintbrushObstacleHp: DEFAULT_OBSTACLE_HP,
  paintbrushBaseColor: null,
  paintbrushAppearanceTint: null,
  paintbrushOverlayTint: null,
  paintbrushFeatureTint: null,
  paintbrushAppearanceKey: undefined,
  paintbrushAppearanceSetId: "basic",
  paintbrushOverlayKey: undefined,
  paintbrushOverlaySetId: "stain",
  paintbrushFeatureKey: undefined,
  paintbrushFeatureSetId: "base",
  paintbrushImageRotation: 0,
  paintbrushImageFlip: false,
  paintbrushAutoRotate: false,
  paintbrushEnableElevation: true,
  paintbrushEnableTerrain: true,
  paintbrushEnableEffect: true,
  paintbrushEnableName: true,
  paintbrushEnableColor: true,
  paintbrushEnableAppearance: true,
  paintbrushEnableOverlay: true,
  paintbrushEnableFeature: true,
  paintbrushEnableAppearanceTint: false,
  paintbrushEnableOverlayTint: false,
  paintbrushEnableFeatureTint: false,
  paintbrushEnableRotation: false,
  paintbrushEnableFlip: false,
};

const DEFAULT_UI: PersistedUi = {
  boardSelection: null,
  selectedSheetId: null,
  selectedMapId: null,
  selectedFactionId: null,
  selectedTableId: null,
  dataCategory: null,
  dataFocus: null,
  dataFocusReturnCategory: null,
  dataCategoryReturnFactionId: null,
  activeTab: "info",
  activeMainTab: "taccom",
  sheetsExpanded: false,
  dataExpanded: false,
  mapsExpanded: false,
  factionsExpanded: false,
  tablesExpanded: false,
  viewport: null,
  gmTools: { ...DEFAULT_GM_TOOLS },
};

function isBoardSelection(value: unknown): value is BoardSelection {
  if (!value || typeof value !== "object") return false;
  const v = value as { kind?: unknown; id?: unknown };
  return (
    (v.kind === "player" || v.kind === "enemy") &&
    typeof v.id === "string" &&
    v.id.length > 0
  );
}

function isDataFocus(value: unknown): value is DataFocus {
  if (!value || typeof value !== "object") return false;
  const v = value as { kind?: unknown; name?: unknown };
  return (
    (v.kind === "enemy" || (typeof v.kind === "string" && isDataCategory(v.kind))) &&
    typeof v.name === "string" &&
    v.name.length > 0
  );
}

function isViewport(value: unknown): value is PersistedViewport {
  if (!value || typeof value !== "object") return false;
  const v = value as PersistedViewport;
  return (
    typeof v.boardKey === "string" &&
    v.boardKey.length > 0 &&
    Number.isFinite(v.scale) &&
    Number.isFinite(v.panX) &&
    Number.isFinite(v.panY)
  );
}

function parseOptionalStringKey(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value;
  return undefined;
}

export function parsePersistedGmTools(raw: unknown): PersistedGmTools {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_GM_TOOLS };
  const g = raw as Record<string, unknown>;
  const activeTool =
    g.activeTool === null
      ? null
      : typeof g.activeTool === "string" && GM_TOOLS.has(g.activeTool as PersistedGmTool)
        ? (g.activeTool as PersistedGmTool)
        : DEFAULT_GM_TOOLS.activeTool;
  const selectTargetKind =
    typeof g.selectTargetKind === "string" &&
    GM_SELECT_TARGET_KINDS.has(g.selectTargetKind as PersistedGmSelectTargetKind)
      ? (g.selectTargetKind as PersistedGmSelectTargetKind)
      : DEFAULT_GM_TOOLS.selectTargetKind;
  const selectSameEnemyType = g.selectSameEnemyType === true;
  const damageAmount =
    typeof g.damageAmount === "number" && Number.isFinite(g.damageAmount)
      ? g.damageAmount
      : DEFAULT_GM_TOOLS.damageAmount;
  const effectId = typeof g.effectId === "string" ? g.effectId : DEFAULT_GM_TOOLS.effectId;
  const effectStacks =
    typeof g.effectStacks === "number" && Number.isFinite(g.effectStacks)
      ? g.effectStacks
      : DEFAULT_GM_TOOLS.effectStacks;
  const paintbrushElevation =
    typeof g.paintbrushElevation === "number" && Number.isInteger(g.paintbrushElevation)
      ? Math.min(3, Math.max(-3, g.paintbrushElevation))
      : DEFAULT_GM_TOOLS.paintbrushElevation;
  const paintbrushTerrain =
    typeof g.paintbrushTerrain === "string" && TERRAIN_TYPE_SET.has(g.paintbrushTerrain)
      ? (g.paintbrushTerrain as TerrainType)
      : DEFAULT_GM_TOOLS.paintbrushTerrain;
  const paintbrushEffectId =
    typeof g.paintbrushEffectId === "string"
      ? g.paintbrushEffectId
      : DEFAULT_GM_TOOLS.paintbrushEffectId;
  const paintbrushEffectStacks =
    typeof g.paintbrushEffectStacks === "number" && Number.isFinite(g.paintbrushEffectStacks)
      ? g.paintbrushEffectStacks
      : DEFAULT_GM_TOOLS.paintbrushEffectStacks;
  const paintbrushTileName =
    typeof g.paintbrushTileName === "string"
      ? g.paintbrushTileName
      : DEFAULT_GM_TOOLS.paintbrushTileName;
  const paintbrushObstacleHp =
    typeof g.paintbrushObstacleHp === "number" &&
    Number.isInteger(g.paintbrushObstacleHp) &&
    g.paintbrushObstacleHp >= 1
      ? g.paintbrushObstacleHp
      : DEFAULT_GM_TOOLS.paintbrushObstacleHp;
  const paintbrushBaseColor =
    g.paintbrushBaseColor === null
      ? null
      : typeof g.paintbrushBaseColor === "string"
        ? g.paintbrushBaseColor
        : DEFAULT_GM_TOOLS.paintbrushBaseColor;
  const paintbrushAppearanceTint =
    g.paintbrushAppearanceTint === null
      ? null
      : (parseTileColorTint(g.paintbrushAppearanceTint) ?? DEFAULT_GM_TOOLS.paintbrushAppearanceTint);
  const paintbrushOverlayTint =
    g.paintbrushOverlayTint === null
      ? null
      : (parseTileColorTint(g.paintbrushOverlayTint) ?? DEFAULT_GM_TOOLS.paintbrushOverlayTint);
  const paintbrushFeatureTint =
    g.paintbrushFeatureTint === null
      ? null
      : (parseTileColorTint(g.paintbrushFeatureTint) ?? DEFAULT_GM_TOOLS.paintbrushFeatureTint);
  const paintbrushAppearanceSetId =
    typeof g.paintbrushAppearanceSetId === "string" && g.paintbrushAppearanceSetId.length > 0
      ? g.paintbrushAppearanceSetId
      : DEFAULT_GM_TOOLS.paintbrushAppearanceSetId;
  const paintbrushOverlaySetId =
    typeof g.paintbrushOverlaySetId === "string" && g.paintbrushOverlaySetId.length > 0
      ? g.paintbrushOverlaySetId
      : DEFAULT_GM_TOOLS.paintbrushOverlaySetId;
  const paintbrushFeatureSetId =
    typeof g.paintbrushFeatureSetId === "string" && g.paintbrushFeatureSetId.length > 0
      ? g.paintbrushFeatureSetId
      : DEFAULT_GM_TOOLS.paintbrushFeatureSetId;
  const paintbrushImageRotation =
    typeof g.paintbrushImageRotation === "number" &&
    TILE_ROTATION_SET.has(g.paintbrushImageRotation)
      ? (g.paintbrushImageRotation as TileImageRotation)
      : DEFAULT_GM_TOOLS.paintbrushImageRotation;

  return {
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
    paintbrushAppearanceKey: parseOptionalStringKey(g.paintbrushAppearanceKey),
    paintbrushAppearanceSetId,
    paintbrushOverlayKey: parseOptionalStringKey(g.paintbrushOverlayKey),
    paintbrushOverlaySetId,
    paintbrushFeatureKey: parseOptionalStringKey(g.paintbrushFeatureKey),
    paintbrushFeatureSetId,
    paintbrushImageRotation,
    paintbrushImageFlip: g.paintbrushImageFlip === true,
    paintbrushAutoRotate: g.paintbrushAutoRotate === true,
    paintbrushEnableElevation: g.paintbrushEnableElevation !== false,
    paintbrushEnableTerrain: g.paintbrushEnableTerrain !== false,
    paintbrushEnableEffect: g.paintbrushEnableEffect !== false,
    paintbrushEnableName: g.paintbrushEnableName !== false,
    paintbrushEnableColor: g.paintbrushEnableColor !== false,
    paintbrushEnableAppearance: g.paintbrushEnableAppearance !== false,
    paintbrushEnableOverlay: g.paintbrushEnableOverlay !== false,
    paintbrushEnableFeature: g.paintbrushEnableFeature !== false,
    paintbrushEnableAppearanceTint: g.paintbrushEnableAppearanceTint === true,
    paintbrushEnableOverlayTint: g.paintbrushEnableOverlayTint === true,
    paintbrushEnableFeatureTint: g.paintbrushEnableFeatureTint === true,
    paintbrushEnableRotation: g.paintbrushEnableRotation === true,
    paintbrushEnableFlip: g.paintbrushEnableFlip === true,
  };
}

function parsePersistedUi(raw: string): PersistedUi {
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedUi>;
    return {
      boardSelection: isBoardSelection(parsed.boardSelection) ? parsed.boardSelection : null,
      selectedSheetId:
        typeof parsed.selectedSheetId === "string" ? parsed.selectedSheetId : null,
      selectedMapId:
        typeof parsed.selectedMapId === "string" ? parsed.selectedMapId : null,
      selectedFactionId:
        parsed.selectedFactionId && getFactionById(parsed.selectedFactionId)
          ? parsed.selectedFactionId
          : null,
      selectedTableId:
        typeof parsed.selectedTableId === "string" && getReconTable(parsed.selectedTableId)
          ? parsed.selectedTableId
          : null,
      dataCategory:
        typeof parsed.dataCategory === "string" && isDataCategory(parsed.dataCategory)
          ? parsed.dataCategory
          : null,
      dataFocus: isDataFocus(parsed.dataFocus) ? parsed.dataFocus : null,
      dataFocusReturnCategory:
        typeof parsed.dataFocusReturnCategory === "string" &&
        isDataCategory(parsed.dataFocusReturnCategory)
          ? parsed.dataFocusReturnCategory
          : null,
      dataCategoryReturnFactionId:
        parsed.dataCategoryReturnFactionId &&
        getFactionById(parsed.dataCategoryReturnFactionId)
          ? parsed.dataCategoryReturnFactionId
          : null,
      activeTab:
        parsed.activeTab && RIGHT_PANEL_TABS.has(parsed.activeTab)
          ? parsed.activeTab
          : DEFAULT_UI.activeTab,
      activeMainTab:
        typeof parsed.activeMainTab === "string" && isMainSectionTab(parsed.activeMainTab)
          ? parsed.activeMainTab
          : DEFAULT_UI.activeMainTab,
      sheetsExpanded: parsed.sheetsExpanded === true,
      dataExpanded: parsed.dataExpanded === true,
      mapsExpanded: parsed.mapsExpanded === true,
      factionsExpanded: parsed.factionsExpanded === true,
      tablesExpanded: parsed.tablesExpanded === true,
      viewport: isViewport(parsed.viewport) ? parsed.viewport : null,
      gmTools: parsePersistedGmTools(parsed.gmTools),
    };
  } catch {
    return { ...DEFAULT_UI, gmTools: { ...DEFAULT_GM_TOOLS } };
  }
}

function uiStorageKey(role: VttRole | null, playerId: string | null): string | null {
  if (role === "gm") return "vtt-core-ui:gm";
  if (role === "player" && playerId) return `vtt-core-ui:player:${playerId}`;
  return null;
}

const { role, playerProfile } = useSession();

function readFromStorage(key: string | null): PersistedUi {
  if (!key) return { ...DEFAULT_UI };
  try {
    let raw = localStorage.getItem(key);
    if (!raw && key === "vtt-core-ui:gm") {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    return raw ? parsePersistedUi(raw) : { ...DEFAULT_UI, gmTools: { ...DEFAULT_GM_TOOLS } };
  } catch {
    return { ...DEFAULT_UI, gmTools: { ...DEFAULT_GM_TOOLS } };
  }
}

let cached: PersistedUi | null = null;
let cachedKey: string | null = null;

function invalidateCache() {
  cached = null;
  cachedKey = null;
}

export function readPersistedUi(): PersistedUi {
  const key = uiStorageKey(role.value, playerProfile.value?.id ?? null);
  if (cached && cachedKey === key) return cached;
  cachedKey = key;
  cached = readFromStorage(key);
  return cached;
}

export function writePersistedUi(patch: Partial<PersistedUi>) {
  const key = uiStorageKey(role.value, playerProfile.value?.id ?? null);
  if (!key) return;
  const next = { ...readPersistedUi(), ...patch };
  cached = next;
  cachedKey = key;
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore quota / private browsing
  }
}

export function readPersistedViewport(boardKey: string): PersistedViewport | null {
  const viewport = readPersistedUi().viewport;
  return viewport?.boardKey === boardKey ? viewport : null;
}

export function writePersistedViewport(boardKey: string, scale: number, panX: number, panY: number) {
  writePersistedUi({ viewport: { boardKey, scale, panX, panY } });
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist(snapshot: () => Partial<PersistedUi>) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => writePersistedUi(snapshot()), 150);
}

export type UiPersistRefs = {
  boardSelection: Ref<BoardSelection | null>;
  selectedSheetId: Ref<string | null>;
  selectedMapId: Ref<string | null>;
  selectedFactionId: Ref<FactionId | null>;
  selectedTableId: Ref<ReconTableId | null>;
  dataCategory: Ref<DataCategory | null>;
  dataFocus: Ref<DataFocus | null>;
  dataFocusReturnCategory: Ref<DataCategory | null>;
  dataCategoryReturnFactionId: Ref<FactionId | null>;
  activeTab: Ref<RightPanelTab>;
  activeMainTab: Ref<MainSectionTab>;
  sheetsExpanded: Ref<boolean>;
  dataExpanded: Ref<boolean>;
  mapsExpanded: Ref<boolean>;
  factionsExpanded: Ref<boolean>;
  tablesExpanded: Ref<boolean>;
  snapshotGmTools: () => PersistedGmTools;
  applyGmTools: (gm: PersistedGmTools) => void;
  gmToolsWatchSources: Ref<unknown>[];
};

export function applyPersistedUiState(refs: UiPersistRefs, persisted: PersistedUi = readPersistedUi()) {
  refs.boardSelection.value = persisted.boardSelection;
  refs.selectedSheetId.value = persisted.selectedSheetId;
  refs.selectedMapId.value = persisted.selectedMapId;
  refs.selectedFactionId.value = persisted.selectedFactionId;
  refs.selectedTableId.value = persisted.selectedTableId;
  refs.dataCategory.value = persisted.dataCategory;
  refs.dataFocus.value = persisted.dataFocus;
  refs.dataFocusReturnCategory.value = persisted.dataFocusReturnCategory;
  refs.dataCategoryReturnFactionId.value = persisted.dataCategoryReturnFactionId;
  refs.activeTab.value = persisted.activeTab;
  refs.activeMainTab.value = persisted.activeMainTab;
  refs.sheetsExpanded.value = persisted.sheetsExpanded;
  refs.dataExpanded.value = persisted.dataExpanded;
  refs.mapsExpanded.value = persisted.mapsExpanded;
  refs.factionsExpanded.value = persisted.factionsExpanded;
  refs.tablesExpanded.value = persisted.tablesExpanded;
  refs.applyGmTools(persisted.gmTools);
}

export function initUiPersistence(opts: UiPersistRefs) {
  const {
    boardSelection,
    selectedSheetId,
    selectedMapId,
    selectedFactionId,
    selectedTableId,
    dataCategory,
    dataFocus,
    dataFocusReturnCategory,
    dataCategoryReturnFactionId,
    activeTab,
    activeMainTab,
    sheetsExpanded,
    dataExpanded,
    mapsExpanded,
    factionsExpanded,
    tablesExpanded,
    snapshotGmTools,
    applyGmTools,
    gmToolsWatchSources,
  } = opts;

  const refs: UiPersistRefs = {
    boardSelection,
    selectedSheetId,
    selectedMapId,
    selectedFactionId,
    selectedTableId,
    dataCategory,
    dataFocus,
    dataFocusReturnCategory,
    dataCategoryReturnFactionId,
    activeTab,
    activeMainTab,
    sheetsExpanded,
    dataExpanded,
    mapsExpanded,
    factionsExpanded,
    tablesExpanded,
    snapshotGmTools,
    applyGmTools,
    gmToolsWatchSources,
  };

  watch(
    [role, playerProfile],
    () => {
      invalidateCache();
      applyPersistedUiState(refs);
    },
    { deep: true },
  );

  watch(
    [
      boardSelection,
      selectedSheetId,
      selectedMapId,
      selectedFactionId,
      selectedTableId,
      dataCategory,
      dataFocus,
      dataFocusReturnCategory,
      dataCategoryReturnFactionId,
      activeTab,
      activeMainTab,
      sheetsExpanded,
      dataExpanded,
      mapsExpanded,
      factionsExpanded,
      tablesExpanded,
      ...gmToolsWatchSources,
    ],
    () => {
      schedulePersist(() => ({
        boardSelection: boardSelection.value,
        selectedSheetId: selectedSheetId.value,
        selectedMapId: selectedMapId.value,
        selectedFactionId: selectedFactionId.value,
        selectedTableId: selectedTableId.value,
        dataCategory: dataCategory.value,
        dataFocus: dataFocus.value,
        dataFocusReturnCategory: dataFocusReturnCategory.value,
        dataCategoryReturnFactionId: dataCategoryReturnFactionId.value,
        activeTab: activeTab.value,
        activeMainTab: activeMainTab.value,
        sheetsExpanded: sheetsExpanded.value,
        dataExpanded: dataExpanded.value,
        mapsExpanded: mapsExpanded.value,
        factionsExpanded: factionsExpanded.value,
        tablesExpanded: tablesExpanded.value,
        gmTools: snapshotGmTools(),
      }));
    },
    { deep: true },
  );
}
