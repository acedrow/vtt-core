import type { ActionTier, Player } from "@vtt-core/shared";
import { canCommitHasteForTier, canSpendActionTier, canUseActionTier, createDefaultActionBudget, getArmorByName, getArmorSpeed, getClassActiveTier, getHeavenBurningLevel, getSabaothChargesRemaining, getWeaponAttackSpec, hasSabaothBombSelected, hasteStacks, isHeavenBurningWeaponName, isSabaothWeaponName, isKushielArmorName, canUseAssistedLaunch, assistedLaunchAnchors, previewPlayerAttack, classGrantsSecondWeapon, classGrantsDualGear, aegisFlyingRemaining, playerAegisStacks, hasAssistedAscensionGear } from "@vtt-core/shared";
import { computed, ref } from "vue";
import { getCombatBoardHelpers } from "../combat-board-helpers.js";

import { useGameState } from "./useGameState.js";
import { useSession } from "./useSession.js";

export function useCombatActions(playerId?: () => string | null) {
  const { gameState, yourPlayerId, send } = useGameState();
  const { isGm, hasGmCapabilities } = useSession();

  const activePlayerId = computed(() => playerId?.() ?? yourPlayerId.value);

  const activePlayer = computed(() => {
    const id = activePlayerId.value;
    const s = gameState.value;
    if (!id || !s) return null;
    return s.players.find((p) => p.id === id) ?? null;
  });

  const sandboxMode = computed(() => gameState.value?.sandboxMode === true);

  const isPlayerTurn = computed(() => {
    const s = gameState.value;
    const id = activePlayerId.value;
    if (!s || !id) return false;
    return s.roundPhase === "playerTurn" && s.turn?.role === "player" && s.turn.playerId === id;
  });

  const combatUiUnlocked = computed(() => {
    const s = gameState.value;
    if (s == null) return false;
    if (sandboxMode.value) return true;
    return s.roundPhase !== "deployment" && s.roundPhase !== "taccomNotStarted";
  });

  const showPlayerActionBar = computed(() => {
    if (!activePlayerId.value || isGm.value || !combatUiUnlocked.value) return false;
    return isPlayerTurn.value || sandboxMode.value;
  });

  const showSheetCombatPanel = computed(() => {
    if (!activePlayerId.value || !combatUiUnlocked.value) return false;
    return showPlayerActionBar.value || hasGmCapabilities.value;
  });

  const canGmRestoreActionTier = computed(
    () =>
      hasGmCapabilities.value &&
      !sandboxMode.value &&
      !!activePlayerId.value &&
      !showPlayerActionBar.value,
  );

  const showGmCombatUi = computed(() => {
    if (!hasGmCapabilities.value || !combatUiUnlocked.value) return false;
    const s = gameState.value;
    if (!s) return false;
    return s.roundPhase === "gmTurn" || sandboxMode.value;
  });

  const budget = computed(() => {
    const p = activePlayer.value;
    const s = gameState.value;
    if (!p) return null;
    if (p.actionBudget) return p.actionBudget;
    if (s?.sandboxMode) {
      const speed = p.speed ?? getArmorSpeed(p.armor);
      if (speed) return createDefaultActionBudget(speed);
    }
    return null;
  });

  const canMain = computed(() => {
    if (sandboxMode.value) return true;
    const p = activePlayer.value;
    return !!p && canUseActionTier(p, "main");
  });
  const canSupport = computed(() => {
    if (sandboxMode.value) return true;
    const p = activePlayer.value;
    return !!p && canUseActionTier(p, "support");
  });
  const hasEquipmentCharge = computed(() => {
    const uses = activePlayer.value?.equipmentUses;
    if (uses === undefined) return true;
    return uses > 0;
  });
  const canUseEquipment = computed(() => canSupport.value && hasEquipmentCharge.value);
  const canAux = computed(() => {
    if (sandboxMode.value) return true;
    const p = activePlayer.value;
    return !!p && canUseActionTier(p, "aux");
  });

  const hasteRemaining = computed(() => hasteStacks(activePlayer.value ?? {}));

  const hasteGrantedTier = computed(() => activePlayer.value?.hasteActionTier ?? null);

  const actionBudgetChips = computed(() => {
    const p = activePlayer.value;
    const b = budget.value;
    const granted = hasteGrantedTier.value;
    const tierSpent = (tier: ActionTier) => !!b && !canSpendActionTier(b, tier);
    const tierGranted = (tier: ActionTier) => granted === tier;
    const canCommit = (tier: ActionTier) =>
      !!p && !sandboxMode.value && canCommitHasteForTier(p, tier);
    return {
      mainSpent: tierSpent("main"),
      supportSpent: tierSpent("support"),
      auxSpent: tierSpent("aux"),
      mainGranted: tierGranted("main"),
      supportGranted: tierGranted("support"),
      auxGranted: tierGranted("aux"),
      canCommitMain: canCommit("main"),
      canCommitSupport: canCommit("support"),
      canCommitAux: canCommit("aux"),
    };
  });

  const sprintRemaining = computed(() => budget.value?.sprintRemaining ?? 0);

  const canStartSprint = computed(
    () => sprintRemaining.value > 0 || canAux.value,
  );

  const sabaothChargesRemaining = computed(() => {
    const p = activePlayer.value;
    if (!p) return null;
    return getSabaothChargesRemaining(p);
  });

  const canUseWeaponActive = computed(() => {
    const p = activePlayer.value;
    if (!p?.weapon || !canMain.value) return false;
    if (isHeavenBurningWeaponName(p.weapon)) return false;
    if (isSabaothWeaponName(p.weapon)) {
      return (sabaothChargesRemaining.value ?? 0) > 0;
    }
    return true;
  });

  const heavenBurningLevel = computed(() => {
    const p = activePlayer.value;
    if (!p || !isHeavenBurningWeaponName(p.weapon)) return null;
    return getHeavenBurningLevel(p);
  });

  const canUseHeavenBurningUnfold = computed(() => {
    const p = activePlayer.value;
    if (!p || !canAux.value || !isHeavenBurningWeaponName(p.weapon)) return false;
    return (heavenBurningLevel.value ?? 1) < getCombatBoardHelpers().HEAVEN_BURNING_MAX_LEVEL;
  });

  const hasWeaponAttack = computed(() => {
    const p = activePlayer.value;
    if (!getWeaponAttackSpec(p?.weapon)) return false;
    if (isSabaothWeaponName(p?.weapon) && !hasSabaothBombSelected(p ?? undefined)) return false;
    return true;
  });

  const armorStructured = computed(() => {
    const armor = getArmorByName(activePlayer.value?.armor ?? "");
    return armor?.armorActionStructured;
  });

  const canTowerTeleport = computed(() => {
    const p = activePlayer.value;
    const s = gameState.value;
    if (!p || !s || !getCombatBoardHelpers().isYadathanArmorName(p.armor)) return false;
    if ((p.actionBudget?.movementRemaining ?? 0) <= 0) return false;
    return !!getCombatBoardHelpers().getPlayerTower(s, p.id);
  });

  const showAssistedLaunch = computed(() => isKushielArmorName(activePlayer.value?.armor));

  const canAssistedLaunch = computed(() => {
    const p = activePlayer.value;
    const s = gameState.value;
    if (!p || !s || !showAssistedLaunch.value) return false;
    return canUseAssistedLaunch(s, p.id);
  });

  const assistedLaunchAnchorOptions = computed(() => {
    const p = activePlayer.value;
    const s = gameState.value;
    if (!p || !s) return [];
    return assistedLaunchAnchors(s, p.id);
  });

  const canInteractSeed = computed(() => {
    const p = activePlayer.value;
    const s = gameState.value;
    if (!p || !s) return false;
    return !!getCombatBoardHelpers().getSeedAt(s, p.x, p.y);
  });

  const pendingActions = computed(() => gameState.value?.combat?.pendingActions ?? []);
  const pendingReaction = computed(() => {
    const id = activePlayerId.value;
    const r = gameState.value?.combat?.pendingReaction;
    if (!id || !r || r.playerId !== id) return null;
    return r;
  });

  const pendingClassReaction = computed(() => {
    const id = activePlayerId.value;
    const r = gameState.value?.combat?.pendingClassReaction;
    if (!id || !r || r.playerId !== id) return null;
    return r;
  });

  const classActiveTier = computed((): ActionTier => {
    return getClassActiveTier(activePlayer.value?.class);
  });

  const canUseClassActive = computed(() => {
    const p = activePlayer.value;
    if (!p?.class) return false;
    const tier = classActiveTier.value;
    if (tier === "main") return canMain.value;
    if (tier === "support") return canSupport.value;
    return canAux.value;
  });

  const hasFreeWeaponSwap = computed(() => {
    const id = activePlayerId.value;
    if (!id) return false;
    return !!gameState.value?.combat?.gearCheckGrants?.[id];
  });

  const hasFreeWeaponAttack = computed(() => (activePlayer.value?.counters?.freeWeaponAttack ?? 0) > 0);

  const showHarpeSecondWeapon = computed(() => {
    const p = activePlayer.value;
    return classGrantsSecondWeapon(p?.class) || false;
  });

  const showEpeusDualGear = computed(() => classGrantsDualGear(activePlayer.value?.class));

  const hasThrownTrap = computed(() => {
    const id = activePlayerId.value;
    if (!id) return false;
    return !!(gameState.value?.combat?.thrownTraps ?? []).find((t) => t.ownerId === id);
  });

  const thrownTrapWeapon = computed(() => {
    const id = activePlayerId.value;
    if (!id) return null;
    return (gameState.value?.combat?.thrownTraps ?? []).find((t) => t.ownerId === id)?.weaponName ?? null;
  });

  const reversalExtraAllyIds = ref<string[]>([]);
  const reversalTowerAnchorAllyIds = ref<string[]>([]);

  const hasSpentActionTier = computed(() => {
    if (sandboxMode.value || !budget.value) return false;
    return !budget.value.main || !budget.value.support || !budget.value.aux;
  });

  const hasPendingPlayerActions = computed(() => {
    const id = activePlayerId.value;
    if (!id) return false;
    return pendingActions.value.some((p) => p.actorPlayerId === id);
  });

  const canResetMovement = computed(() => {
    if (!showPlayerActionBar.value || !activePlayer.value) return false;
    if (hasSpentActionTier.value || hasPendingPlayerActions.value) return false;
    const p = activePlayer.value;
    if (p.turnStartX === undefined || p.turnStartY === undefined) return false;
    if (!budget.value) return false;
    return (
      p.x !== p.turnStartX ||
      p.y !== p.turnStartY ||
      budget.value.movementRemaining < budget.value.movementMax
    );
  });

  const showAegis = computed(() => {
    const p = activePlayer.value;
    if (!p) return false;
    return playerAegisStacks(p) > 0 || hasAssistedAscensionGear(p);
  });

  const aegisFlyingLeft = computed(() => {
    const p = activePlayer.value;
    if (!p) return 0;
    return aegisFlyingRemaining(p);
  });

  const aegisStacks = computed(() => playerAegisStacks(activePlayer.value ?? ({} as Player)));

  const canUseAegis = computed(() => {
    const p = activePlayer.value;
    if (!p || !showAegis.value) return false;
    if ((p.effects?.Pin ?? 0) > 0) return false;
    return aegisFlyingLeft.value > 0;
  });

  const aegisLabel = computed(() => `${aegisFlyingLeft.value}/${aegisStacks.value}`);

  function commitHaste(tier: ActionTier) {
    sendPlayerAction({ action: "commitHaste", tier });
  }

  function restorePlayerActionTier(tier: ActionTier) {
    const id = activePlayerId.value;
    if (!id) return;
    send({ type: "restorePlayerActionTier", playerId: id, tier });
  }

  function sendPlayerAction(action: import("@vtt-core/shared").PlayerAction) {
    send({ type: "playerAction", action });
  }

  function resetMovement() {
    send({ type: "resetMovement" });
  }

  function sendMovePath(path: { x: number; y: number }[], flying?: boolean) {
    send({ type: "movePath", path, ...(flying ? { flying: true } : {}) });
  }

  function triggerReversal(extraLines: { allyId: string; anchor?: "tower" }[] = []) {
    send({
      type: "packCombat",
      kind: "triggerReversal",
      ...(extraLines.length ? { detail: { extraLines } } : {}),
    });
    reversalExtraAllyIds.value = [];
    reversalTowerAnchorAllyIds.value = [];
  }

  function declineReversal() {
    send({ type: "packCombat", kind: "declineReversal" });
    reversalExtraAllyIds.value = [];
    reversalTowerAnchorAllyIds.value = [];
  }

  function attackPreview(direction: import("@vtt-core/shared").PatternDirection) {
    const s = gameState.value;
    const id = activePlayerId.value;
    if (!s || !id) return [];
    return previewPlayerAttack(s, id, direction);
  }

  function effectPills(player: Player) {
    if (!player.effects) return [];
    return Object.entries(player.effects).map(([id, stacks]) => `${id}:${stacks}`);
  }

  return {
    isGm,
    gameState,
    activePlayer,
    activePlayerId,
    sandboxMode,
    isPlayerTurn,
    combatUiUnlocked,
    showPlayerActionBar,
    showSheetCombatPanel,
    canGmRestoreActionTier,
    showGmCombatUi,
    budget,
    canMain,
    canSupport,
    hasEquipmentCharge,
    canUseEquipment,
    canAux,
    hasteRemaining,
    hasteGrantedTier,
    actionBudgetChips,
    canStartSprint,
    sprintRemaining,
    hasWeaponAttack,
    canUseWeaponActive,
    heavenBurningLevel,
    canUseHeavenBurningUnfold,
    sabaothChargesRemaining,
    armorStructured,
    canTowerTeleport,
    showAssistedLaunch,
    canAssistedLaunch,
    assistedLaunchAnchorOptions,
    canInteractSeed,
    pendingActions,
    pendingReaction,
    pendingClassReaction,
    classActiveTier,
    canUseClassActive,
    hasFreeWeaponSwap,
    hasFreeWeaponAttack,
    showHarpeSecondWeapon,
    showEpeusDualGear,
    hasThrownTrap,
    thrownTrapWeapon,
    reversalExtraAllyIds,
    reversalTowerAnchorAllyIds,
    hasSpentActionTier,
    canResetMovement,
    showAegis,
    aegisFlyingLeft,
    aegisStacks,
    canUseAegis,
    aegisLabel,
    sendPlayerAction,
    commitHaste,
    restorePlayerActionTier,
    resetMovement,
    sendMovePath,
    triggerReversal,
    declineReversal,
    attackPreview,
    effectPills,
  };
}
