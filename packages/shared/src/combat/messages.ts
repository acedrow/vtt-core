import { clearAttackPreview } from "./attack-preview.js";
import { isCampaignFeatureUnlocked } from "../base-upgrades-unlocks.js";
import type {
  AssistedOutcome,
  AttackPreviewState,
  GmEnemyAction,
  PlayerAction,
} from "./types.js";
import type { ClientMessage, Enemy, GameState, Player, TerrainType, TileColorTint, TileImageRotation } from "../types.js";
import { hasGmCapabilities, type AuthCapabilities } from "../auth-capabilities.js";
import {
  canGmMoveEnemies,
  canPlayerMove,
  clampHp,
  finishGmTurnIfPlayersRemain,
  getEnemyMaxHp,
  getPlayerMaxHp,
  areActionLimitsEnforced,
  isSandboxMode,
  applyEnemyMove,
  validateEnemyMove,
  buildBoardOccupancy,
  occupancyBlockedByEnemy,
} from "../game.js";
import { getArmorByName, getArmorSpeed, getWeaponByName } from "../player-data.js";
import type { StructuredArmorAction } from "./types.js";
import { createDefaultActionBudget, type ActionTier } from "./types.js";
import { coordKey, isInBounds, isObstacleTile, isTerrainType, setTileTerrain, tileAt } from "../map.js";
import { DEFAULT_OBSTACLE_HP } from "../types.js";
import {
  isValidTileBaseColor,
  isValidTileColorTint,
  isValidTileImageRotation,
  normalizeTileName,
  TILE_NAME_MAX_LENGTH,
} from "../tile-cosmetics.js";
import { isOrthogonallyAdjacent } from "../patterns.js";
import {
  actionTierBlockedReason,
  actionTierLabel,
  applyCommitHaste,
  canSpendActionTier,
  restoreActionTier,
  spendActionTierOrHaste,
  validateCommitHaste,
} from "./actions.js";
import {
  adjacentEnemies,
  applySprintBegin,
  applySprintCancel,
  applySprintMove,
  formlessLandingTiles,
  normalizeMovementPath,
  validateMovementPath,
  validateResetMovement,
  applyResetMovement,
  validateSprintBegin,
  validateSprintCancel,
  validateSprintMove,
} from "./movement.js";
import {
  applyAttackToEnemies,
  applyDamageToEnemy,
  applyDamageToObstacle,
  applyDamageToPlayer,
  applyRangeAttackToEnemies,
  applySwarmEnemyAttackToPlayer,
  collectAttackTiles,
  collectEnemyPatternAttackTiles,
  effectiveRangeLimit,
  elevationBonusTileCandidates,
  enemiesInTiles,
  enemyDirectAttackTargetEnemyIds,
  enemyDirectAttackTargetPlayerIds,
  enemyAttackDamage,
  enemyPatternAttackSpec,
  getWeaponAttackSpec,
  isAutoResolvableEnemyAttack,
  isDirectTargetEnemyAttack,
  isPatternEnemyAttack,
  isSelectTargetEnemyAttack,
  manhattanDistance,
  resolveAttackWeapon,
  resolveCombatAttackSpec,
  resolveEnemyPatternOrigin,
  resolveRangeAttackObstacleCoords,
  resolveRangeAttackTargetIds,
  ensureSabaothCharges,
  hasSabaothBombSelected,
  isSabaothWeaponName,
  resetHeavenBurningLevelAfterAttack,
} from "./attack.js";
import {
  applyAnnihilationCorridorEndOfTurnDamage,
  applyForceProjection,
  applyHylicCorridor,
  applyHylicRejectionField,
  applyRedirectionCircuits,
  equipmentRequiresBoardPlacement,
  isHylicAnnihilationCorridor,
  isHylicRejectionField,
  isThoughtGuidingRedirectionCircuits,
  isTransientForceProjection,
  validateForceProjection,
  validateHylicCorridorAction,
  validateHylicRejectionField,
  validateRedirectionCircuits,
} from "./content-modules-api.js";
import { applyEffectStacks, applyEnemyEffectStacks, applyTileEffectStacks, clearEffectStacks, clearEnemyEffectStacks, clearTileEffects, hasTileEffects, parseEffectToken, replaceTileEffects, tickUnitEndOfTurn } from "./effects.js";
import { isKnownEffectId } from "../effects-data.js";
import { createPendingAction, addPendingAction, applyAssistedOutcome } from "./pending.js";
import { appendCombatSideEffectMessages, maybeTriggerAgnosia } from "./agnosia.js";
import { getPendingConfirmHandler } from "./pending-confirm.js";
import {
  applyPatternEnemyAttack,
  applySelectTargetEnemyAttack,
} from "./enemy-attack-resolve.js";
import { getSpecialIdHandler } from "./special-id.js";
import { setActiveEnemy } from "./enemy.js";
import {
  dedupeSwarmTargetIds,
  exhaustSwarmMembers,
  markSwarmChipResolved,
  maxSwarmStrikesAgainstTarget,
  reconcileSwarmHp,
  requireSwarmChipResolved,
  snapshotSwarmGroups,
  swarmGroupForEnemy,
  validateSwarmChip,
} from "./content-modules-api.js";
import { enemyLabel, playerLabel } from "../console.js";
import {
  isRangeTargetAttack,
  patternOriginFromAnchor,
  evaluateAnchoredPatternPlacement,
  rangeTargetDistance,
  rangeTargetMax,
  usesAnchoredPatternPlacement,
} from "../weapon-patterns.js";
import {
  applyKataptyStrike,
  applyPlaceTower,
  applySeedInteract,
  applyTowerTeleport,
  applyYadathanReversal,
  getPlayerTower,
  getSeedAt,
  isYadathanArmorName,
  resolveKataptyTargetIds,
  validateKataptyEndTurn,
  validatePlaceTower,
  validateSeedInteract,
  validateTowerTeleport,
  yadathanReversalEligible,
} from "./content-modules-api.js";
import {
  computeAssistedLaunch,
  formatAssistedLaunchMessage,
  validateAssistedLaunch,
} from "./assisted-launch.js";
import {
  applyProvokeAndFormat,
  activateExpandedAggressionGear,
  collectPathProvokeTriggers,
  previewSprintProvokes,
  previewPathProvokes,
  recordPassedEnemiesOnPath,
  isExpandedAggressionGearName,
} from "./provoke.js";
import { applyPushFromOrigin, applyRecoilFromTarget } from "./push.js";
import {
  applyClassActive,
  applyClassPassive,
  applyPostMovementHooks,
  applyResolveClassReaction,
  classActiveTierFor,
  validateClassActive,
  validateClassPassive,
  validateResolveClassReaction,
} from "./content-modules-api.js";
import { runEnemyDefeated } from "./combat-lifecycle.js";
import { findWeaponActiveHandler } from "./weapon-active.js";
import { playerArmorGearName, validateRemoveAttractor, applyRemoveAttractor, applyAttractorEndOfTurnPulls, clearAttractorPullForEnemy } from "./attractor.js";
import { applyTransferenceHeal } from "./transference.js";
import { computePathCostWithFlying, resolveFlyingMask, spendAegisFlying } from "./aegis.js";
import { spendMovement } from "./actions.js";

export type CombatMessageContext = AuthCapabilities & {
  playerId: string | null;
};

function actionTierBlocked(player: Player, tier: ActionTier, state: GameState): string | null {
  if (!areActionLimitsEnforced(state)) return null;
  return actionTierBlockedReason(player, tier);
}

function maybeSpendActionTier(state: GameState, player: Player, tier: ActionTier): void {
  if (areActionLimitsEnforced(state)) spendActionTierOrHaste(player, tier);
}

export function validateMovePath(
  state: GameState,
  playerId: string,
  path: { x: number; y: number }[],
  flying?: boolean | boolean[],
): string | null {
  if (!canPlayerMove(state, playerId)) return "Not your turn";
  const flyingMask = resolveFlyingMask(path.length, flying);
  if (flying !== undefined && !flyingMask) return "Invalid flying path";
  if (state.roundPhase === "deployment") {
    if (path.length !== 1) return "Deployment: single step only";
    return validateMovementPath(state, playerId, path, { flyingMask });
  }
  return validateMovementPath(state, playerId, path, { flyingMask });
}

export function applyMovePath(
  state: GameState,
  playerId: string,
  path: { x: number; y: number }[],
  flying?: boolean | boolean[],
): string {
  if (state.roundPhase === "deployment") {
    const player = state.players.find((p) => p.id === playerId);
    if (!player || path.length !== 1) return "Invalid move";
    const dest = path[0]!;
    player.x = dest.x;
    player.y = dest.y;
    const hookMsgs = applyPostMovementHooks(state, player, "player").messages;
    let msg = `${playerLabel(player)} moved to (${dest.x}, ${dest.y})`;
    if (hookMsgs.length) msg = `${hookMsgs.join("; ")}; ${msg}`;
    return msg;
  }
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";
  const flyingMask = resolveFlyingMask(path.length, flying);
  let resolved = path;
  if (!flyingMask?.some(Boolean)) {
    const normalized = normalizeMovementPath(state, playerId, path);
    if (!normalized) return "No path to destination";
    resolved = normalized;
  }
  const err = validateMovementPath(state, playerId, resolved, { flyingMask });
  if (err) return err;
  const computed = computePathCostWithFlying(state, player, resolved, flyingMask)!;
  if (!isSandboxMode(state) && player.actionBudget) {
    if (!spendMovement(player.actionBudget, computed.total)) return "Not enough movement";
  }
  if (flyingMask) {
    spendAegisFlying(player, flyingMask.filter(Boolean).length);
  }
  const provokeOpts = flyingMask ? { flyingMask } : {};
  const triggers = collectPathProvokeTriggers(state, playerId, resolved, provokeOpts);
  const stepMessages: string[] = [];
  const traveled: { x: number; y: number }[] = [];
  for (const step of resolved) {
    player.x = step.x;
    player.y = step.y;
    traveled.push(step);
    const hooks = applyPostMovementHooks(state, player, "player");
    stepMessages.push(...hooks.messages);
    if (hooks.interrupt || (player.hp ?? 0) <= 0) break;
  }
  let provokeMsg = "";
  if (triggers.length) {
    provokeMsg = applyProvokeAndFormat(state, { kind: "player", player }, triggers);
  }
  recordPassedEnemiesOnPath(state, player, traveled.length ? traveled : resolved);
  const dest = traveled[traveled.length - 1] ?? resolved[resolved.length - 1]!;
  let msg = `${playerLabel(player)} moved to (${dest.x}, ${dest.y})`;
  if (stepMessages.length) msg = `${stepMessages.join("; ")}; ${msg}`;
  if (provokeMsg) msg = `${provokeMsg}; ${msg}`;
  return msg;
}

function validateSelectWeaponVariant(
  state: GameState,
  player: Player,
  action: Extract<PlayerAction, { action: "selectWeaponVariant" }>,
): string | null {
  if (state.roundPhase === "deployment") return "Wrong phase";
  const weapon = getWeaponByName(player.weapon ?? "");
  const bombs = weapon?.attack?.bombs;
  if (!bombs?.length) return "Weapon has no variants";
  if (!Number.isInteger(action.index) || action.index < 0 || action.index >= bombs.length) {
    return "Invalid variant";
  }
  ensureSabaothCharges(player);
  const current = player.counters!.sabaothBomb;
  if (action.index !== current && player.counters!.sabaothCharges! <= 0) {
    return "No charges remaining";
  }
  return null;
}

export function validatePlayerAction(
  state: GameState,
  playerId: string,
  action: PlayerAction,
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";

  if (action.action === "selectWeaponVariant") {
    return validateSelectWeaponVariant(state, player, action);
  }

  if (!canPlayerMove(state, playerId)) return "Not your turn";
  if (state.roundPhase === "deployment") return "Wrong phase";
  if (!isSandboxMode(state) && state.roundPhase !== "playerTurn") return "Wrong phase";
  if (!player.actionBudget) {
    const speed = player.speed ?? getArmorSpeed(player.armor);
    if (speed) player.actionBudget = createDefaultActionBudget(speed);
  }

  switch (action.action) {
    case "attack": {
      const freeAttack = (player.counters?.freeWeaponAttack ?? 0) > 0;
      if (!freeAttack) {
        const blocked = actionTierBlocked(player, "main", state);
        if (blocked) return blocked;
      }
      const weapon = resolveAttackWeapon(player, action.weaponName);
      if (!weapon) return "Invalid weapon";
      if (isSabaothWeaponName(weapon) && !hasSabaothBombSelected(player)) {
        return "Select bomb type";
      }
      const spec = resolveCombatAttackSpec(player, weapon);
      if (!spec) return "Weapon has no attack profile";
      if (isRangeTargetAttack(spec)) {
        const targetIds = resolveRangeAttackTargetIds(action);
        const obstacleCoords = resolveRangeAttackObstacleCoords(action);
        if (!targetIds.length && !obstacleCoords.length) return "Select target";
        const maxTargets = rangeTargetMax(spec);
        if (targetIds.length + obstacleCoords.length > maxTargets) {
          return `Too many targets (max ${maxTargets})`;
        }
        for (const targetId of targetIds) {
          const enemy = state.enemies.find((e) => e.id === targetId);
          if (!enemy) return "Unknown target";
          const limit = effectiveRangeLimit(state, player, rangeTargetDistance(spec), enemy, {
            attacker: player,
            targetUnit: enemy,
          });
          if (manhattanDistance(player, enemy) > limit) return "Target out of range";
        }
        const obstacleRange = rangeTargetDistance(spec);
        for (const coord of obstacleCoords) {
          const tile = tileAt(state.tiles, coord.x, coord.y);
          if (!isObstacleTile(tile)) return "Unknown target";
          if (manhattanDistance(player, coord) > obstacleRange) return "Target out of range";
        }
      } else if (usesAnchoredPatternPlacement(spec)) {
        if (action.anchorX === undefined || action.anchorY === undefined) return "Select placement";
        const placement = evaluateAnchoredPatternPlacement(
          player,
          { x: action.anchorX, y: action.anchorY },
          spec,
          action.direction,
          state,
        );
        if (placement.tooFar) return "outside maximum range";
        if (placement.tooCloseKeys.size > 0) return "inside minimum range";
        if (!placement.valid) return "Placement out of range";
      } else if (action.elevationBonusTile) {
        const attackOrigin = { x: player.x, y: player.y };
        const baseTiles = collectAttackTiles(state, attackOrigin, spec, action.direction);
        const candidates = elevationBonusTileCandidates(state, attackOrigin, baseTiles, player);
        const key = `${action.elevationBonusTile.x},${action.elevationBonusTile.y}`;
        if (!candidates.some((c) => `${c.x},${c.y}` === key)) return "Invalid elevation bonus tile";
      }
      return null;
    }
    case "shove": {
      const blocked = actionTierBlocked(player, "aux", state);
      if (blocked) return blocked;
      if (!action.targetEnemyId && !action.targetPlayerId) return "No shove target";
      const tx = action.targetEnemyId
        ? state.enemies.find((e) => e.id === action.targetEnemyId)
        : state.players.find((p) => p.id === action.targetPlayerId);
      if (!tx) return "Unknown target";
      if (!isOrthogonallyAdjacent({ x: player.x, y: player.y }, { x: tx.x, y: tx.y })) {
        return "Target must be adjacent";
      }
      return null;
    }
    case "sprint": {
      return validateSprintBegin(state, playerId);
    }
    case "sprintMove": {
      return validateSprintMove(state, playerId, action.x, action.y, { flying: action.flying });
    }
    case "sprintCancel": {
      return validateSprintCancel(state, playerId);
    }
    case "weaponSwap": {
      const freeSwap = state.combat?.gearCheckGrants?.[playerId];
      if (!freeSwap) {
        const blocked = actionTierBlocked(player, "aux", state);
        if (blocked) return blocked;
      }
      if (!player.weapon2) return "No carried weapon";
      return null;
    }
    case "rez": {
      const blocked = actionTierBlocked(player, "main", state);
      if (blocked) return blocked;
      const target = state.players.find((p) => p.id === action.targetPlayerId);
      if (!target) return "Unknown ally";
      if (!isOrthogonallyAdjacent({ x: player.x, y: player.y }, { x: target.x, y: target.y })) {
        return "Ally must be adjacent";
      }
      if ((target.hp ?? 0) > 0) return "Ally is not down";
      return null;
    }
    case "armorAction": {
      if (action.kind === "tower_teleport") {
        if (action.x == null || action.y == null) return "Select landing space";
        return validateTowerTeleport(state, player, action.x, action.y, action.keraunoTargetEnemyId);
      }
      if (action.kind === "katapty_end_turn") {
        return validateKataptyEndTurn(state, player, action.targetEnemyIds);
      }
      const blocked = actionTierBlocked(player, "support", state);
      if (blocked) return blocked;
      const armor = getArmorByName(player.armor ?? "");
      const structured = armor?.armorActionStructured as StructuredArmorAction | undefined;
      if (!structured) return "Armor action not structured — use assisted flow";
      if (structured.kind === "teleport_adjacent") {
        if (!action.targetEnemyId) return "Select adjacent enemy";
        const enemy = state.enemies.find((e) => e.id === action.targetEnemyId);
        if (!enemy) return "Unknown enemy";
        if (!adjacentEnemies(state, player.x, player.y).includes(enemy.id)) return "Enemy not adjacent";
        if (action.landingX === undefined || action.landingY === undefined) return "Select landing space";
        const landing = { x: action.landingX, y: action.landingY };
        const validLandings = formlessLandingTiles(state, playerId, action.targetEnemyId);
        if (!validLandings.some((tile) => tile.x === landing.x && tile.y === landing.y)) {
          return "Invalid landing space";
        }
      }
      if (structured.kind === "push_recoil") {
        if (!action.targetEnemyId && !action.targetPlayerId) return "Select target";
        const push = action.push ?? 1;
        const maxPush = structured.push ?? 3;
        if (!Number.isInteger(push) || push < 1 || push > maxPush) return "Invalid push distance";
        if (action.targetEnemyId) {
          if (!state.enemies.some((e) => e.id === action.targetEnemyId)) return "Unknown target";
          if (!adjacentEnemies(state, player.x, player.y).includes(action.targetEnemyId)) {
            return "Target must be adjacent";
          }
        } else {
          const target = state.players.find((p) => p.id === action.targetPlayerId);
          if (!target) return "Unknown target";
          if (!isOrthogonallyAdjacent({ x: player.x, y: player.y }, { x: target.x, y: target.y })) {
            return "Target must be adjacent";
          }
        }
      }
      if (structured.kind === "place_tower") {
        if (action.x === undefined || action.y === undefined) return "Select placement tile";
        return validatePlaceTower(state, player, action.x, action.y, structured.range);
      }
      return null;
    }
    case "assistedLaunch": {
      return validateAssistedLaunch(state, playerId, action.anchorX, action.anchorY);
    }
    case "classActive": {
      const tier = classActiveTierFor(player);
      const blocked = actionTierBlocked(player, tier, state);
      if (blocked) return blocked;
      return validateClassActive(state, player, action);
    }
    case "classPassive": {
      return validateClassPassive(state, player, action);
    }
    case "resolveClassReaction": {
      return validateResolveClassReaction(state, playerId, action);
    }
    case "weaponActive": {
      const weaponHandler = findWeaponActiveHandler(player, action);
      if (weaponHandler) {
        const tier = action.detail === "heaven_burning_unfold" ? "aux" : "main";
        const blocked = actionTierBlocked(player, tier, state);
        if (blocked) return blocked;
        return weaponHandler.validate(state, player, action);
      }
      const blocked = actionTierBlocked(player, "main", state);
      if (blocked) return blocked;
      return null;
    }
    case "useEquipment": {
      const blocked = actionTierBlocked(player, "support", state);
      if (blocked) return blocked;
      if ((player.equipmentUses ?? 1) <= 0) {
        return "Equipment already used";
      }
      const equipmentName = action.detail ?? player.equipment;
      if (equipmentRequiresBoardPlacement(equipmentName)) {
        if (isHylicAnnihilationCorridor(equipmentName)) {
          if (action.anchorX === undefined || action.anchorY === undefined) return "Select placement";
          if (!action.direction) return "Select corridor direction";
          return validateHylicCorridorAction(
            state,
            player,
            { x: action.anchorX, y: action.anchorY },
            action.direction,
          );
        }
        if (isHylicRejectionField(equipmentName)) {
          if (!action.coverTiles?.length) return "Select cover tiles";
          return validateHylicRejectionField(state, player, action.coverTiles);
        }
        if (isTransientForceProjection(equipmentName)) {
          return validateForceProjection(state, player, action);
        }
        if (isThoughtGuidingRedirectionCircuits(equipmentName)) {
          return validateRedirectionCircuits(state, player, action);
        }
      }
      return null;
    }
    case "interact": {
      const blocked = actionTierBlocked(player, "support", state);
      if (blocked) return blocked;
      if (validateSeedInteract(state, player) === null && getSeedAt(state, player.x, player.y)) {
        return null;
      }
      return null;
    }
    case "commitHaste": {
      if (!areActionLimitsEnforced(state)) return "Action limits disabled";
      return validateCommitHaste(player, action.tier);
    }
  }
}

export function applyPlayerAction(
  state: GameState,
  playerId: string,
  action: PlayerAction,
): string {
  clearAttackPreview(state, playerId);
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";

  switch (action.action) {
    case "attack": {
      const freeAttack = (player.counters?.freeWeaponAttack ?? 0) > 0;
      if (freeAttack) {
        if (!player.counters) player.counters = {};
        player.counters.freeWeaponAttack = 0;
      } else {
        maybeSpendActionTier(state, player, "main");
      }
      const weapon = resolveAttackWeapon(player, action.weaponName);
      if (!weapon) return "Invalid weapon";
      const spec = resolveCombatAttackSpec(player, weapon);
      if (!spec) return "Weapon has no attack profile";
      let result;
      const weaponName = weapon;
      const suppressEffects = (player.effects?.Bound ?? 0) > 0;
      if (isRangeTargetAttack(spec)) {
        const rangeTargetIds = resolveRangeAttackTargetIds(action);
        const obstacleCoords = resolveRangeAttackObstacleCoords(action);
        const targetIds = action.useBreaker
          ? rangeTargetIds
          : dedupeSwarmTargetIds(state, rangeTargetIds);
        if (targetIds.length || obstacleCoords.length) {
          result = applyRangeAttackToEnemies(state, spec, targetIds, action.damageRoll, {
            useBreaker: action.useBreaker,
            weaponName,
            obstacleCoords,
            suppressEffects,
          });
        } else {
          result = applyAttackToEnemies(
            state,
            spec,
            { x: player.x, y: player.y },
            action.direction,
            action.damageRoll,
            {
              useBreaker: action.useBreaker,
              weaponName,
              elevationBonusTile: action.elevationBonusTile,
              suppressEffects,
            },
          );
        }
      } else {
        const direction = action.direction;
        const attackOrigin =
          usesAnchoredPatternPlacement(spec) && action.anchorX != null && action.anchorY != null
            ? patternOriginFromAnchor({ x: action.anchorX, y: action.anchorY }, spec.anchorTile, direction)
            : { x: player.x, y: player.y };
        result = applyAttackToEnemies(
          state,
          spec,
          attackOrigin,
          direction,
          action.damageRoll,
          {
            useBreaker: action.useBreaker,
            weaponName,
            elevationBonusTile: action.elevationBonusTile,
            suppressEffects,
          },
        );
      }
      const hitEnemies = result.targets
        .map((t) => state.enemies.find((e) => e.id === t.enemyId))
        .filter(Boolean);
      const names = hitEnemies.map((e) => enemyLabel(e!)).join(", ");
      const defeated = hitEnemies
        .filter((e) => (e!.hp ?? 0) <= 0)
        .map((e) => enemyLabel(e!))
        .join(", ");
      let msg = `${playerLabel(player)} attacked (${result.detail} dmg) → ${names || "no targets"}`;
      const xfer = applyTransferenceHeal(player, result.damage);
      if (xfer) msg += `; ${xfer}`;
      const defeatMsgs: string[] = [];
      for (const e of hitEnemies) {
        if ((e!.hp ?? 0) <= 0) {
          const tokenMsg = runEnemyDefeated(state, e!, playerId);
          if (tokenMsg) defeatMsgs.push(tokenMsg);
        }
      }
      if (defeated) msg += `; defeated ${defeated}`;
      if (defeatMsgs.length) msg += `; ${defeatMsgs.join("; ")}`;
      resetHeavenBurningLevelAfterAttack(player, weapon);
      return appendCombatSideEffectMessages(state, msg);
    }
    case "shove": {
      maybeSpendActionTier(state, player, "aux");
      const occ = buildBoardOccupancy(state);
      let tx: number;
      let ty: number;
      if (action.targetEnemyId) {
        const enemy = state.enemies.find((e) => e.id === action.targetEnemyId)!;
        tx = enemy.x;
        ty = enemy.y;
        const dx = tx - player.x;
        const dy = ty - player.y;
        const pushX = tx + Math.sign(dx);
        const pushY = ty + Math.sign(dy);
        if (
          isInBounds(pushX, pushY, state.width, state.height) &&
          !occ.playerByKey.has(coordKey(pushX, pushY)) &&
          !occupancyBlockedByEnemy(occ, pushX, pushY)
        ) {
          const prev = snapshotSwarmGroups(state);
          enemy.x = pushX;
          enemy.y = pushY;
          reconcileSwarmHp(state, prev);
        }
      } else {
        const target = state.players.find((p) => p.id === action.targetPlayerId)!;
        tx = target.x;
        ty = target.y;
        const dx = tx - player.x;
        const dy = ty - player.y;
        const pushX = tx + Math.sign(dx);
        const pushY = ty + Math.sign(dy);
        if (
          isInBounds(pushX, pushY, state.width, state.height) &&
          !occ.playerByKey.has(coordKey(pushX, pushY)) &&
          !occupancyBlockedByEnemy(occ, pushX, pushY)
        ) {
          target.x = pushX;
          target.y = pushY;
        }
      }
      return `${playerLabel(player)} shoved a target`;
    }
    case "sprint": {
      return applySprintBegin(state, playerId);
    }
    case "sprintMove": {
      const player = state.players.find((p) => p.id === playerId)!;
      const flying = action.flying ?? false;
      const triggers = previewSprintProvokes(state, playerId, action.x, action.y, { flying });
      const base = applySprintMove(state, playerId, action.x, action.y, { flying });
      const hookMsgs = applyPostMovementHooks(state, player, "player").messages;
      recordPassedEnemiesOnPath(state, player, [{ x: action.x, y: action.y }]);
      let provokeMsg = "";
      if (triggers.length) {
        provokeMsg = applyProvokeAndFormat(state, { kind: "player", player }, triggers);
      }
      let msg = base;
      if (hookMsgs.length) msg = `${hookMsgs.join("; ")}; ${msg}`;
      if (provokeMsg) msg = `${provokeMsg}; ${msg}`;
      return msg;
    }
    case "sprintCancel": {
      return applySprintCancel(state, playerId);
    }
    case "weaponSwap": {
      const freeSwap = state.combat?.gearCheckGrants?.[playerId];
      if (freeSwap) {
        delete state.combat!.gearCheckGrants![playerId];
        applyEffectStacks(player, ["Transference:1"]);
      } else {
        maybeSpendActionTier(state, player, "aux");
      }
      const primary = player.weapon;
      player.weapon = player.weapon2!;
      player.weapon2 = primary;
      let msg = `${playerLabel(player)} swapped to ${player.weapon}`;
      if (freeSwap) msg += " (Gear Check!)";
      return msg;
    }
    case "selectWeaponVariant": {
      const weapon = getWeaponByName(player.weapon ?? "");
      // Only reached for bomb-carrying weapons (Sabaoth), so bombs is present.
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      const bombs = weapon?.attack?.bombs!;
      if (!player.counters) player.counters = {};
      ensureSabaothCharges(player);
      const current = player.counters.sabaothBomb;
      if (action.index !== current) {
        player.counters.sabaothCharges = (player.counters.sabaothCharges ?? 0) - 1;
      }
      player.counters.sabaothBomb = action.index;
      return `${playerLabel(player)} selected ${bombs[action.index]?.name ?? "variant"}`;
    }
    case "rez": {
      maybeSpendActionTier(state, player, "main");
      const target = state.players.find((p) => p.id === action.targetPlayerId)!;
      target.hp = getPlayerMaxHp(target);
      return `${playerLabel(player)} rezzed ${playerLabel(target)}`;
    }
    case "armorAction": {
      if (action.kind === "tower_teleport" && action.x != null && action.y != null) {
        const msg = applyTowerTeleport(state, player, action.x, action.y, action.keraunoTargetEnemyId);
        return `${playerLabel(player)} ${msg}`;
      }
      if (action.kind === "katapty_end_turn") {
        const tower = getPlayerTower(state, player.id)!;
        const resolved = resolveKataptyTargetIds(state, player.id, action.targetEnemyIds);
        if ("error" in resolved) return resolved.error;
        const strikeMsg = applyKataptyStrike(state, tower, resolved.ids);
        if (!player.counters) player.counters = {};
        player.counters.kataptyResolved = 1;
        return `${playerLabel(player)} ${strikeMsg}`;
      }
      const armor = getArmorByName(player.armor ?? "")!;
      const structured = armor.armorActionStructured as StructuredArmorAction;
      if (structured.kind === "teleport_adjacent" && action.targetEnemyId) {
        const landing = { x: action.landingX!, y: action.landingY! };
        const triggers = previewSprintProvokes(state, playerId, landing.x, landing.y);
        let provokeMsg = "";
        if (triggers.length) {
          provokeMsg = applyProvokeAndFormat(state, { kind: "player", player }, triggers);
        }
        player.x = landing.x;
        player.y = landing.y;
        maybeSpendActionTier(state, player, "support");
        let msg = `${playerLabel(player)} used Formless`;
        if (provokeMsg) msg = `${provokeMsg}; ${msg}`;
        return msg;
      }
      if (structured.kind === "push_recoil") {
        const push = action.push ?? 1;
        const target = action.targetEnemyId
          ? state.enemies.find((e) => e.id === action.targetEnemyId)
          : state.players.find((p) => p.id === action.targetPlayerId);
        if (!target) return "Unknown target";
        const targetX = target.x;
        const targetY = target.y;
        const parts: string[] = [];
        if (action.targetEnemyId) {
          const enemy = target as Enemy;
          parts.push(
            applyPushFromOrigin(state, enemy, player.x, player.y, push, {
              kind: "enemy",
              excludePlayerId: playerId,
            }),
          );
          if ((enemy.hp ?? 1) <= 0) {
            const tokenMsg = runEnemyDefeated(state, enemy, playerId);
            if (tokenMsg) parts.push(tokenMsg);
          }
        } else {
          parts.push(
            applyPushFromOrigin(state, target as Player, player.x, player.y, push, {
              kind: "player",
              excludePlayerId: playerId,
            }),
          );
        }
        parts.push(applyRecoilFromTarget(state, player, targetX, targetY, push));
        maybeSpendActionTier(state, player, "support");
        const detail = parts.filter(Boolean).join("; ");
        return `${playerLabel(player)} used Hasaphet's Palm — ${detail}`;
      }
      maybeSpendActionTier(state, player, "support");
      if (structured.kind === "place_tower" && action.x != null && action.y != null) {
        const result = applyPlaceTower(state, player, action.x, action.y);
        if ("error" in result) return result.error;
        return `${playerLabel(player)} ${result.message}`;
      }
      return `${playerLabel(player)} used armor action`;
    }
    case "assistedLaunch": {
      const preview = computeAssistedLaunch(state, playerId, action.anchorX, action.anchorY)!;
      const triggers = previewPathProvokes(state, playerId, preview.path);
      let provokeMsg = "";
      if (triggers.length) {
        provokeMsg = applyProvokeAndFormat(state, { kind: "player", player }, triggers);
      }
      const stepMessages: string[] = [];
      for (const step of preview.path) {
        player.x = step.x;
        player.y = step.y;
        stepMessages.push(...applyPostMovementHooks(state, player, "player").messages);
        if ((player.hp ?? 0) <= 0) break;
      }
      if (!player.counters) player.counters = {};
      player.counters.assistedLaunchUsed = 1;
      recordPassedEnemiesOnPath(state, player, preview.path);
      let msg = formatAssistedLaunchMessage(player, preview);
      if (stepMessages.length) msg = `${stepMessages.join("; ")}; ${msg}`;
      if (provokeMsg) msg = `${provokeMsg}; ${msg}`;
      return msg;
    }
    case "classActive": {
      const tier = classActiveTierFor(player);
      maybeSpendActionTier(state, player, tier);
      return applyClassActive(state, playerId, action);
    }
    case "classPassive": {
      return applyClassPassive(state, playerId, action);
    }
    case "resolveClassReaction": {
      const reaction = state.combat?.pendingClassReaction;
      if (reaction?.kind === "borrowing_follow_up" && action.accept) {
        maybeSpendActionTier(state, player, "support");
      }
      return applyResolveClassReaction(state, playerId, action);
    }
    case "weaponActive": {
      const weaponHandler = findWeaponActiveHandler(player, action);
      if (weaponHandler) {
        const tier = action.detail === "heaven_burning_unfold" ? "aux" : "main";
        maybeSpendActionTier(state, player, tier);
        return weaponHandler.apply(state, player, action);
      }
      maybeSpendActionTier(state, player, "main");
      const weapon = getWeaponByName(player.weapon ?? "");
      addPendingAction(
        state,
        createPendingAction("weaponActive", `${weapon?.name ?? "Weapon"} active`, {
          actorPlayerId: playerId,
          detail: weapon?.name ?? action.detail,
          targetEnemyIds: action.targetEnemyIds,
          targetPlayerIds: action.targetPlayerIds,
          direction: action.direction,
        }),
      );
      return `${playerLabel(player)} used weapon active (pending GM)`;
    }
    case "useEquipment": {
      maybeSpendActionTier(state, player, "support");
      player.equipmentUses = 0;
      if (isExpandedAggressionGearName(playerArmorGearName(player))) {
        const gearMsg = activateExpandedAggressionGear(state, player);
        return `${playerLabel(player)} used equipment${gearMsg ? ` — ${gearMsg}` : ""}`;
      }
      if (isHylicAnnihilationCorridor(action.detail ?? player.equipment) && action.direction) {
        const anchor = { x: action.anchorX!, y: action.anchorY! };
        const detail = applyHylicCorridor(state, player, anchor, action.direction);
        return `${playerLabel(player)} used Hylic Annihilation Corridor — ${detail}`;
      }
      if (isHylicRejectionField(action.detail ?? player.equipment) && action.coverTiles) {
        const detail = applyHylicRejectionField(state, action.coverTiles);
        return `${playerLabel(player)} used Hylic Rejection Field — ${detail}`;
      }
      if (isThoughtGuidingRedirectionCircuits(action.detail ?? player.equipment) && action.sourceEnemyId != null) {
        const { message, hitEnemyIds } = applyRedirectionCircuits(state, player, action);
        const defeatMsgs: string[] = [];
        for (const id of hitEnemyIds) {
          const enemy = state.enemies.find((e) => e.id === id);
          if (enemy && (enemy.hp ?? 0) <= 0) {
            const tokenMsg = runEnemyDefeated(state, enemy, playerId);
            if (tokenMsg) defeatMsgs.push(tokenMsg);
          }
        }
        if (defeatMsgs.length) return `${message}; ${defeatMsgs.join("; ")}`;
        return message;
      }
      if (isTransientForceProjection(action.detail ?? player.equipment) && action.projectionX != null) {
        const { message, result, hitEnemyIds } = applyForceProjection(state, player, action);
        const xfer = applyTransferenceHeal(player, result.damage);
        const defeatMsgs: string[] = [];
        for (const id of hitEnemyIds) {
          const enemy = state.enemies.find((e) => e.id === id);
          if (enemy && (enemy.hp ?? 0) <= 0) {
            const tokenMsg = runEnemyDefeated(state, enemy, playerId);
            if (tokenMsg) defeatMsgs.push(tokenMsg);
          }
        }
        let msg = message;
        if (xfer) msg += `; ${xfer}`;
        if (defeatMsgs.length) msg += `; ${defeatMsgs.join("; ")}`;
        return msg;
      }
      addPendingAction(
        state,
        createPendingAction("useEquipment", "Equipment", {
          actorPlayerId: playerId,
          detail: action.detail,
        }),
      );
      return `${playerLabel(player)} used equipment (pending GM)`;
    }
    case "interact": {
      maybeSpendActionTier(state, player, "support");
      const seedMsg = applySeedInteract(state, player);
      if (seedMsg) return `${playerLabel(player)} ${seedMsg}`;
      addPendingAction(
        state,
        createPendingAction("interact", "Interact", {
          actorPlayerId: playerId,
          detail: action.detail,
        }),
      );
      return `${playerLabel(player)} interacted (pending GM)`;
    }
    case "commitHaste": {
      const detail = applyCommitHaste(player, action.tier);
      return `${playerLabel(player)} ${detail}`;
    }
  }
}

export function validateGmEnemyAction(state: GameState, action: GmEnemyAction): string | null {
  if (!canGmMoveEnemies(state)) return "Not GM turn";
  const enemy = state.enemies.find((e) => e.id === action.enemyId);
  if (!enemy) return "Unknown enemy";

  switch (action.action) {
    case "move": {
      if (action.path.length === 0) return "Empty path";
      if (!isSandboxMode(state) && enemy.exhausted) return "Enemy has ended turn";
      const chipErr = requireSwarmChipResolved(state, action.enemyId);
      if (chipErr) return chipErr;
      for (const step of action.path) {
        const err = validateEnemyMove(state, action.enemyId, step.x, step.y);
        if (err) return err;
      }
      return null;
    }
    case "swarmChip":
      return validateSwarmChip(state, action.enemyId, action.targetPlayerIds);
    case "attack": {
      const chipErr = requireSwarmChipResolved(state, action.enemyId);
      if (chipErr) return chipErr;
      const attackSpec = enemy.name ? enemyAttacks(enemy.name)[action.attackIndex]?.attack : undefined;
      if (!attackSpec) return "Invalid attack";

      if (action.swarmStrikes != null) {
        const group = swarmGroupForEnemy(state, action.enemyId);
        if (!group) return "Not a swarm";
        const target = action.targetPlayerId
          ? state.players.find((p) => p.id === action.targetPlayerId)
          : null;
        if (!target) return "Invalid target";
        const max = maxSwarmStrikesAgainstTarget(state, action.enemyId, target);
        if (!Number.isInteger(action.swarmStrikes) || action.swarmStrikes < 1 || action.swarmStrikes > max) {
          return "Invalid strike count";
        }
      }

      const specialHandler = getSpecialIdHandler(attackSpec.specialId);
      if (specialHandler) {
        return specialHandler.validate({ state, enemy, action, attackSpec });
      }

      if (isPatternEnemyAttack(attackSpec)) {
        if (!action.direction) return "Select direction";
        const spec = enemyPatternAttackSpec(attackSpec);
        if (!spec) return "Invalid attack";
        const resolved = resolveEnemyPatternOrigin(
          enemy,
          spec.patternId,
          action.direction,
          action.originX != null && action.originY != null
            ? { x: action.originX, y: action.originY }
            : null,
        );
        if (!resolved) return "Select pattern origin";
        return null;
      }

      if (isSelectTargetEnemyAttack(attackSpec)) {
        if (action.targetPlayerId) {
          const valid = enemyDirectAttackTargetPlayerIds(state, enemy.id, attackSpec);
          if (!valid.includes(action.targetPlayerId)) return "Target out of range";
          return null;
        }
        if (action.targetEnemyId) {
          const valid = enemyDirectAttackTargetEnemyIds(state, enemy.id, attackSpec);
          if (!valid.includes(action.targetEnemyId)) return "Target out of range";
          return null;
        }
        return "Select target";
      }

      if (!isAutoResolvableEnemyAttack(attackSpec)) return null;
      return null;
    }
    case "assisted":
      return null;
    case "exhaust":
      return null;
  }
}

export function applyGmEnemyAction(state: GameState, action: GmEnemyAction): string {
  if (action.action === "attack") clearAttackPreview(state);
  const enemy = state.enemies.find((e) => e.id === action.enemyId);
  if (!enemy) return "Unknown enemy";

  switch (action.action) {
    case "move": {
      clearAttractorPullForEnemy(state, action.enemyId);
      const dest = action.path[action.path.length - 1]!;
      for (const step of action.path) {
        applyEnemyMove(state, action.enemyId, step.x, step.y);
      }
      if (swarmGroupForEnemy(state, action.enemyId)) {
        markSwarmChipResolved(state, action.enemyId);
      }
      setActiveEnemy(state, action.enemyId);
      return `${enemyLabel(enemy)} moved to (${dest.x}, ${dest.y})`;
    }
    case "swarmChip": {
      clearAttractorPullForEnemy(state, action.enemyId);
      const group = swarmGroupForEnemy(state, action.enemyId);
      const hits: string[] = [];
      for (const id of action.targetPlayerIds) {
        const player = state.players.find((p) => p.id === id);
        if (!player) continue;
        applyDamageToPlayer(player, 1, state);
        hits.push(playerLabel(player));
      }
      markSwarmChipResolved(state, action.enemyId);
      setActiveEnemy(state, group?.canonicalId ?? action.enemyId);
      const label = enemyLabel(enemy);
      if (!hits.length) return `${label} swarm chip (no targets)`;
      return `${label} swarm chip → ${hits.join(", ")}`;
    }
    case "attack": {
      clearAttractorPullForEnemy(state, enemy.id);
      setActiveEnemy(state, enemy.id);
      if (swarmGroupForEnemy(state, enemy.id)) {
        markSwarmChipResolved(state, enemy.id);
      }
      const attackSpec = enemy.name ? enemyAttacks(enemy.name)[action.attackIndex]?.attack : undefined;
      if (!attackSpec) {
        return appendCombatSideEffectMessages(
          state,
          `${enemyLabel(enemy)} attack ${action.attackIndex + 1} (not auto-resolved — use damage/force-move tools)`,
        );
      }
      const baseDamage = enemyAttackDamage(attackSpec);

      const specialHandler = getSpecialIdHandler(attackSpec.specialId);
      if (specialHandler) {
        return appendCombatSideEffectMessages(
          state,
          specialHandler.apply({ state, enemy, action, attackSpec }),
        );
      }

      if (isPatternEnemyAttack(attackSpec) && action.direction) {
        const msg = applyPatternEnemyAttack(state, enemy, attackSpec, action.direction, {
          damage: action.damage,
          origin:
            action.originX != null && action.originY != null
              ? { x: action.originX, y: action.originY }
              : undefined,
          onPlayerHit: (playerId) =>
            maybeSetEnemyAttackReversal(state, playerId, enemy.id, action.damage ?? baseDamage ?? 0),
        });
        return appendCombatSideEffectMessages(state, msg);
      }

      const group = swarmGroupForEnemy(state, enemy.id);
      if (
        baseDamage != null &&
        action.targetPlayerId &&
        group &&
        isDirectTargetEnemyAttack(attackSpec)
      ) {
        const target = state.players.find((p) => p.id === action.targetPlayerId);
        if (target) {
          const preview = applySwarmEnemyAttackToPlayer(
            state,
            enemy.id,
            attackSpec,
            action.targetPlayerId,
            { damage: action.damage ?? baseDamage, strikeCount: action.swarmStrikes },
          );
          let msg = `${enemyLabel(enemy)} used attack ${action.attackIndex + 1}`;
          msg += ` → ${playerLabel(target)} for ${preview.totalDamage} (${preview.detail})`;
          if (action.targetPlayerId && state.combat) {
            maybeSetEnemyAttackReversal(state, action.targetPlayerId, enemy.id, action.damage ?? baseDamage ?? 0);
          }
          return appendCombatSideEffectMessages(state, msg);
        }
      }

      if (isSelectTargetEnemyAttack(attackSpec) && (action.targetPlayerId || action.targetEnemyId)) {
        const resolved = applySelectTargetEnemyAttack(state, enemy, attackSpec, {
          targetPlayerId: action.targetPlayerId,
          targetEnemyId: action.targetEnemyId,
          damage: action.damage,
        });
        if (resolved) {
          if (action.targetPlayerId && state.combat) {
            maybeSetEnemyAttackReversal(
              state,
              action.targetPlayerId,
              enemy.id,
              action.damage ?? baseDamage ?? 0,
            );
          }
          return appendCombatSideEffectMessages(state, resolved);
        }
      }

      const msg = `${enemyLabel(enemy)} attack ${action.attackIndex + 1} (not auto-resolved — use damage/force-move tools)`;
      return appendCombatSideEffectMessages(state, msg);
    }
    case "assisted": {
      clearAttractorPullForEnemy(state, enemy.id);
      setActiveEnemy(state, enemy.id);
      addPendingAction(
        state,
        createPendingAction("enemySpecial", action.label, {
          actorEnemyId: enemy.id,
          detail: action.detail,
          targetPlayerIds: action.targetPlayerId ? [action.targetPlayerId] : undefined,
          damage: action.damage,
          effects: action.effects,
        }),
      );
      return `${enemyLabel(enemy)}: ${action.label} (pending)`;
    }
    case "exhaust": {
      exhaustSwarmMembers(state, enemy.id);
      if (state.combat?.activeEnemyId === enemy.id) setActiveEnemy(state, null);
      const group = swarmGroupForEnemy(state, enemy.id);
      const ticks = tickUnitEndOfTurn(state, enemy);
      const corridorMsg = applyAnnihilationCorridorEndOfTurnDamage(state, enemy);
      const attractorEndMsgs: string[] = [];
      const pullIds = group ? group.memberIds : [enemy.id];
      for (const id of pullIds) {
        const member = state.enemies.find((e) => e.id === id);
        if (!member || (member.hp ?? 0) <= 0) continue;
        attractorEndMsgs.push(...applyAttractorEndOfTurnPulls(state, member, "enemy"));
      }
      let msg = group
        ? `${enemyLabel(enemy)} swarm ended turn`
        : `${enemyLabel(enemy)} ended turn`;
      if (ticks.length) msg += `. ${ticks.join("; ")}`;
      if (corridorMsg) msg += `. ${corridorMsg}`;
      if (attractorEndMsgs.length) msg += `. ${attractorEndMsgs.join("; ")}`;
      const phaseMsg = finishGmTurnIfPlayersRemain(state);
      if (phaseMsg) msg += `. GM phase ended — ${phaseMsg}`;
      return msg;
    }
  }
}

import { getEnemyListingByName } from "../enemy-data.js";
import { combatMod } from "../combat-modules.js";

type ReversalsModule = {
  reversalTriggerSatisfied: (
    state: GameState,
    armorName: string,
    enemy: Enemy,
    wearer: Player,
  ) => boolean;
  isAsmodelArmorName: (name: string | undefined | null) => boolean;
};

function reversals(): ReversalsModule {
  return combatMod("reversals") as ReversalsModule;
}

function maybeSetEnemyAttackReversal(
  state: GameState,
  targetPlayerId: string,
  sourceEnemyId: string,
  incomingDamage: number,
): void {
  if (!state.combat) return;
  if (!isCampaignFeatureUnlocked("reversals", state.campaign?.constructedBaseUpgrades ?? [])) return;
  const target = state.players.find((p) => p.id === targetPlayerId);
  const enemy = state.enemies.find((e) => e.id === sourceEnemyId);
  if (!target || !enemy) return;

  const setPending = (wearer: Player, armorName: string, trigger: string) => {
    state.combat!.pendingReaction = {
      playerId: wearer.id,
      sourceEnemyId,
      trigger,
      label: `${armorName} Reversal`,
      incomingDamage: incomingDamage > 0 ? incomingDamage : undefined,
    };
  };

  const targetArmor = getArmorByName(target.armor ?? "");
  const targetEligible =
    targetArmor?.reversal &&
    (target.reversalCharges ?? 0) > 0 &&
    (!isYadathanArmorName(target.armor) || yadathanReversalEligible(state, target.id)) &&
    reversals().reversalTriggerSatisfied(state, targetArmor.name, enemy, target);
  if (targetEligible) {
    setPending(target, targetArmor!.name, targetArmor!.reversal!.trigger);
    return;
  }

  // ASMODEL's Reversal triggers for the ally watching an adjacent teammate get hit,
  // not for the attacked player's own armor.
  for (const ally of state.players) {
    if (ally.id === target.id) continue;
    if (!isOrthogonallyAdjacent(ally, target)) continue;
    const allyArmor = getArmorByName(ally.armor ?? "");
    if (!reversals().isAsmodelArmorName(allyArmor?.name) || !allyArmor?.reversal) continue;
    if ((ally.reversalCharges ?? 0) <= 0) continue;
    setPending(ally, allyArmor.name, allyArmor.reversal.trigger);
    return;
  }
}

function enemyAttacks(name: string) {
  return getEnemyListingByName(name)?.attacks ?? [];
}

export function validateSetEnemyHp(state: GameState, enemyId: string, hp: number): string | null {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy) return "Unknown enemy";
  if (!Number.isFinite(hp)) return "Invalid HP";
  return null;
}

export function applySetEnemyHp(state: GameState, enemyId: string, hp: number): string {
  const prev = snapshotSwarmGroups(state);
  const enemy = state.enemies.find((e) => e.id === enemyId)!;
  const group = swarmGroupForEnemy(state, enemyId);
  const maxHp = group ? group.maxHp : getEnemyMaxHp(enemy);
  const hpBefore = enemy.hp ?? maxHp;
  const clamped = clampHp(Math.trunc(hp), maxHp);
  if (group) {
    for (const id of group.memberIds) {
      const member = state.enemies.find((e) => e.id === id);
      if (member) member.hp = clamped;
    }
  } else {
    enemy.hp = clamped;
  }
  reconcileSwarmHp(state, prev);
  maybeTriggerAgnosia(state, enemy, hpBefore);
  const msg = group
    ? `Swarm HP set to ${clamped}`
    : `${enemyLabel(enemy)} HP set to ${clamped}`;
  return appendCombatSideEffectMessages(state, msg);
}

export function validateGmApplyDamage(
  state: GameState,
  target:
    | { kind: "player" | "enemy"; id: string }
    | { kind: "obstacle"; x: number; y: number },
  amount: number,
): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Invalid damage amount";
  if (target.kind === "obstacle") {
    if (!isInBounds(target.x, target.y, state.width, state.height)) return "Out of bounds";
    const tile = tileAt(state.tiles, target.x, target.y);
    if (!isObstacleTile(tile)) return "Not an obstacle";
    return null;
  }
  if (target.kind === "player" && !state.players.some((p) => p.id === target.id)) return "Unknown player";
  if (target.kind === "enemy" && !state.enemies.some((e) => e.id === target.id)) return "Unknown enemy";
  return null;
}

export function applyGmApplyDamage(
  state: GameState,
  target:
    | { kind: "player" | "enemy"; id: string }
    | { kind: "obstacle"; x: number; y: number },
  amount: number,
): string {
  const damage = Math.trunc(amount);
  if (target.kind === "obstacle") {
    const dealt = applyDamageToObstacle(state, target.x, target.y, damage);
    const tile = tileAt(state.tiles, target.x, target.y);
    if (!isObstacleTile(tile)) return `Dealt ${dealt} to obstacle (${target.x}, ${target.y}); destroyed`;
    return `Dealt ${dealt} to obstacle (${target.x}, ${target.y})`;
  }
  if (target.kind === "player") {
    const player = state.players.find((p) => p.id === target.id);
    if (!player) return "Unknown player";
    const dealt = applyDamageToPlayer(player, damage, state);
    return `Dealt ${dealt} to ${playerLabel(player)}`;
  }
  const enemy = state.enemies.find((e) => e.id === target.id);
  if (!enemy) return "Unknown enemy";
  const dealt = applyDamageToEnemy(enemy, damage, state);
  return appendCombatSideEffectMessages(state, `Dealt ${dealt} to ${enemyLabel(enemy)}`);
}

export function validateApplyEffect(
  state: GameState,
  target: { kind: "player" | "enemy"; id: string },
  effects: string[],
): string | null {
  if (target.kind === "player" && !state.players.some((p) => p.id === target.id)) return "Unknown player";
  if (target.kind === "enemy" && !state.enemies.some((e) => e.id === target.id)) return "Unknown enemy";
  if (!effects.length) return "No effects";
  for (const token of effects) {
    const parsed = parseEffectToken(token);
    if (!parsed) return `Invalid effect token: ${token}`;
    if (parsed.stacks === 0) return `Invalid effect stacks: ${token}`;
    if (!isKnownEffectId(parsed.id)) return `Unknown effect: ${parsed.id}`;
  }
  return null;
}

export function applyEffectTarget(
  state: GameState,
  target: { kind: "player" | "enemy"; id: string },
  effects: string[],
): string {
  const unit =
    target.kind === "player"
      ? state.players.find((p) => p.id === target.id)
      : state.enemies.find((e) => e.id === target.id);
  if (!unit) return "Unknown target";
  if (target.kind === "enemy") applyEnemyEffectStacks(state, unit as import("../types.js").Enemy, effects);
  else applyEffectStacks(unit, effects);
  const label = target.kind === "player" ? playerLabel(unit as import("../types.js").Player) : enemyLabel(unit as import("../types.js").Enemy);
  return `Applied ${effects.join(", ")} to ${label}`;
}

export function validateClearEffects(
  state: GameState,
  target: { kind: "player" | "enemy"; id: string },
): string | null {
  if (target.kind === "player" && !state.players.some((p) => p.id === target.id)) return "Unknown player";
  if (target.kind === "enemy" && !state.enemies.some((e) => e.id === target.id)) return "Unknown enemy";
  return null;
}

export function applyClearEffects(
  state: GameState,
  target: { kind: "player" | "enemy"; id: string },
): string {
  const unit =
    target.kind === "player"
      ? state.players.find((p) => p.id === target.id)
      : state.enemies.find((e) => e.id === target.id);
  if (!unit) return "Unknown target";
  if (target.kind === "enemy") clearEnemyEffectStacks(state, unit as import("../types.js").Enemy);
  else clearEffectStacks(unit);
  const label = target.kind === "player" ? playerLabel(unit as import("../types.js").Player) : enemyLabel(unit as import("../types.js").Enemy);
  return `Cleared effects on ${label}`;
}

function validateTileEffectTokens(effects: string[]): string | null {
  if (!effects.length) return "No effects";
  for (const token of effects) {
    const parsed = parseEffectToken(token);
    if (!parsed) return `Invalid effect token: ${token}`;
    if (parsed.stacks === 0) return `Invalid effect stacks: ${token}`;
    if (!isKnownEffectId(parsed.id)) return `Unknown effect: ${parsed.id}`;
  }
  return null;
}

export function validateApplyTileEffect(
  state: GameState,
  x: number,
  y: number,
  effects: string[],
): string | null {
  if (!isInBounds(x, y, state.width, state.height)) return "Out of bounds";
  const tile = tileAt(state.tiles, x, y);
  if (!tile) return "No tile here";
  return validateTileEffectTokens(effects);
}

export function applyApplyTileEffect(
  state: GameState,
  x: number,
  y: number,
  effects: string[],
): string {
  const tile = tileAt(state.tiles, x, y)!;
  applyTileEffectStacks(tile, effects);
  return `Applied ${effects.join(", ")} to (${x}, ${y})`;
}

export function validateClearTileEffects(state: GameState, x: number, y: number): string | null {
  if (!isInBounds(x, y, state.width, state.height)) return "Out of bounds";
  const tile = tileAt(state.tiles, x, y);
  if (!tile) return "No tile here";
  if (!hasTileEffects(tile)) return "No tile effects here";
  return null;
}

export function applyClearTileEffects(state: GameState, x: number, y: number): string {
  const tile = tileAt(state.tiles, x, y)!;
  clearTileEffects(tile);
  return `Cleared tile effects at (${x}, ${y})`;
}

export function validateSetTileTerrain(
  state: GameState,
  x: number,
  y: number,
  terrain: string,
): string | null {
  if (!isInBounds(x, y, state.width, state.height)) return "Out of bounds";
  const tile = tileAt(state.tiles, x, y);
  if (!tile) return "No tile here";
  if (!isTerrainType(terrain)) return `Invalid terrain type: ${terrain}`;
  return null;
}

export function applySetTileTerrain(
  state: GameState,
  x: number,
  y: number,
  terrain: TerrainType,
): string {
  const tile = tileAt(state.tiles, x, y)!;
  setTileTerrain(tile, terrain);
  return `Set (${x}, ${y}) terrain to ${terrain}`;
}

function validatePaintTileEffectTokens(effects: string[]): string | null {
  for (const token of effects) {
    const parsed = parseEffectToken(token);
    if (!parsed) return `Invalid effect token: ${token}`;
    if (parsed.stacks === 0) return `Invalid effect stacks: ${token}`;
    if (!isKnownEffectId(parsed.id)) return `Unknown effect: ${parsed.id}`;
  }
  return null;
}

export type GmPaintTileFields = {
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

function hasGmPaintTileFields(fields: GmPaintTileFields): boolean {
  return (
    fields.elevation !== undefined ||
    fields.terrain !== undefined ||
    fields.tileEffects !== undefined ||
    fields.tileName !== undefined ||
    fields.obstacleHp !== undefined ||
    fields.baseColor !== undefined ||
    fields.appearanceKey !== undefined ||
    fields.overlayKey !== undefined ||
    fields.featureKey !== undefined ||
    fields.appearanceTint !== undefined ||
    fields.overlayTint !== undefined ||
    fields.featureTint !== undefined ||
    fields.appearanceRotation !== undefined ||
    fields.appearanceFlip !== undefined ||
    fields.overlayRotation !== undefined ||
    fields.overlayFlip !== undefined ||
    fields.featureRotation !== undefined ||
    fields.featureFlip !== undefined
  );
}

export function validateGmPaintTile(
  state: GameState,
  x: number,
  y: number,
  fields: GmPaintTileFields,
): string | null {
  if (!isInBounds(x, y, state.width, state.height)) return "Out of bounds";
  const tile = tileAt(state.tiles, x, y);
  if (!tile) return "No tile here";
  if (!hasGmPaintTileFields(fields)) return "No paint fields provided";
  if (fields.elevation !== undefined) {
    if (!Number.isInteger(fields.elevation) || fields.elevation < -3 || fields.elevation > 3) {
      return "Elevation must be an integer from -3 to 3";
    }
  }
  if (fields.terrain !== undefined) {
    if (!isTerrainType(fields.terrain)) return `Invalid terrain type: ${fields.terrain}`;
  }
  if (fields.obstacleHp !== undefined) {
    if (!Number.isInteger(fields.obstacleHp) || fields.obstacleHp < 1) {
      return "obstacleHp must be a positive integer";
    }
    const nextTerrain = fields.terrain ?? (tile.terrain.includes("obstacle") ? "obstacle" : null);
    if (nextTerrain !== "obstacle") {
      return "obstacleHp requires obstacle terrain";
    }
  }
  if (fields.tileEffects !== undefined) {
    const err = validatePaintTileEffectTokens(fields.tileEffects);
    if (err) return err;
  }
  if (fields.tileName !== undefined) {
    if (typeof fields.tileName !== "string") return "tileName must be a string";
    if (normalizeTileName(fields.tileName).length > TILE_NAME_MAX_LENGTH) {
      return `tileName must be at most ${TILE_NAME_MAX_LENGTH} characters`;
    }
  }
  if (fields.baseColor !== undefined && fields.baseColor != null && !isValidTileBaseColor(fields.baseColor)) {
    return "baseColor must be a #RGB or #RRGGBB hex color";
  }
  if (
    fields.appearanceTint !== undefined &&
    fields.appearanceTint != null &&
    !isValidTileColorTint(fields.appearanceTint)
  ) {
    return "appearanceTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }";
  }
  if (
    fields.featureTint !== undefined &&
    fields.featureTint != null &&
    !isValidTileColorTint(fields.featureTint)
  ) {
    return "featureTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }";
  }
  if (
    fields.overlayTint !== undefined &&
    fields.overlayTint != null &&
    !isValidTileColorTint(fields.overlayTint)
  ) {
    return "overlayTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }";
  }
  if (
    fields.appearanceKey !== undefined &&
    fields.appearanceKey != null &&
    (typeof fields.appearanceKey !== "string" || !fields.appearanceKey.trim())
  ) {
    return "appearanceKey must be a non-empty string";
  }
  if (
    fields.overlayKey !== undefined &&
    fields.overlayKey != null &&
    (typeof fields.overlayKey !== "string" || !fields.overlayKey.trim())
  ) {
    return "overlayKey must be a non-empty string";
  }
  if (
    fields.featureKey !== undefined &&
    fields.featureKey != null &&
    (typeof fields.featureKey !== "string" || !fields.featureKey.trim())
  ) {
    return "featureKey must be a non-empty string";
  }
  if (
    fields.appearanceRotation !== undefined &&
    fields.appearanceRotation != null &&
    !isValidTileImageRotation(fields.appearanceRotation)
  ) {
    return "appearanceRotation must be 0, 90, 180, or 270";
  }
  if (
    fields.overlayRotation !== undefined &&
    fields.overlayRotation != null &&
    !isValidTileImageRotation(fields.overlayRotation)
  ) {
    return "overlayRotation must be 0, 90, 180, or 270";
  }
  if (
    fields.featureRotation !== undefined &&
    fields.featureRotation != null &&
    !isValidTileImageRotation(fields.featureRotation)
  ) {
    return "featureRotation must be 0, 90, 180, or 270";
  }
  if (
    fields.appearanceFlip !== undefined &&
    fields.appearanceFlip != null &&
    typeof fields.appearanceFlip !== "boolean"
  ) {
    return "appearanceFlip must be a boolean";
  }
  if (
    fields.overlayFlip !== undefined &&
    fields.overlayFlip != null &&
    typeof fields.overlayFlip !== "boolean"
  ) {
    return "overlayFlip must be a boolean";
  }
  if (
    fields.featureFlip !== undefined &&
    fields.featureFlip != null &&
    typeof fields.featureFlip !== "boolean"
  ) {
    return "featureFlip must be a boolean";
  }
  return null;
}

export function applyGmPaintTile(
  state: GameState,
  x: number,
  y: number,
  fields: GmPaintTileFields,
): string {
  const tile = tileAt(state.tiles, x, y)!;
  if (fields.elevation !== undefined) tile.elevation = fields.elevation;
  if (fields.terrain !== undefined) setTileTerrain(tile, fields.terrain);
  if (fields.obstacleHp !== undefined) {
    if (isObstacleTile(tile)) tile.obstacleHp = fields.obstacleHp;
  } else if (fields.terrain === "obstacle" && tile.obstacleHp == null) {
    tile.obstacleHp = DEFAULT_OBSTACLE_HP;
  }
  if (fields.tileEffects !== undefined) replaceTileEffects(tile, fields.tileEffects);

  if (fields.tileName !== undefined) {
    const normalizedName = normalizeTileName(fields.tileName);
    if (normalizedName) tile.name = normalizedName;
    else delete tile.name;
  }

  if (fields.baseColor !== undefined) {
    if (fields.baseColor) tile.baseColor = fields.baseColor;
    else delete tile.baseColor;
  }

  if (fields.appearanceKey !== undefined) {
    if (fields.appearanceKey?.trim()) tile.appearanceKey = fields.appearanceKey.trim();
    else delete tile.appearanceKey;
  }

  if (fields.overlayKey !== undefined) {
    if (fields.overlayKey?.trim()) tile.overlayKey = fields.overlayKey.trim();
    else delete tile.overlayKey;
  }

  if (fields.featureKey !== undefined) {
    if (fields.featureKey?.trim()) tile.featureKey = fields.featureKey.trim();
    else delete tile.featureKey;
  }

  if (fields.appearanceTint !== undefined) {
    if (fields.appearanceTint) tile.appearanceTint = { ...fields.appearanceTint };
    else delete tile.appearanceTint;
  }

  if (fields.overlayTint !== undefined) {
    if (fields.overlayTint) tile.overlayTint = { ...fields.overlayTint };
    else delete tile.overlayTint;
  }

  if (fields.featureTint !== undefined) {
    if (fields.featureTint) tile.featureTint = { ...fields.featureTint };
    else delete tile.featureTint;
  }

  if (fields.appearanceRotation !== undefined) {
    if (fields.appearanceRotation != null && fields.appearanceRotation !== 0) {
      tile.appearanceRotation = fields.appearanceRotation;
    } else {
      delete tile.appearanceRotation;
    }
  }

  if (fields.overlayRotation !== undefined) {
    if (fields.overlayRotation != null && fields.overlayRotation !== 0) {
      tile.overlayRotation = fields.overlayRotation;
    } else {
      delete tile.overlayRotation;
    }
  }

  if (fields.featureRotation !== undefined) {
    if (fields.featureRotation != null && fields.featureRotation !== 0) {
      tile.featureRotation = fields.featureRotation;
    } else {
      delete tile.featureRotation;
    }
  }

  if (fields.appearanceFlip !== undefined) {
    if (fields.appearanceFlip) tile.appearanceFlip = true;
    else delete tile.appearanceFlip;
  }

  if (fields.overlayFlip !== undefined) {
    if (fields.overlayFlip) tile.overlayFlip = true;
    else delete tile.overlayFlip;
  }

  if (fields.featureFlip !== undefined) {
    if (fields.featureFlip) tile.featureFlip = true;
    else delete tile.featureFlip;
  }

  return `Painted (${x}, ${y})`;
}

export function validateAssistedOutcome(_state: GameState, _outcome: AssistedOutcome, ctx: AuthCapabilities): string | null {
  if (!hasGmCapabilities(ctx)) return "Only GM can apply assisted outcomes";
  return null;
}

export { applyAssistedOutcome };

export function validateTriggerReversal(state: GameState, playerId: string): string | null {
  if (!isCampaignFeatureUnlocked("reversals", state.campaign?.constructedBaseUpgrades ?? [])) {
    return "Reversals disabled";
  }
  const reaction = state.combat?.pendingReaction;
  if (!reaction || reaction.playerId !== playerId) return "No reversal pending";
  const player = state.players.find((p) => p.id === playerId);
  if (!player || (player.reversalCharges ?? 0) <= 0) return "No reversal charges";
  return null;
}

export function applyTriggerReversal(
  state: GameState,
  playerId: string,
  extraLines: { allyId: string; anchor?: "tower" }[] = [],
): string {
  const player = state.players.find((p) => p.id === playerId)!;
  const reaction = state.combat?.pendingReaction;
  const incomingDamage = reaction?.incomingDamage ?? 1;
  player.reversalCharges = (player.reversalCharges ?? 0) - 1;
  const extraCount = extraLines.length;
  if (extraCount > 0) {
    player.reversalCharges = Math.max(0, (player.reversalCharges ?? 0) - extraCount);
  }
  if (state.combat) state.combat.pendingReaction = null;
  const armor = getArmorByName(player.armor ?? "");

  if (isYadathanArmorName(player.armor)) {
    const detail = applyYadathanReversal(state, player, incomingDamage, extraLines);
    return `${playerLabel(player)} triggered Reversal — ${detail}`;
  }

  addPendingAction(
    state,
    createPendingAction("reversal", `${armor?.name ?? "Armor"} Reversal`, {
      actorPlayerId: playerId,
      detail: armor?.reversal?.effect,
    }),
  );
  return `${playerLabel(player)} triggered Reversal (pending GM)`;
}

export function validateDeclineReversal(state: GameState, playerId: string): string | null {
  if (!isCampaignFeatureUnlocked("reversals", state.campaign?.constructedBaseUpgrades ?? [])) {
    return "Reversals disabled";
  }
  const reaction = state.combat?.pendingReaction;
  if (!reaction || reaction.playerId !== playerId) return "No reversal pending";
  return null;
}

export function applyDeclineReversal(state: GameState, playerId: string): string {
  if (state.combat) state.combat.pendingReaction = null;
  const player = state.players.find((p) => p.id === playerId);
  return `${player ? playerLabel(player) : "Player"} declined Reversal`;
}

export function previewPlayerAttack(
  state: GameState,
  playerId: string,
  direction: import("../pattern-data.js").PatternDirection,
  weaponName?: string,
): { x: number; y: number }[] {
  const player = state.players.find((p) => p.id === playerId);
  const weapon = player ? resolveAttackWeapon(player, weaponName) ?? player.weapon : undefined;
  const spec = player ? resolveCombatAttackSpec(player, weapon) : getWeaponAttackSpec(weapon);
  if (!player || !spec) return [];
  return collectAttackTiles(state, { x: player.x, y: player.y }, spec, direction);
}

export function previewEnemyAttack(
  state: GameState,
  enemyId: string,
  attackIndex: number,
  direction: import("../pattern-data.js").PatternDirection,
  origin?: { x: number; y: number },
): { x: number; y: number }[] {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy?.name) return [];
  const attackSpec = enemyAttacks(enemy.name)[attackIndex]?.attack;
  if (!attackSpec) return [];
  const spec = enemyPatternAttackSpec(attackSpec);
  if (!spec) return [];
  const resolved = resolveEnemyPatternOrigin(enemy, spec.patternId, direction, origin ?? null);
  if (!resolved) return [];
  return collectEnemyPatternAttackTiles(state, enemy, spec, direction, resolved);
}

export function previewAttackTargets(
  state: GameState,
  tiles: { x: number; y: number }[],
): string[] {
  return enemiesInTiles(state, tiles).map((t) => t.enemyId);
}
export type CombatHandleResult =
  | { handled: true; message: string; silent?: boolean; persistCoords?: { x: number; y: number }[] }
  | { handled: false };

export function validateSetAttackPreview(
  _state: GameState,
  preview: AttackPreviewState | null,
  ctx: CombatMessageContext,
): string | null {
  if (preview == null) return null;
  if (preview.mode === "gmEnemyAttack") {
    if (!hasGmCapabilities(ctx)) return "Only GM can preview enemy attacks";
    if (!preview.enemyId || preview.attackIndex == null) return "Invalid enemy attack preview";
    return null;
  }
  if (!ctx.playerId) return "Only players can preview attacks";
  if (preview.playerId !== ctx.playerId) return "Cannot preview for another player";
  return null;
}

export function applySetAttackPreview(state: GameState, preview: AttackPreviewState | null) {
  if (!state.combat) return;
  state.combat.attackPreview = preview;
}

export function validateRestorePlayerActionTier(
  state: GameState,
  playerId: string,
  tier: ActionTier,
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return "Unknown player";
  if (!player.actionBudget) return "No action budget";
  if (canSpendActionTier(player.actionBudget, tier)) return "Action not spent";
  return null;
}

export function applyRestorePlayerActionTier(
  state: GameState,
  playerId: string,
  tier: ActionTier,
): string {
  const player = state.players.find((p) => p.id === playerId);
  if (!player?.actionBudget) return "Unknown player";
  restoreActionTier(player.actionBudget, tier);
  if (player.hasteActionTier === tier) delete player.hasteActionTier;
  return `restored ${actionTierLabel(tier)} action for ${playerLabel(player)}`;
}

export function handleCombatMessage(
  state: GameState,
  parsed: ClientMessage,
  ctx: CombatMessageContext,
): CombatHandleResult | { handled: true; error: string } {
  switch (parsed.type) {
    case "movePath": {
      if (!ctx.playerId) return { handled: true, error: "Only players can move" };
      const err = validateMovePath(state, ctx.playerId, parsed.path, parsed.flying);
      if (err) return { handled: true, error: err };
      return {
        handled: true,
        message: applyMovePath(state, ctx.playerId, parsed.path, parsed.flying),
      };
    }
    case "resetMovement": {
      if (!ctx.playerId) return { handled: true, error: "Only players can reset movement" };
      const err = validateResetMovement(state, ctx.playerId);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applyResetMovement(state, ctx.playerId) };
    }
    case "playerAction": {
      if (!ctx.playerId) return { handled: true, error: "Only players can act" };
      const err = validatePlayerAction(state, ctx.playerId, parsed.action);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applyPlayerAction(state, ctx.playerId, parsed.action) };
    }
    case "restorePlayerActionTier": {
      if (!hasGmCapabilities(ctx)) return { handled: true, error: "Only GM can do that" };
      const err = validateRestorePlayerActionTier(state, parsed.playerId, parsed.tier);
      if (err) return { handled: true, error: err };
      return {
        handled: true,
        message: applyRestorePlayerActionTier(state, parsed.playerId, parsed.tier),
      };
    }
    case "gmEnemyAction": {
      if (!hasGmCapabilities(ctx)) return { handled: true, error: "Only GM can do that" };
      const err = validateGmEnemyAction(state, parsed.action);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applyGmEnemyAction(state, parsed.action) };
    }
    case "applyAssistedOutcome": {
      const err = validateAssistedOutcome(state, parsed.outcome, ctx);
      if (err) return { handled: true, error: err };
      const msg = applyAssistedOutcome(state, parsed.outcome);
      return { handled: true, message: msg ?? "Applied" };
    }
    case "setEnemyHp": {
      if (!hasGmCapabilities(ctx)) return { handled: true, error: "Only GM can do that" };
      const err = validateSetEnemyHp(state, parsed.enemyId, parsed.hp);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applySetEnemyHp(state, parsed.enemyId, parsed.hp) };
    }
    case "gmApplyDamage": {
      if (!hasGmCapabilities(ctx)) return { handled: true, error: "Only GM can do that" };
      const err = validateGmApplyDamage(state, parsed.target, parsed.amount);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applyGmApplyDamage(state, parsed.target, parsed.amount) };
    }
    case "applyEffect": {
      const err = validateApplyEffect(state, parsed.target, parsed.effects);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applyEffectTarget(state, parsed.target, parsed.effects) };
    }
    case "clearEffects": {
      if (!hasGmCapabilities(ctx)) return { handled: true, error: "Only GM can do that" };
      const err = validateClearEffects(state, parsed.target);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applyClearEffects(state, parsed.target) };
    }
    case "applyTileEffect": {
      if (!hasGmCapabilities(ctx)) return { handled: true, error: "Only GM can do that" };
      const err = validateApplyTileEffect(state, parsed.x, parsed.y, parsed.effects);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applyApplyTileEffect(state, parsed.x, parsed.y, parsed.effects) };
    }
    case "clearTileEffects": {
      if (!hasGmCapabilities(ctx)) return { handled: true, error: "Only GM can do that" };
      const err = validateClearTileEffects(state, parsed.x, parsed.y);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applyClearTileEffects(state, parsed.x, parsed.y) };
    }
    case "setTileTerrain": {
      if (!hasGmCapabilities(ctx)) return { handled: true, error: "Only GM can do that" };
      const err = validateSetTileTerrain(state, parsed.x, parsed.y, parsed.terrain);
      if (err) return { handled: true, error: err };
      return {
        handled: true,
        message: applySetTileTerrain(state, parsed.x, parsed.y, parsed.terrain),
      };
    }
    case "gmPaintTile": {
      if (!hasGmCapabilities(ctx)) return { handled: true, error: "Only GM can do that" };
      if (parsed.coords.length === 0) return { handled: true, error: "No tiles selected" };
      const fields: GmPaintTileFields = {
        ...(parsed.elevation !== undefined ? { elevation: parsed.elevation } : {}),
        ...(parsed.terrain !== undefined ? { terrain: parsed.terrain } : {}),
        ...(parsed.tileEffects !== undefined ? { tileEffects: parsed.tileEffects } : {}),
        ...(parsed.tileName !== undefined ? { tileName: parsed.tileName } : {}),
        ...(parsed.obstacleHp !== undefined ? { obstacleHp: parsed.obstacleHp } : {}),
        ...(parsed.baseColor !== undefined ? { baseColor: parsed.baseColor } : {}),
        ...(parsed.appearanceKey !== undefined ? { appearanceKey: parsed.appearanceKey } : {}),
        ...(parsed.overlayKey !== undefined ? { overlayKey: parsed.overlayKey } : {}),
        ...(parsed.featureKey !== undefined ? { featureKey: parsed.featureKey } : {}),
        ...(parsed.appearanceTint !== undefined ? { appearanceTint: parsed.appearanceTint } : {}),
        ...(parsed.overlayTint !== undefined ? { overlayTint: parsed.overlayTint } : {}),
        ...(parsed.featureTint !== undefined ? { featureTint: parsed.featureTint } : {}),
        ...(parsed.appearanceRotation !== undefined
          ? { appearanceRotation: parsed.appearanceRotation }
          : {}),
        ...(parsed.appearanceFlip !== undefined ? { appearanceFlip: parsed.appearanceFlip } : {}),
        ...(parsed.overlayRotation !== undefined ? { overlayRotation: parsed.overlayRotation } : {}),
        ...(parsed.overlayFlip !== undefined ? { overlayFlip: parsed.overlayFlip } : {}),
        ...(parsed.featureRotation !== undefined ? { featureRotation: parsed.featureRotation } : {}),
        ...(parsed.featureFlip !== undefined ? { featureFlip: parsed.featureFlip } : {}),
      };
      for (const { x, y } of parsed.coords) {
        const err = validateGmPaintTile(state, x, y, fields);
        if (err) return { handled: true, error: err };
      }
      for (const { x, y } of parsed.coords) {
        applyGmPaintTile(state, x, y, fields);
      }
      return { handled: true, message: "", silent: true };
    }
    case "confirmPending": {
      if (!hasGmCapabilities(ctx)) return { handled: true, error: "Only GM can do that" };
      const handler = getPendingConfirmHandler(parsed.kind);
      if (!handler) return { handled: true, error: `Unknown pending confirm: ${parsed.kind}` };
      const confirmCtx = {
        state,
        enemyId: parsed.enemyId,
        hoverX: parsed.hoverX,
        hoverY: parsed.hoverY,
      };
      const err = handler.validate(confirmCtx);
      if (err) return { handled: true, error: err };
      const result = handler.apply(confirmCtx);
      return { handled: true, message: result.message, persistCoords: result.coords };
    }
    case "removeAttractor": {
      const err = validateRemoveAttractor(state, parsed.x, parsed.y, ctx);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applyRemoveAttractor(state, parsed.x, parsed.y) };
    }
    case "triggerReversal": {
      if (!ctx.playerId) return { handled: true, error: "Only players can trigger reversal" };
      const err = validateTriggerReversal(state, ctx.playerId);
      if (err) return { handled: true, error: err };
      return {
        handled: true,
        message: applyTriggerReversal(state, ctx.playerId, parsed.extraLines ?? []),
      };
    }
    case "declineReversal": {
      if (!ctx.playerId) return { handled: true, error: "Only players can decline reversal" };
      const err = validateDeclineReversal(state, ctx.playerId);
      if (err) return { handled: true, error: err };
      return { handled: true, message: applyDeclineReversal(state, ctx.playerId) };
    }
    case "setAttackPreview": {
      const err = validateSetAttackPreview(state, parsed.preview, ctx);
      if (err) return { handled: true, error: err };
      applySetAttackPreview(state, parsed.preview);
      return { handled: true, message: "", silent: true };
    }
    default:
      return { handled: false };
  }
}

