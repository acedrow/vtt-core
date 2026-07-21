import { isHeavenBurningWeaponName } from "@gaem/shared";
import type { StructuredArmorAction } from "@gaem/shared";
import { isRangeTargetAttack, isSabaothWeaponName, isWarhookWeaponName, rangeTargetMax, resolveCombatAttackSpec } from "@gaem/shared";
import { computed, ref, type Ref } from "vue";

import { useBoardActionMode, type BoardActionMode } from "./useBoardActionMode.js";
import { useCombatActions } from "./useCombatActions.js";

const CLASS_MODE_BY_NAME: Record<string, BoardActionMode> = {
  HARPE: "harpeTrap",
  KOPIS: "kopisMark",
  CHRYSAOR: "chrysaorBrand",
  SHARUR: "sharurAttractor",
  HEPHAESTUS: "hephaestusSynesis",
  VARUNASTRA: "varunastraBorrow",
};

export function useCombatModeActions(opts?: {
  playerClass?: Ref<string | undefined>;
  playerId?: () => string | null;
}) {
  const {
    sendPlayerAction,
    armorStructured,
    assistedLaunchAnchorOptions,
    activePlayer,
    hasThrownTrap,
    canSupport,
    sandboxMode,
    budget,
  } = useCombatActions(opts?.playerId);

  const {
    mode,
    omnistrikeStep,
    omnistrikeBombs,
    omnistrikeAnchors,
    assistedLaunchStep,
    assistedLaunchAnchor,
    kataptyTargetIds,
    rangeAttackTargetIds,
    rangeAttackObstacleCoords,
    forceProjectionStep,
    setMode,
    clearMode,
    confirmRangeAttack,
  } = useBoardActionMode();

  const playerClass = opts?.playerClass ?? computed(() => activePlayer.value?.class);

  const epeusBagOpen = ref(false);
  const epeusBagInitialSlot = ref<"weapon" | "armor" | null>(null);
  const harpeRecallOpen = ref(false);

  const classMode = computed(() => {
    const cls = playerClass.value;
    return cls ? (CLASS_MODE_BY_NAME[cls] ?? null) : null;
  });

  const classModeActive = computed(() => {
    const m = classMode.value;
    return m ? mode.value === m : false;
  });

  const showHephaestusRestore = computed(() => playerClass.value === "HEPHAESTUS");

  const showHarpeRecall = computed(
    () =>
      playerClass.value === "HARPE" &&
      hasThrownTrap.value &&
      !!budget.value &&
      (canSupport.value || sandboxMode.value),
  );

  function pickMode(next: BoardActionMode) {
    if (mode.value === next) clearMode();
    else if (next === "attack") setMode("attack");
    else {
      if (next === "sprint" && mode.value === "aegis") clearMode();
      if (next === "aegis" && mode.value === "sprint") clearMode();
      setMode(next);
    }
  }

  function pickAegisMode() {
    pickMode("aegis");
  }

  function toggleMode(next: BoardActionMode) {
    if (mode.value === next) clearMode();
    else setMode(next);
  }

  function pickArmorMode(structured?: StructuredArmorAction | null) {
    const kind = (structured ?? armorStructured.value)?.kind;
    if (kind === "teleport_adjacent") toggleMode("armorTeleport");
    else if (kind === "place_tower") toggleMode("armorPlaceTower");
    else toggleMode("armorPush");
  }

  function pickTowerTeleportMode() {
    toggleMode("towerTeleport");
  }

  function pickAssistedLaunchMode() {
    if (mode.value === "assistedLaunch") {
      clearMode();
      return;
    }
    setMode("assistedLaunch");
    const anchors = assistedLaunchAnchorOptions.value;
    if (anchors.length === 1) {
      assistedLaunchAnchor.value = { x: anchors[0]!.x, y: anchors[0]!.y };
      assistedLaunchStep.value = "confirm";
    }
  }

  function useClassActive() {
    if (playerClass.value === "EPEUS") {
      epeusBagInitialSlot.value = null;
      epeusBagOpen.value = true;
      return;
    }
    const m = classMode.value;
    if (!m) {
      sendPlayerAction({ action: "classActive" });
      return;
    }
    toggleMode(m);
  }

  function openEpeusBag(slot: "weapon" | "armor") {
    epeusBagInitialSlot.value = slot;
    epeusBagOpen.value = true;
  }

  function useHephaestusRestore() {
    toggleMode("hephaestusRestore");
  }

  function recallHarpeTrap() {
    harpeRecallOpen.value = true;
  }

  function onEpeusBagConfirm(slot: "weapon" | "armor", gearName: string) {
    sendPlayerAction({ action: "classActive", kind: "bag_of_tricks", gearSlot: slot, gearName });
    epeusBagOpen.value = false;
  }

  function onHarpeRecallConfirm(equipWeapon?: string) {
    sendPlayerAction({
      action: "classActive",
      kind: "weapon_trap",
      harpeRecall: true,
      harpeEquipWeapon: equipWeapon,
    });
    harpeRecallOpen.value = false;
  }

  function useWeaponActive(weaponName?: string | null) {
    const name = weaponName ?? activePlayer.value?.weapon;
    if (isSabaothWeaponName(name)) {
      toggleMode("omnistrike");
      return;
    }
    if (isWarhookWeaponName(name)) {
      toggleMode("warhook");
      return;
    }
    if (isHeavenBurningWeaponName(name)) {
      sendPlayerAction({ action: "weaponActive", detail: "heaven_burning_unfold" });
      return;
    }
    sendPlayerAction({ action: "weaponActive" });
  }

  function toggleWeaponAttack() {
    toggleMode("attack");
  }

  function confirmKatapty() {
    if (kataptyTargetIds.value.length !== 3) return;
    sendPlayerAction({
      action: "armorAction",
      kind: "katapty_end_turn",
      targetEnemyIds: [...kataptyTargetIds.value],
    });
    clearMode();
  }

  const canConfirmRangeAttack = computed(() => {
    const attackMode =
      mode.value === "attack" ||
      (mode.value === "equipmentForceProjection" && forceProjectionStep.value === "attack");
    if (!attackMode) return false;
    const p = activePlayer.value;
    const weapon = p?.weapon;
    if (!p || !weapon) return false;
    const spec = resolveCombatAttackSpec(p, weapon);
    if (!spec || !isRangeTargetAttack(spec)) return false;
    const max = rangeTargetMax(spec);
    const count = rangeAttackTargetIds.value.length + rangeAttackObstacleCoords.value.length;
    return count > 0 && count < max;
  });

  function submitRangeAttack() {
    if (!canConfirmRangeAttack.value) return;
    confirmRangeAttack();
  }

  function onDualBombIndices(indices: [number | null, number | null]) {
    omnistrikeBombs.value = indices;
    if (indices[0] == null || indices[1] == null) {
      omnistrikeStep.value = "selectBombs";
      omnistrikeAnchors.value = [null, null];
    }
  }

  function onDualBombComplete() {
    if (omnistrikeBombs.value[0] != null && omnistrikeBombs.value[1] != null) {
      omnistrikeStep.value = "placeFirst";
    }
  }

  return {
    mode,
    omnistrikeStep,
    omnistrikeBombs,
    kataptyTargetIds,
    classMode,
    classModeActive,
    showHephaestusRestore,
    showHarpeRecall,
    epeusBagOpen,
    epeusBagInitialSlot,
    harpeRecallOpen,
    pickMode,
    pickAegisMode,
    toggleMode,
    pickArmorMode,
    pickTowerTeleportMode,
    pickAssistedLaunchMode,
    useClassActive,
    openEpeusBag,
    useHephaestusRestore,
    recallHarpeTrap,
    onEpeusBagConfirm,
    onHarpeRecallConfirm,
    useWeaponActive,
    toggleWeaponAttack,
    confirmKatapty,
    canConfirmRangeAttack,
    submitRangeAttack,
    onDualBombIndices,
    onDualBombComplete,
    clearMode,
  };
}
