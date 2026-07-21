import type { Player } from "@vtt-core/shared";
import {
  isRangeTargetAttack,
  isRangedPatternAttack,
  rangeTargetMax,
  resolveCombatAttackSpec,
  usesAnchoredPatternPlacement,
} from "@vtt-core/shared";
import { computed, type Ref } from "vue";

import { useBoardActionMode } from "./useBoardActionMode.js";

const DEFAULT_ATTACK_HINT =
  "Click a highlighted tile to aim, press R to rotate, then click the attack area to confirm";

export function useCombatModeHints(opts: {
  player: Ref<Player | null | undefined>;
  weaponName: Ref<string | undefined | null>;
}) {
  const {
    mode,
    rangeAttackTargetIds,
    rangeAttackObstacleCoords,
    omnistrikeStep,
    warhookStep,
    towerTeleportStep,
    kataptyTargetIds,
    borrowAllyId,
    assistedLaunchStep,
    equipmentCoverTiles,
    forceProjectionStep,
    redirectStep,
  } = useBoardActionMode();

  const attackHint = computed(() => {
    const attackMode =
      mode.value === "attack" ||
      (mode.value === "equipmentForceProjection" && forceProjectionStep.value === "attack");
    if (!attackMode || !opts.player.value || !opts.weaponName.value) {
      return DEFAULT_ATTACK_HINT;
    }
    const spec = resolveCombatAttackSpec(opts.player.value, opts.weaponName.value);
    if (!spec) return DEFAULT_ATTACK_HINT;
    if (isRangeTargetAttack(spec)) {
      const max = rangeTargetMax(spec);
      const count = rangeAttackTargetIds.value.length + rangeAttackObstacleCoords.value.length;
      if (max <= 1) return "Click an enemy or obstacle in range to attack";
      return `Select up to ${max} targets (${count}/${max}). Click an enemy or obstacle to toggle, then Attack or click empty tile.`;
    }
    if (usesAnchoredPatternPlacement(spec)) {
      return "Hover to preview, click to place the pattern, press R to rotate, then click the pattern to attack";
    }
    if (isRangedPatternAttack(spec)) {
      return "Click a tile in range to aim, then click a highlighted tile to attack";
    }
    return DEFAULT_ATTACK_HINT;
  });

  const rangeAttackHint = computed(() => {
    if (mode.value !== "attack" || !opts.player.value || !opts.weaponName.value) return null;
    const spec = resolveCombatAttackSpec(opts.player.value, opts.weaponName.value);
    if (!spec || !isRangeTargetAttack(spec)) return null;
    const max = rangeTargetMax(spec);
    const count = rangeAttackTargetIds.value.length + rangeAttackObstacleCoords.value.length;
    if (max <= 1) return "Click an enemy or obstacle in range to attack";
    return `Select up to ${max} targets (${count}/${max}). Click an enemy or obstacle to toggle, then Attack or click empty tile.`;
  });

  const rangedPatternAttackHint = computed(() => {
    if (mode.value !== "attack" || !opts.player.value || !opts.weaponName.value) return null;
    const spec = resolveCombatAttackSpec(opts.player.value, opts.weaponName.value);
    if (!spec || isRangeTargetAttack(spec)) return null;
    if (usesAnchoredPatternPlacement(spec)) {
      return "Hover to preview, click to place the pattern, press R to rotate, then click the pattern to attack";
    }
    if (isRangedPatternAttack(spec)) {
      return "Click a tile in range to aim, then click a highlighted tile to attack";
    }
    return null;
  });

  const omnistrikeHint = computed(() => {
    if (mode.value !== "omnistrike") return null;
    switch (omnistrikeStep.value) {
      case "selectBombs":
        return "Select two bomb types to combine (tap to toggle).";
      case "placeFirst":
        return "Place the first pattern — hover to preview, press R to rotate, click to confirm placement.";
      case "placeSecond":
        return "Place the second pattern adjacent to or overlapping the first. Press R to rotate.";
      case "confirm":
        return "Click the combined pattern to launch Omnistrike. Press R to rotate.";
      default:
        return null;
    }
  });

  const warhookHint = computed(() => {
    if (mode.value !== "warhook") return null;
    if (warhookStep.value === "selectLanding") return "Choose destination tile";
    return "Click an enemy, obstacle, or wall within range";
  });

  const armorHint = computed(() => {
    if (mode.value === "armorPlaceTower") return "Click a tile within Range:2 to place your tower";
    if (mode.value === "armorPush") return "Choose Push:1–3, then click an adjacent creature";
    if (mode.value === "armorTeleport") return "Click an adjacent enemy, then choose a landing space";
    return null;
  });

  const towerTeleportHint = computed(() => {
    if (mode.value !== "towerTeleport") return null;
    if (towerTeleportStep.value === "selectKeraunoTarget") return "Select adjacent enemy for Kerauno";
    return "Spend all remaining Speed — click a tile adjacent to your tower";
  });

  const kataptyHint = computed(() => {
    if (mode.value !== "kataptyPick") return null;
    return `Select exactly 3 Katapty targets (${kataptyTargetIds.value.length}/3), then confirm`;
  });

  const varunastraBorrowHint = computed(() => {
    if (mode.value !== "varunastraBorrow") return null;
    if (!borrowAllyId.value) return "Click a squad ally to borrow their weapon pattern";
    return "Aim the borrowed pattern, then click highlighted tiles to attack";
  });

  const chrysaorBrandHint = computed(() => {
    if (mode.value !== "chrysaorBrand") return null;
    return "Click a creature or obstacle in line of sight to Brand:2";
  });

  const assistedLaunchHint = computed(() => {
    if (mode.value !== "assistedLaunch") return null;
    if (assistedLaunchStep.value === "selectAnchor") return "Select impassable terrain, an obstacle, or an ally to launch from";
    return "Click the highlighted landing tile to launch";
  });

  const equipmentCorridorHint = computed(() => {
    if (mode.value !== "equipmentCorridor") return null;
    return "Hover to preview, click to place the corridor anywhere on the map, press R to rotate, then click to confirm";
  });

  const equipmentCoverHint = computed(() => {
    if (mode.value !== "equipmentCover") return null;
    return `Select 3 connected tiles within range (${equipmentCoverTiles.value.length}/3). Click a selected tile to deselect.`;
  });

  const equipmentForceProjectionHint = computed(() => {
    if (mode.value !== "equipmentForceProjection") return null;
    if (forceProjectionStep.value === "selectSquare") {
      return "Click an empty square within Range:3, then make your weapon attack from that square";
    }
    return attackHint.value;
  });

  const equipmentRedirectHint = computed(() => {
    if (mode.value !== "equipmentRedirect") return null;
    switch (redirectStep.value) {
      case "selectSource":
        return "Click an enemy within Range:5 to redirect its attack";
      case "selectAttack":
        return "Press R to cycle attacks, then click the source enemy again to confirm";
      case "selectTarget":
        return "Click a valid enemy target for the redirected attack";
      case "confirmPattern":
        return "Press R to rotate the pattern, then click the highlighted area to confirm";
      default:
        return null;
    }
  });

  const boardHintRows = computed(() => {
    const rows: { key: string; text: string }[] = [];
    if (mode.value === "attack") rows.push({ key: "attack", text: attackHint.value });
    if (omnistrikeHint.value) rows.push({ key: "omnistrike", text: omnistrikeHint.value });
    if (equipmentCorridorHint.value) rows.push({ key: "equipmentCorridor", text: equipmentCorridorHint.value });
    if (equipmentCoverHint.value) rows.push({ key: "equipmentCover", text: equipmentCoverHint.value });
    if (equipmentForceProjectionHint.value) {
      rows.push({ key: "equipmentForceProjection", text: equipmentForceProjectionHint.value });
    }
    if (equipmentRedirectHint.value) rows.push({ key: "equipmentRedirect", text: equipmentRedirectHint.value });
    if (warhookHint.value) rows.push({ key: "warhook", text: warhookHint.value });
    if (armorHint.value) rows.push({ key: "armor", text: armorHint.value });
    if (towerTeleportHint.value) rows.push({ key: "towerTeleport", text: towerTeleportHint.value });
    if (kataptyHint.value) rows.push({ key: "katapty", text: kataptyHint.value });
    if (varunastraBorrowHint.value) rows.push({ key: "varunastraBorrow", text: varunastraBorrowHint.value });
    if (chrysaorBrandHint.value) rows.push({ key: "chrysaorBrand", text: chrysaorBrandHint.value });
    if (assistedLaunchHint.value) rows.push({ key: "assistedLaunch", text: assistedLaunchHint.value });
    return rows;
  });

  return {
    attackHint,
    rangeAttackHint,
    rangedPatternAttackHint,
    omnistrikeHint,
    warhookHint,
    armorHint,
    towerTeleportHint,
    kataptyHint,
    varunastraBorrowHint,
    chrysaorBrandHint,
    assistedLaunchHint,
    equipmentCorridorHint,
    equipmentCoverHint,
    equipmentForceProjectionHint,
    equipmentRedirectHint,
    boardHintRows,
  };
}
