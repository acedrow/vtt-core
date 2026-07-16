import type { GameState, Player, Enemy } from "@gaem/shared";
import type { PlayerAction, ActionTier, ThrownTrap } from "@gaem/shared";
import {
  getClassActiveKind,
  getClassActiveTier,
  getGearByName,
} from "@gaem/shared";
import { getUnlockedOptions } from "@gaem/shared";
import { playerLabel, enemyLabel } from "@gaem/shared";
import { coordKey, isObstacleTile, isWalkable, tileAt } from "@gaem/shared";
import { isOrthogonallyAdjacent } from "@gaem/shared";
import { hasLineOfSight, tilesOnCardinalLine } from "@gaem/shared";
import {
  applyAttackToEnemies,
  applyDamageToEnemy,
  collectAttackTiles,
  getWeaponAttackSpec,
  initSabaothCharges,
  manhattanDistance,
  resolveCombatAttackSpec,
} from "@gaem/shared";
import { maxWeaponDamage, rollDice } from "@gaem/shared";
import { applyPullToward } from "@gaem/shared";
import { applyAttractorEntryPulls, placeAttractor } from "@gaem/shared";
import { applyVoidTileDefeat } from "@gaem/shared";
import { applyOffhandPistolPush } from "@gaem/shared";
import {
  applyKopisMark,
  ensureKopisCombatFields,
  handleEnemyDefeated,
} from "./kopis.js";
import {
  applySoulBranding,
  CHRYSAOR_CLASS,
  ensureChrysaorCombatFields,
  stripOwnedBrand,
} from "./chrysaor.js";
import { unitHasSeeking, unitPiercingStacks } from "@gaem/shared";
import { adjacentEnemies } from "@gaem/shared";

export { handleEnemyDefeated, syncKopisMarkEffects } from "./kopis.js";
export const HARPE_CLASS = "HARPE";
export const KOPIS_CLASS = "KOPIS";
export const SHARUR_CLASS = "SHARUR";
export const VARUNASTRA_CLASS = "VARUNASTRA";
export const HEPHAESTUS_CLASS = "HEPHAESTUS";
export const EPEUS_CLASS = "EPEUS";

function ensureCombat(state: GameState): boolean {
  if (!state.combat) return false;
  if (!state.combat.thrownTraps) state.combat.thrownTraps = [];
  if (!state.combat.attractors) state.combat.attractors = [];
  ensureChrysaorCombatFields(state);
  return ensureKopisCombatFields(state);
}

function getThrownTrap(state: GameState, ownerId: string): ThrownTrap | undefined {
  return state.combat?.thrownTraps?.find((t) => t.ownerId === ownerId);
}

export function validateClassActive(
  state: GameState,
  player: Player,
  action: Extract<PlayerAction, { action: "classActive" }>,
): string | null {
  const kind = action.kind ?? getClassActiveKind(player.class);
  if (!kind) return "Class has no structured active";

  if (player.class === HARPE_CLASS) {
    if (action.harpeRecall) {
      if (!getThrownTrap(state, player.id)) return "No thrown weapon";
      return null;
    }
    if (action.x == null || action.y == null) return "Select trap destination";
    if (!isOrthogonallyAdjacent(player, { x: action.x, y: action.y }) &&
        !(player.x === action.x || player.y === action.y)) {
      const dx = Math.sign(action.x - player.x);
      const dy = Math.sign(action.y - player.y);
      if (dx === 0 && dy === 0) return "Invalid direction";
      if (dx !== 0 && dy !== 0) return "Must throw cardinally";
    }
    const dx = Math.sign(action.x - player.x);
    const dy = Math.sign(action.y - player.y);
    if (dx === 0 && dy === 0) return "Select a direction";
    if (dx !== 0 && dy !== 0) return "Must throw cardinally";
    const dist = Math.abs(action.x - player.x) + Math.abs(action.y - player.y);
    if (dist < 1 || dist > 6) return "Range 1–6";
    if (!player.weapon) return "No weapon equipped";
    if (
      !hasLineOfSight(state, player.x, player.y, action.x, action.y, {
        viewer: player,
        piercing: unitPiercingStacks(player),
        seeking: unitHasSeeking(player),
      })
    ) {
      return "No line of sight";
    }
    if (!isWalkable(tileAt(state.tiles, action.x, action.y))) return "Blocked";
    return null;
  }

  if (player.class === KOPIS_CLASS) {
    const enemyId = action.targetEnemyIds?.[0];
    if (!enemyId) return "Select enemy";
    const enemy = state.enemies.find((e) => e.id === enemyId);
    if (!enemy) return "Unknown enemy";
    if (
      !hasLineOfSight(state, player.x, player.y, enemy.x, enemy.y, {
        viewer: player,
        target: enemy,
        piercing: unitPiercingStacks(player),
        seeking: unitHasSeeking(player),
      })
    ) {
      return "No line of sight";
    }
    return null;
  }

  if (player.class === SHARUR_CLASS) {
    if (action.x == null || action.y == null) return "Select tile";
    if (manhattanDistance(player, { x: action.x, y: action.y }) > 4) return "Out of range";
    if (!isWalkable(tileAt(state.tiles, action.x, action.y))) return "Invalid tile";
    return null;
  }

  if (player.class === HEPHAESTUS_CLASS) {
    const enemyId = action.targetEnemyIds?.[0];
    if (!enemyId) return "Select adjacent enemy";
    const enemy = state.enemies.find((e) => e.id === enemyId);
    if (!enemy) return "Unknown enemy";
    if (!adjacentEnemies(state, player.x, player.y).includes(enemy.id)) return "Range 1";
    return null;
  }

  if (player.class === EPEUS_CLASS) {
    if (!action.gearSlot || !action.gearName) return "Select gear to swap";
    const gear = getGearByName(action.gearName);
    if (!gear) return "Unknown gear";
    if (gear.slot !== action.gearSlot) return "Wrong gear slot";
    const unlocked = getUnlockedOptions(state.campaign?.constructedBaseUpgrades ?? []);
    if (!unlocked.gear.includes(action.gearName)) return "Gear not unlocked";
    return null;
  }

  if (player.class === VARUNASTRA_CLASS) {
    if (!action.allyPlayerId) return "Select ally";
    const ally = state.players.find((p) => p.id === action.allyPlayerId);
    if (!ally?.weapon) return "Ally has no weapon";
    if (!action.direction) return "Select attack direction";
    return null;
  }

  if (player.class === CHRYSAOR_CLASS) {
    const enemyId = action.targetEnemyIds?.[0];
    const playerId = action.targetPlayerIds?.[0];
    const hasObstacle = action.x != null && action.y != null;
    const targetCount = (enemyId ? 1 : 0) + (playerId ? 1 : 0) + (hasObstacle ? 1 : 0);
    if (targetCount !== 1) return "Select one creature or obstacle";

    let tx: number;
    let ty: number;
    let losTarget: Player | Enemy | undefined;
    if (enemyId) {
      const enemy = state.enemies.find((e) => e.id === enemyId);
      if (!enemy) return "Unknown enemy";
      tx = enemy.x;
      ty = enemy.y;
      losTarget = enemy;
    } else if (playerId) {
      const targetPlayer = state.players.find((p) => p.id === playerId);
      if (!targetPlayer) return "Unknown player";
      tx = targetPlayer.x;
      ty = targetPlayer.y;
      losTarget = targetPlayer;
    } else {
      const tile = tileAt(state.tiles, action.x!, action.y!);
      if (!tile || !isObstacleTile(tile)) return "Not an obstacle";
      tx = action.x!;
      ty = action.y!;
    }
    if (
      !hasLineOfSight(state, player.x, player.y, tx, ty, {
        viewer: player,
        target: losTarget,
        piercing: unitPiercingStacks(player),
        seeking: unitHasSeeking(player),
      })
    ) {
      return "No line of sight";
    }
    return null;
  }

  return `Unsupported class active: ${kind}`;
}

export function validateClassPassive(
  state: GameState,
  player: Player,
  action: Extract<PlayerAction, { action: "classPassive" }>,
): string | null {
  if (action.kind === "baseline_communism" && player.class === HEPHAESTUS_CLASS) {
    const ally = state.players.find((p) => p.id === action.targetPlayerId);
    if (!ally) return "Unknown ally";
    if (!isOrthogonallyAdjacent(player, ally)) return "Ally must be adjacent";
    if ((player.equipmentUses ?? 0) <= 0) return "No equipment to spend";
    if ((ally.equipmentUses ?? 0) > 0) return "Ally still has equipment";
    return null;
  }
  return "Unknown class passive";
}

export function validateResolveClassReaction(
  state: GameState,
  playerId: string,
  action: Extract<PlayerAction, { action: "resolveClassReaction" }>,
): string | null {
  const reaction = state.combat?.pendingClassReaction;
  if (!reaction) return "No pending reaction";
  if (reaction.playerId !== playerId) return "Not your reaction";
  if (reaction.kind === "harpe_trap_pull") {
    if (action.pullDistance == null || action.pullDistance < 0) return "Invalid pull distance";
    if (!action.pullToward) return "Choose pull direction";
    return null;
  }
  if (reaction.kind === "borrowing_follow_up") {
    if (action.accept === undefined) return "Choose follow-up";
    return null;
  }
  if (reaction.kind === "offhand_pistol_push") {
    if (action.accept === undefined) return "Choose push";
    return null;
  }
  if (reaction.kind === "brand_strip") {
    if (action.accept === false) return null;
    if (action.accept !== true) return "Choose brand strip";
    const hasEnemy = !!action.targetEnemyId;
    const hasPlayer = !!action.targetPlayerId;
    const hasObstacle = action.x != null && action.y != null;
    const count = (hasEnemy ? 1 : 0) + (hasPlayer ? 1 : 0) + (hasObstacle ? 1 : 0);
    if (count !== 1) return "Select one Brand to remove";
    const ok = reaction.candidates.some((c) => {
      if (c.kind === "enemy") return c.id === action.targetEnemyId;
      if (c.kind === "player") return c.id === action.targetPlayerId;
      return c.x === action.x && c.y === action.y;
    });
    if (!ok) return "Not a valid Brand target";
    return null;
  }
  return "Unknown reaction";
}

export function applyClassActive(
  state: GameState,
  playerId: string,
  action: Extract<PlayerAction, { action: "classActive" }>,
): string {
  const player = state.players.find((p) => p.id === playerId)!;
  if (!ensureCombat(state)) return "No combat state";

  if (player.class === HARPE_CLASS) {
    if (action.harpeRecall) {
      return recallHarpeWeapon(state, player, action.harpeEquipWeapon);
    }
    const weaponName = player.weapon!;
    const trap: ThrownTrap = {
      ownerId: player.id,
      weaponName,
      x: action.x!,
      y: action.y!,
      originX: player.x,
      originY: player.y,
    };
    state.combat!.thrownTraps = state.combat!.thrownTraps!.filter((t) => t.ownerId !== player.id);
    state.combat!.thrownTraps!.push(trap);
    player.weapon = undefined;
    return `${playerLabel(player)} threw ${weaponName} to (${trap.x}, ${trap.y})`;
  }

  if (player.class === KOPIS_CLASS) {
    const enemyId = action.targetEnemyIds![0]!;
    const enemy = state.enemies.find((e) => e.id === enemyId)!;
    applyKopisMark(state, player.id, enemyId);
    return `${playerLabel(player)} Mag Dump → marked ${enemyLabel(enemy)}`;
  }

  if (player.class === SHARUR_CLASS) {
    placeAttractor(state, player.id, action.x!, action.y!);
    return `${playerLabel(player)} Back Up → attractor at (${action.x}, ${action.y})`;
  }

  if (player.class === HEPHAESTUS_CLASS) {
    const enemy = state.enemies.find((e) => e.id === action.targetEnemyIds![0])!;
    const roll = rollDice(1, 6)[0]!;
    const dealt = applyDamageToEnemy(enemy, roll, state);
    let msg = `${playerLabel(player)} Synesis Conversion → ${enemyLabel(enemy)} ${dealt}`;
    if (dealt !== roll) msg += ` (rolled ${roll})`;
    if ((enemy.hp ?? 0) <= 0) {
      player.equipmentUses = 1;
      initSabaothCharges(player);
      const tokenMsg = handleEnemyDefeated(state, enemy, player.id);
      msg += "; Equipment restored";
      if (tokenMsg) msg += `; ${tokenMsg}`;
    }
    return msg;
  }

  if (player.class === EPEUS_CLASS) {
    if (action.gearSlot === "weapon") {
      player.gear = action.gearName;
    } else {
      player.gearArmor = action.gearName;
    }
    return `${playerLabel(player)} Bag of Tricks → ${action.gearName}`;
  }

  if (player.class === VARUNASTRA_CLASS) {
    const ally = state.players.find((p) => p.id === action.allyPlayerId)!;
    const borrowedSpec = getWeaponAttackSpec(ally.weapon!);
    if (!borrowedSpec) return "Ally weapon has no attack";
    const ownSpec = resolveCombatAttackSpec(player, player.weapon ?? "");
    const attackSpec = { ...borrowedSpec, damage: ownSpec?.damage ?? borrowedSpec.damage };
    const origin = { x: player.x, y: player.y };
    const anchor =
      action.anchorX != null && action.anchorY != null
        ? { x: action.anchorX, y: action.anchorY }
        : origin;
    const result = applyAttackToEnemies(
      state,
      attackSpec,
      anchor,
      action.direction!,
      undefined,
      { weaponName: player.weapon },
    );
    let msg = `${playerLabel(player)} Borrowing This (${ally.weapon}) → ${result.detail}`;

    if (ownSpec && result.targets.length) {
      const ownTiles = collectAttackTiles(state, anchor, ownSpec, action.direction!);
      const ownTileKeys = new Set(ownTiles.map((t) => coordKey(t.x, t.y)));
      const extraTargets = result.targets.filter((t) => !ownTileKeys.has(coordKey(t.x, t.y)));
      if (extraTargets.length) {
        state.combat!.pendingClassReaction = {
          kind: "borrowing_follow_up",
          playerId: player.id,
          allyPlayerId: action.allyPlayerId!,
          direction: action.direction!,
          anchorX: action.anchorX,
          anchorY: action.anchorY,
          extraEnemyIds: extraTargets.map((t) => t.enemyId),
          maxDamage: maxWeaponDamage(ownSpec.damage),
        };
        msg += `; Support follow-up available (${extraTargets.length})`;
      }
    }
    return msg;
  }

  if (player.class === CHRYSAOR_CLASS) {
    const enemyId = action.targetEnemyIds?.[0];
    const targetPlayerId = action.targetPlayerIds?.[0];
    let brandMsg: string;
    if (enemyId) {
      brandMsg = applySoulBranding(state, player.id, { kind: "enemy", id: enemyId });
    } else if (targetPlayerId) {
      brandMsg = applySoulBranding(state, player.id, { kind: "player", id: targetPlayerId });
    } else {
      brandMsg = applySoulBranding(state, player.id, {
        kind: "obstacle",
        x: action.x!,
        y: action.y!,
      });
    }
    return `${playerLabel(player)} Soul-Branding → ${brandMsg}`;
  }

  return "Class active not implemented";
}

function recallHarpeWeapon(state: GameState, player: Player, equipWeapon?: string): string {
  const trap = getThrownTrap(state, player.id);
  if (!trap) return "No thrown weapon";
  state.combat!.thrownTraps = state.combat!.thrownTraps!.filter((t) => t.ownerId !== player.id);
  if (equipWeapon) {
    if (player.weapon && player.weapon !== equipWeapon) {
      if (!player.weapon2) player.weapon2 = player.weapon;
      else player.weapon2 = player.weapon;
    }
    player.weapon = equipWeapon;
  } else {
    player.weapon = trap.weaponName;
  }
  return `${playerLabel(player)} recalled ${trap.weaponName}`;
}

export function applyClassPassive(
  state: GameState,
  playerId: string,
  action: Extract<PlayerAction, { action: "classPassive" }>,
): string {
  const player = state.players.find((p) => p.id === playerId)!;
  if (action.kind === "baseline_communism") {
    const ally = state.players.find((p) => p.id === action.targetPlayerId)!;
    player.equipmentUses = 0;
    ally.equipmentUses = 1;
    initSabaothCharges(ally);
    return `${playerLabel(player)} Baseline Communism → restored ${playerLabel(ally)} equipment`;
  }
  return "Unknown passive";
}

export function applyResolveClassReaction(
  state: GameState,
  _playerId: string,
  action: Extract<PlayerAction, { action: "resolveClassReaction" }>,
): string {
  const reaction = state.combat!.pendingClassReaction!;
  if (reaction.kind === "borrowing_follow_up") {
    if (action.accept) {
      for (const id of reaction.extraEnemyIds) {
        const enemy = state.enemies.find((e) => e.id === id);
        if (enemy) applyDamageToEnemy(enemy, reaction.maxDamage, state);
      }
      state.combat!.pendingClassReaction = null;
      return `Borrowing follow-up max damage ${reaction.maxDamage} on ${reaction.extraEnemyIds.length}`;
    }
    state.combat!.pendingClassReaction = null;
    return "Borrowing follow-up skipped";
  }
  if (reaction.kind === "offhand_pistol_push") {
    const player = state.players.find((p) => p.id === reaction.playerId)!;
    state.combat!.pendingClassReaction = null;
    if (!action.accept) return "Offhand Pistol push skipped";
    const pushMsg = applyOffhandPistolPush(
      state,
      reaction.originX,
      reaction.originY,
      reaction.enemyIds,
      player.id,
    );
    const defeatMsgs: string[] = [];
    for (const id of reaction.enemyIds) {
      const enemy = state.enemies.find((e) => e.id === id);
      if (enemy && (enemy.hp ?? 1) <= 0) {
        const tokenMsg = handleEnemyDefeated(state, enemy, player.id);
        if (tokenMsg) defeatMsgs.push(tokenMsg);
      }
    }
    let msg = pushMsg ? `Offhand Pistol push — ${pushMsg}` : "Offhand Pistol push — no movement";
    if (defeatMsgs.length) msg += `; ${defeatMsgs.join("; ")}`;
    return msg;
  }
  if (reaction.kind === "brand_strip") {
    state.combat!.pendingClassReaction = null;
    if (!action.accept) return "Brand strip skipped";
    const candidate = reaction.candidates.find((c) => {
      if (c.kind === "enemy") return c.id === action.targetEnemyId;
      if (c.kind === "player") return c.id === action.targetPlayerId;
      return c.x === action.x && c.y === action.y;
    })!;
    return stripOwnedBrand(state, reaction.playerId, candidate);
  }
  const enemy = state.enemies.find((e) => e.id === reaction.enemyId)!;
  const owner = state.players.find((p) => p.id === reaction.trapOwnerId)!;
  const toward =
    action.pullToward === "weapon"
      ? { x: reaction.trapX, y: reaction.trapY }
      : { x: owner.x, y: owner.y };
  const pullMsg = applyPullToward(state, enemy, toward.x, toward.y, action.pullDistance!, {
    kind: "enemy",
  });
  recallHarpeWeapon(state, owner);
  state.combat!.pendingClassReaction = null;
  return `Weapon Trap pull: ${pullMsg}`;
}

export type MovementHookResult = {
  messages: string[];
  interrupt: boolean;
};

export function applyPostMovementHooks(
  state: GameState,
  unit: Player | Enemy,
  kind: "player" | "enemy",
): MovementHookResult {
  const messages: string[] = [];
  let interrupt = false;
  if (!ensureCombat(state)) return { messages, interrupt };

  if (kind === "player") {
    const player = unit as Player;
    if (!player.counters) player.counters = {};
    player.counters.movedThisTurn = 1;

    const tokenIdx = state.combat!.boardTokens!.findIndex(
      (t) => t.ownerId === player.id && t.x === player.x && t.y === player.y,
    );
    if (tokenIdx >= 0) {
      state.combat!.boardTokens!.splice(tokenIdx, 1);
      player.counters.freeWeaponAttack = 1;
      messages.push("Kopis token — free weapon attack");
    }
  }

  const voidMsg = applyVoidTileDefeat(state, unit, kind);
  if (voidMsg) messages.push(voidMsg);

  const hp = unit.hp;
  if (hp === undefined || hp > 0) {
    const attractorMsgs = applyAttractorEntryPulls(state, unit as Player, kind);
    messages.push(...attractorMsgs);
  }

  const trapResult = checkHarpeTrapCrossing(state, unit, unit.x, unit.y, kind);
  if (trapResult) {
    messages.push(trapResult.message);
    if (trapResult.interrupt) interrupt = true;
  }

  return { messages, interrupt };
}

function checkHarpeTrapCrossing(
  state: GameState,
  unit: Player | Enemy,
  stepX: number,
  stepY: number,
  kind: "player" | "enemy",
): { message: string; interrupt: boolean } | null {
  if (kind !== "enemy") return null;
  const enemy = unit as Enemy;
  for (const trap of state.combat?.thrownTraps ?? []) {
    const owner = state.players.find((p) => p.id === trap.ownerId);
    if (!owner) continue;
    if (!hasLineOfSight(state, owner.x, owner.y, trap.x, trap.y, {
      viewer: owner,
      piercing: unitPiercingStacks(owner),
      seeking: unitHasSeeking(owner),
    })) continue;
    const lineTiles = tilesOnCardinalLine(trap.originX, trap.originY, trap.x, trap.y);
    const crossed = lineTiles.some((t) => t.x === stepX && t.y === stepY);
    if (!crossed) continue;

    const spec = getWeaponAttackSpec(trap.weaponName);
    const damage = spec ? maxWeaponDamage(spec.damage) : 0;
    applyDamageToEnemy(enemy, damage, state);
    state.combat!.pendingClassReaction = {
      playerId: trap.ownerId,
      kind: "harpe_trap_pull",
      enemyId: enemy.id,
      trapOwnerId: trap.ownerId,
      weaponName: trap.weaponName,
      trapX: trap.x,
      trapY: trap.y,
      damageDealt: damage,
    };
    return {
      message: `Weapon Trap triggered on ${enemyLabel(enemy)} for ${damage}`,
      interrupt: true,
    };
  }
  return null;
}

export function classActiveTierFor(player: Player): ActionTier {
  return getClassActiveTier(player.class);
}
