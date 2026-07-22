<script setup lang="ts">
import { GORGENAUT_AGNOSIA_BOX, getEquipmentAttackSpec, collectEquipmentPatternTiles, isHylicAnnihilationCorridor, areOrthogonallyConnected, listRedirectableEnemyAttackIndices, rejectionFieldTileKeys, forceProjectionTileKeys, redirectionSourceTileKeys, isTowerEnemy, yadathanPlacementKeys, towerTeleportLandingKeys, kataptyTargetKeys, keraunoAdjacentEnemyIds, getPlayerTower, TOWER_IATROS, buildSwarmGroups, canSwarmMemberReachDest, getSwarmMemberHp, getSwarmMaxHp, swarmGroupForEnemy, swarmFringeTiles, pickSwarmMoveMember, getSwarmMovementRemaining, swarmCanonicalDisplayId, getEffectiveEnemyHp, getEffectiveEnemyMaxHp, weaponHasBreakerTag, attackTargetsSwarm, flowerbudPlantTiles, tileIsStained, swarmChipEligibleTargets, swarmChipPromptRequired, swarmMembersHitByTiles, maxSwarmStrikesAgainstTarget, type SwarmChipTarget } from "@vtt-core/hellpiercers-content/combat-ui";
import type { EffectStacks, Enemy, MapTile, PatternDirection, Player, PlayerAction, TerrainObject } from "@vtt-core/shared";
import { boardCellKey, buildBoardOccupancy, canGmMoveEnemies, canPlayerMove, coordKey, coordsToKeySet, drawableExpansionOptions, ensureEnemyMovement, enemyFootprintTiles, fixedPatternTilesInBounds, findPlayerMovementPath, formlessLandingTiles, formlessTargetTileKeys, getEnemyMaxHp, getEnemyScale, getEnemyScaleByName, agnosiaCenteredHover, getObstacleHp, getPlayerMaxHp, isMovementStepAdjacent, isObstacleTile, isPlayerDowned, isSandboxMode, isHealAttackSpec, isRangeTargetAttack, isRangedPatternAttack, isWalkable, isInBounds, manhattanDistance, movementStepCost, stepMoveCost, enemyMoveStepCost, isFlyingStepReachable, aegisFlyingRemaining, playerAllowsDiagonalMovement, playerAttackDirectionsAt, evaluateAnchoredPatternPlacement, evaluateOmnistrikePlacement, computeOmnistrikeRangeSpan, collectBombPatternTiles, unionPatternTiles, resolveBombAttackSpec, isDirectTargetEnemyAttack, isSelectTargetEnemyAttack, isPatternEnemyAttack, enemyAttackPatternOptionsAt, enemyPatternOrigins, enemyDirectAttackTargetEnemyIds, PATTERN_DIRECTIONS, rangeAttackTileKeys, rangeTargetDistance, rangeTargetMax, rangedPatternPlacementKeys, recoilTilesInBounds, resolveCombatAttackSpec, tileAt, usesAnchoredPatternPlacement, patternOriginFromAnchor, validateEnemyFootprint, validateGmForceMove, warhookAdjacentLandingTiles, warhookNearestLandings, warhookRangeKeys, warhookValidTargetKeys, isWarhookTargetAt, isFortificationEnemy, getArmorByName, getWeaponAttackSpec, hasLineOfSight, outOfLineOfSightTileKeys, tilesOnCardinalLine, tilesOnSegment, visibleEnemyIds, getEnemyAttack, getEnemyListingByName, collectAttackTiles, elevationBonusTileCandidates, enemyDirectAttackTargetPlayerIds, isSethianWeaponName, SETHIAN_DAMAGE_CAP, previewPathProvokes, previewEnemyMoveProvokes, previewSprintProvokes, assistedLaunchAnchors, computeAssistedLaunch, tilesInAttractorZone, hasTileEffects, formatTileEffectTooltipLabel, terrainTypeDisplayName, type ProvokeTrigger, computeAttackPreviewHighlights, type AttackPreviewState } from "@vtt-core/shared";
import { computed, onMounted, onUnmounted, provide, ref, shallowRef, watch } from "vue";

import { routesTokenClickToCellTargeting } from "../lib/boardCellTargeting.js";
import { boardCellMetrics, buildElevationContourPaths } from "../lib/elevationContours.js";
import { useBoardActionMode } from "../composables/useBoardActionMode.js";
import { useCombatActions } from "../composables/useCombatActions.js";
import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useBoardViewport } from "../composables/useBoardViewport.js";
import { useDamageIndicators } from "../composables/useDamageIndicators.js";
import { useEnemyDeathAnimations } from "../composables/useEnemyDeathAnimations.js";
import { useEnemyMoveAnimation } from "../composables/useEnemyMoveAnimation.js";
import { usePlayerTeleportAnimation } from "../composables/usePlayerTeleportAnimation.js";
import { useCharacterSheets } from "../composables/useCharacterSheets.js";
import { useEnemySpawnSelection } from "../composables/useEnemySpawnSelection.js";
import { useStainGeyserPlacement, useGorgenautAgnosiaPlacement } from "@vtt-core/hellpiercers-content/combat-board-placement";
import { clearActiveTool, useGmTools } from "../composables/useGmTools.js";
import { gmToolCursor } from "../lib/gmToolCursors.js";
import { showToast } from "../composables/useToasts.js";
import { usePortraitCache } from "../composables/usePortraitCache.js";
import { useTileAppearanceCache } from "../composables/useTileAppearanceCache.js";
import { useApi } from "../composables/useApi.js";
import { useEnemyPortraitColors } from "../composables/useEnemyPortraitColors.js";
import { useGameConnection } from "../composables/useGameConnection.js";
import { useGameState } from "../composables/useGameState.js";
import { useInfoDataSelection } from "../composables/useInfoDataSelection.js";
import {
  consumeSuppressMapPingClick,
  useMapPing,
} from "../composables/useMapPing.js";
import { usePatternSelection } from "../composables/usePatternSelection.js";
import { usePlayerSettings } from "../composables/usePlayerSettings.js";
import { getClientCombatBoard } from "../client-content-pack.js";
import { combatBoardHostKey } from "../composables/useCombatBoardHost.js";
import BoardCell, { type CellRenderState } from "./BoardCell.vue";
import BoardContextMenu, { type BoardContextMenuItem } from "./BoardContextMenu.vue";
import AddEffectModal from "./AddEffectModal.vue";
import AddTileEffectModal from "./AddTileEffectModal.vue";
import ChangeTileTerrainModal from "./ChangeTileTerrainModal.vue";
import ProvokePromptModal from "./ProvokePromptModal.vue";
import TargetPickerModal, { type TargetPickerEnemy } from "./TargetPickerModal.vue";

const props = defineProps<{
  role: "gm" | "player";
  gmCapabilities?: boolean;
  playerProfile?: { id: string; name: string } | null;
  overlayEl?: HTMLElement | null;
}>();

const canUseGmTools = computed(() => props.role === "gm" || props.gmCapabilities === true);

const { taccomPings, beginMapPingHold } = useMapPing();

const {
  boardSelection,
  selectedEnemyId,
  clearBoardSelection,
  selectBoardPlayer,
  selectBoardEnemy,
  selectBoardEnemyMember,
  toggleBoardEnemy,
  isPlayerSelected,
  isEnemySelected,
  isSoloSwarmMemberSelected,
} = useBoardSelection();

const selectedPlayerId = computed(() =>
  boardSelection.value?.kind === "player" ? boardSelection.value.id : null,
);
const { connection } = useGameConnection();
const { gameState, yourPlayerId, send } = useGameState();
const boardLoadingMessage = computed(() => {
  if (connection.value === "connecting") return "Connecting to game server…";
  if (connection.value === "connected") return "Joining session…";
  return "Disconnected…";
});
const activePlayerSelected = computed(() => {
  const id = yourPlayerId.value;
  if (!id) return false;
  if (!selectedPlayerId.value) return true;
  return selectedPlayerId.value === id;
});
const { showHealthBars, showLineOfSightIndicator, showElevationContours } = usePlayerSettings();
const showEnemyHealthBars = computed(() => showHealthBars.value && canUseGmTools.value);
const { indicators: damageIndicators } = useDamageIndicators(gameState);
const { sheets, loadSheets } = useCharacterSheets();
const boardPlayers = computed(() => gameState.value?.players);
const { portraitUrlFor } = usePortraitCache(sheets, boardPlayers);
const { tileAppearanceUrlFor } = useTileAppearanceCache(gameState);
const { enemyPortraitUrlForName } = useApi();
const { portraitBackgroundFor } = useEnemyPortraitColors();
const { dataCategory } = useInfoDataSelection();
const { selectedSpawnEnemyName, clearSpawnEnemySelection } = useEnemySpawnSelection();
const {
  STAIN_GEYSER_NAME,
  stainGeyserPlacementActive,
  stainGeyserPreviewTiles,
  stainGeyserPreviewKeys,
  stainGeyserPreviewOverlayUrl,
  beginStainGeyserPlacement,
  clearStainGeyserPlacement,
  setStainGeyserHover,
  tryApplyStainGeyserPlacement,
} = useStainGeyserPlacement();
const {
  pendingGorgenautAgnosiaEnemyId,
  gorgenautAgnosiaPlacementActive,
  gorgenautAgnosiaPreviewTiles,
  gorgenautAgnosiaPreviewKeys,
  gorgenautAgnosiaPreviewOverlayUrl,
  setGorgenautAgnosiaHover,
  tryApplyGorgenautAgnosiaPlacement,
} = useGorgenautAgnosiaPlacement();
const {
  activeTool: gmActiveTool,
  effectiveActiveTool: gmEffectiveActiveTool,
  selectTargetKind: gmSelectTargetKind,
  selectSameEnemyType: gmSelectSameEnemyType,
  bulkSelection: gmBulkSelection,
  setBulkSelection: setGmBulkSelection,
  clearBulkSelection: clearGmBulkSelection,
  isTileBulkSelected,
  isPlayerBulkSelected,
  isEnemyBulkSelected,
  isCellInBulkSelection,
  applyDamageEffectToToken,
  applyPaintbrushToTile,
  queuePaintbrushDragTile,
  endPaintbrushDrag,
  samplePaintbrushFromTile,
  paintbrushEyedropperActive,
  setPaintbrushEyedropperActive,
  setPaintbrushSelectHeld,
  cyclePaintbrushImageRotation,
  togglePaintbrushImageFlip,
  paintbrushEnableColor,
  paintbrushEnableAppearance,
  paintbrushEnableOverlay,
  paintbrushEnableFeature,
  paintbrushEnableAppearanceTint,
  paintbrushEnableOverlayTint,
  paintbrushEnableFeatureTint,
  paintbrushEnableRotation,
  paintbrushEnableFlip,
  paintbrushBaseColor,
  paintbrushAppearanceTint,
  paintbrushOverlayTint,
  paintbrushFeatureTint,
  paintbrushImageRotation,
  paintbrushImageFlip,
  peekPaintbrushPlacement,
  paintbrushSuppressPreviewKey,
  clearPaintbrushSuppressPreview,
  paintbrushDragStickyPreviews,
  paintbrushAutoRotate,
} = useGmTools();

const gmViewportCursor = computed(() => {
  if (!canUseGmTools.value || !gmEffectiveActiveTool.value) return null;
  if (gmEffectiveActiveTool.value === "paintbrush" && paintbrushEyedropperActive.value) {
    return gmToolCursor("eyedropper");
  }
  return gmToolCursor(gmEffectiveActiveTool.value);
});

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (el as HTMLInputElement).type;
  return (
    type !== "checkbox" &&
    type !== "radio" &&
    type !== "button" &&
    type !== "submit" &&
    type !== "reset" &&
    type !== "file"
  );
}

// The paintbrush pointerdown handler already paints the start cell (and handles
// drag-paint); the trailing native click on that same cell would otherwise paint
// it again, re-resolving a new random pick/rotation that no longer matches the
// preview. Suppress that trailing click.
let suppressPaintbrushClickAfterPointerDown = false;

function handlePaintbrushCellAction(x: number, y: number) {
  if (suppressPaintbrushClickAfterPointerDown) {
    suppressPaintbrushClickAfterPointerDown = false;
    return;
  }
  if (paintbrushEyedropperActive.value) samplePaintbrushFromTile(x, y);
  else applyPaintbrushToTile(x, y);
}

const {
  selectedPatternId,
  selectedPattern,
  patternSize,
  patternDirection,
  wallLopsidedExtra,
  modifierValues,
  drawnTiles,
  isDrawablePattern,
  tryExtendDrawing,
  cyclePatternDirection,
  setPatternHoverOrigin,
} = usePatternSelection();

const {
  mode: boardActionMode,
  attackDirection,
  attackAimed,
  attackAnchor,
  elevBonusTile,
  rangeAttackTargetIds,
  rangeAttackObstacleCoords,
  pendingTargetEnemyId,
  armorPush,
  omnistrikeStep,
  omnistrikeBombs,
  omnistrikeAnchors,
  warhookStep,
  warhookTarget,
  warhookLandingOptions,
  towerTeleportStep,
  towerTeleportLanding,
  kataptyTargetIds,
  borrowAllyId,
  assistedLaunchStep,
  assistedLaunchAnchor,
  equipmentCoverTiles,
  forceProjectionOrigin,
  forceProjectionStep,
  redirectSourceEnemyId,
  redirectAttackIndex,
  redirectStep,
  gmEnemyAttack,
  clearMode: clearBoardActionMode,
  rotateAttackDirection,
  registerRangeAttackConfirm,
  unregisterRangeAttackConfirm,
} = useBoardActionMode();
const { sendPlayerAction, sendMovePath, pendingReaction, reversalExtraAllyIds } = useCombatActions();

const hoveredKey = ref<string | null>(null);
const hoveredCell = ref<{ x: number; y: number } | null>(null);
const previewHoverCell = ref<{ x: number; y: number } | null>(null);
let previewHoverTimer: ReturnType<typeof setTimeout> | null = null;
watch(hoveredCell, (cell) => {
  if (previewHoverTimer) clearTimeout(previewHoverTimer);
  if (!cell) {
    previewHoverCell.value = null;
    return;
  }
  previewHoverTimer = setTimeout(() => {
    previewHoverCell.value = cell;
  }, 32);
});
const draggingDeploy = ref(false);
const contextMenu = ref<{
  open: boolean;
  x: number;
  y: number;
  items: BoardContextMenuItem[];
  enemyId?: string;
  playerId?: string;
  cellX?: number;
  cellY?: number;
}>({ open: false, x: 0, y: 0, items: [] });
const effectModalOpen = ref(false);
const effectModalTarget = ref<{ kind: "player" | "enemy"; id: string } | null>(null);
const effectModalBulkTargets = ref<{ kind: "player" | "enemy"; id: string }[] | undefined>(
  undefined,
);
const tileEffectModalOpen = ref(false);
const tileEffectModalCoords = ref<{ x: number; y: number } | null>(null);
const tileEffectModalBulkCoords = ref<{ x: number; y: number }[] | undefined>(undefined);
const tileTerrainModalOpen = ref(false);
const tileTerrainModalCoords = ref<{ x: number; y: number } | null>(null);
const tileTerrainModalBulkCoords = ref<{ x: number; y: number }[] | undefined>(undefined);
const marqueeActive = ref(false);
const marqueeStart = ref<{ x: number; y: number } | null>(null);
const marqueeEnd = ref<{ x: number; y: number } | null>(null);
const MARQUEE_DRAG_THRESHOLD_PX = 6;
// A marquee drag across cells emits a trailing click on the board container,
// which would otherwise clear the selection we just made; suppress that click.
let suppressViewportClickAfterMarquee = false;
const viewportEl = ref<HTMLElement | null>(null);

const boardWidthPx = computed(() => {
  const s = gameState.value;
  if (!s) return 520;
  return Math.max(s.width * 40, 280);
});

const hasGameState = computed(() => !!gameState.value);
const boardWidth = computed(() => gameState.value?.width ?? 1);
const boardHeight = computed(() => gameState.value?.height ?? 1);
const boardKey = computed(() =>
  gameState.value ? `${gameState.value.mapId}:${gameState.value.width}x${gameState.value.height}` : null,
);
const contentHeightPx = computed(() =>
  boardWidthPx.value * (boardHeight.value / boardWidth.value),
);

const overlayInsetPx = ref(0);
let overlayInsetObserver: ResizeObserver | null = null;

function updateOverlayInset() {
  overlayInsetPx.value = props.overlayEl?.offsetHeight ?? 0;
}

watch(
  () => props.overlayEl,
  (el, prev) => {
    if (overlayInsetObserver) {
      overlayInsetObserver.disconnect();
      overlayInsetObserver = null;
    }
    if (prev && prev !== el) overlayInsetPx.value = 0;
    if (!el) return;
    overlayInsetObserver = new ResizeObserver(updateOverlayInset);
    overlayInsetObserver.observe(el);
    updateOverlayInset();
  },
  { flush: "post" },
);

const {
  scale,
  panX,
  panY,
  stageStyle,
  isTransformed,
  fitToView,
  onWheel,
  observeViewport,
  disconnect: disconnectViewport,
} = useBoardViewport(
  viewportEl,
  boardWidthPx,
  contentHeightPx,
  hasGameState,
  boardKey,
  overlayInsetPx,
);

function finalizeDefeatedEnemy(enemyId: string) {
  const s = gameState.value;
  if (!s?.enemies.some((e) => e.id === enemyId)) return;
  send({ type: "removeEnemy", enemyId });
}

const { isEnemyDying, isEnemyDefeated, isEnemyPendingRemoval } =
  useEnemyDeathAnimations(gameState, finalizeDefeatedEnemy);
const {
  active: teleportAnimation,
  teleportingPlayerIds,
  startTeleport,
  finishTeleport,
} = usePlayerTeleportAnimation(gameState);
const {
  active: enemyMoveAnimation,
  animatingEnemyId,
  startMove: startEnemyMove,
  finishMove: finishEnemyMove,
} = useEnemyMoveAnimation(gameState);
const enemyMoveOverlayAtDest = ref(false);
const breakerPromptOpen = ref(false);
const pendingAttackAction = ref<Extract<PlayerAction, { action: "attack" }> | null>(null);
const provokePromptOpen = ref(false);
const provokeTriggers = ref<ProvokeTrigger[]>([]);
const pendingProvokeMove = ref<(() => void) | null>(null);
const swarmChipOpen = ref(false);
const swarmChipEnemyId = ref<string | null>(null);
const swarmChipTargets = ref<SwarmChipTarget[]>([]);
const swarmAttackModalOpen = ref(false);
const swarmAttackPending = ref<{
  enemyId: string;
  attackIndex: number;
  targetPlayerId: string;
  damage?: number;
} | null>(null);
const targetPickerOpen = ref(false);
const targetPickerEnemies = ref<TargetPickerEnemy[]>([]);
const targetPickerMaxSelectable = ref(1);
const targetPickerPreSelectedIds = ref<string[]>([]);
const targetPickerTileIds = ref<string[]>([]);

function closeTargetPicker() {
  targetPickerOpen.value = false;
  targetPickerEnemies.value = [];
  targetPickerPreSelectedIds.value = [];
  targetPickerTileIds.value = [];
}

function maybePromptSwarmChip(enemyId: string) {
  if (props.role !== "gm") return;
  const s = gameState.value;
  if (!s || !canGmMoveEnemies(s)) return;
  const enemy = s.enemies.find((e) => e.id === enemyId);
  if (!enemy || enemy.exhausted || isTowerEnemy(enemy)) return;
  if (!swarmChipPromptRequired(s, enemyId)) return;
  const group = swarmGroupForEnemy(s, enemyId)!;
  swarmChipEnemyId.value = group.canonicalId;
  swarmChipTargets.value = swarmChipEligibleTargets(s, enemyId);
  swarmChipOpen.value = true;
}

function ensureSwarmChipResolved(enemyId: string): boolean {
  const s = gameState.value;
  if (!s || !swarmChipPromptRequired(s, enemyId)) return true;
  maybePromptSwarmChip(enemyId);
  return false;
}

watch(selectedEnemyId, (id) => {
  if (id) maybePromptSwarmChip(id);
});

const breakerSethianHint = computed(() => {
  const action = pendingAttackAction.value;
  const s = gameState.value;
  const ctx = attackContext.value;
  if (!action || !s || !ctx || !isSethianWeaponName(ctx.weapon)) return undefined;
  const tiles = attackTilesForAction(action);
  const hits = swarmMembersHitByTiles(s, tiles).length;
  if (!hits) return undefined;
  return `Attack as whole: damage × ${hits} pattern square${hits === 1 ? "" : "s"} (max ${SETHIAN_DAMAGE_CAP} total).`;
});

function gateProvoke(triggers: ProvokeTrigger[], action: () => void) {
  if (!triggers.length) {
    action();
    return;
  }
  provokeTriggers.value = triggers;
  pendingProvokeMove.value = action;
  provokePromptOpen.value = true;
}

function onProvokeConfirm() {
  pendingProvokeMove.value?.();
  pendingProvokeMove.value = null;
  provokePromptOpen.value = false;
  provokeTriggers.value = [];
}

function onProvokeCancel() {
  pendingProvokeMove.value = null;
  provokePromptOpen.value = false;
  provokeTriggers.value = [];
}

function onSwarmChipConfirm(targetPlayerIds: string[]) {
  const enemyId = swarmChipEnemyId.value;
  if (!enemyId) return;
  send({
    type: "gmEnemyAction",
    action: { action: "swarmChip", enemyId, targetPlayerIds },
  });
  swarmChipOpen.value = false;
}

function onSwarmChipClose() {
  swarmChipOpen.value = false;
}

const swarmChipEnemyName = computed(() => {
  const s = gameState.value;
  const id = swarmChipEnemyId.value;
  if (!s || !id) return "Swarm";
  return s.enemies.find((e) => e.id === id)?.name ?? "Swarm";
});

const swarmAttackModalProps = computed(() => {
  const pending = swarmAttackPending.value;
  const s = gameState.value;
  if (!pending || !s) return null;
  const player = s.players.find((p) => p.id === pending.targetPlayerId);
  const enemy = s.enemies.find((e) => e.id === pending.enemyId);
  const attackEntry = getEnemyAttack(enemy?.name, pending.attackIndex);
  const maxStrikes = player ? maxSwarmStrikesAgainstTarget(s, pending.enemyId, player) : 0;
  return {
    enemyId: pending.enemyId,
    attackIndex: pending.attackIndex,
    attackText: attackEntry?.text ?? "",
    attackSpec: attackEntry?.attack,
    targetPlayerId: pending.targetPlayerId,
    targetPlayerName: player?.nickname ?? player?.id ?? "Player",
    maxStrikes,
    damageOverride: pending.damage,
  };
});

const combatBoard = getClientCombatBoard();
provide(combatBoardHostKey, {
  breakerPromptOpen,
  breakerSethianHint,
  onBreakerConfirm,
  onBreakerCancel,
  swarmChipOpen,
  swarmChipEnemyName,
  swarmChipTargets,
  onSwarmChipConfirm,
  onSwarmChipClose,
  swarmAttackModalOpen,
  swarmAttackModalProps,
  onSwarmAttackConfirm,
  onSwarmAttackClose,
});

const teleportOverlayAtDest = ref(false);

const gridStyle = computed(() => {
  const s = gameState.value;
  if (!s) return {};
  return {
    gridTemplateColumns: `repeat(${s.width}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${s.height}, minmax(0, 1fr))`,
    width: `${boardWidthPx.value}px`,
  };
});

const cellsCache = shallowRef<{ x: number; y: number; key: string }[]>([]);
const cellsCacheKey = ref<string | null>(null);

const cells = computed(() => {
  const s = gameState.value;
  if (!s) return [] as { x: number; y: number; key: string }[];
  const key = `${s.mapId}:${s.width}x${s.height}`;
  if (cellsCacheKey.value === key && cellsCache.value.length > 0) {
    return cellsCache.value;
  }
  const out: { x: number; y: number; key: string }[] = [];
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      out.push({ x, y, key: boardCellKey(x, y) });
    }
  }
  // Intentional memoization cache: only rebuilt when the board dimensions key
  // changes, avoiding reallocating the cell list on every unrelated state tick.
  // eslint-disable-next-line vue/no-side-effects-in-computed-properties
  cellsCache.value = out;
  // eslint-disable-next-line vue/no-side-effects-in-computed-properties
  cellsCacheKey.value = key;
  return out;
});

const boardAspectRatio = computed(() => {
  const s = gameState.value;
  if (!s) return "1 / 1";
  return `${s.width} / ${s.height}`;
});

const patternPreviewActive = computed(
  () => dataCategory.value === "patterns" && !!selectedPatternId.value,
);

const patternOrigin = computed(() => {
  if (!hoveredKey.value) return null;
  const [x, y] = hoveredKey.value.split("-").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
});

const patternPrimaryKeys = computed(() => {
  if (!patternPreviewActive.value || !gameState.value) return new Set<string>();

  if (isDrawablePattern.value) {
    if (drawnTiles.value.length === 0) return new Set<string>();
    return coordsToKeySet(drawnTiles.value);
  }

  const origin = patternOrigin.value;
  if (!origin) return new Set<string>();

  return coordsToKeySet(
    fixedPatternTilesInBounds(
      selectedPatternId.value!,
      origin,
      patternSize.value,
      patternDirection.value,
      gameState.value.width,
      gameState.value.height,
      {
        ringGap:
          selectedPatternId.value === "ring" && modifierValues.value.range > 0
            ? modifierValues.value.range
            : (selectedPattern.value?.defaultRange ?? 1),
        lopsidedExtra: wallLopsidedExtra.value,
        modifiers: modifierValues.value,
      },
    ),
  );
});

const isHealAttackSpecActive = computed(() => {
  const ctx = attackContext.value;
  return ctx ? isHealAttackSpec(ctx.spec) : false;
});

const rezTargetKeys = computed(() => {
  if (boardActionMode.value !== "rez") return new Set<string>();
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return new Set<string>();
  const keys = new Set<string>();
  for (const player of s.players) {
    if (player.id === me.id) continue;
    if ((player.hp ?? 0) > 0) continue;
    if (Math.abs(player.x - me.x) + Math.abs(player.y - me.y) !== 1) continue;
    keys.add(coordKey(player.x, player.y));
  }
  return keys;
});

const anchoredPlacementPreview = computed(() => {
  if (!isWeaponAttackMode.value) return null;
  const ctx = attackContext.value;
  const s = gameState.value;
  if (!ctx || !s || !usesAnchoredPatternPlacement(ctx.spec)) return null;
  const anchor = attackAimed.value ? attackAnchor.value : previewHoverCell.value;
  if (!anchor) return null;
  const user = ctx.origin ?? { x: ctx.me.x, y: ctx.me.y };
  return evaluateAnchoredPatternPlacement(
    user,
    anchor,
    ctx.spec,
    attackDirection.value,
    s,
  );
});

const omnistrikePlacementPreview = computed(() => {
  const step = omnistrikeStep.value;
  if (boardActionMode.value !== "omnistrike" || step === "selectBombs" || step === "confirm") {
    return null;
  }
  const ctx = omnistrikeContext.value;
  const s = gameState.value;
  if (!ctx || !s) return null;
  const anchor = previewHoverCell.value;
  if (!anchor) return null;

  if (step === "placeFirst") {
    return evaluateOmnistrikePlacement(ctx.me, anchor, ctx.bombA, attackDirection.value, s);
  }

  const firstAnchor = omnistrikeAnchors.value[0];
  if (!firstAnchor) return null;
  const firstTiles = collectBombPatternTiles(s, firstAnchor, ctx.bombA, attackDirection.value);
  return evaluateOmnistrikePlacement(
    ctx.me,
    anchor,
    ctx.bombB,
    attackDirection.value,
    s,
    firstTiles,
  );
});

const omnistrikeLockedFirstKeys = computed(() => {
  const ctx = omnistrikeContext.value;
  const s = gameState.value;
  const anchor = omnistrikeAnchors.value[0];
  if (
    boardActionMode.value !== "omnistrike" ||
    !ctx ||
    !s ||
    !anchor ||
    omnistrikeStep.value === "selectBombs" ||
    omnistrikeStep.value === "placeFirst"
  ) {
    return new Set<string>();
  }
  return coordsToKeySet(collectBombPatternTiles(s, anchor, ctx.bombA, attackDirection.value));
});

const omnistrikePrimaryKeys = computed(() => {
  if (boardActionMode.value !== "omnistrike" || omnistrikeStep.value !== "confirm") {
    return new Set<string>();
  }
  const ctx = omnistrikeContext.value;
  const s = gameState.value;
  const anchorA = omnistrikeAnchors.value[0];
  const anchorB = omnistrikeAnchors.value[1];
  if (!ctx || !s || !anchorA || !anchorB) return new Set<string>();
  const tilesA = collectBombPatternTiles(s, anchorA, ctx.bombA, attackDirection.value);
  const tilesB = collectBombPatternTiles(s, anchorB, ctx.bombB, attackDirection.value);
  return coordsToKeySet(unionPatternTiles(tilesA, tilesB));
});

const omnistrikeSecondaryKeys = computed(() => {
  if (boardActionMode.value !== "omnistrike") return new Set<string>();
  const step = omnistrikeStep.value;
  if (step === "confirm") return new Set<string>();
  if (step === "selectBombs") return new Set<string>();

  const preview = omnistrikePlacementPreview.value;
  if (preview && (step === "placeFirst" || step === "placeSecond")) {
    const keys = coordsToKeySet(preview.patternTiles);
    for (const key of omnistrikeLockedFirstKeys.value) keys.add(key);
    return keys;
  }
  return omnistrikeLockedFirstKeys.value;
});

const omnistrikeInvalidKeys = computed(() => {
  if (boardActionMode.value !== "omnistrike") return new Set<string>();
  const step = omnistrikeStep.value;
  if (step !== "placeFirst" && step !== "placeSecond") return new Set<string>();
  const preview = omnistrikePlacementPreview.value;
  if (!preview) return new Set<string>();
  if (preview.tooFar) return coordsToKeySet(preview.patternTiles);
  if (!preview.adjacentToOther && step === "placeSecond") {
    return coordsToKeySet(preview.patternTiles);
  }
  return preview.tooCloseKeys;
});

const warhookPrimaryKeys = computed(() => {
  if (boardActionMode.value !== "warhook") return new Set<string>();
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return new Set<string>();
  if (warhookStep.value === "selectLanding" && warhookTarget.value) {
    return new Set([coordKey(warhookTarget.value.x, warhookTarget.value.y)]);
  }
  return warhookValidTargetKeys(s, me);
});

const warhookSecondaryKeys = computed(() => {
  if (boardActionMode.value !== "warhook") return new Set<string>();
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return new Set<string>();
  if (warhookStep.value === "selectLanding") {
    return coordsToKeySet(warhookLandingOptions.value);
  }
  return warhookRangeKeys(s, me);
});

const armorPlaceTowerKeys = computed(() => {
  if (boardActionMode.value !== "armorPlaceTower") return new Set<string>();
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return new Set<string>();
  const armor = getArmorByName(me.armor ?? "");
  const structured = armor?.armorActionStructured;
  if (!structured || structured.kind !== "place_tower") return new Set<string>();
  return yadathanPlacementKeys(s, me, structured.range);
});

const armorPushTargetKeys = computed(() => {
  if (boardActionMode.value !== "armorPush") return new Set<string>();
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return new Set<string>();
  const keys = formlessTargetTileKeys(s, me.x, me.y);
  for (const p of s.players) {
    if (p.id !== me.id && Math.abs(p.x - me.x) + Math.abs(p.y - me.y) === 1) {
      keys.add(coordKey(p.x, p.y));
    }
  }
  return keys;
});

const armorTeleportTargetKeys = computed(() => {
  if (boardActionMode.value !== "armorTeleport" || pendingTargetEnemyId.value) return new Set<string>();
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return new Set<string>();
  return formlessTargetTileKeys(s, me.x, me.y);
});

const armorTeleportLandingKeys = computed(() => {
  if (boardActionMode.value !== "armorTeleport" || !pendingTargetEnemyId.value) return new Set<string>();
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return new Set<string>();
  return coordsToKeySet(formlessLandingTiles(s, me.id, pendingTargetEnemyId.value));
});

const classAbilityPrimaryKeys = computed(() => {
  const keys = new Set<string>();
  const m = boardActionMode.value;
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return keys;
  if (m === "kopisMark") {
    const visible = new Set(visibleEnemyIds(s, me.id));
    for (const e of s.enemies) {
      if (visible.has(e.id)) keys.add(coordKey(e.x, e.y));
    }
  }
  if (m === "chrysaorBrand") {
    const visible = new Set(visibleEnemyIds(s, me.id));
    for (const e of s.enemies) {
      if (visible.has(e.id)) keys.add(coordKey(e.x, e.y));
    }
    for (const p of s.players) {
      if (p.id === me.id) continue;
      if (hasLineOfSight(s, me.x, me.y, p.x, p.y, { viewer: me, target: p })) {
        keys.add(coordKey(p.x, p.y));
      }
    }
    for (const tile of s.tiles) {
      if (!isObstacleTile(tile)) continue;
      if (hasLineOfSight(s, me.x, me.y, tile.x, tile.y, { viewer: me })) {
        keys.add(coordKey(tile.x, tile.y));
      }
    }
  }
  if (m === "hephaestusSynesis") {
    for (const key of formlessTargetTileKeys(s, me.x, me.y)) keys.add(key);
  }
  if (m === "varunastraBorrow" && !borrowAllyId.value) {
    for (const p of s.players) {
      if (p.id !== me.id && p.weapon) keys.add(coordKey(p.x, p.y));
    }
  }
  if (m === "hephaestusRestore") {
    for (const p of s.players) {
      if (p.id !== me.id && Math.abs(p.x - me.x) + Math.abs(p.y - me.y) === 1) {
        keys.add(coordKey(p.x, p.y));
      }
    }
  }
  return keys;
});

const classAbilitySecondaryKeys = computed(() => {
  const keys = new Set<string>();
  const m = boardActionMode.value;
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return keys;
  if (m === "sharurAttractor" || m === "harpeTrap") {
    for (const tile of s.tiles) {
      const dist = Math.abs(tile.x - me.x) + Math.abs(tile.y - me.y);
      if (m === "sharurAttractor" && dist <= 4 && dist >= 1) keys.add(coordKey(tile.x, tile.y));
      if (m === "harpeTrap") {
        const dx = Math.sign(tile.x - me.x);
        const dy = Math.sign(tile.y - me.y);
        if (dx === 0 && dy === 0) continue;
        if (dx !== 0 && dy !== 0) continue;
        const d = Math.abs(tile.x - me.x) + Math.abs(tile.y - me.y);
        if (d >= 1 && d <= 6) keys.add(coordKey(tile.x, tile.y));
      }
    }
  }
  return keys;
});

const sharurAttractorInvalidKeys = computed(() => new Set<string>());

const harpeTrapInvalidKeys = computed(() => {
  const keys = new Set<string>();
  const m = boardActionMode.value;
  const me = yourPlayer.value;
  const s = gameState.value;
  if (m !== "harpeTrap" || !me || !s) return keys;
  for (const key of classAbilitySecondaryKeys.value) {
    const [x, y] = key.split(",").map(Number);
    if (!hasLineOfSight(s, me.x, me.y, x!, y!) || !isWalkable(tileAt(s.tiles, x!, y!))) {
      keys.add(key);
    }
  }
  return keys;
});

const lineOfSightObserver = computed((): { x: number; y: number } | null => {
  const sel = boardSelection.value;
  const s = gameState.value;
  if (!sel || !s) return null;
  if (sel.kind === "player") {
    const player = s.players.find((p) => p.id === sel.id);
    return player ? { x: player.x, y: player.y } : null;
  }
  const enemy = s.enemies.find((e) => e.id === sel.id);
  return enemy ? { x: enemy.x, y: enemy.y } : null;
});

const lineOfSightViewer = computed((): Player | Enemy | null => {
  const sel = boardSelection.value;
  const s = gameState.value;
  if (!sel || !s) return null;
  if (sel.kind === "player") {
    return s.players.find((p) => p.id === sel.id) ?? null;
  }
  return s.enemies.find((e) => e.id === sel.id) ?? null;
});

const outOfLineOfSightKeys = computed(() => {
  if (!showLineOfSightIndicator.value) return new Set<string>();
  const observer = lineOfSightObserver.value;
  const viewer = lineOfSightViewer.value;
  const s = gameState.value;
  if (!observer || !s) return new Set<string>();
  return outOfLineOfSightTileKeys(s, observer.x, observer.y, viewer ? { viewer } : undefined);
});

const sharurAttractorPlacementPreview = computed(() => {
  if (boardActionMode.value !== "sharurAttractor") return null;
  const cell = previewHoverCell.value;
  const me = yourPlayer.value;
  if (!cell || !me) return null;
  const key = coordKey(cell.x, cell.y);
  if (!classAbilitySecondaryKeys.value.has(key) || sharurAttractorInvalidKeys.value.has(key)) return null;
  return {
    id: "preview",
    ownerId: me.id,
    x: cell.x,
    y: cell.y,
    void: (me.hp ?? 0) <= 10,
  };
});

const attractorPreviewCenterKeys = computed(() => {
  const preview = sharurAttractorPlacementPreview.value;
  if (!preview) return new Map<string, { void: boolean }>();
  return new Map([[coordKey(preview.x, preview.y), { void: preview.void }]]);
});

const attractorPreviewZoneOnlyKeys = computed(() => {
  const preview = sharurAttractorPlacementPreview.value;
  if (!preview) return new Set<string>();
  const centerKey = coordKey(preview.x, preview.y);
  const keys = new Set<string>();
  for (const tile of tilesInAttractorZone(preview)) {
    const key = coordKey(tile.x, tile.y);
    if (key !== centerKey) keys.add(key);
  }
  return keys;
});

const boardTokensByKey = computed(() => {
  const map = new Map<string, { id: string; ownerId: string; kind: string }[]>();
  for (const t of gameState.value?.combat?.boardTokens ?? []) {
    const key = coordKey(t.x, t.y);
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  return map;
});

const trapLineKeys = computed(() => {
  const keys = new Set<string>();
  for (const trap of gameState.value?.combat?.thrownTraps ?? []) {
    for (const tile of tilesOnCardinalLine(trap.originX, trap.originY, trap.x, trap.y)) {
      keys.add(coordKey(tile.x, tile.y));
    }
  }
  return keys;
});

const trapWeaponKeys = computed(() => {
  const keys = new Set<string>();
  for (const trap of gameState.value?.combat?.thrownTraps ?? []) {
    keys.add(coordKey(trap.x, trap.y));
  }
  return keys;
});

const attractorCenterKeys = computed(() => {
  const keys = new Map<string, { void: boolean }>();
  for (const a of gameState.value?.combat?.attractors ?? []) {
    keys.set(coordKey(a.x, a.y), { void: a.void });
  }
  return keys;
});

const attractorZoneOnlyKeys = computed(() => {
  const keys = new Set<string>();
  for (const a of gameState.value?.combat?.attractors ?? []) {
    for (const tile of tilesInAttractorZone(a)) {
      const key = coordKey(tile.x, tile.y);
      if (!attractorCenterKeys.value.has(key)) keys.add(key);
    }
  }
  return keys;
});

const kopisMarkedEnemyIds = computed(() => {
  const marks = gameState.value?.combat?.marks ?? gameState.value?.combat?.kopisMarks ?? {};
  return new Set(Object.values(marks));
});

const towerTeleportPrimaryKeys = computed(() => {
  if (boardActionMode.value !== "towerTeleport") return new Set<string>();
  const id = yourPlayerId.value;
  const s = gameState.value;
  if (!id || !s) return new Set<string>();
  if (towerTeleportStep.value === "selectKeraunoTarget" && towerTeleportLanding.value) {
    const adjacent = keraunoAdjacentEnemyIds(s, towerTeleportLanding.value.x, towerTeleportLanding.value.y);
    const keys = new Set<string>();
    for (const enemyId of adjacent) {
      const enemy = s.enemies.find((e) => e.id === enemyId);
      if (enemy) keys.add(coordKey(enemy.x, enemy.y));
    }
    return keys;
  }
  return new Set<string>();
});

const towerTeleportSecondaryKeys = computed(() => {
  if (boardActionMode.value !== "towerTeleport") return new Set<string>();
  const id = yourPlayerId.value;
  const s = gameState.value;
  if (!id || !s || towerTeleportStep.value === "selectKeraunoTarget") return new Set<string>();
  return towerTeleportLandingKeys(s, id);
});

const assistedLaunchPreview = computed(() => {
  if (boardActionMode.value !== "assistedLaunch") return null;
  const id = yourPlayerId.value;
  const s = gameState.value;
  const anchor = assistedLaunchAnchor.value;
  if (!id || !s || !anchor) return null;
  return computeAssistedLaunch(s, id, anchor.x, anchor.y);
});

const assistedLaunchAnchorKeys = computed(() => {
  if (boardActionMode.value !== "assistedLaunch" || assistedLaunchStep.value !== "selectAnchor") {
    return new Set<string>();
  }
  const id = yourPlayerId.value;
  const s = gameState.value;
  const me = yourPlayer.value;
  if (!id || !s) return new Set<string>();
  const anchors = assistedLaunchAnchors(s, id);
  const coords: { x: number; y: number }[] = [];
  for (const anchor of anchors) {
    if (isInBounds(anchor.x, anchor.y, s.width, s.height)) {
      coords.push({ x: anchor.x, y: anchor.y });
    }
  }
  const edgeAnchors = anchors.filter((a) => a.kind === "edge");
  if (edgeAnchors.length === 1 && me) {
    coords.push({ x: me.turnStartX ?? me.x, y: me.turnStartY ?? me.y });
  }
  return coordsToKeySet(coords);
});

const assistedLaunchPathKeys = computed(() => {
  const preview = assistedLaunchPreview.value;
  if (!preview || assistedLaunchStep.value !== "confirm") return new Set<string>();
  const keys = new Set<string>();
  for (const step of preview.path.slice(0, -1)) {
    keys.add(coordKey(step.x, step.y));
  }
  return keys;
});

const assistedLaunchLandingKeys = computed(() => {
  const preview = assistedLaunchPreview.value;
  if (!preview || assistedLaunchStep.value !== "confirm") return new Set<string>();
  return new Set([coordKey(preview.landing.x, preview.landing.y)]);
});

const assistedLaunchLineKeys = computed(() => {
  const preview = assistedLaunchPreview.value;
  const me = yourPlayer.value;
  if (!preview || !me || assistedLaunchStep.value !== "confirm") return new Set<string>();
  const startX = me.turnStartX ?? me.x;
  const startY = me.turnStartY ?? me.y;
  const keys = new Set<string>();
  for (const tile of tilesOnCardinalLine(startX, startY, preview.landing.x, preview.landing.y)) {
    keys.add(coordKey(tile.x, tile.y));
  }
  return keys;
});

const kataptyPickKeys = computed(() => {
  if (boardActionMode.value !== "kataptyPick") return new Set<string>();
  const id = yourPlayerId.value;
  const s = gameState.value;
  if (!id || !s) return new Set<string>();
  return kataptyTargetKeys(s, id);
});

const kataptySelectedCoordKeys = computed(() => {
  const keys = new Set<string>();
  if (boardActionMode.value !== "kataptyPick") return keys;
  const s = gameState.value;
  if (!s) return keys;
  for (const id of kataptyTargetIds.value) {
    const enemy = s.enemies.find((e) => e.id === id);
    if (enemy) keys.add(coordKey(enemy.x, enemy.y));
  }
  return keys;
});

const reversalLineKeys = computed(() => {
  const r = pendingReaction.value;
  const me = yourPlayer.value;
  const s = gameState.value;
  const heal = new Set<string>();
  const damage = new Set<string>();
  if (!r || !me || !s) return { heal, damage };
  const tower = getPlayerTower(s, me.id);
  if (!tower) return { heal, damage };
  const iatros = tower.name === TOWER_IATROS;
  const targetSet = iatros ? heal : damage;
  const lines: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [
    { from: { x: me.x, y: me.y }, to: { x: tower.x, y: tower.y } },
  ];
  for (const allyId of reversalExtraAllyIds.value) {
    const ally = s.players.find((p) => p.id === allyId);
    if (ally) lines.push({ from: { x: me.x, y: me.y }, to: { x: ally.x, y: ally.y } });
  }
  for (const line of lines) {
    for (const tile of tilesOnSegment(line.from, line.to)) {
      targetSet.add(coordKey(tile.x, tile.y));
    }
  }
  return { heal, damage };
});

const combatAttackInvalidKeys = computed(() => {
  if (attackAimed.value) return new Set<string>();
  const preview = anchoredPlacementPreview.value;
  if (!preview) return new Set<string>();
  if (preview.tooFar) return coordsToKeySet(preview.patternTiles);
  return preview.tooCloseKeys;
});

const elevationBonusCandidateKeys = computed(() => {
  if (!isWeaponAttackMode.value || !attackAimed.value) return new Set<string>();
  const ctx = attackContext.value;
  const s = gameState.value;
  if (!ctx || !s) return new Set<string>();
  if (isRangeTargetAttack(ctx.spec) || usesAnchoredPatternPlacement(ctx.spec)) {
    return new Set<string>();
  }
  const baseTiles = collectAttackTiles(s, ctx.origin, ctx.spec, attackDirection.value);
  return coordsToKeySet(elevationBonusTileCandidates(s, ctx.origin, baseTiles, ctx.me));
});

const isWeaponAttackMode = computed(() => {
  const m = boardActionMode.value;
  if (m === "attack") return true;
  return m === "equipmentForceProjection" && forceProjectionStep.value === "attack";
});

const attackContext = computed(() => {
  const me = yourPlayer.value;
  const mode = boardActionMode.value;
  if (mode === "equipmentForceProjection" && forceProjectionStep.value === "attack" && forceProjectionOrigin.value && me?.weapon) {
    const spec = resolveCombatAttackSpec(me, me.weapon);
    if (!spec) return null;
    return {
      me,
      weapon: me.weapon,
      spec,
      origin: forceProjectionOrigin.value,
      equipmentUse: true as const,
    };
  }
  if (mode !== "attack" || !me?.weapon) return null;
  const spec = resolveCombatAttackSpec(me, me.weapon);
  if (!spec) return null;
  return { me, weapon: me.weapon, spec, origin: { x: me.x, y: me.y } };
});

const borrowContext = computed(() => {
  const me = yourPlayer.value;
  const s = gameState.value;
  const allyId = borrowAllyId.value;
  if (boardActionMode.value !== "varunastraBorrow" || !allyId || !me || !s) return null;
  const ally = s.players.find((p) => p.id === allyId);
  if (!ally?.weapon) return null;
  const spec = getWeaponAttackSpec(ally.weapon);
  if (!spec) return null;
  return { me, weapon: ally.weapon, spec };
});

const equipmentCorridorContext = computed(() => {
  const me = yourPlayer.value;
  if (boardActionMode.value !== "equipmentCorridor" || !me?.equipment) return null;
  if (!isHylicAnnihilationCorridor(me.equipment)) return null;
  const spec = getEquipmentAttackSpec(me.equipment);
  if (!spec) return null;
  return { me, spec };
});

const equipmentCorridorPlacementPreview = computed(() => {
  if (boardActionMode.value !== "equipmentCorridor") return null;
  const ctx = equipmentCorridorContext.value;
  const s = gameState.value;
  if (!ctx || !s) return null;
  const anchor = attackAimed.value ? attackAnchor.value : previewHoverCell.value;
  if (!anchor) return null;
  const patternTiles = collectEquipmentPatternTiles(
    s,
    anchor,
    ctx.me.equipment!,
    attackDirection.value,
  );
  const tileCount = ctx.spec.tiles?.length ?? 0;
  return { patternTiles, valid: patternTiles.length >= tileCount };
});

const equipmentCorridorPrimaryKeys = computed(() => {
  if (boardActionMode.value !== "equipmentCorridor" || !attackAimed.value) return new Set<string>();
  const preview = equipmentCorridorPlacementPreview.value;
  if (!preview?.valid) return new Set<string>();
  return coordsToKeySet(preview.patternTiles);
});

const equipmentCorridorSecondaryKeys = computed(() => {
  if (boardActionMode.value !== "equipmentCorridor" || attackAimed.value) return new Set<string>();
  const preview = equipmentCorridorPlacementPreview.value;
  if (!preview?.valid) return new Set<string>();
  return coordsToKeySet(preview.patternTiles);
});

const equipmentCorridorInvalidKeys = computed(() => {
  if (boardActionMode.value !== "equipmentCorridor" || attackAimed.value) return new Set<string>();
  const preview = equipmentCorridorPlacementPreview.value;
  if (!preview || preview.valid) return new Set<string>();
  return coordsToKeySet(preview.patternTiles);
});

const equipmentCoverRangeKeys = computed(() => {
  if (boardActionMode.value !== "equipmentCover") return new Set<string>();
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return new Set<string>();
  return rejectionFieldTileKeys(s, me);
});

const equipmentCoverSelectedKeys = computed(() => coordsToKeySet(equipmentCoverTiles.value));

const equipmentCoverSecondaryKeys = computed(() => {
  if (boardActionMode.value !== "equipmentCover") return new Set<string>();
  const range = equipmentCoverRangeKeys.value;
  const selected = equipmentCoverSelectedKeys.value;
  const keys = new Set<string>();
  for (const key of range) {
    if (!selected.has(key)) keys.add(key);
  }
  return keys;
});

const equipmentForceProjectionSquareKeys = computed(() => {
  if (boardActionMode.value !== "equipmentForceProjection" || forceProjectionStep.value !== "selectSquare") {
    return new Set<string>();
  }
  const me = yourPlayer.value;
  const s = gameState.value;
  const occ = occupancy.value;
  if (!me || !s || !occ) return new Set<string>();
  return forceProjectionTileKeys(s, me, occ);
});

const redirectSourceKeys = computed(() => {
  if (boardActionMode.value !== "equipmentRedirect" || redirectStep.value !== "selectSource") {
    return new Set<string>();
  }
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return new Set<string>();
  return redirectionSourceTileKeys(s, me);
});

const redirectTargetKeys = computed(() => {
  if (boardActionMode.value !== "equipmentRedirect" || redirectStep.value !== "selectTarget") {
    return new Set<string>();
  }
  const s = gameState.value;
  const sourceId = redirectSourceEnemyId.value;
  const attackIndex = redirectAttackIndex.value;
  if (!s || !sourceId || attackIndex == null) return new Set<string>();
  const source = s.enemies.find((e) => e.id === sourceId);
  if (!source?.name) return new Set<string>();
  const attackSpec = getEnemyAttack(source.name, attackIndex)?.attack;
  if (!attackSpec) return new Set<string>();
  const ids = enemyDirectAttackTargetEnemyIds(s, sourceId, attackSpec);
  const keys = new Set<string>();
  for (const id of ids) {
    const enemy = s.enemies.find((e) => e.id === id);
    if (enemy) keys.add(coordKey(enemy.x, enemy.y));
  }
  return keys;
});

const redirectPatternHighlights = computed(() => {
  if (boardActionMode.value !== "equipmentRedirect" || redirectStep.value !== "confirmPattern") {
    return null;
  }
  const s = gameState.value;
  const sourceId = redirectSourceEnemyId.value;
  const attackIndex = redirectAttackIndex.value;
  if (!s || !sourceId || attackIndex == null) return null;
  return computeAttackPreviewHighlights(s, {
    mode: "gmEnemyAttack",
    enemyId: sourceId,
    attackIndex,
    direction: attackDirection.value,
    aimed: attackAimed.value,
    anchorX: attackAnchor.value?.x,
    anchorY: attackAnchor.value?.y,
  });
});

const redirectPatternPrimaryKeys = computed(() => {
  const hl = redirectPatternHighlights.value;
  if (!hl) return new Set<string>();
  return new Set(hl.primary);
});

const redirectPatternSecondaryKeys = computed(() => {
  const hl = redirectPatternHighlights.value;
  if (!hl) return new Set<string>();
  return new Set(hl.secondary);
});

const borrowAnchoredPlacementPreview = computed(() => {
  if (boardActionMode.value !== "varunastraBorrow" || !borrowAllyId.value) return null;
  const ctx = borrowContext.value;
  const s = gameState.value;
  if (!ctx || !s || !usesAnchoredPatternPlacement(ctx.spec)) return null;
  const anchor = attackAimed.value ? attackAnchor.value : previewHoverCell.value;
  if (!anchor) return null;
  return evaluateAnchoredPatternPlacement(
    ctx.me,
    anchor,
    ctx.spec,
    attackDirection.value,
    s,
  );
});

const omnistrikeContext = computed(() => {
  const me = yourPlayer.value;
  if (boardActionMode.value !== "omnistrike" || !me?.weapon) return null;
  const [indexA, indexB] = omnistrikeBombs.value;
  if (indexA == null || indexB == null) return null;
  const bombA = resolveBombAttackSpec(me.weapon, indexA);
  const bombB = resolveBombAttackSpec(me.weapon, indexB);
  if (!bombA || !bombB) return null;
  const combinedSpan = computeOmnistrikeRangeSpan(bombA, bombB);
  if (!combinedSpan) return null;
  return { me, weapon: me.weapon, bombA, bombB, combinedSpan, indexA, indexB };
});

const attackPreviewByDirection = computed(() => {
  const ctx = attackContext.value;
  const s = gameState.value;
  if (!ctx || !s) {
    return new Map<PatternDirection, Set<string>>();
  }
  if (isRangeTargetAttack(ctx.spec) || usesAnchoredPatternPlacement(ctx.spec)) {
    return new Map<PatternDirection, Set<string>>();
  }
  const origin = ctx.origin ?? { x: ctx.me.x, y: ctx.me.y };
  const map = new Map<PatternDirection, Set<string>>();
  for (const direction of PATTERN_DIRECTIONS) {
    const tiles = collectAttackTiles(s, origin, ctx.spec, direction);
    map.set(direction, coordsToKeySet(tiles));
  }
  return map;
});

const borrowAttackPreviewByDirection = computed(() => {
  const ctx = borrowContext.value;
  const s = gameState.value;
  if (!ctx || !s) return new Map<PatternDirection, Set<string>>();
  if (isRangeTargetAttack(ctx.spec) || usesAnchoredPatternPlacement(ctx.spec)) {
    return new Map<PatternDirection, Set<string>>();
  }
  const map = new Map<PatternDirection, Set<string>>();
  for (const direction of PATTERN_DIRECTIONS) {
    const tiles = collectAttackTiles(s, { x: ctx.me.x, y: ctx.me.y }, ctx.spec, direction);
    map.set(direction, coordsToKeySet(tiles));
  }
  return map;
});

const borrowCombatPrimaryKeys = computed(() => {
  if (boardActionMode.value !== "varunastraBorrow" || !borrowAllyId.value) return new Set<string>();
  const ctx = borrowContext.value;
  const s = gameState.value;
  if (!ctx || !s) return new Set<string>();
  if (isRangeTargetAttack(ctx.spec)) return new Set<string>();

  if (usesAnchoredPatternPlacement(ctx.spec)) {
    if (!attackAimed.value) return new Set<string>();
    const preview = borrowAnchoredPlacementPreview.value;
    if (!preview?.valid) return new Set<string>();
    return coordsToKeySet(preview.patternTiles);
  }

  if (!attackAimed.value) return new Set<string>();
  return borrowAttackPreviewByDirection.value.get(attackDirection.value) ?? new Set<string>();
});

const borrowCombatSecondaryKeys = computed(() => {
  const ctx = borrowContext.value;
  const s = gameState.value;
  if (!ctx || !s) return new Set<string>();

  if (isRangeTargetAttack(ctx.spec)) {
    return rangeAttackTileKeys(s, ctx.me, rangeTargetDistance(ctx.spec));
  }

  if (usesAnchoredPatternPlacement(ctx.spec)) {
    if (attackAimed.value) return new Set<string>();
    const preview = borrowAnchoredPlacementPreview.value;
    if (!preview) return new Set<string>();
    return coordsToKeySet(preview.patternTiles);
  }

  if (isRangedPatternAttack(ctx.spec)) {
    if (ctx.spec.rangeSpan) {
      return rangedPatternPlacementKeys(s, ctx.me, ctx.spec.rangeSpan);
    }
    return rangeAttackTileKeys(s, ctx.me, ctx.spec.range!);
  }

  const keys = new Set<string>();
  for (const [direction, tileKeys] of borrowAttackPreviewByDirection.value) {
    if (attackAimed.value && direction === attackDirection.value) continue;
    for (const key of tileKeys) keys.add(key);
  }
  return keys;
});

const combatAttackPrimaryKeys = computed(() => {
  if (!isWeaponAttackMode.value) return new Set<string>();
  const ctx = attackContext.value;
  const s = gameState.value;
  if (!ctx || !s) return new Set<string>();
  if (isRangeTargetAttack(ctx.spec)) return new Set<string>();

  if (usesAnchoredPatternPlacement(ctx.spec)) {
    if (!attackAimed.value) return new Set<string>();
    const preview = anchoredPlacementPreview.value;
    if (!preview?.valid) return new Set<string>();
    return coordsToKeySet(preview.patternTiles);
  }

  if (!attackAimed.value) return new Set<string>();
  return attackPreviewByDirection.value.get(attackDirection.value) ?? new Set<string>();
});

const combatAttackSecondaryKeys = computed(() => {
  const ctx = attackContext.value;
  const s = gameState.value;
  if (!ctx || !s || !isWeaponAttackMode.value) {
    return new Set<string>();
  }

  const origin = ctx.origin ?? { x: ctx.me.x, y: ctx.me.y };

  if (isRangeTargetAttack(ctx.spec)) {
    return rangeAttackTileKeys(
      s,
      origin,
      rangeTargetDistance(ctx.spec),
    );
  }

  if (usesAnchoredPatternPlacement(ctx.spec)) {
    if (attackAimed.value) return new Set<string>();
    const preview = anchoredPlacementPreview.value;
    if (!preview) return new Set<string>();
    return coordsToKeySet(preview.patternTiles);
  }

  if (isRangedPatternAttack(ctx.spec)) {
    if (ctx.spec.rangeSpan) {
      return rangedPatternPlacementKeys(s, origin, ctx.spec.rangeSpan);
    }
    return rangeAttackTileKeys(s, origin, ctx.spec.range!);
  }

  const keys = new Set<string>();
  for (const [direction, tileKeys] of attackPreviewByDirection.value) {
    if (attackAimed.value && direction === attackDirection.value) continue;
    for (const key of tileKeys) keys.add(key);
  }
  return keys;
});

const combatAttackSelectedKeys = computed(() => {
  const s = gameState.value;
  const keys = new Set<string>();
  if (!s) return keys;
  for (const id of rangeAttackTargetIds.value) {
    const enemy = s.enemies.find((e) => e.id === id);
    if (enemy) keys.add(coordKey(enemy.x, enemy.y));
  }
  for (const c of rangeAttackObstacleCoords.value) {
    keys.add(coordKey(c.x, c.y));
  }
  return keys;
});

function shouldRenderRemoteAttackPreview(preview: AttackPreviewState): boolean {
  if (preview.mode === "gmEnemyAttack") {
    return !(canUseGmTools.value && boardActionMode.value === "gmEnemyAttack");
  }
  if (preview.playerId === yourPlayerId.value && boardActionMode.value != null) return false;
  return true;
}

const remoteAttackPreviewHighlights = computed(() => {
  const s = gameState.value;
  const preview = s?.combat?.attackPreview;
  if (!s || !preview || !shouldRenderRemoteAttackPreview(preview)) return null;
  return computeAttackPreviewHighlights(s, preview);
});

function buildLocalAttackPreview(): AttackPreviewState | null {
  const m = boardActionMode.value;
  if (m === "gmEnemyAttack") {
    if (props.role !== "gm") return null;
    const pending = gmEnemyAttack.value;
    if (!pending) return null;
    return {
      mode: "gmEnemyAttack",
      enemyId: pending.enemyId,
      attackIndex: pending.attackIndex,
      direction: attackDirection.value,
      aimed: attackAimed.value,
      anchorX: attackAnchor.value?.x,
      anchorY: attackAnchor.value?.y,
    };
  }

  const playerId = yourPlayerId.value;
  if (!playerId) return null;

  if (m === "attack" || m === "varunastraBorrow" || m === "equipmentCorridor") {
    if (m === "varunastraBorrow" && !borrowAllyId.value) return null;
    return {
      playerId,
      mode: m,
      direction: attackDirection.value,
      aimed: attackAimed.value,
      anchorX: attackAnchor.value?.x,
      anchorY: attackAnchor.value?.y,
      hoverX: previewHoverCell.value?.x,
      hoverY: previewHoverCell.value?.y,
      targetEnemyIds: rangeAttackTargetIds.value.length ? [...rangeAttackTargetIds.value] : undefined,
      targetObstacleCoords: rangeAttackObstacleCoords.value.length
        ? [...rangeAttackObstacleCoords.value]
        : undefined,
      borrowAllyId: borrowAllyId.value ?? undefined,
    };
  }

  if (
    m === "equipmentForceProjection" &&
    forceProjectionStep.value === "attack" &&
    forceProjectionOrigin.value
  ) {
    return {
      playerId,
      mode: "equipmentForceProjection",
      direction: attackDirection.value,
      aimed: attackAimed.value,
      anchorX: attackAnchor.value?.x,
      anchorY: attackAnchor.value?.y,
      hoverX: previewHoverCell.value?.x,
      hoverY: previewHoverCell.value?.y,
      targetEnemyIds: rangeAttackTargetIds.value.length ? [...rangeAttackTargetIds.value] : undefined,
      targetObstacleCoords: rangeAttackObstacleCoords.value.length
        ? [...rangeAttackObstacleCoords.value]
        : undefined,
      forceProjectionX: forceProjectionOrigin.value.x,
      forceProjectionY: forceProjectionOrigin.value.y,
    };
  }

  if (m === "omnistrike") {
    const step = omnistrikeStep.value;
    if (step === "selectBombs") return null;
    const [indexA, indexB] = omnistrikeBombs.value;
    if (indexA == null || indexB == null) return null;
    return {
      playerId,
      mode: "omnistrike",
      direction: attackDirection.value,
      omnistrikeStep: step,
      omnistrikeBombIndices: [indexA, indexB],
      omnistrikeAnchors: [
        omnistrikeAnchors.value[0] ? { ...omnistrikeAnchors.value[0] } : null,
        omnistrikeAnchors.value[1] ? { ...omnistrikeAnchors.value[1] } : null,
      ],
      hoverX: previewHoverCell.value?.x,
      hoverY: previewHoverCell.value?.y,
    };
  }

  return null;
}

let lastAttackPreviewJson = "";
let attackPreviewSyncTimer: ReturnType<typeof setTimeout> | null = null;

function syncAttackPreviewNow() {
  const preview = buildLocalAttackPreview();
  const json = JSON.stringify(preview);
  if (json === lastAttackPreviewJson) return;
  lastAttackPreviewJson = json;
  send({ type: "setAttackPreview", preview });
}

function scheduleAttackPreviewSync() {
  if (attackPreviewSyncTimer) clearTimeout(attackPreviewSyncTimer);
  attackPreviewSyncTimer = setTimeout(syncAttackPreviewNow, 40);
}

watch(
  [
    boardActionMode,
    attackDirection,
    attackAimed,
    attackAnchor,
    rangeAttackTargetIds,
    rangeAttackObstacleCoords,
    borrowAllyId,
    forceProjectionStep,
    forceProjectionOrigin,
    omnistrikeStep,
    omnistrikeBombs,
    omnistrikeAnchors,
    gmEnemyAttack,
  ],
  syncAttackPreviewNow,
);

watch(previewHoverCell, scheduleAttackPreviewSync);

const patternRecoilKeys = computed(() => {
  if (!patternPreviewActive.value || !gameState.value) return new Set<string>();
  if (modifierValues.value.recoil <= 0) return new Set<string>();
  if (!selectedPattern.value?.directional) return new Set<string>();

  const origin = patternOrigin.value;
  if (!origin) return new Set<string>();

  return coordsToKeySet(
    recoilTilesInBounds(
      origin,
      modifierValues.value.recoil,
      patternDirection.value,
      gameState.value.width,
      gameState.value.height,
    ),
  );
});

const patternSecondaryKeys = computed(() => {
  if (!patternPreviewActive.value || !isDrawablePattern.value || !gameState.value) {
    return new Set<string>();
  }
  if (drawnTiles.value.length === 0 || drawnTiles.value.length >= patternSize.value) {
    return new Set<string>();
  }
  return coordsToKeySet(
    drawableExpansionOptions(
      drawnTiles.value,
      patternSize.value,
      gameState.value.width,
      gameState.value.height,
    ),
  );
});

function terrainClass(tile: MapTile | undefined): string | null {
  if (!tile) return null;
  if (tile.terrain.includes("impassable")) return "impassable";
  if (tile.terrain.includes("obstacle")) return "obstacle";
  if (tile.terrain.includes("void")) return "void";
  return null;
}

function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

const gmForceMovableKeys = computed(() => {
  const keys = new Set<string>();
  const s = gameState.value;
  if (!s || !canUseGmTools.value || gmActiveTool.value !== "forceMove") return keys;

  if (selectedPlayerId.value) {
    const target = { kind: "player" as const, id: selectedPlayerId.value };
    for (const c of cells.value) {
      if (validateGmForceMove(s, target, c.x, c.y) === null) keys.add(c.key);
    }
    return keys;
  }

  const id = selectedEnemyId.value;
  if (!id) return keys;
  const target = { kind: "enemy" as const, id };
  const solo = isSoloSwarmMemberSelected.value ? { soloSwarmMember: true as const } : undefined;
  for (const c of cells.value) {
    if (validateGmForceMove(s, target, c.x, c.y, solo) === null) keys.add(c.key);
  }
  return keys;
});

const gmEnemyMoveTargetKeys = computed(() => {
  const keys = new Set<string>();
  const s = gameState.value;
  const id = selectedEnemyId.value;
  if (gmActiveTool.value === "forceMove") return keys;
  if (!s || !id || !canGmMoveEnemies(s)) return keys;
  const enemy = s.enemies.find((e) => e.id === id);
  if (!enemy || enemy.exhausted || isTowerEnemy(enemy)) return keys;

  const group = swarmGroupForEnemy(s, id);
  const occ = occupancy.value ?? undefined;

  if (group && isSoloSwarmMemberSelected.value) {
    const remaining = isSandboxMode(s) ? Infinity : getSwarmMovementRemaining(s, group.memberIds);
    if (remaining < 1) return keys;
    for (const tile of swarmFringeTiles(s, group.memberIds, occ)) {
      if (!canSwarmMemberReachDest(s, id, tile.x, tile.y, occ)) continue;
      const cost = enemyMoveStepCost(s, enemy, enemy.x, enemy.y, tile.x, tile.y, { swarm: true });
      if (cost <= remaining) keys.add(boardCellKey(tile.x, tile.y));
    }
    const deltas = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];
    for (const { dx, dy } of deltas) {
      const destX = enemy.x + dx;
      const destY = enemy.y + dy;
      if (!canSwarmMemberReachDest(s, id, destX, destY, occ)) continue;
      const cost = enemyMoveStepCost(s, enemy, enemy.x, enemy.y, destX, destY, { swarm: true });
      if (cost <= remaining) keys.add(boardCellKey(destX, destY));
    }
    return keys;
  }

  if (group) {
    const remaining = isSandboxMode(s) ? Infinity : getSwarmMovementRemaining(s, group.memberIds);
    if (remaining < 1) return keys;
    for (const tile of swarmFringeTiles(s, group.memberIds, occupancy.value ?? undefined)) {
      const moverId = pickSwarmMoveMember(s, group.memberIds, tile.x, tile.y);
      if (!moverId) continue;
      const mover = s.enemies.find((e) => e.id === moverId);
      if (!mover) continue;
      const cost = enemyMoveStepCost(s, mover, mover.x, mover.y, tile.x, tile.y, { swarm: true });
      if (cost <= remaining) keys.add(boardCellKey(tile.x, tile.y));
    }
    return keys;
  }

  if (!isSandboxMode(s)) {
    ensureEnemyMovement(enemy);
  }
  const remaining = isSandboxMode(s) ? Infinity : (enemy.movementRemaining ?? 0);
  if (remaining < 1) return keys;
  const scale = getEnemyScale(enemy);
  const deltas = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  for (const { dx, dy } of deltas) {
    const anchorX = enemy.x + dx;
    const anchorY = enemy.y + dy;
    const cost = enemyMoveStepCost(s, enemy, enemy.x, enemy.y, anchorX, anchorY);
    if (cost > remaining) continue;
    if (validateEnemyFootprint(s, anchorX, anchorY, scale, id, occupancy.value ?? undefined, enemy) !== null) {
      continue;
    }
    for (const tile of enemyFootprintTiles(anchorX, anchorY, scale)) {
      keys.add(boardCellKey(tile.x, tile.y));
    }
  }
  return keys;
});

const gmSpawnableKeys = computed(() => {
  const keys = new Set<string>();
  const s = gameState.value;
  const spawnName = selectedSpawnEnemyName.value;
  if (!s || !spawnName) return keys;
  const scale = getEnemyScaleByName(spawnName);
  for (const c of cells.value) {
    if (
      validateEnemyFootprint(s, c.x, c.y, scale, undefined, occupancy.value ?? undefined, { name: spawnName }) === null
    ) {
      keys.add(c.key);
    }
  }
  return keys;
});

const gmEnemyAttackTargetKeys = computed(() => {
  const keys = new Set<string>();
  if (boardActionMode.value !== "gmEnemyAttack" || !gmEnemyAttack.value) return keys;
  const s = gameState.value;
  const occ = occupancy.value;
  if (!s || !occ) return keys;
  const pending = gmEnemyAttack.value;
  const { enemyId, attackIndex } = pending;
  const enemy = s.enemies.find((e) => e.id === enemyId);
  const attackSpec = getEnemyAttack(enemy?.name, attackIndex)?.attack;
  if (!attackSpec) return keys;
  if (isPatternEnemyAttack(attackSpec)) return keys;
  const stainTeleport =
    pending.stainTeleport || attackSpec.specialId === "stain-teleport";
  const plantFlowerbud =
    pending.plantFlowerbud || attackSpec.specialId === "flowerbud-plant";

  if (plantFlowerbud && enemy) {
    for (const tile of flowerbudPlantTiles(s, enemy)) {
      keys.add(coordKey(tile.x, tile.y));
    }
    return keys;
  }

  if (stainTeleport && (pending.targetPlayerId || pending.targetEnemyId)) {
    for (const tile of s.tiles) {
      if (tileIsStained(s, tile.x, tile.y)) keys.add(coordKey(tile.x, tile.y));
    }
    return keys;
  }

  for (const playerId of enemyDirectAttackTargetPlayerIds(s, enemyId, attackSpec, occ)) {
    const player = s.players.find((p) => p.id === playerId);
    if (player) keys.add(coordKey(player.x, player.y));
  }
  if (stainTeleport || isSelectTargetEnemyAttack(attackSpec)) {
    for (const targetId of enemyDirectAttackTargetEnemyIds(s, enemyId, attackSpec, occ)) {
      const target = s.enemies.find((e) => e.id === targetId);
      if (!target) continue;
      for (const tile of enemyFootprintTiles(target.x, target.y, getEnemyScale(target))) {
        keys.add(coordKey(tile.x, tile.y));
      }
    }
  }
  return keys;
});

const localGmEnemyAttackHighlights = computed(() => {
  if (boardActionMode.value !== "gmEnemyAttack" || !canUseGmTools.value) return null;
  const pending = gmEnemyAttack.value;
  const s = gameState.value;
  if (!pending || !s) return null;
  return computeAttackPreviewHighlights(s, {
    mode: "gmEnemyAttack",
    enemyId: pending.enemyId,
    attackIndex: pending.attackIndex,
    direction: attackDirection.value,
    aimed: attackAimed.value,
    anchorX: attackAnchor.value?.x,
    anchorY: attackAnchor.value?.y,
  });
});

const gmEnemyPatternPrimaryKeys = computed(() => {
  const hl = localGmEnemyAttackHighlights.value;
  if (!hl) return new Set<string>();
  return new Set(hl.primary);
});

const gmEnemyPatternSecondaryKeys = computed(() => {
  const hl = localGmEnemyAttackHighlights.value;
  if (!hl) return new Set<string>();
  return new Set(hl.secondary);
});

const occupancy = computed(() =>
  gameState.value ? buildBoardOccupancy(gameState.value) : null,
);

const yourPlayer = computed(() => {
  const s = gameState.value;
  const id = yourPlayerId.value;
  if (!s || !id) return undefined;
  return s.players.find((p) => p.id === id);
});

let sprintModePrev: typeof boardActionMode.value = null;
watch(boardActionMode, (mode) => {
  if (mode === "sprint" && sprintModePrev !== "sprint") {
    const remaining = yourPlayer.value?.actionBudget?.sprintRemaining ?? 0;
    if (remaining <= 0) sendPlayerAction({ action: "sprint" });
  }
  sprintModePrev = mode;
});

watch(gmActiveTool, (tool) => {
  if (tool) clearStainGeyserPlacement();
});

watch(selectedSpawnEnemyName, (name) => {
  if (name) clearStainGeyserPlacement();
});

watch(
  () => yourPlayer.value?.actionBudget?.sprintRemaining ?? 0,
  (remaining, prev) => {
    if (boardActionMode.value === "sprint" && prev > 0 && remaining <= 0) {
      clearBoardActionMode();
    }
  },
);

watch(
  () => (yourPlayer.value ? aegisFlyingRemaining(yourPlayer.value) : 0),
  (remaining, prev) => {
    if (boardActionMode.value === "aegis" && prev > 0 && remaining <= 0) {
      clearBoardActionMode();
    }
  },
);

const BOARD_CELL_GAP = 3;

const elevationContourPaths = computed(() => {
  if (!showElevationContours.value) return null;
  const s = gameState.value;
  if (!s) return null;
  const metrics = boardCellMetrics(s.width, s.height, boardWidthPx.value, BOARD_CELL_GAP);
  const paths = buildElevationContourPaths(s.tiles, metrics);
  return paths.length > 0 ? paths : null;
});

const cellStateByKey = computed(() => {
  const map = new Map<string, CellRenderState>();
  const s = gameState.value;
  const occ = occupancy.value;
  if (!s || !occ) return map;

  const swarmGroups = buildSwarmGroups(s);

  const playerCanMove =
    props.role === "player" &&
    !!yourPlayerId.value &&
    canPlayerMove(s, yourPlayerId.value);
  const isDeployment = s.roundPhase === "deployment";
  const sandbox = isSandboxMode(s);
  const inMoveMode = boardActionMode.value === "move";
  const inSprintMode = boardActionMode.value === "sprint";
  const inAegisMode = boardActionMode.value === "aegis";
  const inCombatActionMode =
    boardActionMode.value != null && !inMoveMode && !inSprintMode && !inAegisMode;
  const onPlayerTurn =
    s.roundPhase === "playerTurn" &&
    s.turn?.role === "player" &&
    s.turn.playerId === yourPlayerId.value;
  const showStepMoveHighlights =
    activePlayerSelected.value &&
    !inCombatActionMode &&
    (sandbox || onPlayerTurn || inMoveMode || inSprintMode || inAegisMode);
  const me = yourPlayer.value;
  const movementRemaining = me?.actionBudget?.movementRemaining ?? 0;
  const sprintRemaining = me?.actionBudget?.sprintRemaining ?? 0;
  const aegisRemaining = me ? aegisFlyingRemaining(me) : 0;
  const remotePreview = remoteAttackPreviewHighlights.value;
  const remotePrimary = remotePreview ? new Set(remotePreview.primary) : null;
  const remoteSecondary = remotePreview ? new Set(remotePreview.secondary) : null;
  const remoteInvalid = remotePreview ? new Set(remotePreview.invalid) : null;
  const remoteSelected = remotePreview ? new Set(remotePreview.selected) : null;
  const remoteHeal = remotePreview?.heal ?? false;

  const portraitBgCache = new Map<string, string | null>();

  const enemiesByAnchorKey = new Map<string, Enemy[]>();
  for (const e of s.enemies) {
    const key = coordKey(e.x, e.y);
    const list = enemiesByAnchorKey.get(key);
    if (list) list.push(e);
    else enemiesByAnchorKey.set(key, [e]);
  }

  function enemyPortraitBgFor(enemy: Enemy): string | null {
    if (enemy.kind === "tower") return null;
    const listing = getEnemyListingByName(enemy.name);
    const url = enemyPortraitUrlForName(enemy.name);
    if (!listing?.portrait || !url) return null;
    const cacheKey = `${listing.portrait}:${url}`;
    if (portraitBgCache.has(cacheKey)) return portraitBgCache.get(cacheKey)!;
    const bg = portraitBackgroundFor(listing.portrait, url);
    portraitBgCache.set(cacheKey, bg);
    return bg;
  }

  for (const c of cells.value) {
    const ck = coordKey(c.x, c.y);
    const tile = tileAt(s.tiles, c.x, c.y);
    const player = occ.playerByKey.get(ck);
    const enemy = occ.enemyByKey.get(ck);
    const enemiesAtTile = enemiesByAnchorKey.get(ck) ?? [];
    const enemyAnchor = enemiesAtTile[0];
    const objects = occ.terrainObjectsByKey.get(ck) ?? [];
    const hasSeed = objects.some((o) => o.kind === "seed");

    const adjacent =
      me != null &&
      isMovementStepAdjacent({ x: me.x, y: me.y }, c, playerAllowsDiagonalMovement(me));
    const stepBase =
      playerCanMove &&
      !isDeployment &&
      isWalkable(tile) &&
      !player &&
      !enemy &&
      adjacent &&
      showStepMoveHighlights;
    const aegisStepBase =
      playerCanMove &&
      !isDeployment &&
      !player &&
      !enemy &&
      adjacent &&
      showStepMoveHighlights &&
      (inAegisMode || inSprintMode) &&
      me != null &&
      isFlyingStepReachable(s, me, { x: me.x, y: me.y }, c);
    const stepCost = me && stepBase ? movementStepCost(s, me, c.x, c.y) : Infinity;
    const aegisStepCost =
      me && aegisStepBase
        ? stepMoveCost(s, me, { x: me.x, y: me.y }, c, true)
        : Infinity;
    const showRegularStep =
      stepBase &&
      !inSprintMode &&
      !inAegisMode &&
      (sandbox || (stepCost <= movementRemaining && movementRemaining > 0));
    const showSprintStep = stepBase && inSprintMode && stepCost <= sprintRemaining && sprintRemaining > 0;
    const aegisUsesSprint = sprintRemaining > 0 && (inSprintMode || inAegisMode);
    const aegisMoveBudget = aegisUsesSprint ? sprintRemaining : movementRemaining;
    const showAegisStep =
      aegisStepBase &&
      (inAegisMode || inSprintMode) &&
      aegisStepCost <= aegisMoveBudget &&
      aegisMoveBudget > 0 &&
      aegisRemaining > 0 &&
      (sandbox || onPlayerTurn);

    const combatPrimary =
      combatAttackPrimaryKeys.value.has(ck) ||
      borrowCombatPrimaryKeys.value.has(ck) ||
      omnistrikePrimaryKeys.value.has(ck) ||
      equipmentCorridorPrimaryKeys.value.has(ck) ||
      equipmentCoverSelectedKeys.value.has(ck) ||
      equipmentForceProjectionSquareKeys.value.has(ck) ||
      redirectSourceKeys.value.has(ck) ||
      redirectTargetKeys.value.has(ck) ||
      redirectPatternPrimaryKeys.value.has(ck) ||
      warhookPrimaryKeys.value.has(ck) ||
      classAbilityPrimaryKeys.value.has(ck) ||
      armorPushTargetKeys.value.has(ck) ||
      armorTeleportTargetKeys.value.has(ck) ||
      towerTeleportPrimaryKeys.value.has(ck) ||
      assistedLaunchAnchorKeys.value.has(ck) ||
      assistedLaunchLandingKeys.value.has(ck) ||
      combatAttackSelectedKeys.value.has(ck) ||
      (elevBonusTile.value != null && coordKey(elevBonusTile.value.x, elevBonusTile.value.y) === ck) ||
      (remoteSelected?.has(ck) ?? false) ||
      reversalLineKeys.value.damage.has(ck) ||
      gmEnemyAttackTargetKeys.value.has(ck) ||
      gmEnemyPatternPrimaryKeys.value.has(ck) ||
      (remotePrimary?.has(ck) ?? false) ||
      (boardActionMode.value === "kataptyPick" && kataptySelectedCoordKeys.value.has(ck));
    const combatSecondary =
      combatAttackSecondaryKeys.value.has(ck) ||
      borrowCombatSecondaryKeys.value.has(ck) ||
      omnistrikeSecondaryKeys.value.has(ck) ||
      equipmentCorridorSecondaryKeys.value.has(ck) ||
      equipmentCoverSecondaryKeys.value.has(ck) ||
      warhookSecondaryKeys.value.has(ck) ||
      armorPlaceTowerKeys.value.has(ck) ||
      armorTeleportLandingKeys.value.has(ck) ||
      classAbilitySecondaryKeys.value.has(ck) ||
      towerTeleportSecondaryKeys.value.has(ck) ||
      assistedLaunchPathKeys.value.has(ck) ||
      assistedLaunchLineKeys.value.has(ck) ||
      kataptyPickKeys.value.has(ck) ||
      rezTargetKeys.value.has(ck) ||
      gmEnemyPatternSecondaryKeys.value.has(ck) ||
      redirectPatternSecondaryKeys.value.has(ck) ||
      (elevationBonusCandidateKeys.value.has(ck) &&
        !(elevBonusTile.value && coordKey(elevBonusTile.value.x, elevBonusTile.value.y) === ck)) ||
      (remoteSecondary?.has(ck) ?? false);

    map.set(c.key, {
      terrainClass: terrainClass(tile),
      movable:
        activePlayerSelected.value &&
        playerCanMove &&
        !isDeployment &&
        isWalkable(tile) &&
        !player &&
        !enemy &&
        (sandbox) &&
        inMoveMode,
      moveSecondary: showRegularStep || showSprintStep,
      moveAegis: showAegisStep,
      deployable:
        isDeployment &&
        props.role === "player" &&
        !!yourPlayerId.value &&
        isWalkable(tile) &&
        !player &&
        !enemy,
      gmMovable: canUseGmTools.value && gmEnemyMoveTargetKeys.value.has(c.key),
      gmSpawnable:
        canUseGmTools.value &&
        (gmSpawnableKeys.value.has(c.key) || gmForceMovableKeys.value.has(c.key)),
      patternPrimary:
        patternPrimaryKeys.value.has(ck) || stainGeyserPreviewKeys.value.has(ck),
      patternSecondary:
        patternSecondaryKeys.value.has(ck) || gorgenautAgnosiaPreviewKeys.value.has(ck),
      combatTargetPrimary: combatPrimary,
      combatTargetSecondary: combatSecondary,
      combatTargetHeal:
        reversalLineKeys.value.heal.has(ck) ||
        (boardActionMode.value === "rez" && rezTargetKeys.value.has(ck)) ||
        (isHealAttackSpecActive.value && (combatPrimary || combatSecondary)) ||
        (remoteHeal && ((remotePrimary?.has(ck) ?? false) || (remoteSecondary?.has(ck) ?? false))),
      combatTargetInvalid:
        combatAttackInvalidKeys.value.has(coordKey(c.x, c.y)) ||
        omnistrikeInvalidKeys.value.has(coordKey(c.x, c.y)) ||
        equipmentCorridorInvalidKeys.value.has(coordKey(c.x, c.y)) ||
        sharurAttractorInvalidKeys.value.has(coordKey(c.x, c.y)) ||
        harpeTrapInvalidKeys.value.has(coordKey(c.x, c.y)) ||
        (remoteInvalid?.has(ck) ?? false),
      patternRecoil: patternRecoilKeys.value.has(coordKey(c.x, c.y)),
      tile,
      player,
      enemyAnchor,
      stackedEnemies: enemiesAtTile.slice(1).map((stacked) => ({
        enemy: stacked,
        portraitUrl:
          stacked.kind !== "tower" ? enemyPortraitUrlForName(stacked.name) : null,
        portraitBg: enemyPortraitBgFor(stacked),
        hp:
          canUseGmTools.value
            ? {
                currentHp: getEffectiveEnemyHp(stacked, s),
                maxHp: getEffectiveEnemyMaxHp(stacked, s),
              }
            : undefined,
        selected: isEnemySelected(stacked.id) || isEnemyBulkSelected(stacked.id),
        dying: isEnemyDying(stacked.id),
        defeated: isEnemyDefeated(stacked.id),
        turnEnded: !isTowerEnemy(stacked) && !isSandboxMode(s) && !!stacked.exhausted,
        animating: stacked.id === animatingEnemyId.value,
      })),
      enemyHp:
        enemyAnchor && s && canUseGmTools.value
          ? (() => {
              const group = swarmGroupForEnemy(s, enemyAnchor.id, swarmGroups);
              if (
                isSoloSwarmMemberSelected.value &&
                selectedEnemyId.value === enemyAnchor.id &&
                group &&
                group.size > 1
              ) {
                const memberHp = getSwarmMemberHp(getEffectiveEnemyHp(enemyAnchor, s), group.size);
                return { currentHp: memberHp, maxHp: getSwarmMaxHp(1) };
              }
              return {
                currentHp: getEffectiveEnemyHp(enemyAnchor, s),
                maxHp: getEffectiveEnemyMaxHp(enemyAnchor, s),
              };
            })()
          : undefined,
      showSwarmHp: (() => {
        if (!enemyAnchor || !s) return true;
        if (isSoloSwarmMemberSelected.value && selectedEnemyId.value === enemyAnchor.id) {
          return true;
        }
        const group = swarmGroupForEnemy(s, enemyAnchor.id, swarmGroups);
        if (!group) return true;
        return swarmCanonicalDisplayId(s, group.memberIds) === enemyAnchor.id;
      })(),
      effectStacks: player?.effects ?? enemyAnchor?.effects,
      turnEnded: player
        ? !isSandboxMode(s) &&
          s.roundPhase !== "deployment" &&
          s.actedPlayerIds.includes(player.id)
        : !!(enemyAnchor && !isTowerEnemy(enemyAnchor) && !isSandboxMode(s) && enemyAnchor.exhausted),
      playerDowned: player ? isPlayerDowned(player) : false,
      playerPortraitUrl: player?.characterSheetId
        ? portraitUrlFor(player.characterSheetId)
        : null,
      enemyPortraitUrl:
        enemyAnchor && enemyAnchor.kind !== "tower"
          ? enemyPortraitUrlForName(enemyAnchor.name)
          : null,
      enemyPortraitBg: enemyAnchor ? enemyPortraitBgFor(enemyAnchor) : null,
      hasSeed,
      kopisToken: (boardTokensByKey.value.get(coordKey(c.x, c.y)) ?? []).length > 0,
      kopisTokenMine: (boardTokensByKey.value.get(coordKey(c.x, c.y)) ?? []).some(
        (t) => t.ownerId === yourPlayerId.value,
      ),
      kopisMarked: enemyAnchor ? kopisMarkedEnemyIds.value.has(enemyAnchor.id) : false,
      trapLine: trapLineKeys.value.has(coordKey(c.x, c.y)),
      trapWeapon: trapWeaponKeys.value.has(coordKey(c.x, c.y)),
      attractorZone: attractorZoneOnlyKeys.value.has(coordKey(c.x, c.y)),
      attractorCenter: attractorCenterKeys.value.has(coordKey(c.x, c.y)),
      attractorVoid: attractorCenterKeys.value.get(coordKey(c.x, c.y))?.void ?? false,
      attractorPreviewZone: attractorPreviewZoneOnlyKeys.value.has(coordKey(c.x, c.y)),
      attractorPreviewCenter: attractorPreviewCenterKeys.value.has(coordKey(c.x, c.y)),
      attractorPreviewVoid: attractorPreviewCenterKeys.value.get(coordKey(c.x, c.y))?.void ?? false,
      towerOwnerHue:
        enemyAnchor?.kind === "tower" && enemyAnchor.ownerPlayerId
          ? hueFromId(enemyAnchor.ownerPlayerId)
          : null,
      tileEffects: tile?.tileEffects,
      outOfLineOfSight: outOfLineOfSightKeys.value.has(ck),
      tileAppearanceUrl: tile?.appearanceKey ? tileAppearanceUrlFor(tile.appearanceKey) : null,
      tileOverlayUrl: tile?.overlayKey ? tileAppearanceUrlFor(tile.overlayKey) : null,
      tileFeatureUrl: tile?.featureKey ? tileAppearanceUrlFor(tile.featureKey) : null,
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
      paintbrushPreview: null,
    });
  }

  if (
    canUseGmTools.value &&
    gmEffectiveActiveTool.value === "paintbrush" &&
    !paintbrushEyedropperActive.value &&
    hoveredCell.value &&
    paintbrushSuppressPreviewKey.value !==
      coordKey(hoveredCell.value.x, hoveredCell.value.y) &&
    !paintbrushDragStickyPreviews.value[coordKey(hoveredCell.value.x, hoveredCell.value.y)]
  ) {
    const { x, y } = hoveredCell.value;
    const previewCell = map.get(boardCellKey(x, y));
    if (previewCell) {
      const tile = previewCell.tile;
      const showColor = paintbrushEnableColor.value;
      const showAppearance = paintbrushEnableAppearance.value;
      const showOverlay = paintbrushEnableOverlay.value;
      const showFeature = paintbrushEnableFeature.value;
      const showAppearanceTint = paintbrushEnableAppearanceTint.value;
      const showOverlayTint = paintbrushEnableOverlayTint.value;
      const showFeatureTint = paintbrushEnableFeatureTint.value;
      const showRotation = paintbrushEnableRotation.value;
      const showFlip = paintbrushEnableFlip.value;
      if (
        showColor ||
        showAppearance ||
        showOverlay ||
        showFeature ||
        showAppearanceTint ||
        showOverlayTint ||
        showFeatureTint ||
        showRotation ||
        showFlip
      ) {
        const placement = peekPaintbrushPlacement(x, y);
        const brushRotation = showRotation
          ? paintbrushAutoRotate.value
            ? (placement.imageRotation ?? 0)
            : paintbrushImageRotation.value
          : 0;
        const brushFlip = showFlip ? paintbrushImageFlip.value : false;
        const paintingAppearance = showAppearance && placement.appearanceKey !== undefined;
        const paintingOverlay = showOverlay && placement.overlayKey !== undefined;
        const paintingFeature = showFeature && placement.featureKey !== undefined;
        const previewBaseColor = showColor ? paintbrushBaseColor.value : null;
        const previewAppearanceUrl = showAppearance ? placement.appearanceUrl : null;
        const previewOverlayUrl = showOverlay ? placement.overlayUrl : null;
        const previewFeatureUrl = showFeature ? placement.featureUrl : null;
        // Full cosmetic composite so we can hide the live layers under the preview.
        // When a layer is enabled and the brush has an explicit value (including null =
        // clear), use that. Fall back to the live tile only when the brush leaves the
        // layer untouched (undefined / enable off).
        previewCell.paintbrushPreview = {
          baseColor: previewBaseColor ?? tile?.baseColor ?? null,
          appearanceUrl: paintingAppearance
            ? previewAppearanceUrl
            : previewCell.tileAppearanceUrl,
          overlayUrl: paintingOverlay ? previewOverlayUrl : previewCell.tileOverlayUrl,
          featureUrl: paintingFeature ? previewFeatureUrl : previewCell.tileFeatureUrl,
          appearanceTint: showAppearanceTint
            ? paintbrushAppearanceTint.value
            : (tile?.appearanceTint ?? null),
          overlayTint: showOverlayTint
            ? paintbrushOverlayTint.value
            : (tile?.overlayTint ?? null),
          featureTint: showFeatureTint
            ? paintbrushFeatureTint.value
            : (tile?.featureTint ?? null),
          appearanceRotation: paintingAppearance
            ? brushRotation
            : (tile?.appearanceRotation ?? 0),
          appearanceFlip: paintingAppearance ? brushFlip : !!tile?.appearanceFlip,
          overlayRotation: paintingOverlay
            ? brushRotation
            : (tile?.overlayRotation ?? 0),
          overlayFlip: paintingOverlay ? brushFlip : !!tile?.overlayFlip,
          featureRotation: paintingFeature
            ? brushRotation
            : (tile?.featureRotation ?? 0),
          featureFlip: paintingFeature ? brushFlip : !!tile?.featureFlip,
        };
      }
    }
  }

  const dragStickies = paintbrushDragStickyPreviews.value;
  for (const [stickyKey, entry] of Object.entries(dragStickies)) {
    const [xs, ys] = stickyKey.split(",");
    const stickyCell = map.get(boardCellKey(Number(xs), Number(ys)));
    if (stickyCell) stickyCell.paintbrushPreview = entry.preview;
  }

  if (canUseGmTools.value && stainGeyserPlacementActive.value) {
    const overlayUrl = stainGeyserPreviewOverlayUrl.value;
    for (const t of stainGeyserPreviewTiles.value) {
      const previewCell = map.get(boardCellKey(t.x, t.y));
      if (!previewCell || previewCell.paintbrushPreview) continue;
      const tile = previewCell.tile;
      previewCell.paintbrushPreview = {
        baseColor: tile?.baseColor ?? null,
        appearanceUrl: previewCell.tileAppearanceUrl,
        overlayUrl: overlayUrl ?? previewCell.tileOverlayUrl,
        featureUrl: previewCell.tileFeatureUrl,
        appearanceTint: tile?.appearanceTint ?? null,
        overlayTint: tile?.overlayTint ?? null,
        featureTint: tile?.featureTint ?? null,
        appearanceRotation: tile?.appearanceRotation ?? 0,
        appearanceFlip: !!tile?.appearanceFlip,
        overlayRotation: tile?.overlayRotation ?? 0,
        overlayFlip: !!tile?.overlayFlip,
        featureRotation: tile?.featureRotation ?? 0,
        featureFlip: !!tile?.featureFlip,
      };
    }
  }

  if (canUseGmTools.value && gorgenautAgnosiaPlacementActive.value) {
    const overlayUrl = gorgenautAgnosiaPreviewOverlayUrl.value;
    for (const t of gorgenautAgnosiaPreviewTiles.value) {
      const previewCell = map.get(boardCellKey(t.x, t.y));
      if (!previewCell || previewCell.paintbrushPreview) continue;
      const tile = previewCell.tile;
      previewCell.paintbrushPreview = {
        baseColor: tile?.baseColor ?? null,
        appearanceUrl: previewCell.tileAppearanceUrl,
        overlayUrl: overlayUrl ?? previewCell.tileOverlayUrl,
        featureUrl: previewCell.tileFeatureUrl,
        appearanceTint: tile?.appearanceTint ?? null,
        overlayTint: tile?.overlayTint ?? null,
        featureTint: tile?.featureTint ?? null,
        appearanceRotation: tile?.appearanceRotation ?? 0,
        appearanceFlip: !!tile?.appearanceFlip,
        overlayRotation: tile?.overlayRotation ?? 0,
        overlayFlip: !!tile?.overlayFlip,
        featureRotation: tile?.featureRotation ?? 0,
        featureFlip: !!tile?.featureFlip,
      };
    }
  }

  return map;
});

const boardCellRows = computed(() => {
  const states = cellStateByKey.value;
  const teleportingIds = teleportingPlayerIds.value;
  const animatingId = animatingEnemyId.value;
  return cells.value.map((c) => {
    const cell = states.get(c.key);
    if (!cell) return null;
    const player = cell.player;
    const enemyAnchor = cell.enemyAnchor;
    return {
      x: c.x,
      y: c.y,
      key: c.key,
      cell,
      isHovered: hoveredKey.value === c.key,
      canDragDeploy: !!player && canDragDeploy(player),
      isPlayerSelected: !!player && (isPlayerSelected(player.id) || isPlayerBulkSelected(player.id)),
      isEnemySelected:
        (!!enemyAnchor && (isEnemySelected(enemyAnchor.id) || isEnemyBulkSelected(enemyAnchor.id))) ||
        !!cell.stackedEnemies?.some((e) => e.selected),
      isBulkTileSelected: isTileBulkSelected(c.x, c.y),
      playerHue: player ? hueFromId(player.id) : null,
      enemyDying:
        (!!enemyAnchor && isEnemyDying(enemyAnchor.id)) ||
        !!cell.stackedEnemies?.some((e) => e.dying),
      enemyDefeated:
        (!!enemyAnchor && isEnemyDefeated(enemyAnchor.id)) ||
        !!cell.stackedEnemies?.some((e) => e.defeated),
      enemyPendingRemoval: !!enemyAnchor && isEnemyPendingRemoval(enemyAnchor.id),
      playerTeleporting: !!player && teleportingIds.has(player.id),
      enemyAnimating:
        enemyAnchor?.id === animatingId ||
        !!cell.stackedEnemies?.some((e) => e.enemy.id === animatingId),
      playerHp: player?.hp,
      enemyHp: enemyAnchor?.hp,
      stackedEnemyKey: cell.stackedEnemies?.map((e) => `${e.enemy.id}:${e.selected}:${e.hp?.currentHp ?? ""}`).join("|") ?? "",
    };
  }).filter((row): row is NonNullable<typeof row> => row != null);
});

const tooltipData = computed(() => {
  const cell = hoveredCell.value;
  const s = gameState.value;
  const occ = occupancy.value;
  if (!cell || !s || !occ) return null;
  const key = coordKey(cell.x, cell.y);
  const tile = tileAt(s.tiles, cell.x, cell.y);
  if (!tile) return null;
  const enemiesAtTile = s.enemies.filter((e) => e.x === cell.x && e.y === cell.y);
  const enemyEntries = enemiesAtTile
    .filter((e) => !isTowerEnemy(e))
    .map((anchor) => {
      const group = swarmGroupForEnemy(s, anchor.id);
      const baseName = anchor.name ?? "Enemy";
      if (group && group.size > 1) {
        const solo =
          isSoloSwarmMemberSelected.value && selectedEnemyId.value === anchor.id;
        const memberHp = getSwarmMemberHp(group.currentHp, group.size);
        return {
          ...anchor,
          displayName: solo ? `${baseName} (Swarm member)` : `${baseName} (Swarm · ${group.size})`,
          displayHp: solo ? memberHp : group.currentHp,
          displayMaxHp: solo ? getSwarmMaxHp(1) : group.maxHp,
        };
      }
      return {
        ...anchor,
        displayName: baseName,
        displayHp: getEffectiveEnemyHp(anchor, s),
        displayMaxHp: getEffectiveEnemyMaxHp(anchor, s),
      };
    });
  const towers = enemiesAtTile.filter((e) => isTowerEnemy(e));
  const moveCost = (() => {
    const sel = boardSelection.value;
    if (!sel) return null;
    if (sel.kind === "player") {
      const player = s.players.find((p) => p.id === sel.id);
      if (!player) return null;
      if (!isMovementStepAdjacent(player, cell, playerAllowsDiagonalMovement(player))) return null;
      return movementStepCost(s, player, cell.x, cell.y);
    }
    const enemy = s.enemies.find((e) => e.id === sel.id);
    if (!enemy) return null;
    if (!isMovementStepAdjacent(enemy, cell, false)) return null;
    const swarm = swarmGroupForEnemy(s, enemy.id) != null;
    return enemyMoveStepCost(s, enemy, enemy.x, enemy.y, cell.x, cell.y, { swarm });
  })();
  return {
    x: cell.x,
    y: cell.y,
    tile,
    tileName: tile.name,
    moveCost,
    players: occ.playerByKey.has(key) ? [occ.playerByKey.get(key)!] : [],
    enemies: enemyEntries,
    towers,
    objects: occ.terrainObjectsByKey.get(key) ?? [],
    attractors: (() => {
      const attractors = s.combat?.attractors ?? [];
      const entries: { id: string; void: boolean; ownerId: string; zone: boolean }[] = [];
      for (const a of attractors) {
        if (a.x === cell.x && a.y === cell.y) {
          entries.push({ id: a.id, void: a.void, ownerId: a.ownerId, zone: false });
          continue;
        }
        if (tilesInAttractorZone(a).some((t) => t.x === cell.x && t.y === cell.y)) {
          entries.push({ id: `zone-${a.id}`, void: a.void, ownerId: a.ownerId, zone: true });
        }
      }
      return entries;
    })(),
    boardTokens: boardTokensByKey.value.get(key) ?? [],
  };
});

const tooltipStyle = computed(() => {
  const cell = hoveredCell.value;
  const s = gameState.value;
  if (!cell || !s) return null;
  const gridW = boardWidthPx.value;
  const gridH = gridW * (s.height / s.width);
  const cellW = (gridW - (s.width - 1) * BOARD_CELL_GAP) / s.width;
  const cellH = (gridH - (s.height - 1) * BOARD_CELL_GAP) / s.height;
  const cellLeft = cell.x * (cellW + BOARD_CELL_GAP);
  const cellTop = cell.y * (cellH + BOARD_CELL_GAP);
  const centerX = cellLeft + cellW / 2;
  return {
    left: `${panX.value + centerX * scale.value}px`,
    top: `${panY.value + cellTop * scale.value}px`,
    transform: "translate(-50%, calc(-100% - 6px))",
  };
});

function cellCenterStyle(x: number, y: number) {
  const s = gameState.value;
  if (!s) return undefined;
  const gridW = boardWidthPx.value;
  const gridH = gridW * (s.height / s.width);
  const cellW = (gridW - (s.width - 1) * BOARD_CELL_GAP) / s.width;
  const cellH = (gridH - (s.height - 1) * BOARD_CELL_GAP) / s.height;
  const centerX = x * (cellW + BOARD_CELL_GAP) + cellW / 2;
  const centerY = y * (cellH + BOARD_CELL_GAP) + cellH / 2;
  const tokenSize = Math.min(cellW, cellH) - 8;
  return {
    left: `${panX.value + centerX * scale.value}px`,
    top: `${panY.value + centerY * scale.value}px`,
    width: `${tokenSize * scale.value}px`,
    height: `${tokenSize * scale.value}px`,
    transform: "translate(-50%, -50%)",
  };
}

function damageIndicatorStyle(x: number, y: number) {
  const base = cellCenterStyle(x, y);
  if (!base) return undefined;
  const s = gameState.value;
  if (!s) return undefined;
  const gridW = boardWidthPx.value;
  const gridH = gridW * (s.height / s.width);
  const cellH = (gridH - (s.height - 1) * BOARD_CELL_GAP) / s.height;
  const tokenBottomOffset = ((cellH - 8) / 2) * scale.value;
  return {
    ...base,
    "--damage-rise": `${tokenBottomOffset}px`,
  };
}

const teleportOverlayPlayer = computed(() => {
  const anim = teleportAnimation.value;
  const s = gameState.value;
  if (!anim || !s) return null;
  return s.players.find((p) => p.id === anim.playerId) ?? null;
});

const teleportOverlayStyle = computed(() => {
  const anim = teleportAnimation.value;
  if (!anim?.animating) return null;
  const x = teleportOverlayAtDest.value ? anim.toX : anim.fromX;
  const y = teleportOverlayAtDest.value ? anim.toY : anim.fromY;
  return cellCenterStyle(x, y);
});

let teleportFinishTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => teleportAnimation.value?.animating,
  (animating) => {
    if (teleportFinishTimer) {
      clearTimeout(teleportFinishTimer);
      teleportFinishTimer = null;
    }
    if (!animating) {
      teleportOverlayAtDest.value = false;
      return;
    }
    teleportOverlayAtDest.value = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        teleportOverlayAtDest.value = true;
      });
    });
    teleportFinishTimer = setTimeout(() => finishTeleport(), 450);
  },
);

function onTeleportOverlayTransitionEnd(e: TransitionEvent) {
  if (e.propertyName !== "left" || !teleportOverlayAtDest.value) return;
  if (teleportFinishTimer) {
    clearTimeout(teleportFinishTimer);
    teleportFinishTimer = null;
  }
  finishTeleport();
}

const enemyMoveOverlayStyle = computed(() => {
  const anim = enemyMoveAnimation.value;
  if (!anim) return null;
  const s = gameState.value;
  if (!s) return null;
  const x = enemyMoveOverlayAtDest.value ? anim.toX : anim.fromX;
  const y = enemyMoveOverlayAtDest.value ? anim.toY : anim.fromY;
  const enemy = s.enemies.find((e) => e.id === anim.enemyId);
  const enemyScale = enemy ? getEnemyScale(enemy) : 1;
  if (enemyScale <= 1) return cellCenterStyle(x, y);

  const gridW = boardWidthPx.value;
  const gridH = gridW * (s.height / s.width);
  const cellW = (gridW - (s.width - 1) * BOARD_CELL_GAP) / s.width;
  const cellH = (gridH - (s.height - 1) * BOARD_CELL_GAP) / s.height;
  const inset = 8;
  const offset = 4;
  const tokenW = enemyScale * cellW + (enemyScale - 1) * BOARD_CELL_GAP - inset;
  const tokenH = enemyScale * cellH + (enemyScale - 1) * BOARD_CELL_GAP - inset;
  const left = x * (cellW + BOARD_CELL_GAP) + offset;
  const top = y * (cellH + BOARD_CELL_GAP) + offset;
  return {
    left: `${panX.value + left * scale.value}px`,
    top: `${panY.value + top * scale.value}px`,
    width: `${tokenW * scale.value}px`,
    height: `${tokenH * scale.value}px`,
  };
});

const enemyMoveOverlayPortraitUrl = computed(() => {
  const anim = enemyMoveAnimation.value;
  const s = gameState.value;
  if (!anim || !s) return null;
  const enemy = s.enemies.find((e) => e.id === anim.enemyId);
  if (!enemy || enemy.kind === "tower") return null;
  return enemyPortraitUrlForName(enemy.name);
});

const enemyMoveOverlayIsFortification = computed(() => {
  const anim = enemyMoveAnimation.value;
  const s = gameState.value;
  if (!anim || !s) return false;
  const enemy = s.enemies.find((e) => e.id === anim.enemyId);
  return !!enemy && isFortificationEnemy(enemy);
});

const enemyMoveOverlayBg = computed(() => {
  const anim = enemyMoveAnimation.value;
  const s = gameState.value;
  if (!anim || !s) return null;
  const enemy = s.enemies.find((e) => e.id === anim.enemyId);
  if (!enemy || enemy.kind === "tower") return null;
  const listing = getEnemyListingByName(enemy.name);
  const url = enemyPortraitUrlForName(enemy.name);
  if (!listing?.portrait || !url) return null;
  return portraitBackgroundFor(listing.portrait, url);
});

const enemyMoveOverlaySelected = computed(() => {
  const anim = enemyMoveAnimation.value;
  if (!anim) return false;
  return isEnemySelected(anim.enemyId) || isEnemyBulkSelected(anim.enemyId);
});

const teleportOverlaySelected = computed(() => {
  const anim = teleportAnimation.value;
  if (!anim) return false;
  return isPlayerSelected(anim.playerId) || isPlayerBulkSelected(anim.playerId);
});

let enemyMoveFinishTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => enemyMoveAnimation.value?.animating,
  (animating) => {
    if (enemyMoveFinishTimer) {
      clearTimeout(enemyMoveFinishTimer);
      enemyMoveFinishTimer = null;
    }
    if (!animating) {
      enemyMoveOverlayAtDest.value = false;
      return;
    }
    enemyMoveOverlayAtDest.value = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        enemyMoveOverlayAtDest.value = true;
      });
    });
    enemyMoveFinishTimer = setTimeout(() => finishEnemyMove(), 450);
  },
);

function onEnemyMoveOverlayTransitionEnd(e: TransitionEvent) {
  if (e.propertyName !== "left" || !enemyMoveOverlayAtDest.value) return;
  if (enemyMoveFinishTimer) {
    clearTimeout(enemyMoveFinishTimer);
    enemyMoveFinishTimer = null;
  }
  finishEnemyMove();
}

function playerLabel(player: Player): string {
  return player.nickname ?? player.id;
}

function enemyLabel(enemy: Enemy): string {
  return enemy.name ?? "Enemy";
}

function terrainObjectLabel(object: TerrainObject): string {
  return object.name ?? "Object";
}

function attractorTooltipLabel(entry: { void: boolean; ownerId: string; zone: boolean }): string {
  const owner = gameState.value?.players.find((p) => p.id === entry.ownerId);
  const ownerName = owner ? playerLabel(owner) : entry.ownerId;
  if (entry.zone) return `Attractor zone · ${ownerName}`;
  return `${entry.void ? "Void Attractor" : "Attractor"} · ${ownerName}`;
}

function formatHp(current: number | undefined, max: number): string {
  const hp = current ?? 0;
  return max > 0 ? `${hp}/${max}` : String(hp);
}

function effectEntries(stacks?: EffectStacks) {
  if (!stacks) return [];
  return Object.entries(stacks)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => ({ id, stacks: count }));
}

function effectTooltipLabel(id: string, stacks: number): string {
  return `${id}: ${stacks}`;
}

function boardTokenTooltipLabel(token: { ownerId: string; kind: string }): string {
  const owner = gameState.value?.players.find((p) => p.id === token.ownerId);
  const ownerName = owner ? playerLabel(owner) : token.ownerId;
  const yours = token.ownerId === yourPlayerId.value;
  return `Kopis token · ${ownerName}${yours ? " (yours — step here for a free weapon attack)" : ""}`;
}

function terrainTooltipLabel(terrain: string[]): string {
  return terrain.map((id) => terrainTypeDisplayName(id)).join(", ");
}

function gmEnemyMoveDestAt(x: number, y: number): { x: number; y: number } | null {
  const s = gameState.value;
  const id = selectedEnemyId.value;
  if (!s || !id) return null;
  const key = boardCellKey(x, y);
  if (!gmEnemyMoveTargetKeys.value.has(key)) return null;

  const group = swarmGroupForEnemy(s, id);
  if (group) return { x, y };

  const enemy = s.enemies.find((e) => e.id === id);
  if (!enemy) return null;
  const scale = getEnemyScale(enemy);
  const occ = occupancy.value ?? undefined;
  const deltas = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  const clickDx = x - enemy.x;
  const clickDy = y - enemy.y;
  let best: { x: number; y: number; score: number } | null = null;
  for (const { dx, dy } of deltas) {
    const anchorX = enemy.x + dx;
    const anchorY = enemy.y + dy;
    if (validateEnemyFootprint(s, anchorX, anchorY, scale, id, occ, enemy) !== null) continue;
    let matches = false;
    for (const tile of enemyFootprintTiles(anchorX, anchorY, scale)) {
      if (tile.x === x && tile.y === y) {
        matches = true;
        break;
      }
    }
    if (!matches) continue;
    const score = dx * clickDx + dy * clickDy;
    if (!best || score > best.score) best = { x: anchorX, y: anchorY, score };
  }
  return best ? { x: best.x, y: best.y } : null;
}

function sendEnemyMove(
  enemyId: string,
  destX: number,
  destY: number,
  opts: { soloSwarmMember?: boolean; animateFrom?: { x: number; y: number }; animateMoverId?: string },
) {
  const s = gameState.value;
  if (!s) return;
  const moverId = opts.animateMoverId ?? enemyId;
  const mover = s.enemies.find((e) => e.id === moverId);
  const from = opts.animateFrom ?? (mover ? { x: mover.x, y: mover.y } : { x: destX, y: destY });
  gateProvoke(previewEnemyMoveProvokes(s, enemyId, destX, destY, opts), () => {
    startEnemyMove(moverId, from, { x: destX, y: destY });
    send({ type: "moveEnemy", enemyId, x: destX, y: destY, soloSwarmMember: opts.soloSwarmMember });
  });
}

function tryMoveSelectedEnemyToDest(destX: number, destY: number): boolean {
  const s = gameState.value;
  const selected = selectedEnemyId.value;
  if (!s || !selected) return false;
  if (swarmChipOpen.value) return false;
  if (!ensureSwarmChipResolved(selected)) return false;
  const enemy = s.enemies.find((e) => e.id === selected);
  if (!enemy) {
    clearBoardSelection();
    return false;
  }
  if (!canGmMoveEnemies(s)) return false;

  const group = swarmGroupForEnemy(s, selected);
  if (group && isSoloSwarmMemberSelected.value) {
    if (!canSwarmMemberReachDest(s, selected, destX, destY, occupancy.value ?? undefined)) {
      return false;
    }
    sendEnemyMove(selected, destX, destY, {
      soloSwarmMember: true,
      animateFrom: { x: s.enemies.find((e) => e.id === selected)!.x, y: s.enemies.find((e) => e.id === selected)!.y },
      animateMoverId: selected,
    });
    return true;
  }
  if (group) {
    const moverId = pickSwarmMoveMember(s, group.memberIds, destX, destY);
    if (!moverId) return false;
    const mover = s.enemies.find((e) => e.id === moverId)!;
    sendEnemyMove(selected, destX, destY, {
      animateFrom: { x: mover.x, y: mover.y },
      animateMoverId: moverId,
    });
    return true;
  }

  const scale = getEnemyScale(enemy);
  if (validateEnemyFootprint(s, destX, destY, scale, selected, occupancy.value ?? undefined, enemy) !== null) {
    return false;
  }
  sendEnemyMove(selected, destX, destY, { animateFrom: { x: enemy.x, y: enemy.y } });
  return true;
}

function handleKataptyPick(enemyId: string): boolean {
  const s = gameState.value;
  if (!s || boardActionMode.value !== "kataptyPick") return false;
  const enemy = s.enemies.find((e) => e.id === enemyId);
  if (!enemy || isTowerEnemy(enemy)) return true;
  if (!kataptyPickKeys.value.has(coordKey(enemy.x, enemy.y))) return true;
  const ids = kataptyTargetIds.value;
  const idx = ids.indexOf(enemy.id);
  if (idx >= 0) {
    kataptyTargetIds.value = ids.filter((id) => id !== enemy.id);
  } else if (ids.length < 3) {
    kataptyTargetIds.value = [...ids, enemy.id];
  }
  if (kataptyTargetIds.value.length === 3) {
    sendPlayerAction({
      action: "armorAction",
      kind: "katapty_end_turn",
      targetEnemyIds: [...kataptyTargetIds.value],
    });
    clearBoardActionMode();
  }
  return true;
}

let enemyClickTimer: ReturnType<typeof setTimeout> | null = null;

function boardTargetingContext() {
  return { omnistrikeStep: omnistrikeStep.value };
}

function onEnemyCellClick(x: number, y: number, enemyId: string) {
  if (canUseGmTools.value && gmEffectiveActiveTool.value === "paintbrush") {
    handlePaintbrushCellAction(x, y);
    return;
  }
  if (tryGmDamageEffectToken({ kind: "enemy", id: enemyId })) return;
  if (
    props.role === "player" &&
    routesTokenClickToCellTargeting(boardActionMode.value, boardTargetingContext())
  ) {
    handleCombatCellClick(x, y);
    return;
  }
  // Occupied destinations: piece click stops cell propagation, so complete
  // pending spawn/move here instead of only toggling selection.
  if (canUseGmTools.value) {
    if (trySpawnEnemyAt(x, y)) return;
    if (
      selectedEnemyId.value &&
      selectedEnemyId.value !== enemyId &&
      gmActiveTool.value === "forceMove" &&
      gmForceMovableKeys.value.has(boardCellKey(x, y))
    ) {
      send({
        type: "gmForceMove",
        target: { kind: "enemy", id: selectedEnemyId.value },
        x,
        y,
        ...(isSoloSwarmMemberSelected.value ? { soloSwarmMember: true } : {}),
      });
      return;
    }
    if (selectedEnemyId.value && selectedEnemyId.value !== enemyId && tryMoveSelectedEnemy(x, y)) {
      return;
    }
  }
  if (enemyClickTimer) clearTimeout(enemyClickTimer);
  enemyClickTimer = setTimeout(() => {
    enemyClickTimer = null;
    toggleBoardEnemy(enemyId);
    if (canUseGmTools.value && gmEffectiveActiveTool.value === "select") {
      applySameTypeBulkSelection(enemyId);
    }
  }, 250);
}

function onEnemyCellDblClick(_x: number, _y: number, enemyId: string) {
  if (canUseGmTools.value && gmEffectiveActiveTool.value === "paintbrush") return;
  if (enemyClickTimer) {
    clearTimeout(enemyClickTimer);
    enemyClickTimer = null;
  }
  const s = gameState.value;
  if (props.role !== "gm" || !s) return;
  const group = swarmGroupForEnemy(s, enemyId);
  if (!group || group.size < 2) return;
  selectBoardEnemyMember(enemyId);
}

function applySameTypeBulkSelection(enemyId: string) {
  if (gmSelectTargetKind.value !== "enemies" || !gmSelectSameEnemyType.value) return;
  const s = gameState.value;
  const enemy = s?.enemies.find((e) => e.id === enemyId);
  if (!s || !enemy) return;
  const ids = enemy.name
    ? s.enemies.filter((e) => !!e.name && e.name === enemy.name).map((e) => e.id)
    : [enemy.id];
  setGmBulkSelection({ kind: "enemies", ids });
}

function selectOccupantAt(x: number, y: number): boolean {
  const occ = occupancy.value;
  if (!occ) return false;
  const key = coordKey(x, y);
  const player = occ.playerByKey.get(key);
  if (player) {
    selectBoardPlayer(player.id, player.characterSheetId);
    return true;
  }
  const enemy = occ.enemyByKey.get(key);
  if (enemy) {
    toggleBoardEnemy(enemy.id);
    return true;
  }
  return false;
}

function arrowTarget(key: string, origin: { x: number; y: number }): { x: number; y: number } | null {
  const map: Record<string, { x: number; y: number }> = {
    ArrowUp: { x: origin.x, y: origin.y - 1 },
    ArrowDown: { x: origin.x, y: origin.y + 1 },
    ArrowLeft: { x: origin.x - 1, y: origin.y },
    ArrowRight: { x: origin.x + 1, y: origin.y },
  };
  return map[key] ?? null;
}

function tryMove(x: number, y: number) {
  if (props.role !== "player") return;
  if (boardActionMode.value === "sprint") return;
  if (!yourPlayerId.value || !gameState.value) return;
  if (!canPlayerMove(gameState.value, yourPlayerId.value)) return;
  const deploying = gameState.value.roundPhase === "deployment";
  if (!deploying && !activePlayerSelected.value) return;
  const cell = cellStateByKey.value.get(boardCellKey(x, y));
  const flying = boardActionMode.value === "aegis";
  if (!deploying && !cell?.movable && !cell?.deployable && !cell?.moveSecondary && !cell?.moveAegis) return;
  if (deploying && !cell?.deployable) return;
  const s = gameState.value;
  const id = yourPlayerId.value;
  const path = [{ x, y }];
  if (deploying) {
    send({ type: "move", x, y });
    return;
  }
  const provokeOpts = flying ? { flying: true } : {};
  gateProvoke(previewPathProvokes(s, id, path, provokeOpts), () => sendMovePath(path, flying));
}

function canDragDeploy(player: Player): boolean {
  return (
    props.role === "player" &&
    !!yourPlayerId.value &&
    player.id === yourPlayerId.value &&
    !!gameState.value &&
    gameState.value.roundPhase === "deployment"
  );
}

function onDeployPointerDown(_e: PointerEvent, player: Player) {
  if (!canDragDeploy(player)) return;
  draggingDeploy.value = true;
  const onUp = (ev: PointerEvent) => {
    window.removeEventListener("pointerup", onUp);
    onDeployPointerUp(ev);
  };
  window.addEventListener("pointerup", onUp);
}

function onDeployPointerUp(e: PointerEvent) {
  if (!draggingDeploy.value) return;
  draggingDeploy.value = false;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const cell = el?.closest("[data-cell-x]") as HTMLElement | null;
  if (!cell) return;
  const x = Number(cell.dataset.cellX);
  const y = Number(cell.dataset.cellY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  tryMove(x, y);
}

function attackTilesForAction(action: Extract<PlayerAction, { action: "attack" }>): { x: number; y: number }[] {
  const me = yourPlayer.value;
  const s = gameState.value;
  const ctx = attackContext.value;
  if (!me || !s || !ctx) return [];
  if (isRangeTargetAttack(ctx.spec)) {
    const ids = action.targetEnemyIds;
    if (!ids?.length) return [];
    return ids.flatMap((id) => {
      const e = s.enemies.find((en) => en.id === id);
      return e ? [{ x: e.x, y: e.y }] : [];
    });
  }
  const direction = action.direction;
  const base = ctx.origin ?? { x: me.x, y: me.y };
  const origin =
    action.anchorX != null && action.anchorY != null
      ? patternOriginFromAnchor({ x: action.anchorX, y: action.anchorY }, ctx.spec.anchorTile, direction)
      : base;
  return collectAttackTiles(
    s,
    origin,
    ctx.spec,
    direction,
    action.elevationBonusTile ?? elevBonusTile.value ?? undefined,
    ctx.me,
  );
}

function submitAttackAction(action: Extract<PlayerAction, { action: "attack" }>) {
  const me = yourPlayer.value;
  const s = gameState.value;
  const ctx = attackContext.value;
  if (!me || !s || !ctx) return;
  const tiles = attackTilesForAction(action);
  if (weaponHasBreakerTag(me, ctx.weapon) && attackTargetsSwarm(s, tiles)) {
    pendingAttackAction.value = action;
    breakerPromptOpen.value = true;
    return;
  }
  if (ctx.equipmentUse && forceProjectionOrigin.value) {
    const origin = forceProjectionOrigin.value;
    sendPlayerAction({
      action: "useEquipment",
      detail: me.equipment,
      projectionX: origin.x,
      projectionY: origin.y,
      direction: action.direction,
      anchorX: action.anchorX,
      anchorY: action.anchorY,
      targetEnemyIds: action.targetEnemyIds,
      weaponName: ctx.weapon,
      useBreaker: action.useBreaker,
    });
    clearBoardActionMode();
    return;
  }
  sendPlayerAction(action);
  clearBoardActionMode();
}

function onBreakerConfirm(useBreaker: boolean) {
  const action = pendingAttackAction.value;
  if (!action) return;
  const ctx = attackContext.value;
  const me = yourPlayer.value;
  if (ctx?.equipmentUse && forceProjectionOrigin.value && me) {
    const origin = forceProjectionOrigin.value;
    sendPlayerAction({
      action: "useEquipment",
      detail: me.equipment,
      projectionX: origin.x,
      projectionY: origin.y,
      direction: action.direction,
      anchorX: action.anchorX,
      anchorY: action.anchorY,
      targetEnemyIds: action.targetEnemyIds,
      weaponName: ctx.weapon,
      useBreaker,
    });
  } else {
    sendPlayerAction({ ...action, useBreaker });
  }
  pendingAttackAction.value = null;
  breakerPromptOpen.value = false;
  clearBoardActionMode();
}

function onBreakerCancel() {
  pendingAttackAction.value = null;
  breakerPromptOpen.value = false;
}

function submitRangeAttackFromSelection() {
  if (rangeAttackTargetIds.value.length === 0 && rangeAttackObstacleCoords.value.length === 0) {
    return;
  }
  submitAttackAction({
    action: "attack",
    direction: attackDirection.value,
    ...(rangeAttackTargetIds.value.length
      ? { targetEnemyIds: [...rangeAttackTargetIds.value] }
      : {}),
    ...(rangeAttackObstacleCoords.value.length
      ? { targetObstacleCoords: [...rangeAttackObstacleCoords.value] }
      : {}),
  });
}

function onTargetPickerConfirm(selectedIds: string[]) {
  const tileIds = new Set(targetPickerTileIds.value);
  const withoutTile = rangeAttackTargetIds.value.filter((id) => !tileIds.has(id));
  const next = [...withoutTile, ...selectedIds];
  rangeAttackTargetIds.value = next;
  closeTargetPicker();

  const ctx = attackContext.value;
  if (!ctx || !isRangeTargetAttack(ctx.spec)) return;
  const maxTargets = rangeTargetMax(ctx.spec);
  if (next.length + rangeAttackObstacleCoords.value.length >= maxTargets) {
    submitAttackAction({
      action: "attack",
      direction: attackDirection.value,
      targetEnemyIds: next,
      ...(rangeAttackObstacleCoords.value.length
        ? { targetObstacleCoords: [...rangeAttackObstacleCoords.value] }
        : {}),
      ...(elevBonusTile.value
        ? {
            elevationBonusTile: {
              x: elevBonusTile.value.x,
              y: elevBonusTile.value.y,
            },
          }
        : {}),
    });
  }
}

watch(boardActionMode, () => {
  if (targetPickerOpen.value) closeTargetPicker();
});

registerRangeAttackConfirm(submitRangeAttackFromSelection);
onUnmounted(unregisterRangeAttackConfirm);

function handleAttackCellClick(x: number, y: number, targetEnemyId?: string): boolean {
  const me = yourPlayer.value;
  const s = gameState.value;
  const ctx = attackContext.value;
  if (!me || !s || !ctx) return false;

  const key = coordKey(x, y);
  const origin = ctx.origin ?? { x: me.x, y: me.y };
  const attackAction = {
    action: "attack" as const,
    direction: attackDirection.value,
    ...(elevBonusTile.value
      ? {
          elevationBonusTile: {
            x: elevBonusTile.value.x,
            y: elevBonusTile.value.y,
          },
        }
      : {}),
  };

  if (elevationBonusCandidateKeys.value.has(key)) {
    elevBonusTile.value = { x, y };
    return true;
  }

  const attackPlayer = me;
  const attackState = s;
  const attackCtx = ctx;
  function dirsAt(tx: number, ty: number): PatternDirection[] {
    if (origin.x === attackPlayer.x && origin.y === attackPlayer.y) {
      return playerAttackDirectionsAt(attackState, attackPlayer.id, tx, ty, attackCtx.weapon);
    }
    const dirs: PatternDirection[] = [];
    for (const direction of PATTERN_DIRECTIONS) {
      const tiles = collectAttackTiles(attackState, origin, attackCtx.spec, direction);
      if (tiles.some((t) => t.x === tx && t.y === ty)) dirs.push(direction);
    }
    return dirs;
  }

  if (isRangeTargetAttack(ctx.spec)) {
    if (!combatAttackSecondaryKeys.value.has(key)) return false;

    const maxTargets = rangeTargetMax(ctx.spec);
    const selectedCount =
      rangeAttackTargetIds.value.length + rangeAttackObstacleCoords.value.length;
    const rangeLimit = rangeTargetDistance(ctx.spec);
    const occ = occupancy.value;
    const enemiesAtTile = (occ?.enemiesByKey.get(key) ?? []).filter(
      (e) => manhattanDistance(origin, e) <= rangeLimit,
    );

    if (enemiesAtTile.length > 1) {
      const tileIds = enemiesAtTile.map((e) => e.id);
      const alreadyFromTile = rangeAttackTargetIds.value.filter((id) => tileIds.includes(id));
      const slotsLeft = Math.max(0, maxTargets - (selectedCount - alreadyFromTile.length));
      if (slotsLeft <= 0 && alreadyFromTile.length === 0) return true;
      targetPickerTileIds.value = tileIds;
      targetPickerEnemies.value = enemiesAtTile.map((e) => ({
        id: e.id,
        name: e.name ?? "Enemy",
        ...(canUseGmTools.value
          ? {
              hp: getEffectiveEnemyHp(e, s),
              maxHp: getEffectiveEnemyMaxHp(e, s),
            }
          : {}),
      }));
      targetPickerPreSelectedIds.value = alreadyFromTile;
      targetPickerMaxSelectable.value = Math.max(1, Math.min(slotsLeft, enemiesAtTile.length));
      targetPickerOpen.value = true;
      return true;
    }

    const singleEnemyId = enemiesAtTile[0]?.id ?? targetEnemyId;
    if (singleEnemyId) {
      const enemy = s.enemies.find((e) => e.id === singleEnemyId);
      if (!enemy) return false;
      if (manhattanDistance(origin, enemy) > rangeLimit) return false;

      const selected = rangeAttackTargetIds.value;
      if (selected.includes(singleEnemyId)) {
        rangeAttackTargetIds.value = selected.filter((id) => id !== singleEnemyId);
      } else if (selectedCount < maxTargets) {
        const next = [...selected, singleEnemyId];
        rangeAttackTargetIds.value = next;
        if (next.length + rangeAttackObstacleCoords.value.length >= maxTargets) {
          submitAttackAction({
            ...attackAction,
            targetEnemyIds: next,
            ...(rangeAttackObstacleCoords.value.length
              ? { targetObstacleCoords: [...rangeAttackObstacleCoords.value] }
              : {}),
          });
        }
      }
      return true;
    }

    const tile = tileAt(s.tiles, x, y);
    if (isObstacleTile(tile)) {
      if (manhattanDistance(origin, { x, y }) > rangeLimit) return false;
      const selected = rangeAttackObstacleCoords.value;
      const already = selected.some((c) => c.x === x && c.y === y);
      if (already) {
        rangeAttackObstacleCoords.value = selected.filter((c) => !(c.x === x && c.y === y));
      } else if (selectedCount < maxTargets) {
        const next = [...selected, { x, y }];
        rangeAttackObstacleCoords.value = next;
        if (rangeAttackTargetIds.value.length + next.length >= maxTargets) {
          submitAttackAction({
            ...attackAction,
            ...(rangeAttackTargetIds.value.length
              ? { targetEnemyIds: [...rangeAttackTargetIds.value] }
              : {}),
            targetObstacleCoords: next,
          });
        }
      }
      return true;
    }

    if (selectedCount === 0) return true;
    submitAttackAction({
      ...attackAction,
      ...(rangeAttackTargetIds.value.length
        ? { targetEnemyIds: [...rangeAttackTargetIds.value] }
        : {}),
      ...(rangeAttackObstacleCoords.value.length
        ? { targetObstacleCoords: [...rangeAttackObstacleCoords.value] }
        : {}),
    });
    return true;
  }

  if (usesAnchoredPatternPlacement(ctx.spec)) {
    if (!attackAimed.value) {
      const placement = evaluateAnchoredPatternPlacement(
        origin,
        { x, y },
        ctx.spec,
        attackDirection.value,
        s,
      );
      if (placement.tooFar) {
        showToast("outside maximum range");
        return true;
      }
      if (placement.tooCloseKeys.size > 0) {
        showToast("inside minimum range");
        return true;
      }
      if (!placement.valid) return false;
      attackAnchor.value = { x, y };
      attackAimed.value = true;
      return true;
    }

    if (combatAttackPrimaryKeys.value.has(key)) {
      const anchor = attackAnchor.value;
      if (!anchor) return false;
      submitAttackAction({
        action: "attack",
        direction: attackDirection.value,
        anchorX: anchor.x,
        anchorY: anchor.y,
      });
      return true;
    }

    attackAimed.value = false;
    attackAnchor.value = null;
    return true;
  }

  if (isRangedPatternAttack(ctx.spec)) {
    if (!combatAttackSecondaryKeys.value.has(key)) return false;

    const dirs = dirsAt(x, y);
    if (dirs.length === 0) return false;

    if (attackAimed.value && (combatAttackPrimaryKeys.value.has(key) || combatAttackSecondaryKeys.value.has(key))) {
      submitAttackAction(attackAction);
      return true;
    }

    const nextDir = attackAimed.value
      ? (dirs.find((d) => d !== attackDirection.value) ?? dirs[0])
      : dirs[0];
    attackDirection.value = nextDir;
    attackAimed.value = true;
    elevBonusTile.value = null;
    return true;
  }

  const dirs = dirsAt(x, y);
  if (dirs.length === 0) return false;

  if (attackAimed.value && combatAttackPrimaryKeys.value.has(key)) {
    submitAttackAction(attackAction);
    return true;
  }

  const nextDir = attackAimed.value
    ? (dirs.find((d) => d !== attackDirection.value) ?? dirs[0])
    : dirs[0];
  attackDirection.value = nextDir!;
  attackAimed.value = true;
  elevBonusTile.value = null;
  return true;
}

function handleEquipmentCoverCellClick(x: number, y: number): boolean {
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return false;
  const key = coordKey(x, y);
  if (!equipmentCoverRangeKeys.value.has(key)) return false;

  const selected = [...equipmentCoverTiles.value];
  const idx = selected.findIndex((t) => t.x === x && t.y === y);
  if (idx >= 0) {
    equipmentCoverTiles.value = selected.filter((_, i) => i !== idx);
    return true;
  }
  if (selected.length >= 3) return false;

  const next = [...selected, { x, y }];
  if (next.length > 1 && !areOrthogonallyConnected(next)) {
    showToast("Tiles must be connected");
    return true;
  }
  equipmentCoverTiles.value = next;

  if (next.length === 3 && areOrthogonallyConnected(next)) {
    sendPlayerAction({
      action: "useEquipment",
      detail: me.equipment,
      coverTiles: next,
    });
    clearBoardActionMode();
  }
  return true;
}

function handleForceProjectionSquareClick(x: number, y: number): boolean {
  const key = coordKey(x, y);
  if (!equipmentForceProjectionSquareKeys.value.has(key)) return false;
  forceProjectionOrigin.value = { x, y };
  forceProjectionStep.value = "attack";
  attackAimed.value = false;
  attackAnchor.value = null;
  rangeAttackTargetIds.value = [];
  rangeAttackObstacleCoords.value = [];
  return true;
}

function advanceRedirectAfterAttackPick() {
  const s = gameState.value;
  const sourceId = redirectSourceEnemyId.value;
  const attackIndex = redirectAttackIndex.value;
  if (!s || !sourceId || attackIndex == null) return;
  const source = s.enemies.find((e) => e.id === sourceId);
  if (!source?.name) return;
  const attackSpec = getEnemyAttack(source.name, attackIndex)?.attack;
  if (!attackSpec) return;
  redirectStep.value = isDirectTargetEnemyAttack(attackSpec) ? "selectTarget" : "confirmPattern";
  attackAimed.value = false;
  attackAnchor.value = null;
  attackDirection.value = "n";
}

function handleEquipmentRedirectCellClick(x: number, y: number, enemyId?: string): boolean {
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return false;
  const step = redirectStep.value;

  if (step === "selectSource") {
    if (!enemyId || !redirectSourceKeys.value.has(coordKey(x, y))) return false;
    const anchor = s.enemies.find((e) => e.id === enemyId);
    if (!anchor?.name) return false;
    const indices = listRedirectableEnemyAttackIndices(anchor.name);
    if (!indices.length) {
      showToast("No supported attacks");
      return true;
    }
    redirectSourceEnemyId.value = enemyId;
    if (indices.length === 1) {
      redirectAttackIndex.value = indices[0]!;
      advanceRedirectAfterAttackPick();
    } else {
      redirectAttackIndex.value = indices[0]!;
      redirectStep.value = "selectAttack";
    }
    return true;
  }

  if (step === "selectTarget" && enemyId && redirectTargetKeys.value.has(coordKey(x, y))) {
    sendPlayerAction({
      action: "useEquipment",
      detail: me.equipment,
      sourceEnemyId: redirectSourceEnemyId.value!,
      attackIndex: redirectAttackIndex.value!,
      targetEnemyId: enemyId,
    });
    clearBoardActionMode();
    return true;
  }

  if (step === "confirmPattern") {
    const sourceId = redirectSourceEnemyId.value;
    const attackIndex = redirectAttackIndex.value;
    if (!sourceId || attackIndex == null) return false;
    const attackSpec = getEnemyAttack(
      s.enemies.find((e) => e.id === sourceId)?.name,
      attackIndex,
    )?.attack;
    if (!attackSpec) return false;
    const options = enemyAttackPatternOptionsAt(s, sourceId, attackSpec, x, y);
    if (options.length === 0) return false;

    const key = coordKey(x, y);
    if (attackAimed.value && attackAnchor.value && redirectPatternPrimaryKeys.value.has(key)) {
      sendPlayerAction({
        action: "useEquipment",
        detail: me.equipment,
        sourceEnemyId: sourceId,
        attackIndex,
        direction: attackDirection.value,
        anchorX: attackAnchor.value.x,
        anchorY: attackAnchor.value.y,
      });
      clearBoardActionMode();
      return true;
    }

    const currentKey =
      attackAimed.value && attackAnchor.value
        ? `${attackDirection.value}:${attackAnchor.value.x},${attackAnchor.value.y}`
        : null;
    const next =
      options.find((o) => `${o.direction}:${o.origin.x},${o.origin.y}` !== currentKey) ??
      options[0]!;
    attackDirection.value = next.direction;
    attackAnchor.value = next.origin;
    attackAimed.value = true;
    return true;
  }

  if (step === "selectAttack") {
    if (enemyId === redirectSourceEnemyId.value) {
      advanceRedirectAfterAttackPick();
      return true;
    }
    return true;
  }

  return false;
}

function submitBorrowClassActive(opts?: {
  direction?: PatternDirection;
  anchorX?: number;
  anchorY?: number;
}) {
  const allyId = borrowAllyId.value;
  if (!allyId) return;
  sendPlayerAction({
    action: "classActive",
    kind: "borrowing_this",
    allyPlayerId: allyId,
    direction: opts?.direction ?? attackDirection.value,
    anchorX: opts?.anchorX,
    anchorY: opts?.anchorY,
  });
  clearBoardActionMode();
}

function handleBorrowCellClick(x: number, y: number, targetEnemyId?: string): boolean {
  const me = yourPlayer.value;
  const s = gameState.value;
  const ctx = borrowContext.value;
  if (!me || !s || !ctx) return false;

  const key = coordKey(x, y);

  if (isRangeTargetAttack(ctx.spec)) {
    if (!borrowCombatSecondaryKeys.value.has(key)) return false;

    if (targetEnemyId) {
      const enemy = s.enemies.find((e) => e.id === targetEnemyId);
      if (!enemy) return false;
      if (manhattanDistance(me, enemy) > rangeTargetDistance(ctx.spec)) return false;

      const maxTargets = rangeTargetMax(ctx.spec);
      const selected = rangeAttackTargetIds.value;
      if (selected.includes(targetEnemyId)) {
        rangeAttackTargetIds.value = selected.filter((id) => id !== targetEnemyId);
      } else if (selected.length < maxTargets) {
        const next = [...selected, targetEnemyId];
        rangeAttackTargetIds.value = next;
        if (next.length >= maxTargets) submitBorrowClassActive();
      }
      return true;
    }

    if (rangeAttackTargetIds.value.length === 0) return true;
    submitBorrowClassActive();
    return true;
  }

  if (usesAnchoredPatternPlacement(ctx.spec)) {
    if (!attackAimed.value) {
      const placement = evaluateAnchoredPatternPlacement(
        me,
        { x, y },
        ctx.spec,
        attackDirection.value,
        s,
      );
      if (placement.tooFar) {
        showToast("outside maximum range");
        return true;
      }
      if (placement.tooCloseKeys.size > 0) {
        showToast("inside minimum range");
        return true;
      }
      if (!placement.valid) return false;
      attackAnchor.value = { x, y };
      attackAimed.value = true;
      return true;
    }

    if (borrowCombatPrimaryKeys.value.has(key)) {
      const anchor = attackAnchor.value;
      if (!anchor) return false;
      submitBorrowClassActive({
        direction: attackDirection.value,
        anchorX: anchor.x,
        anchorY: anchor.y,
      });
      return true;
    }

    attackAimed.value = false;
    attackAnchor.value = null;
    return true;
  }

  if (isRangedPatternAttack(ctx.spec)) {
    if (!borrowCombatSecondaryKeys.value.has(key)) return false;

    const dirs = playerAttackDirectionsAt(s, me.id, x, y, ctx.weapon);
    if (dirs.length === 0) return false;

    if (
      attackAimed.value &&
      (borrowCombatPrimaryKeys.value.has(key) || borrowCombatSecondaryKeys.value.has(key))
    ) {
      submitBorrowClassActive();
      return true;
    }

    const nextDir = attackAimed.value
      ? (dirs.find((d) => d !== attackDirection.value) ?? dirs[0])
      : dirs[0];
    attackDirection.value = nextDir;
    attackAimed.value = true;
    return true;
  }

  const dirs = playerAttackDirectionsAt(s, me.id, x, y, ctx.weapon);
  if (dirs.length === 0) return false;

  if (attackAimed.value && borrowCombatPrimaryKeys.value.has(key)) {
    submitBorrowClassActive();
    return true;
  }

  const nextDir = attackAimed.value
    ? (dirs.find((d) => d !== attackDirection.value) ?? dirs[0])
    : dirs[0];
  attackDirection.value = nextDir;
  attackAimed.value = true;
  return true;
}

function commitWarhook(landing: { x: number; y: number }) {
  const me = yourPlayer.value;
  const target = warhookTarget.value;
  const s = gameState.value;
  if (!me || !target || !s) return;
  const triggers = previewSprintProvokes(s, me.id, landing.x, landing.y);
  gateProvoke(triggers, () => {
    startTeleport(me.id, { x: me.x, y: me.y }, landing);
    sendPlayerAction({
      action: "weaponActive",
      warhook: {
        targetEnemyId: target.enemyId,
        targetX: target.x,
        targetY: target.y,
        landingX: landing.x,
        landingY: landing.y,
      },
    });
    clearBoardActionMode();
  });
}

function handleWarhookCellClick(x: number, y: number): boolean {
  const me = yourPlayer.value;
  const s = gameState.value;
  if (!me || !s) return false;

  if (warhookStep.value === "selectLanding") {
    const key = coordKey(x, y);
    if (!warhookSecondaryKeys.value.has(key)) return false;
    const landing = warhookLandingOptions.value.find((t) => t.x === x && t.y === y);
    if (!landing) return false;
    commitWarhook(landing);
    return true;
  }

  const key = coordKey(x, y);
  if (!warhookPrimaryKeys.value.has(key)) return false;

  const target = isWarhookTargetAt(s, me, x, y);
  if (!target) return false;

  const landings = warhookAdjacentLandingTiles(s, me.id, target);
  if (!landings.length) {
    showToast("No space adjacent to target");
    return true;
  }

  const nearest = warhookNearestLandings(me, landings);
  if (nearest.length === 1) {
    warhookTarget.value = target;
    commitWarhook(nearest[0]!);
    return true;
  }

  warhookTarget.value = target;
  warhookLandingOptions.value = nearest;
  warhookStep.value = "selectLanding";
  return true;
}

function handleEquipmentCorridorCellClick(x: number, y: number): boolean {
  const me = yourPlayer.value;
  const s = gameState.value;
  const ctx = equipmentCorridorContext.value;
  if (!me || !s || !ctx) return false;

  const key = coordKey(x, y);

  if (!attackAimed.value) {
    const tiles = collectEquipmentPatternTiles(s, { x, y }, me.equipment!, attackDirection.value);
    if (tiles.length < (ctx.spec.tiles?.length ?? 0)) return false;
    attackAnchor.value = { x, y };
    attackAimed.value = true;
    return true;
  }

  if (equipmentCorridorPrimaryKeys.value.has(key)) {
    const anchor = attackAnchor.value;
    if (!anchor) return false;
    sendPlayerAction({
      action: "useEquipment",
      detail: me.equipment,
      direction: attackDirection.value,
      anchorX: anchor.x,
      anchorY: anchor.y,
    });
    clearBoardActionMode();
    return true;
  }

  attackAimed.value = false;
  attackAnchor.value = null;
  return true;
}

function handleOmnistrikeCellClick(x: number, y: number): boolean {
  const ctx = omnistrikeContext.value;
  const s = gameState.value;
  if (!ctx || !s) return false;

  const step = omnistrikeStep.value;
  const key = coordKey(x, y);

  if (step === "confirm") {
    if (omnistrikePrimaryKeys.value.has(key)) {
      const anchorA = omnistrikeAnchors.value[0];
      const anchorB = omnistrikeAnchors.value[1];
      if (!anchorA || !anchorB) return false;
      sendPlayerAction({
        action: "weaponActive",
        omnistrike: {
          bombIndices: [ctx.indexA, ctx.indexB],
          anchors: [anchorA, anchorB],
          direction: attackDirection.value,
        },
      });
      clearBoardActionMode();
      return true;
    }
    omnistrikeAnchors.value = [omnistrikeAnchors.value[0], null];
    omnistrikeStep.value = "placeSecond";
    return true;
  }

  if (step === "placeFirst") {
    const placement = evaluateOmnistrikePlacement(ctx.me, { x, y }, ctx.bombA, attackDirection.value, s);
    if (placement.tooFar) {
      showToast("outside maximum range");
      return true;
    }
    if (placement.tooCloseKeys.size > 0) {
      showToast("inside minimum range");
      return true;
    }
    if (!placement.valid) return false;
    omnistrikeAnchors.value = [{ x, y }, null];
    omnistrikeStep.value = "placeSecond";
    return true;
  }

  if (step === "placeSecond") {
    const firstAnchor = omnistrikeAnchors.value[0];
    if (!firstAnchor) return false;
    const firstTiles = collectBombPatternTiles(s, firstAnchor, ctx.bombA, attackDirection.value);
    const placement = evaluateOmnistrikePlacement(
      ctx.me,
      { x, y },
      ctx.bombB,
      attackDirection.value,
      s,
      firstTiles,
    );
    if (placement.tooFar) {
      showToast("outside maximum range");
      return true;
    }
    if (placement.tooCloseKeys.size > 0) {
      showToast("inside minimum range");
      return true;
    }
    if (!placement.adjacentToOther) {
      showToast("Patterns must be adjacent or overlap");
      return true;
    }
    if (!placement.valid) return false;
    omnistrikeAnchors.value = [firstAnchor, { x, y }];
    omnistrikeStep.value = "confirm";
    return true;
  }

  return false;
}

function handleCombatCellClick(x: number, y: number): boolean {
  const m = boardActionMode.value;
  if (!m || !yourPlayer.value || !gameState.value) return false;
  const occ = occupancy.value;
  if (!occ) return false;
  const key = coordKey(x, y);
  const enemy = occ.enemyByKey.get(key);
  const player = occ.playerByKey.get(key);
  const me = yourPlayer.value;

  if (m === "aegis") {
    if (!activePlayerSelected.value) return true;
    if (!cellStateByKey.value.get(boardCellKey(x, y))?.moveAegis) return true;
    const s = gameState.value;
    const id = yourPlayerId.value;
    if (!s || !id) return true;
    const path = [{ x, y }];
    const sprintLeft = me.actionBudget?.sprintRemaining ?? 0;
    if (sprintLeft > 0) {
      gateProvoke(previewSprintProvokes(s, id, x, y, { flying: true }), () => {
        sendPlayerAction({ action: "sprintMove", x, y, flying: true });
      });
    } else {
      gateProvoke(previewPathProvokes(s, id, path, { flying: true }), () => sendMovePath(path, true));
    }
    return true;
  }
  if (m === "move") {
    if (!activePlayerSelected.value) return true;
    const s = gameState.value;
    const id = yourPlayerId.value;
    if (!s || !id) return true;
    if (isSandboxMode(s)) {
      const path = findPlayerMovementPath(s, id, { x, y });
      if (path) {
        gateProvoke(previewPathProvokes(s, id, path), () => sendMovePath(path));
      }
    } else {
      if (!cellStateByKey.value.get(boardCellKey(x, y))?.moveSecondary) return true;
      const path = [{ x, y }];
      gateProvoke(previewPathProvokes(s, id, path), () => sendMovePath(path));
    }
    return true;
  }
  if (m === "attack") {
    return handleAttackCellClick(x, y, enemy?.id);
  }
  if (m === "varunastraBorrow") {
    if (!borrowAllyId.value && player && player.id !== me.id) {
      borrowAllyId.value = player.id;
      attackAimed.value = false;
      attackAnchor.value = null;
      rangeAttackTargetIds.value = [];
      rangeAttackObstacleCoords.value = [];
      return true;
    }
    if (borrowAllyId.value) {
      return handleBorrowCellClick(x, y, enemy?.id);
    }
    return true;
  }
  if (m === "omnistrike") {
    return handleOmnistrikeCellClick(x, y);
  }
  if (m === "equipmentCorridor") {
    return handleEquipmentCorridorCellClick(x, y);
  }
  if (m === "equipmentCover") {
    return handleEquipmentCoverCellClick(x, y);
  }
  if (m === "equipmentForceProjection") {
    if (forceProjectionStep.value === "selectSquare") return handleForceProjectionSquareClick(x, y);
    return handleAttackCellClick(x, y, enemy?.id);
  }
  if (m === "equipmentRedirect") {
    return handleEquipmentRedirectCellClick(x, y, enemy?.id);
  }
  if (m === "warhook") {
    return handleWarhookCellClick(x, y);
  }
  if (m === "shove") {
    if (enemy && Math.abs(x - me.x) + Math.abs(y - me.y) === 1) {
      sendPlayerAction({ action: "shove", targetEnemyId: enemy.id });
      clearBoardActionMode();
      return true;
    }
    if (player && player.id !== me.id && Math.abs(x - me.x) + Math.abs(y - me.y) === 1) {
      sendPlayerAction({ action: "shove", targetPlayerId: player.id });
      clearBoardActionMode();
      return true;
    }
    return true;
  }
  if (m === "sprint") {
    if (!activePlayerSelected.value) return true;
    const cell = cellStateByKey.value.get(boardCellKey(x, y));
    const s = gameState.value;
    const id = yourPlayerId.value;
    if (!s || !id) return true;
    if (cell?.moveAegis) {
      gateProvoke(previewSprintProvokes(s, id, x, y, { flying: true }), () => {
        sendPlayerAction({ action: "sprintMove", x, y, flying: true });
      });
      return true;
    }
    if (!cell?.moveSecondary) return true;
    gateProvoke(previewSprintProvokes(s, id, x, y), () => {
      sendPlayerAction({ action: "sprintMove", x, y });
    });
    return true;
  }
  if (m === "armorTeleport") {
    const key = coordKey(x, y);
    if (!pendingTargetEnemyId.value) {
      if (!armorTeleportTargetKeys.value.has(key) || !enemy) return true;
      pendingTargetEnemyId.value = enemy.id;
      return true;
    }
    if (!armorTeleportLandingKeys.value.has(key)) return true;
    const s = gameState.value;
    const id = yourPlayerId.value;
    if (!s || !id) return true;
    gateProvoke(previewSprintProvokes(s, id, x, y), () => {
      startTeleport(me.id, { x: me.x, y: me.y }, { x, y });
      sendPlayerAction({
        action: "armorAction",
        targetEnemyId: pendingTargetEnemyId.value!,
        landingX: x,
        landingY: y,
      });
      clearBoardActionMode();
    });
    return true;
  }
  if (m === "armorPush") {
    if (enemy && armorPushTargetKeys.value.has(coordKey(x, y))) {
      sendPlayerAction({ action: "armorAction", targetEnemyId: enemy.id, push: armorPush.value });
      clearBoardActionMode();
      return true;
    }
    if (player && player.id !== me.id && Math.abs(x - me.x) + Math.abs(y - me.y) === 1) {
      sendPlayerAction({ action: "armorAction", targetPlayerId: player.id, push: armorPush.value });
      clearBoardActionMode();
      return true;
    }
    return true;
  }
  if (m === "armorPlaceTower") {
    const key = coordKey(x, y);
    if (!armorPlaceTowerKeys.value.has(key)) return true;
    sendPlayerAction({ action: "armorAction", x, y });
    clearBoardActionMode();
    return true;
  }
  if (m === "sharurAttractor") {
    const key = coordKey(x, y);
    if (!classAbilitySecondaryKeys.value.has(key) || sharurAttractorInvalidKeys.value.has(key)) return true;
    sendPlayerAction({ action: "classActive", kind: "back_up", x, y });
    clearBoardActionMode();
    return true;
  }
  if (m === "harpeTrap") {
    const key = coordKey(x, y);
    if (!classAbilitySecondaryKeys.value.has(key) || harpeTrapInvalidKeys.value.has(key)) return true;
    sendPlayerAction({ action: "classActive", kind: "weapon_trap", x, y });
    clearBoardActionMode();
    return true;
  }
  if (m === "hephaestusRestore" && player && player.id !== me.id) {
    sendPlayerAction({ action: "classPassive", kind: "baseline_communism", targetPlayerId: player.id });
    clearBoardActionMode();
    return true;
  }
  if (m === "kopisMark" && enemy) {
    sendPlayerAction({ action: "classActive", kind: "mag_dump", targetEnemyIds: [enemy.id] });
    clearBoardActionMode();
    return true;
  }
  if (m === "chrysaorBrand") {
    const key = coordKey(x, y);
    if (!classAbilityPrimaryKeys.value.has(key)) return true;
    if (enemy) {
      sendPlayerAction({ action: "classActive", kind: "soul_branding", targetEnemyIds: [enemy.id] });
      clearBoardActionMode();
      return true;
    }
    if (player) {
      sendPlayerAction({
        action: "classActive",
        kind: "soul_branding",
        targetPlayerIds: [player.id],
      });
      clearBoardActionMode();
      return true;
    }
    const s = gameState.value;
    const tile = s ? tileAt(s.tiles, x, y) : undefined;
    if (tile && isObstacleTile(tile)) {
      sendPlayerAction({ action: "classActive", kind: "soul_branding", x, y });
      clearBoardActionMode();
      return true;
    }
    return true;
  }
  if (m === "hephaestusSynesis" && enemy && classAbilityPrimaryKeys.value.has(coordKey(x, y))) {
    sendPlayerAction({ action: "classActive", kind: "synesis_conversion", targetEnemyIds: [enemy.id] });
    clearBoardActionMode();
    return true;
  }
  if (m === "towerTeleport") {
    const s = gameState.value;
    if (!s) return true;
    const key = coordKey(x, y);
    if (towerTeleportStep.value === "selectKeraunoTarget" && enemy) {
      sendPlayerAction({
        action: "armorAction",
        kind: "tower_teleport",
        x: towerTeleportLanding.value!.x,
        y: towerTeleportLanding.value!.y,
        keraunoTargetEnemyId: enemy.id,
      });
      clearBoardActionMode();
      return true;
    }
    if (!towerTeleportSecondaryKeys.value.has(key)) return true;
    const tower = getPlayerTower(s, me.id);
    towerTeleportLanding.value = { x, y };
    if (tower?.name === "Kerauno") {
      const adjacent = keraunoAdjacentEnemyIds(s, x, y);
      if (adjacent.length > 0) {
        towerTeleportStep.value = "selectKeraunoTarget";
        return true;
      }
    }
    sendPlayerAction({ action: "armorAction", kind: "tower_teleport", x, y });
    clearBoardActionMode();
    return true;
  }
  if (m === "assistedLaunch") {
    const s = gameState.value;
    const id = yourPlayerId.value;
    if (!s || !id || !me) return true;
    const key = coordKey(x, y);
    if (assistedLaunchStep.value === "selectAnchor") {
      if (!assistedLaunchAnchorKeys.value.has(key)) return true;
      const anchors = assistedLaunchAnchors(s, id);
      let picked = anchors.find((a) => a.x === x && a.y === y);
      if (!picked) {
        const startX = me.turnStartX ?? me.x;
        const startY = me.turnStartY ?? me.y;
        if (x === startX && y === startY) {
          const edgeAnchors = anchors.filter((a) => a.kind === "edge");
          if (edgeAnchors.length === 1) picked = edgeAnchors[0];
        }
      }
      if (!picked) return true;
      assistedLaunchAnchor.value = { x: picked.x, y: picked.y };
      assistedLaunchStep.value = "confirm";
      return true;
    }
    if (!assistedLaunchLandingKeys.value.has(key)) return true;
    const anchor = assistedLaunchAnchor.value;
    if (!anchor) return true;
    const preview = computeAssistedLaunch(s, id, anchor.x, anchor.y);
    if (!preview) return true;
    gateProvoke(previewPathProvokes(s, id, preview.path), () => {
      sendPlayerAction({ action: "assistedLaunch", anchorX: anchor.x, anchorY: anchor.y });
      clearBoardActionMode();
    });
    return true;
  }
  if (m === "kataptyPick") {
    if (!enemy || isTowerEnemy(enemy)) return true;
    return handleKataptyPick(enemy.id);
  }
  if (m === "rez") {
    if (player && player.id !== me.id && (player.hp ?? 0) <= 0) {
      sendPlayerAction({ action: "rez", targetPlayerId: player.id });
      clearBoardActionMode();
      return true;
    }
    return true;
  }
  return false;
}

function onBoardPlayerClick(x: number, y: number, playerId: string, characterSheetId?: string) {
  if (canUseGmTools.value && gmEffectiveActiveTool.value === "paintbrush") {
    handlePaintbrushCellAction(x, y);
    return;
  }
  if (tryGmDamageEffectToken({ kind: "player", id: playerId })) return;
  if (canUseGmTools.value && boardActionMode.value === "gmEnemyAttack") {
    if (handleGmEnemyAttackCellClick(x, y)) return;
  }
  if (routesTokenClickToCellTargeting(boardActionMode.value, boardTargetingContext())) {
    handleCombatCellClick(x, y);
    return;
  }
  selectBoardPlayer(playerId, characterSheetId);
}

function onPlayerCellClick(x: number, y: number) {
  if (handleCombatCellClick(x, y)) return;
  if (routesTokenClickToCellTargeting(boardActionMode.value, boardTargetingContext())) {
    return;
  }
  if (selectOccupantAt(x, y)) return;
  clearBoardSelection();
  tryMove(x, y);
}

function tryMoveSelectedEnemy(x: number, y: number): boolean {
  const dest = gmEnemyMoveDestAt(x, y);
  if (!dest) return false;
  return tryMoveSelectedEnemyToDest(dest.x, dest.y);
}

function handleGmEnemyAttackCellClick(x: number, y: number): boolean {
  const pending = gmEnemyAttack.value;
  const s = gameState.value;
  const occ = occupancy.value;
  if (!pending || !s || !occ) return false;
  const key = coordKey(x, y);

  const attackSpec = getEnemyAttack(
    s.enemies.find((e) => e.id === pending.enemyId)?.name,
    pending.attackIndex,
  )?.attack;
  if (!attackSpec) return false;

  if (isPatternEnemyAttack(attackSpec)) {
    const options = enemyAttackPatternOptionsAt(s, pending.enemyId, attackSpec, x, y);
    if (options.length === 0) return false;

    if (attackAimed.value && attackAnchor.value && gmEnemyPatternPrimaryKeys.value.has(key)) {
      send({
        type: "gmEnemyAction",
        action: {
          action: "attack",
          enemyId: pending.enemyId,
          attackIndex: pending.attackIndex,
          direction: attackDirection.value,
          originX: attackAnchor.value.x,
          originY: attackAnchor.value.y,
          damage: pending.damage,
        },
      });
      clearBoardActionMode();
      return true;
    }

    const currentKey =
      attackAimed.value && attackAnchor.value
        ? `${attackDirection.value}:${attackAnchor.value.x},${attackAnchor.value.y}`
        : null;
    const next =
      options.find((o) => `${o.direction}:${o.origin.x},${o.origin.y}` !== currentKey) ??
      options[0]!;
    attackDirection.value = next.direction;
    attackAnchor.value = next.origin;
    attackAimed.value = true;
    return true;
  }

  if (!gmEnemyAttackTargetKeys.value.has(key)) return false;

  const plantFlowerbud =
    pending.plantFlowerbud || attackSpec.specialId === "flowerbud-plant";
  if (plantFlowerbud) {
    send({
      type: "gmEnemyAction",
      action: {
        action: "attack",
        enemyId: pending.enemyId,
        attackIndex: pending.attackIndex,
        destX: x,
        destY: y,
      },
    });
    clearBoardActionMode();
    return true;
  }

  const stainTeleport =
    pending.stainTeleport || attackSpec.specialId === "stain-teleport";

  if (stainTeleport && (pending.targetPlayerId || pending.targetEnemyId)) {
    send({
      type: "gmEnemyAction",
      action: {
        action: "attack",
        enemyId: pending.enemyId,
        attackIndex: pending.attackIndex,
        targetPlayerId: pending.targetPlayerId,
        targetEnemyId: pending.targetEnemyId,
        destX: x,
        destY: y,
        damage: pending.damage,
      },
    });
    clearBoardActionMode();
    return true;
  }

  if (stainTeleport) {
    const player = occ.playerByKey.get(key);
    const enemy = occ.enemyByKey.get(key);
    if (player) {
      gmEnemyAttack.value = {
        ...pending,
        stainTeleport: true,
        targetPlayerId: player.id,
        targetEnemyId: undefined,
      };
      return true;
    }
    if (enemy && enemy.id !== pending.enemyId) {
      const canon = swarmGroupForEnemy(s, enemy.id)?.canonicalId ?? enemy.id;
      gmEnemyAttack.value = {
        ...pending,
        stainTeleport: true,
        targetEnemyId: canon,
        targetPlayerId: undefined,
      };
      return true;
    }
    return false;
  }

  const player = occ.playerByKey.get(key);
  const enemyOnTile = occ.enemyByKey.get(key);

  if (pending.swarm) {
    if (!player) return false;
    swarmAttackPending.value = {
      enemyId: pending.enemyId,
      attackIndex: pending.attackIndex,
      targetPlayerId: player.id,
      damage: pending.damage,
    };
    swarmAttackModalOpen.value = true;
    clearBoardActionMode();
    return true;
  }

  if (player) {
    send({
      type: "gmEnemyAction",
      action: {
        action: "attack",
        enemyId: pending.enemyId,
        attackIndex: pending.attackIndex,
        targetPlayerId: player.id,
        damage: pending.damage,
      },
    });
    clearBoardActionMode();
    return true;
  }

  if (enemyOnTile && enemyOnTile.id !== pending.enemyId) {
    const canon = swarmGroupForEnemy(s, enemyOnTile.id)?.canonicalId ?? enemyOnTile.id;
    send({
      type: "gmEnemyAction",
      action: {
        action: "attack",
        enemyId: pending.enemyId,
        attackIndex: pending.attackIndex,
        targetEnemyId: canon,
        damage: pending.damage,
      },
    });
    clearBoardActionMode();
    return true;
  }

  return false;
}

function onSwarmAttackConfirm(strikeCount: number) {
  const pending = swarmAttackPending.value;
  if (!pending) return;
  send({
    type: "gmEnemyAction",
    action: {
      action: "attack",
      enemyId: pending.enemyId,
      attackIndex: pending.attackIndex,
      targetPlayerId: pending.targetPlayerId,
      damage: pending.damage,
      swarmStrikes: strikeCount,
    },
  });
  swarmAttackModalOpen.value = false;
  swarmAttackPending.value = null;
}

function onSwarmAttackClose() {
  swarmAttackModalOpen.value = false;
  swarmAttackPending.value = null;
}

function cellFromClientPoint(clientX: number, clientY: number): { x: number; y: number } | null {
  const el = document.elementFromPoint(clientX, clientY)?.closest("[data-cell-x]") as HTMLElement | null;
  if (!el) return null;
  const x = Number(el.dataset.cellX);
  const y = Number(el.dataset.cellY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function cellsInGridRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(width - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(height - 1, Math.max(y0, y1));
  const coords: { x: number; y: number }[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) coords.push({ x, y });
  }
  return coords;
}

function finishMarqueeSelection(
  startClient: { x: number; y: number },
  endClient: { x: number; y: number },
  sameTypeSeed: { id: string; name?: string } | null = null,
) {
  const s = gameState.value;
  const occ = occupancy.value;
  if (!s || !occ) return;
  const startCell = cellFromClientPoint(startClient.x, startClient.y);
  const endCell = cellFromClientPoint(endClient.x, endClient.y);
  if (!startCell || !endCell) {
    clearGmBulkSelection();
    return;
  }
  const rectCells = cellsInGridRect(startCell.x, startCell.y, endCell.x, endCell.y, s.width, s.height);
  if (gmSelectTargetKind.value === "tiles") {
    setGmBulkSelection({ kind: "tiles", coords: rectCells });
    return;
  }
  if (gmSelectTargetKind.value === "players") {
    const ids = new Set<string>();
    for (const cell of rectCells) {
      const player = occ.playerByKey.get(coordKey(cell.x, cell.y));
      if (player) ids.add(player.id);
    }
    setGmBulkSelection(ids.size ? { kind: "players", ids: [...ids] } : null);
    return;
  }
  if (gmSelectSameEnemyType.value) {
    let seed = sameTypeSeed;
    if (!seed) {
      let best: { id: string; name?: string; dist: number } | null = null;
      for (const cell of rectCells) {
        const enemy = occ.enemyByKey.get(coordKey(cell.x, cell.y));
        if (!enemy) continue;
        const dist = Math.abs(cell.x - startCell.x) + Math.abs(cell.y - startCell.y);
        if (!best || dist < best.dist) {
          best = { id: enemy.id, name: enemy.name, dist };
        }
      }
      if (best) seed = { id: best.id, name: best.name };
    }
    if (!seed) {
      setGmBulkSelection(null);
      return;
    }
    const ids = seed.name
      ? s.enemies.filter((e) => !!e.name && e.name === seed.name).map((e) => e.id)
      : [seed.id];
    setGmBulkSelection(ids.length ? { kind: "enemies", ids } : null);
    return;
  }
  const ids = new Set<string>();
  for (const cell of rectCells) {
    const enemy = occ.enemyByKey.get(coordKey(cell.x, cell.y));
    if (enemy) ids.add(enemy.id);
  }
  setGmBulkSelection(ids.size ? { kind: "enemies", ids: [...ids] } : null);
}

function onMarqueePointerDown(e: PointerEvent) {
  if (props.role !== "gm" || gmEffectiveActiveTool.value !== "select") return;
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest(".reset-zoom-btn")) return;
  e.preventDefault();
  let sameTypeSeed: { id: string; name?: string } | null = null;
  if (gmSelectSameEnemyType.value && gmSelectTargetKind.value === "enemies") {
    const startCell = cellFromClientPoint(e.clientX, e.clientY);
    const enemy = startCell
      ? occupancy.value?.enemyByKey.get(coordKey(startCell.x, startCell.y))
      : undefined;
    if (enemy) sameTypeSeed = { id: enemy.id, name: enemy.name };
  }
  marqueeActive.value = true;
  marqueeStart.value = { x: e.clientX, y: e.clientY };
  marqueeEnd.value = { x: e.clientX, y: e.clientY };
  let didDrag = false;
  const onMove = (ev: PointerEvent) => {
    const start = marqueeStart.value;
    if (!start) return;
    const dx = ev.clientX - start.x;
    const dy = ev.clientY - start.y;
    if (!didDrag && dx * dx + dy * dy < MARQUEE_DRAG_THRESHOLD_PX * MARQUEE_DRAG_THRESHOLD_PX) {
      return;
    }
    didDrag = true;
    marqueeEnd.value = { x: ev.clientX, y: ev.clientY };
  };
  const onUp = (_ev: PointerEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    marqueeActive.value = false;
    const start = marqueeStart.value;
    const end = marqueeEnd.value;
    marqueeStart.value = null;
    marqueeEnd.value = null;
    if (!start || !end) return;
    if (didDrag) {
      suppressViewportClickAfterMarquee = true;
      finishMarqueeSelection(start, end, sameTypeSeed);
    }
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function cellsOnGridLine(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (x0 !== x1 || y0 !== y1) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
    cells.push({ x: x0, y: y0 });
  }
  return cells;
}

function onPaintbrushPointerDown(e: PointerEvent) {
  if (!canUseGmTools.value || gmEffectiveActiveTool.value !== "paintbrush") return;
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest(".reset-zoom-btn")) return;
  const startCell = cellFromClientPoint(e.clientX, e.clientY);
  if (!startCell) return;
  e.preventDefault();
  suppressPaintbrushClickAfterPointerDown = true;

  if (paintbrushEyedropperActive.value) {
    samplePaintbrushFromTile(startCell.x, startCell.y);
    return;
  }

  const captureEl = e.currentTarget as HTMLElement | null;
  if (captureEl?.setPointerCapture) {
    try {
      captureEl.setPointerCapture(e.pointerId);
    } catch {
      // ignore — capture can fail if the pointer is already released
    }
  }

  const visited = new Set<string>();
  let lastCell: { x: number; y: number } | null = null;
  const width = gameState.value?.width ?? 0;
  const height = gameState.value?.height ?? 0;

  function paintCell(cell: { x: number; y: number }) {
    const key = coordKey(cell.x, cell.y);
    if (visited.has(key)) return;
    if (!isInBounds(cell.x, cell.y, width, height)) return;
    visited.add(key);
    queuePaintbrushDragTile(cell.x, cell.y);
  }

  const sel = gmBulkSelection.value;
  if (sel?.kind === "tiles" && isTileBulkSelected(startCell.x, startCell.y)) {
    for (const coord of sel.coords) visited.add(coordKey(coord.x, coord.y));
    lastCell = startCell;
    applyPaintbrushToTile(startCell.x, startCell.y);
  } else {
    paintCell(startCell);
    lastCell = startCell;
  }

  const onMove = (ev: PointerEvent) => {
    const cell = cellFromClientPoint(ev.clientX, ev.clientY);
    if (!cell || !lastCell) return;
    if (cell.x === lastCell.x && cell.y === lastCell.y) return;
    for (const step of cellsOnGridLine(lastCell, cell)) {
      paintCell(step);
    }
    lastCell = cell;
  };

  const onUp = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (captureEl?.hasPointerCapture?.(ev.pointerId)) {
      captureEl.releasePointerCapture(ev.pointerId);
    }
    endPaintbrushDrag();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

function onViewportPointerDown(e: PointerEvent) {
  suppressViewportClickAfterMarquee = false;
  suppressPaintbrushClickAfterPointerDown = false;
  onMarqueePointerDown(e);
  onPaintbrushPointerDown(e);
  onMapPingPointerDown(e);
}

function canStartMapPing(): boolean {
  if (boardActionMode.value != null) return false;
  if (canUseGmTools.value && gmActiveTool.value != null) return false;
  if (stainGeyserPlacementActive.value) return false;
  if (gorgenautAgnosiaPlacementActive.value) return false;
  return true;
}

function onMapPingPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement;
  if (target.closest(".reset-zoom-btn")) return;
  beginMapPingHold({
    e,
    surface: "taccom",
    getCell: (clientX, clientY) => cellFromClientPoint(clientX, clientY),
    canStart: canStartMapPing,
  });
}

function mapPingStyle(x: number, y: number) {
  const s = gameState.value;
  if (!s) return null;
  const gridW = boardWidthPx.value;
  const gridH = contentHeightPx.value;
  const cellW = (gridW - (s.width - 1) * BOARD_CELL_GAP) / s.width;
  const cellH = (gridH - (s.height - 1) * BOARD_CELL_GAP) / s.height;
  const size = Math.min(cellW, cellH) * 0.85;
  return {
    left: `${x * (cellW + BOARD_CELL_GAP) + cellW / 2}px`,
    top: `${y * (cellH + BOARD_CELL_GAP) + cellH / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
  };
}

const marqueeOverlayStyle = computed(() => {
  if (!marqueeActive.value || !marqueeStart.value || !marqueeEnd.value || !viewportEl.value) return null;
  const rect = viewportEl.value.getBoundingClientRect();
  const x0 = marqueeStart.value.x - rect.left;
  const y0 = marqueeStart.value.y - rect.top;
  const x1 = marqueeEnd.value.x - rect.left;
  const y1 = marqueeEnd.value.y - rect.top;
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.abs(x1 - x0)}px`,
    height: `${Math.abs(y1 - y0)}px`,
  };
});

function tryGmDamageEffectToken(target: { kind: "player" | "enemy"; id: string }): boolean {
  if (props.role !== "gm" || gmActiveTool.value !== "damageEffect") return false;
  applyDamageEffectToToken(target);
  return true;
}

function trySpawnEnemyAt(x: number, y: number): boolean {
  const s = gameState.value;
  const spawnName = selectedSpawnEnemyName.value;
  if (!s || !spawnName) return false;
  if (
    validateEnemyFootprint(
      s,
      x,
      y,
      getEnemyScaleByName(spawnName),
      undefined,
      occupancy.value ?? undefined,
      { name: spawnName },
    ) !== null
  ) {
    return false;
  }
  send({ type: "addEnemy", x, y, name: spawnName });
  if (spawnName === STAIN_GEYSER_NAME) {
    clearSpawnEnemySelection();
    beginStainGeyserPlacement(x, y);
  }
  return true;
}

function onGmCellClick(x: number, y: number) {
  const s = gameState.value;
  if (!s) return;

  if (tryApplyStainGeyserPlacement(x, y)) return;
  if (tryApplyGorgenautAgnosiaPlacement(x, y)) return;

  if (gmEffectiveActiveTool.value === "paintbrush") {
    handlePaintbrushCellAction(x, y);
    return;
  }

  if (gmEffectiveActiveTool.value !== "select") {
    const occ = occupancy.value;
    const key = coordKey(x, y);
    const hasOccupant =
      !!occ && (!!occ.playerByKey.get(key) || !!occ.enemyByKey.get(key));
    if (!hasOccupant) clearGmBulkSelection();
  }

  if (gmActiveTool.value === "damageEffect") {
    const occ = occupancy.value;
    const key = coordKey(x, y);
    const player = occ?.playerByKey.get(key);
    if (player) {
      applyDamageEffectToToken({ kind: "player", id: player.id });
      return;
    }
    const enemy = occ?.enemyByKey.get(key);
    if (enemy) {
      applyDamageEffectToToken({ kind: "enemy", id: enemy.id });
      return;
    }
    const tile = tileAt(s.tiles, x, y);
    if (isObstacleTile(tile)) {
      applyDamageEffectToToken({ kind: "obstacle", x, y });
      return;
    }
    return;
  }

  if (gmEffectiveActiveTool.value === "select") {
    if (!selectOccupantAt(x, y)) {
      clearGmBulkSelection();
      return;
    }
    const enemy = occupancy.value?.enemyByKey.get(coordKey(x, y));
    if (enemy) applySameTypeBulkSelection(enemy.id);
    return;
  }

  if (gmActiveTool.value === "forceMove") {
    if (selectedPlayerId.value && gmForceMovableKeys.value.has(boardCellKey(x, y))) {
      send({
        type: "gmForceMove",
        target: { kind: "player", id: selectedPlayerId.value },
        x,
        y,
      });
      return;
    }
    if (selectedEnemyId.value && gmForceMovableKeys.value.has(boardCellKey(x, y))) {
      send({
        type: "gmForceMove",
        target: { kind: "enemy", id: selectedEnemyId.value },
        x,
        y,
        ...(isSoloSwarmMemberSelected.value ? { soloSwarmMember: true } : {}),
      });
      return;
    }
    if (selectOccupantAt(x, y)) return;
    clearBoardSelection();
    return;
  }

  if (boardActionMode.value === "gmEnemyAttack") {
    if (handleGmEnemyAttackCellClick(x, y)) return;
    clearBoardActionMode();
    return;
  }

  // Spawn and move before select so stacking onto occupied tiles works.
  if (trySpawnEnemyAt(x, y)) return;
  if (tryMoveSelectedEnemy(x, y)) return;
  if (selectOccupantAt(x, y)) return;
  clearBoardSelection();
}

function tryPatternCellClick(x: number, y: number): boolean {
  if (!patternPreviewActive.value || !isDrawablePattern.value) return false;
  const s = gameState.value;
  if (!s) return false;
  return tryExtendDrawing({ x, y }, s.width, s.height);
}

function onCellClick(x: number, y: number) {
  if (consumeSuppressMapPingClick()) return;
  if (tryPatternCellClick(x, y)) return;
  if (canUseGmTools.value) onGmCellClick(x, y);
  else onPlayerCellClick(x, y);
}

function onCellHover(x: number, y: number, key: string) {
  const suppressKey = paintbrushSuppressPreviewKey.value;
  if (suppressKey && suppressKey !== coordKey(x, y)) {
    clearPaintbrushSuppressPreview();
  }
  hoveredKey.value = key;
  hoveredCell.value = { x, y };
  setStainGeyserHover(x, y);
  setGorgenautAgnosiaHover(x, y);
  setPatternHoverOrigin({ x, y });
}

function onCellUnhover() {
  clearPaintbrushSuppressPreview();
  hoveredKey.value = null;
  hoveredCell.value = null;
  setPatternHoverOrigin(null);
}

function onViewportClick(e: MouseEvent) {
  closeContextMenu();
  if (consumeSuppressMapPingClick()) return;
  if (suppressViewportClickAfterMarquee) {
    suppressViewportClickAfterMarquee = false;
    return;
  }
  if ((e.target as HTMLElement).closest(".cell")) return;
  clearBoardSelection();
  clearGmBulkSelection();
}

function onBoardDisplayClick(e: MouseEvent) {
  closeContextMenu();
  const target = e.target as HTMLElement;
  if (target.closest(".board-viewport, .reset-zoom-btn, .board-tooltip")) return;
  clearBoardSelection();
  clearGmBulkSelection();
}

function removeEnemyById(enemyId: string) {
  send({ type: "removeEnemy", enemyId, entireSwarm: true });
  clearBoardSelection();
}

function removeSelectedEnemy() {
  if (!selectedEnemyId.value) return;
  removeEnemyById(selectedEnemyId.value);
}

function closeContextMenu() {
  contextMenu.value.open = false;
  contextMenu.value.items = [];
  contextMenu.value.enemyId = undefined;
  contextMenu.value.playerId = undefined;
  contextMenu.value.cellX = undefined;
  contextMenu.value.cellY = undefined;
}

function hasEffectStacks(unit: { effects?: EffectStacks } | undefined): boolean {
  if (!unit?.effects) return false;
  return Object.values(unit.effects).some((stacks) => stacks > 0);
}

function buildContextMenuItems(x: number, y: number): BoardContextMenuItem[] {
  const items: BoardContextMenuItem[] = [];
  const s = gameState.value;
  const occ = occupancy.value;
  const key = coordKey(x, y);
  const player = occ?.playerByKey.get(key);
  const enemy = occ?.enemyByKey.get(key);
  const attractor = s?.combat?.attractors?.find((a) => a.x === x && a.y === y);
  const tile = s ? tileAt(s.tiles, x, y) : undefined;
  const bulk = gmBulkSelection.value;
  const useBulk =
    canUseGmTools.value &&
    !!bulk &&
    !!occ &&
    isCellInBulkSelection(x, y, occ);
  const countLabel = (n: number) => (useBulk && n > 1 ? ` (${n})` : "");

  if (useBulk && bulk.kind === "tiles") {
    const n = bulk.coords.length;
    items.push({ id: "change-tile-terrain", label: `Change terrain type${countLabel(n)}` });
    items.push({ id: "add-tile-effect", label: `Add tile effect${countLabel(n)}` });
    if (bulk.coords.some((c) => hasTileEffects(tileAt(s!.tiles, c.x, c.y)))) {
      items.push({ id: "clear-tile-effects", label: `Clear tile effects${countLabel(n)}`, danger: true });
    }
    return items;
  }

  if (useBulk && bulk.kind === "players") {
    const n = bulk.ids.length;
    items.push({ id: "add-effect", label: `Add effect${countLabel(n)}` });
    if (bulk.ids.some((id) => hasEffectStacks(s?.players.find((p) => p.id === id)))) {
      items.push({ id: "clear-effects", label: `Clear effects${countLabel(n)}`, danger: true });
    }
    items.push({ id: "remove-player", label: `Remove token${countLabel(n)}`, danger: true });
    return items;
  }

  if (useBulk && bulk.kind === "enemies") {
    const n = bulk.ids.length;
    items.push({ id: "add-effect", label: `Add effect${countLabel(n)}` });
    if (bulk.ids.some((id) => hasEffectStacks(s?.enemies.find((e) => e.id === id)))) {
      items.push({ id: "clear-effects", label: `Clear effects${countLabel(n)}`, danger: true });
    }
    items.push({ id: "remove-enemy", label: `Remove enemy${countLabel(n)}`, danger: true });
    return items;
  }

  const canRemoveAttractor =
    !!attractor &&
    (canUseGmTools.value ||
      (props.role === "player" && yourPlayerId.value === attractor.ownerId));
  if (player || enemy) {
    items.push({ id: "add-effect", label: "Add effect" });
  }
  if (canUseGmTools.value) {
    items.push({ id: "change-tile-terrain", label: "Change terrain type" });
    items.push({ id: "add-tile-effect", label: "Add tile effect" });
    if (hasTileEffects(tile)) {
      items.push({ id: "clear-tile-effects", label: "Clear tile effects", danger: true });
    }
  }
  if (canUseGmTools.value && hasEffectStacks(player ?? enemy)) {
    items.push({ id: "clear-effects", label: "Clear effects", danger: true });
  }
  if (canUseGmTools.value && enemy) {
    items.push({ id: "remove-enemy", label: "Remove enemy", danger: true });
  }
  if (player && (canUseGmTools.value || player.id === yourPlayerId.value)) {
    items.push({ id: "remove-player", label: "Remove token", danger: true });
  }
  if (canRemoveAttractor) {
    items.push({ id: "remove-attractor", label: "Remove attractors", danger: true });
  }
  return items;
}

function onBoardContextMenu(e: MouseEvent) {
  if (!gameState.value) return;
  e.preventDefault();

  const cell = (e.target as HTMLElement).closest("[data-cell-x]") as HTMLElement | null;
  if (!cell) {
    closeContextMenu();
    return;
  }

  const x = Number(cell.dataset.cellX);
  const y = Number(cell.dataset.cellY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const items = buildContextMenuItems(x, y);
  if (items.length === 0) {
    closeContextMenu();
    return;
  }

  const occ = occupancy.value;
  const key = coordKey(x, y);
  const player = occ?.playerByKey.get(key);
  const enemy = occ?.enemyByKey.get(key);
  const inBulk =
    canUseGmTools.value &&
    !!gmBulkSelection.value &&
    !!occ &&
    isCellInBulkSelection(x, y, occ);
  if (!inBulk) {
    if (enemy) selectBoardEnemy(enemy.id);
    else if (player) selectBoardPlayer(player.id, player.characterSheetId);
  }

  contextMenu.value = {
    open: true,
    x: e.clientX,
    y: e.clientY,
    items,
    enemyId: enemy?.id,
    playerId: player?.id,
    cellX: x,
    cellY: y,
  };
}

function onContextMenuSelect(id: string) {
  const bulk = gmBulkSelection.value;
  const occ = occupancy.value;
  const cellX = contextMenu.value.cellX;
  const cellY = contextMenu.value.cellY;
  const useBulk =
    !!bulk &&
    cellX != null &&
    cellY != null &&
    !!occ &&
    isCellInBulkSelection(cellX, cellY, occ);

  if (id === "add-effect") {
    if (useBulk && (bulk.kind === "players" || bulk.kind === "enemies")) {
      effectModalBulkTargets.value = bulk.ids.map((targetId) => ({
        kind: bulk.kind === "players" ? "player" : "enemy",
        id: targetId,
      }));
      effectModalTarget.value = null;
      effectModalOpen.value = true;
      closeContextMenu();
      return;
    }
    const enemyId = contextMenu.value.enemyId;
    const playerId = contextMenu.value.playerId;
    effectModalBulkTargets.value = undefined;
    if (enemyId) {
      effectModalTarget.value = { kind: "enemy", id: enemyId };
    } else if (playerId) {
      effectModalTarget.value = { kind: "player", id: playerId };
    }
    effectModalOpen.value = true;
    closeContextMenu();
    return;
  }
  if (id === "clear-effects") {
    if (useBulk && (bulk.kind === "players" || bulk.kind === "enemies")) {
      for (const targetId of bulk.ids) {
        send({
          type: "clearEffects",
          target: { kind: bulk.kind === "players" ? "player" : "enemy", id: targetId },
        });
      }
      closeContextMenu();
      return;
    }
    const enemyId = contextMenu.value.enemyId;
    const playerId = contextMenu.value.playerId;
    if (enemyId) {
      send({ type: "clearEffects", target: { kind: "enemy", id: enemyId } });
    } else if (playerId) {
      send({ type: "clearEffects", target: { kind: "player", id: playerId } });
    }
    closeContextMenu();
    return;
  }
  if (id === "add-tile-effect") {
    if (useBulk && bulk.kind === "tiles") {
      tileEffectModalBulkCoords.value = bulk.coords;
      tileEffectModalCoords.value = null;
      tileEffectModalOpen.value = true;
      closeContextMenu();
      return;
    }
    const x = contextMenu.value.cellX;
    const y = contextMenu.value.cellY;
    if (x != null && y != null) {
      tileEffectModalBulkCoords.value = undefined;
      tileEffectModalCoords.value = { x, y };
      tileEffectModalOpen.value = true;
    }
    closeContextMenu();
    return;
  }
  if (id === "change-tile-terrain") {
    if (useBulk && bulk.kind === "tiles") {
      tileTerrainModalBulkCoords.value = bulk.coords;
      tileTerrainModalCoords.value = null;
      tileTerrainModalOpen.value = true;
      closeContextMenu();
      return;
    }
    const x = contextMenu.value.cellX;
    const y = contextMenu.value.cellY;
    if (x != null && y != null) {
      tileTerrainModalBulkCoords.value = undefined;
      tileTerrainModalCoords.value = { x, y };
      tileTerrainModalOpen.value = true;
    }
    closeContextMenu();
    return;
  }
  if (id === "clear-tile-effects") {
    if (useBulk && bulk.kind === "tiles") {
      for (const coords of bulk.coords) {
        send({ type: "clearTileEffects", x: coords.x, y: coords.y });
      }
      closeContextMenu();
      return;
    }
    const x = contextMenu.value.cellX;
    const y = contextMenu.value.cellY;
    if (x != null && y != null) {
      send({ type: "clearTileEffects", x, y });
    }
    closeContextMenu();
    return;
  }
  if (id === "remove-enemy") {
    if (useBulk && bulk.kind === "enemies") {
      for (const enemyId of bulk.ids) removeEnemyById(enemyId);
      closeContextMenu();
      return;
    }
    if (contextMenu.value.enemyId) {
      removeEnemyById(contextMenu.value.enemyId);
    }
    closeContextMenu();
    return;
  }
  if (id === "remove-player") {
    if (useBulk && bulk.kind === "players") {
      for (const targetId of bulk.ids) send({ type: "removePlayerToken", playerId: targetId });
    } else if (contextMenu.value.playerId) {
      send({ type: "removePlayerToken", playerId: contextMenu.value.playerId });
    }
    clearBoardSelection();
    closeContextMenu();
    return;
  }
  if (id === "remove-attractor") {
    const x = contextMenu.value.cellX;
    const y = contextMenu.value.cellY;
    if (x != null && y != null) {
      send({ type: "removeAttractor", x, y });
    }
    closeContextMenu();
    return;
  }
  closeContextMenu();
}

function endEnemyTurn(enemyId: string): boolean {
  const s = gameState.value;
  if (!s) return false;
  const enemy = s.enemies.find((e) => e.id === enemyId);
  if (!enemy || enemy.exhausted || isTowerEnemy(enemy) || !canGmMoveEnemies(s)) return false;
  send({ type: "gmEnemyAction", action: { action: "exhaust", enemyId: enemy.id } });
  return true;
}

function tryEndGmTokenTurn(): boolean {
  const id = selectedEnemyId.value;
  if (!id) return false;
  return endEnemyTurn(id);
}

function tryEndPlayerTurn(): boolean {
  const s = gameState.value;
  const id = yourPlayerId.value;
  if (!s || !id || props.role !== "player") return false;
  if (s.roundPhase !== "playerTurn") return false;
  if (s.turn?.role !== "player" || s.turn.playerId !== id) return false;
  send({ type: "phaseAction", action: "endPlayerTurn" });
  return true;
}

function onKeydown(e: KeyboardEvent) {
  if (isTypingTarget(e.target)) return;

  if (
    canUseGmTools.value &&
    gmActiveTool.value === "paintbrush" &&
    (e.key === "s" || e.key === "S") &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey
  ) {
    setPaintbrushSelectHeld(true);
    return;
  }

  if (
    canUseGmTools.value &&
    gmActiveTool.value === "paintbrush" &&
    (e.key === "e" || e.key === "E") &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey
  ) {
    setPaintbrushEyedropperActive(true);
    return;
  }

  if (
    canUseGmTools.value &&
    gmActiveTool.value === "paintbrush" &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey
  ) {
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      cyclePaintbrushImageRotation();
      return;
    }
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      togglePaintbrushImageFlip();
      return;
    }
  }

  if (e.key === "e" && e.ctrlKey && !e.metaKey && !e.altKey) {
    if (canUseGmTools.value && tryEndGmTokenTurn()) {
      e.preventDefault();
      return;
    }
    if (tryEndPlayerTurn()) {
      e.preventDefault();
      return;
    }
  }

  if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && !e.altKey) {
    if (patternPreviewActive.value && selectedPattern.value?.directional) {
      e.preventDefault();
      cyclePatternDirection();
      return;
    }
    const mode = boardActionMode.value;
    if (
      mode === "attack" ||
      mode === "omnistrike" ||
      mode === "equipmentCorridor" ||
      mode === "equipmentForceProjection" ||
      mode === "equipmentRedirect" ||
      mode === "varunastraBorrow" ||
      mode === "gmEnemyAttack"
    ) {
      if (mode === "omnistrike" && omnistrikeStep.value === "selectBombs") return;
      if (mode === "equipmentRedirect" && redirectStep.value === "selectAttack") {
        const s = gameState.value;
        const sourceId = redirectSourceEnemyId.value;
        if (s && sourceId) {
          const source = s.enemies.find((e) => e.id === sourceId);
          if (source?.name) {
            const indices = listRedirectableEnemyAttackIndices(source.name);
            const cur = redirectAttackIndex.value ?? indices[0]!;
            const pos = indices.indexOf(cur);
            redirectAttackIndex.value = indices[(pos + 1) % indices.length]!;
          }
        }
        e.preventDefault();
        return;
      }
      e.preventDefault();
      rotateAttackDirection();
      if (mode === "attack" || mode === "equipmentForceProjection") {
        const ctx = attackContext.value;
        if (ctx && !usesAnchoredPatternPlacement(ctx.spec)) attackAimed.value = true;
      } else if (mode === "gmEnemyAttack") {
        const pending = gmEnemyAttack.value;
        const s = gameState.value;
        if (pending && s) {
          const attackSpec = getEnemyAttack(
            s.enemies.find((e) => e.id === pending.enemyId)?.name,
            pending.attackIndex,
          )?.attack;
          if (attackSpec && isPatternEnemyAttack(attackSpec)) {
            const enemy = s.enemies.find((e) => e.id === pending.enemyId);
            const patternId = attackSpec.patternId;
            if (enemy && patternId) {
              const origins = enemyPatternOrigins(enemy, attackDirection.value, patternId);
              attackAnchor.value = origins[0] ?? null;
              attackAimed.value = origins.length > 0;
            }
          }
        }
      } else if (mode === "equipmentRedirect" && redirectStep.value === "confirmPattern") {
        const s = gameState.value;
        const sourceId = redirectSourceEnemyId.value;
        const attackIndex = redirectAttackIndex.value;
        if (s && sourceId && attackIndex != null) {
          const attackSpec = getEnemyAttack(
            s.enemies.find((e) => e.id === sourceId)?.name,
            attackIndex,
          )?.attack;
          const enemy = s.enemies.find((e) => e.id === sourceId);
          const patternId = attackSpec?.patternId;
          if (enemy && patternId) {
            const origins = enemyPatternOrigins(enemy, attackDirection.value, patternId);
            attackAnchor.value = origins[0] ?? null;
            attackAimed.value = origins.length > 0;
          }
        }
      } else if (mode === "varunastraBorrow") {
        const ctx = borrowContext.value;
        if (ctx && !usesAnchoredPatternPlacement(ctx.spec)) attackAimed.value = true;
      }
      return;
    }
  }

  if (contextMenu.value.open && e.key === "Escape") {
    e.preventDefault();
    closeContextMenu();
    return;
  }

  if (canUseGmTools.value) {
    if (e.key === "Escape") {
      if (stainGeyserPlacementActive.value) {
        clearStainGeyserPlacement();
        return;
      }
      if (gorgenautAgnosiaPlacementActive.value) {
        const enemy = gameState.value?.enemies.find(
          (e) => e.id === pendingGorgenautAgnosiaEnemyId.value,
        );
        if (enemy) {
          const centered = agnosiaCenteredHover(
            enemy.x,
            enemy.y,
            getEnemyScale(enemy),
            GORGENAUT_AGNOSIA_BOX,
          );
          setGorgenautAgnosiaHover(centered.x, centered.y);
        }
        return;
      }
      if (gmActiveTool.value === "forceMove" && (selectedPlayerId.value || selectedEnemyId.value)) {
        clearBoardSelection();
        return;
      }
      if (gmBulkSelection.value) {
        clearGmBulkSelection();
        return;
      }
      if (gmActiveTool.value) {
        clearActiveTool();
        return;
      }
      if (selectedSpawnEnemyName.value) {
        clearSpawnEnemySelection();
        return;
      }
      clearBoardSelection();
      return;
    }
    if ((e.key === "Delete" || e.key === "Backspace") && selectedEnemyId.value) {
      e.preventDefault();
      removeSelectedEnemy();
      return;
    }
    const selected = selectedEnemyId.value;
    const s = gameState.value;
    if (selected && s) {
      const enemy = s.enemies.find((e) => e.id === selected);
      if (enemy) {
        const anchor = arrowTarget(e.key, enemy);
        if (anchor) {
          e.preventDefault();
          if (!swarmGroupForEnemy(s, selected)) {
            tryMoveSelectedEnemyToDest(anchor.x, anchor.y);
          }
        }
      }
    }
    return;
  }

  const me = yourPlayer.value;
  if (!me) return;
  const t = arrowTarget(e.key, me);
  if (!t) return;
  e.preventDefault();
  tryMove(t.x, t.y);
}

function onKeyup(e: KeyboardEvent) {
  if (e.key === "e" || e.key === "E") setPaintbrushEyedropperActive(false);
  if (e.key === "s" || e.key === "S") setPaintbrushSelectHeld(false);
}

function onWindowBlur() {
  setPaintbrushEyedropperActive(false);
  setPaintbrushSelectHeld(false);
}

onMounted(() => {
  void loadSheets();
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("keyup", onKeyup);
  window.addEventListener("blur", onWindowBlur);
});

watch(viewportEl, (el, prev) => {
  observeViewport(el, prev);
});

onUnmounted(() => {
  if (previewHoverTimer) clearTimeout(previewHoverTimer);
  if (attackPreviewSyncTimer) clearTimeout(attackPreviewSyncTimer);
  if (teleportFinishTimer) clearTimeout(teleportFinishTimer);
  if (enemyMoveFinishTimer) clearTimeout(enemyMoveFinishTimer);
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("keyup", onKeyup);
  window.removeEventListener("blur", onWindowBlur);
  overlayInsetObserver?.disconnect();
  disconnectViewport();
});
</script>

<template>
  <div class="game-board">
    <div v-if="gameState" class="board-display" @click="onBoardDisplayClick">
      <div
        ref="viewportEl"
        class="board-viewport"
        :class="{ 'gm-tool-cursor': !!gmViewportCursor }"
        :style="gmViewportCursor ? { '--gm-tool-cursor': gmViewportCursor } : undefined"
        @pointerdown="onViewportPointerDown"
        @click="onViewportClick"
        @contextmenu="onBoardContextMenu"
        @wheel.prevent="onWheel"
      >
        <div
          v-if="marqueeOverlayStyle"
          class="marquee-overlay"
          :style="marqueeOverlayStyle"
          aria-hidden="true"
        />
        <div class="board-stage" :style="stageStyle">
          <div class="board" :style="gridStyle">
            <svg
              v-if="elevationContourPaths"
              class="elevation-contour-overlay"
              aria-hidden="true"
              :viewBox="`0 0 ${boardWidthPx} ${contentHeightPx}`"
            >
              <path
                v-for="(d, i) in elevationContourPaths"
                :key="i"
                :d="d"
                fill="none"
                stroke="var(--color-elevation-contour)"
                stroke-width="1"
                stroke-linecap="round"
              />
            </svg>
            <BoardCell
                v-for="row in boardCellRows"
                :key="row.key"
                v-memo="[
                  row.cell,
                  row.cell.tileBaseColor,
                  row.cell.tile?.name,
                  row.cell.tileAppearanceUrl,
                  row.cell.tileOverlayUrl,
                  row.cell.tileFeatureUrl,
                  row.cell.appearanceTint,
                  row.cell.overlayTint,
                  row.cell.featureTint,
                  row.cell.appearanceRotation,
                  row.cell.appearanceFlip,
                  row.cell.overlayRotation,
                  row.cell.overlayFlip,
                  row.cell.featureRotation,
                  row.cell.featureFlip,
                  row.cell.paintbrushPreview,
                  row.isHovered,
                  draggingDeploy,
                  row.isPlayerSelected,
                  row.isEnemySelected,
                  row.isBulkTileSelected,
                  row.playerHp,
                  row.enemyHp,
                  row.enemyDying,
                  showHealthBars,
                  showEnemyHealthBars,
                  row.enemyAnimating,
                  row.playerTeleporting,
                  row.enemyPendingRemoval,
                  row.enemyDefeated,
                  row.stackedEnemyKey,
                ]"
                :x="row.x"
                :y="row.y"
                :cell="row.cell"
                :is-hovered="row.isHovered"
                :dragging-deploy="draggingDeploy"
                :can-drag-deploy="row.canDragDeploy"
                :is-player-selected="row.isPlayerSelected"
                :is-enemy-selected="row.isEnemySelected"
                :is-bulk-tile-selected="row.isBulkTileSelected"
                :player-hue="row.playerHue"
                :show-health-bars="showHealthBars"
                :show-enemy-health-bars="showEnemyHealthBars"
                :enemy-dying="row.enemyDying"
                :enemy-defeated="row.enemyDefeated"
                :player-teleporting="row.playerTeleporting"
                :enemy-animating="row.enemyAnimating"
                :paintbrush-active="canUseGmTools && gmEffectiveActiveTool === 'paintbrush'"
                :gm-inherit-cursor="!!gmViewportCursor"
                @click="onCellClick(row.x, row.y)"
                @hover="onCellHover(row.x, row.y, row.key)"
                @unhover="onCellUnhover"
                @player-click="onBoardPlayerClick(row.x, row.y, row.cell.player!.id, row.cell.player!.characterSheetId)"
                @enemy-click="onEnemyCellClick(row.x, row.y, $event)"
                @enemy-dblclick="onEnemyCellDblClick(row.x, row.y, $event)"
                @deploy-pointer-down="onDeployPointerDown($event, row.cell.player!)"
              />
            <div
              v-for="ping in taccomPings"
              :key="ping.fromId"
              class="map-ping"
              :style="mapPingStyle(ping.x, ping.y) ?? undefined"
              :title="ping.fromName"
              aria-hidden="true"
            />
          </div>
        </div>

        <div v-if="tooltipData" class="board-tooltip popover-tooltip" :style="tooltipStyle ?? undefined">
          <div class="tooltip-section">
            <span class="tooltip-row">({{ tooltipData.x }}, {{ tooltipData.y }})</span>
            <span v-if="tooltipData.tileName" class="tooltip-row">{{ tooltipData.tileName }}</span>
            <span class="tooltip-row">Terrain: {{ terrainTooltipLabel(tooltipData.tile.terrain) }}</span>
            <span
              v-if="isObstacleTile(tooltipData.tile)"
              class="tooltip-row"
            >
              Obstacle HP: {{ getObstacleHp(tooltipData.tile) }}
            </span>
            <span class="tooltip-row">Elevation: {{ tooltipData.tile.elevation }}</span>
            <span v-if="tooltipData.moveCost != null" class="tooltip-row">
              Move cost: {{ tooltipData.moveCost }}
            </span>
          </div>
          <div v-if="tooltipData.players.length" class="tooltip-section">
            <span class="tooltip-heading">Players</span>
            <div v-for="player in tooltipData.players" :key="player.id" class="tooltip-unit">
              <span class="tooltip-row">
                {{ playerLabel(player) }} · HP {{ formatHp(player.hp, getPlayerMaxHp(player)) }}
              </span>
              <span
                v-for="effect in effectEntries(player.effects)"
                :key="effect.id"
                class="tooltip-row tooltip-effect"
              >
                {{ effectTooltipLabel(effect.id, effect.stacks) }}
              </span>
            </div>
          </div>
          <div v-if="tooltipData.towers.length" class="tooltip-section">
            <span class="tooltip-heading">Towers</span>
            <div v-for="tower in tooltipData.towers" :key="tower.id" class="tooltip-unit">
              <span class="tooltip-row">
                {{ enemyLabel(tower) }}<template v-if="canUseGmTools"> · HP {{ formatHp(tower.hp, getEnemyMaxHp(tower)) }}</template>
              </span>
            </div>
          </div>
          <div v-if="tooltipData.enemies.length" class="tooltip-section">
            <span class="tooltip-heading">Enemies</span>
            <div v-for="enemy in tooltipData.enemies" :key="enemy.id" class="tooltip-unit">
              <span class="tooltip-row">
                {{ enemy.displayName }}<template v-if="canUseGmTools"> · HP {{ formatHp(enemy.displayHp, enemy.displayMaxHp) }}</template>
              </span>
              <span
                v-for="effect in effectEntries(enemy.effects)"
                :key="effect.id"
                class="tooltip-row tooltip-effect"
              >
                {{ effectTooltipLabel(effect.id, effect.stacks) }}
              </span>
            </div>
          </div>
          <div v-if="tooltipData.attractors.length" class="tooltip-section">
            <span class="tooltip-heading">Attractors</span>
            <span
              v-for="attractor in tooltipData.attractors"
              :key="attractor.id"
              class="tooltip-row"
            >
              {{ attractorTooltipLabel(attractor) }}
            </span>
          </div>
          <div v-if="tooltipData.boardTokens.length" class="tooltip-section">
            <span class="tooltip-heading">Tokens</span>
            <span
              v-for="token in tooltipData.boardTokens"
              :key="token.id"
              class="tooltip-row"
            >
              {{ boardTokenTooltipLabel(token) }}
            </span>
          </div>
          <div v-if="tooltipData.objects.length" class="tooltip-section">
            <span class="tooltip-heading">Objects</span>
            <span
              v-for="object in tooltipData.objects"
              :key="object.id"
              class="tooltip-row"
            >
              {{ terrainObjectLabel(object) }}
            </span>
          </div>
          <div v-if="effectEntries(tooltipData.tile.tileEffects).length" class="tooltip-section">
            <span class="tooltip-heading">Tile effects</span>
            <span
              v-for="effect in effectEntries(tooltipData.tile.tileEffects)"
              :key="effect.id"
              class="tooltip-row tooltip-effect"
            >
              {{ formatTileEffectTooltipLabel(effect.id, effect.stacks) }}
            </span>
          </div>
        </div>

        <div
          v-for="indicator in damageIndicators"
          :key="indicator.id"
          class="damage-indicator"
          :style="damageIndicatorStyle(indicator.x, indicator.y)"
        >
          <span class="damage-indicator-text">-{{ indicator.amount }}</span>
        </div>

        <div
          v-if="enemyMoveOverlayStyle"
          class="enemy-move-overlay"
          :class="{
            'enemy-move-overlay-animating': enemyMoveOverlayAtDest,
            'has-portrait': !!enemyMoveOverlayPortraitUrl,
            'fortification-overlay': enemyMoveOverlayIsFortification,
            selected: enemyMoveOverlaySelected,
          }"
          :style="[
            enemyMoveOverlayStyle,
            enemyMoveOverlayBg ? { background: enemyMoveOverlayBg } : undefined,
          ]"
          @transitionend="onEnemyMoveOverlayTransitionEnd"
        >
          <img
            v-if="enemyMoveOverlayPortraitUrl"
            :src="enemyMoveOverlayPortraitUrl"
            alt=""
            class="portrait-img"
          />
        </div>

        <div
          v-if="teleportOverlayStyle && teleportOverlayPlayer"
          class="teleport-overlay"
          :class="{
            'teleport-overlay-animating': teleportOverlayAtDest,
            selected: teleportOverlaySelected,
          }"
          :style="[
            teleportOverlayStyle,
            !teleportOverlayPlayer.characterSheetId || !portraitUrlFor(teleportOverlayPlayer.characterSheetId)
              ? { background: `hsl(${hueFromId(teleportOverlayPlayer.id)} 70% 45%)` }
              : undefined,
          ]"
          @transitionend="onTeleportOverlayTransitionEnd"
        >
          <img
            v-if="teleportOverlayPlayer.characterSheetId && portraitUrlFor(teleportOverlayPlayer.characterSheetId)"
            :src="portraitUrlFor(teleportOverlayPlayer.characterSheetId)!"
            alt=""
            class="portrait-img"
          />
        </div>
      </div>
      <button v-if="isTransformed" class="reset-zoom-btn" type="button" @click="fitToView(true)">
        Reset zoom
      </button>
    </div>

    <div v-else class="board-loading" role="status" aria-live="polite">
      <span class="board-loading-spinner" aria-hidden="true" />
      <p class="board-loading-message">{{ boardLoadingMessage }}</p>
    </div>

    <BoardContextMenu
      :open="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @select="onContextMenuSelect"
      @close="closeContextMenu"
    />

    <AddEffectModal
      :open="effectModalOpen"
      :target="effectModalTarget"
      :bulk-targets="effectModalBulkTargets"
      @close="effectModalOpen = false; effectModalBulkTargets = undefined"
    />

    <AddTileEffectModal
      :open="tileEffectModalOpen"
      :coords="tileEffectModalCoords"
      :bulk-coords="tileEffectModalBulkCoords"
      @close="tileEffectModalOpen = false; tileEffectModalBulkCoords = undefined"
    />

    <ChangeTileTerrainModal
      :open="tileTerrainModalOpen"
      :coords="tileTerrainModalCoords"
      :bulk-coords="tileTerrainModalBulkCoords"
      @close="tileTerrainModalOpen = false; tileTerrainModalBulkCoords = undefined"
    />

    <component :is="combatBoard.host" v-if="combatBoard.host" />

    <ProvokePromptModal
      :open="provokePromptOpen"
      :triggers="provokeTriggers"
      @close="onProvokeCancel"
      @confirm="onProvokeConfirm"
    />

    <TargetPickerModal
      :open="targetPickerOpen"
      :enemies="targetPickerEnemies"
      :max-selectable="targetPickerMaxSelectable"
      :pre-selected-ids="targetPickerPreSelectedIds"
      :show-hp="canUseGmTools"
      @close="closeTargetPicker"
      @confirm="onTargetPickerConfirm"
    />
  </div>
</template>

<style scoped>
.game-board {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.board-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  margin: 0;
  padding: 1.5rem;
}

.board-loading-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  animation: board-loading-spin 0.7s linear infinite;
}

.board-loading-message {
  margin: 0;
  color: var(--color-muted);
  font-size: 1.05rem;
}

@keyframes board-loading-spin {
  to { transform: rotate(360deg); }
}

.board-display {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.board-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.board-viewport.gm-tool-cursor {
  cursor: var(--gm-tool-cursor);
}

.marquee-overlay {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  border: 1px dashed var(--color-accent-bright);
  background: var(--color-accent-subtle-bg);
  opacity: 0.45;
}

.reset-zoom-btn {
  position: absolute;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-board);
  color: var(--color-text);
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.reset-zoom-btn:hover {
  background: var(--color-surface);
  border-color: var(--color-accent-muted);
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

.elevation-contour-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.map-ping {
  position: absolute;
  z-index: 6;
  pointer-events: none;
  border-radius: 50%;
  border: 2px solid var(--color-accent-bright);
  background: color-mix(in srgb, var(--color-accent) 22%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent);
  transform: translate(-50%, -50%);
  animation: map-ping-pulse 1s ease-out infinite;
}

@keyframes map-ping-pulse {
  0% {
    opacity: 0.95;
    transform: translate(-50%, -50%) scale(0.72);
  }
  70% {
    opacity: 0.35;
    transform: translate(-50%, -50%) scale(1.15);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.28);
  }
}

.board-tooltip {
  position: absolute;
  white-space: nowrap;
  z-index: 3;
}

.teleport-overlay {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-surface);
  transition: left 350ms ease, top 350ms ease;
}

.teleport-overlay.selected,
.enemy-move-overlay.selected {
  outline: 2px solid var(--color-on-accent);
}

.teleport-overlay .portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}

.enemy-move-overlay {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  border-radius: 50%;
  background: var(--color-enemy-piece);
  box-sizing: border-box;
  transition: left 350ms ease, top 350ms ease;
  overflow: hidden;
}

.enemy-move-overlay.has-portrait {
  background: linear-gradient(to top, var(--color-on-dark) 0%, transparent 50%), var(--color-surface-raised);
}

.enemy-move-overlay.fortification-overlay {
  border-radius: 4px;
}

.enemy-move-overlay .portrait-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  border-radius: 50%;
}

.enemy-move-overlay.fortification-overlay .portrait-img {
  border-radius: 4px;
}

.damage-indicator {
  position: absolute;
  z-index: 4;
  pointer-events: none;
}

.damage-indicator-text {
  display: inline-block;
  font-size: 1.7rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--color-danger);
  text-shadow: var(--shadow-text);
  opacity: 0;
  animation: damage-indicator 2s ease-in-out forwards;
}

@keyframes damage-indicator {
  0% {
    opacity: 0;
    transform: translateY(var(--damage-rise, 10px));
  }
  12% {
    opacity: 1;
    transform: translateY(0);
  }
  75% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(0);
  }
}

.tooltip-section + .tooltip-section {
  margin-top: 0.35rem;
  padding-top: 0.35rem;
  border-top: 1px solid var(--color-border);
}

.tooltip-heading {
  display: block;
  margin-bottom: 0.15rem;
  color: var(--color-muted);
  text-transform: uppercase;
  font-family: inherit;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.tooltip-row {
  display: block;
}

.tooltip-unit + .tooltip-unit {
  margin-top: 0.35rem;
}

.tooltip-effect {
  padding-left: 0.5rem;
  color: var(--color-muted);
  font-size: 0.72rem;
}
</style>
