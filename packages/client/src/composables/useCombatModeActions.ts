import { isHeavenBurningWeaponName } from "@vtt-core/shared";
import type { StructuredArmorAction } from "@vtt-core/shared";
import { isRangeTargetAttack, rangeTargetMax, resolveCombatAttackSpec } from "@vtt-core/shared";
import { computed, ref, type Ref } from "vue";

import { boardModeForClass, boardModeForWeapon } from "../client-content-pack.js";
import { useBoardActionMode, type BoardActionMode } from "./useBoardActionMode.js";
import { useCombatActions } from "./useCombatActions.js";

const epeusBagOpen = ref(false);
const epeusBagInitialSlot = ref<"weapon" | "armor" | null>(null);
const harpeRecallOpen = ref(false);

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
    rangeAttackTargetIds,
    rangeAttackObstacleCoords,
    packUi,
    setMode,
    clearMode,
    patchPackUi,
    confirmRangeAttack,
  } = useBoardActionMode();

  const playerClass = opts?.playerClass ?? computed(() => activePlayer.value?.class);

  const classMode = computed(() => boardModeForClass(playerClass.value) as BoardActionMode | null);

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
    else setMode(next);
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
      patchPackUi({
        assistedLaunchAnchor: { x: anchors[0]!.x, y: anchors[0]!.y },
        step: "confirm",
      });
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
      sendPlayerAction({ action: "pack", kind: "classActive" });
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
    sendPlayerAction({
      action: "pack",
      kind: "classActive",
      detail: { kind: "bag_of_tricks", gearSlot: slot, gearName },
    });
    epeusBagOpen.value = false;
  }

  function onHarpeRecallConfirm(equipWeapon?: string) {
    sendPlayerAction({
      action: "pack",
      kind: "classActive",
      detail: {
        kind: "weapon_trap",
        harpeRecall: true,
        harpeEquipWeapon: equipWeapon,
      },
    });
    harpeRecallOpen.value = false;
  }

  function useWeaponActive(weaponName?: string | null) {
    const name = weaponName ?? activePlayer.value?.weapon;
    const packMode = boardModeForWeapon(name ?? undefined);
    if (packMode) {
      toggleMode(packMode);
      return;
    }
    if (isHeavenBurningWeaponName(name)) {
      sendPlayerAction({
        action: "pack",
        kind: "weaponActive",
        detail: { detail: "heaven_burning_unfold" },
      });
      return;
    }
    sendPlayerAction({ action: "pack", kind: "weaponActive" });
  }

  function toggleWeaponAttack() {
    toggleMode("attack");
  }

  function confirmKatapty() {
    const ids = packUi.value.kataptyTargetIds ?? [];
    if (ids.length !== 3) return;
    sendPlayerAction({
      action: "pack",
      kind: "armorAction",
      detail: {
        kind: "katapty_end_turn",
        targetEnemyIds: [...ids],
      },
    });
    clearMode();
  }

  const canConfirmRangeAttack = computed(() => {
    if (!(mode.value === "attack" || packUi.value.equipmentUse === true)) return false;
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
    if (indices[0] == null || indices[1] == null) {
      patchPackUi({ omnistrikeBombs: indices, step: "selectBombs", omnistrikeAnchors: [null, null] });
      return;
    }
    patchPackUi({ omnistrikeBombs: indices });
  }

  function onDualBombComplete() {
    const bombs = packUi.value.omnistrikeBombs;
    if (bombs?.[0] != null && bombs[1] != null) {
      patchPackUi({ step: "placeFirst" });
    }
  }

  const kataptyTargetIds = computed(() => packUi.value.kataptyTargetIds ?? []);
  const omnistrikeStep = computed(() => packUi.value.step ?? "selectBombs");
  const omnistrikeBombs = computed<[number | null, number | null]>(
    () => packUi.value.omnistrikeBombs ?? [null, null],
  );

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
