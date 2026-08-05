import { computed, ref } from "vue";
import { nextPatternDirection } from "@vtt-core/shared";
import type { PatternDirection } from "@vtt-core/shared";

import type { PackBoardUi } from "../client-content-pack.js";
import { clearActiveTool } from "./useGmTools.js";

// Pack board-mode plugins may register additional string ids (e.g. kopisMark).
export type BoardActionMode =
  | "move"
  | "attack"
  | "omnistrike"
  | "shove"
  | "sprint"
  | "aegis"
  | "rez"
  | "gmEnemyAttack"
  | (string & {})
  | null;

export type OmnistrikeStep = "selectBombs" | "placeFirst" | "placeSecond" | "confirm";

const mode = ref<BoardActionMode>(null);
const attackDirection = ref<PatternDirection>("n");
const attackAimed = ref(false);
const attackAnchor = ref<{ x: number; y: number } | null>(null);
const elevBonusTile = ref<{ x: number; y: number } | null>(null);
const rangeAttackTargetIds = ref<string[]>([]);
const rangeAttackObstacleCoords = ref<{ x: number; y: number }[]>([]);
const movePath = ref<{ x: number; y: number }[]>([]);
const armorLanding = ref<{ x: number; y: number } | null>(null);
const omnistrikeStep = ref<OmnistrikeStep>("selectBombs");
const omnistrikeBombs = ref<[number | null, number | null]>([null, null]);
const omnistrikeAnchors = ref<[{ x: number; y: number } | null, { x: number; y: number } | null]>([
  null,
  null,
]);
const omnistrikeAimed = ref(false);
const packUi = ref<PackBoardUi>({});
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

function resetOmnistrikeState() {
  omnistrikeStep.value = "selectBombs";
  omnistrikeBombs.value = [null, null];
  omnistrikeAnchors.value = [null, null];
  omnistrikeAimed.value = false;
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
    armorLanding.value = null;
    packUi.value = {};
    gmEnemyAttack.value = null;
    resetOmnistrikeState();
  }

  function clearMode() {
    setMode(null);
  }

  function patchPackUi(patch: Partial<PackBoardUi>) {
    packUi.value = { ...packUi.value, ...patch };
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
    armorLanding,
    omnistrikeStep,
    omnistrikeBombs,
    omnistrikeAnchors,
    omnistrikeAimed,
    packUi,
    gmEnemyAttack,
    isActive,
    setMode,
    clearMode,
    patchPackUi,
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
