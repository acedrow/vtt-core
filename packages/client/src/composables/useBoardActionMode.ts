import { computed, ref } from "vue";
import { nextPatternDirection } from "@gaem/shared";
import type { PatternDirection } from "@gaem/shared";

import { clearActiveTool } from "./useGmTools.js";

export type BoardActionMode =
  | "move"
  | "attack"
  | "omnistrike"
  | "warhook"
  | "shove"
  | "sprint"
  | "aegis"
  | "armorTeleport"
  | "armorPush"
  | "armorPlaceTower"
  | "towerTeleport"
  | "kataptyPick"
  | "rez"
  | "kopisMark"
  | "chrysaorBrand"
  | "sharurAttractor"
  | "hephaestusSynesis"
  | "hephaestusRestore"
  | "harpeTrap"
  | "varunastraBorrow"
  | "assistedLaunch"
  | "equipmentCorridor"
  | "equipmentCover"
  | "equipmentForceProjection"
  | "equipmentRedirect"
  | "gmEnemyAttack"
  | null;

export type OmnistrikeStep = "selectBombs" | "placeFirst" | "placeSecond" | "confirm";
export type WarhookStep = "selectTarget" | "selectLanding";
export type TowerTeleportStep = "selectLanding" | "selectKeraunoTarget";
export type AssistedLaunchStep = "selectAnchor" | "confirm";
export type RedirectStep = "selectSource" | "selectAttack" | "selectTarget" | "confirmPattern";
export type ForceProjectionStep = "selectSquare" | "attack";

const mode = ref<BoardActionMode>(null);
const attackDirection = ref<PatternDirection>("n");
const attackAimed = ref(false);
const attackAnchor = ref<{ x: number; y: number } | null>(null);
const elevBonusTile = ref<{ x: number; y: number } | null>(null);
const rangeAttackTargetIds = ref<string[]>([]);
const rangeAttackObstacleCoords = ref<{ x: number; y: number }[]>([]);
const movePath = ref<{ x: number; y: number }[]>([]);
const pendingTargetEnemyId = ref<string | null>(null);
const pendingTargetPlayerId = ref<string | null>(null);
const armorLanding = ref<{ x: number; y: number } | null>(null);
const armorPush = ref<1 | 2 | 3>(1);
const omnistrikeStep = ref<OmnistrikeStep>("selectBombs");
const omnistrikeBombs = ref<[number | null, number | null]>([null, null]);
const omnistrikeAnchors = ref<[{ x: number; y: number } | null, { x: number; y: number } | null]>([
  null,
  null,
]);
const omnistrikeAimed = ref(false);
const warhookStep = ref<WarhookStep>("selectTarget");
const warhookTarget = ref<{ enemyId?: string; x: number; y: number } | null>(null);
const warhookLandingOptions = ref<{ x: number; y: number }[]>([]);
const towerTeleportStep = ref<TowerTeleportStep>("selectLanding");
const towerTeleportLanding = ref<{ x: number; y: number } | null>(null);
const kataptyTargetIds = ref<string[]>([]);
const borrowAllyId = ref<string | null>(null);
const assistedLaunchStep = ref<AssistedLaunchStep>("selectAnchor");
const assistedLaunchAnchor = ref<{ x: number; y: number } | null>(null);
const equipmentCoverTiles = ref<{ x: number; y: number }[]>([]);
const forceProjectionOrigin = ref<{ x: number; y: number } | null>(null);
const forceProjectionStep = ref<ForceProjectionStep>("selectSquare");
const redirectSourceEnemyId = ref<string | null>(null);
const redirectAttackIndex = ref<number | null>(null);
const redirectStep = ref<RedirectStep>("selectSource");
const gmEnemyAttack = ref<{
  enemyId: string;
  attackIndex: number;
  damage?: number;
  swarm?: boolean;
  stainTeleport?: boolean;
  plantFlowerbud?: boolean;
  targetPlayerId?: string;
  targetEnemyId?: string;
} | null>(null);
const rangeAttackConfirmHandler = ref<(() => void) | null>(null);

function resetEquipmentCoverState() {
  equipmentCoverTiles.value = [];
}

function resetRedirectState() {
  redirectSourceEnemyId.value = null;
  redirectAttackIndex.value = null;
  redirectStep.value = "selectSource";
}

function resetForceProjectionState() {
  forceProjectionOrigin.value = null;
  forceProjectionStep.value = "selectSquare";
}

function resetAssistedLaunchState() {
  assistedLaunchStep.value = "selectAnchor";
  assistedLaunchAnchor.value = null;
}

function resetWarhookState() {
  warhookStep.value = "selectTarget";
  warhookTarget.value = null;
  warhookLandingOptions.value = [];
}

function resetOmnistrikeState() {
  omnistrikeStep.value = "selectBombs";
  omnistrikeBombs.value = [null, null];
  omnistrikeAnchors.value = [null, null];
  omnistrikeAimed.value = false;
}

function resetTowerTeleportState() {
  towerTeleportStep.value = "selectLanding";
  towerTeleportLanding.value = null;
}

export function useBoardActionMode() {
  const isActive = computed(() => mode.value !== null);

  function setMode(next: BoardActionMode) {
    if (next !== null) clearActiveTool();
    mode.value = next;
    attackAimed.value = false;
    attackAnchor.value = null;
    elevBonusTile.value = null;
    rangeAttackTargetIds.value = [];
    rangeAttackObstacleCoords.value = [];
    movePath.value = [];
    pendingTargetEnemyId.value = null;
    pendingTargetPlayerId.value = null;
    armorLanding.value = null;
    kataptyTargetIds.value = [];
    borrowAllyId.value = null;
    gmEnemyAttack.value = null;
    resetAssistedLaunchState();
    resetOmnistrikeState();
    resetWarhookState();
    resetTowerTeleportState();
    resetEquipmentCoverState();
    resetForceProjectionState();
    resetRedirectState();
  }

  function clearMode() {
    setMode(null);
  }

  function rotateAttackDirection() {
    attackDirection.value = nextPatternDirection(attackDirection.value);
  }

  function appendMoveStep(x: number, y: number) {
    movePath.value = [...movePath.value, { x, y }];
  }

  function resetMovePath() {
    movePath.value = [];
  }

  function startGmEnemyAttack(
    enemyId: string,
    attackIndex: number,
    damage?: number,
    opts?: { stainTeleport?: boolean; plantFlowerbud?: boolean },
  ) {
    setMode("gmEnemyAttack");
    gmEnemyAttack.value = {
      enemyId,
      attackIndex,
      damage,
      stainTeleport: opts?.stainTeleport,
      plantFlowerbud: opts?.plantFlowerbud,
    };
  }

  function startGmSwarmAttack(enemyId: string, attackIndex: number, damage?: number) {
    setMode("gmEnemyAttack");
    gmEnemyAttack.value = { enemyId, attackIndex, damage, swarm: true };
  }

  function registerRangeAttackConfirm(handler: () => void) {
    rangeAttackConfirmHandler.value = handler;
  }

  function unregisterRangeAttackConfirm() {
    rangeAttackConfirmHandler.value = null;
  }

  function confirmRangeAttack() {
    rangeAttackConfirmHandler.value?.();
  }

  return {
    mode,
    attackDirection,
    attackAimed,
    attackAnchor,
    elevBonusTile,
    rangeAttackTargetIds,
    rangeAttackObstacleCoords,
    movePath,
    pendingTargetEnemyId,
    pendingTargetPlayerId,
    armorLanding,
    armorPush,
    omnistrikeStep,
    omnistrikeBombs,
    omnistrikeAnchors,
    omnistrikeAimed,
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
    isActive,
    setMode,
    clearMode,
    startGmEnemyAttack,
    startGmSwarmAttack,
    registerRangeAttackConfirm,
    unregisterRangeAttackConfirm,
    confirmRangeAttack,
    rotateAttackDirection,
    appendMoveStep,
    resetMovePath,
  };
}
