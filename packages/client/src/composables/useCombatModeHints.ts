import type { Player } from "@vtt-core/shared";
import {
  isRangeTargetAttack,
  isRangedPatternAttack,
  rangeTargetMax,
  resolveCombatAttackSpec,
  usesAnchoredPatternPlacement,
} from "@vtt-core/shared";
import { computed, type Ref } from "vue";

import { clientBoardMode } from "../client-content-pack.js";
import type { BoardModeContext } from "../client-content-pack.js";
import { useBoardActionMode } from "./useBoardActionMode.js";
import { useGameState } from "./useGameState.js";

const DEFAULT_ATTACK_HINT =
  "Click a highlighted tile to aim, press R to rotate, then click the attack area to confirm";

export function useCombatModeHints(opts: {
  player: Ref<Player | null | undefined>;
  weaponName: Ref<string | undefined | null>;
}) {
  const { gameState } = useGameState();
  const {
    mode,
    rangeAttackTargetIds,
    rangeAttackObstacleCoords,
    omnistrikeStep,
    warhookStep,
    towerTeleportStep,
    kataptyTargetIds,
    assistedLaunchStep,
    packUi,
    attackDirection,
    attackAimed,
    attackAnchor,
  } = useBoardActionMode();

  const isPackEquipmentAttack = computed(
    () => clientBoardMode(mode.value) != null && packUi.value.equipmentUse === true,
  );

  const attackHint = computed(() => {
    const attackMode = mode.value === "attack" || isPackEquipmentAttack.value;
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

  const assistedLaunchHint = computed(() => {
    if (mode.value !== "assistedLaunch") return null;
    if (assistedLaunchStep.value === "selectAnchor") {
      return "Select impassable terrain, an obstacle, or an ally to launch from";
    }
    return "Click the highlighted landing tile to launch";
  });

  const packModeHint = computed(() => {
    const id = mode.value;
    const s = gameState.value;
    const player = opts.player.value;
    if (!id || !s || !player) return null;
    const plugin = clientBoardMode(id);
    if (!plugin?.hint) return null;
    if (typeof plugin.hint === "string") return plugin.hint;
    const ctx: BoardModeContext = {
      gameState: s,
      yourPlayerId: player.id,
      mode: id,
      previewHoverCell: null,
      packUi: packUi.value,
      aim: {
        direction: attackDirection.value,
        aimed: attackAimed.value,
        anchor: attackAnchor.value,
      },
      rangeAttackTargetIds: rangeAttackTargetIds.value,
      rangeAttackObstacleCoords: rangeAttackObstacleCoords.value,
    };
    return plugin.hint(ctx);
  });

  const boardHintRows = computed(() => {
    const rows: { key: string; text: string }[] = [];
    if (mode.value === "attack" || isPackEquipmentAttack.value) {
      rows.push({ key: "attack", text: attackHint.value });
    }
    if (omnistrikeHint.value) rows.push({ key: "omnistrike", text: omnistrikeHint.value });
    if (warhookHint.value) rows.push({ key: "warhook", text: warhookHint.value });
    if (armorHint.value) rows.push({ key: "armor", text: armorHint.value });
    if (towerTeleportHint.value) rows.push({ key: "towerTeleport", text: towerTeleportHint.value });
    if (kataptyHint.value) rows.push({ key: "katapty", text: kataptyHint.value });
    if (assistedLaunchHint.value) rows.push({ key: "assistedLaunch", text: assistedLaunchHint.value });
    if (packModeHint.value && mode.value) {
      const already = rows.some((r) => r.key === mode.value);
      if (!already && !(isPackEquipmentAttack.value && packModeHint.value === attackHint.value)) {
        rows.push({ key: mode.value, text: packModeHint.value });
      }
    }
    return rows;
  });

  const equipmentCorridorHint = computed(() =>
    mode.value === "equipmentCorridor" ? packModeHint.value : null,
  );
  const equipmentCoverHint = computed(() =>
    mode.value === "equipmentCover" ? packModeHint.value : null,
  );
  const equipmentForceProjectionHint = computed(() =>
    mode.value === "equipmentForceProjection" ? packModeHint.value : null,
  );
  const equipmentRedirectHint = computed(() =>
    mode.value === "equipmentRedirect" ? packModeHint.value : null,
  );

  return {
    attackHint,
    rangeAttackHint,
    rangedPatternAttackHint,
    omnistrikeHint,
    warhookHint,
    armorHint,
    towerTeleportHint,
    kataptyHint,
    assistedLaunchHint,
    equipmentCorridorHint,
    equipmentCoverHint,
    equipmentForceProjectionHint,
    equipmentRedirectHint,
    boardHintRows,
  };
}
