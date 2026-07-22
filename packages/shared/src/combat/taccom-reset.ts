import type { GameMap, GameState, Player } from "../types.js";
import { getEffectiveEnemyMaxHp, getPlayerMaxHp } from "../game.js";
import { getArmorByName } from "../player-data.js";
import { applyResetToStartingState } from "../map.js";
import { initHeavenBurningLevel, initSabaothCharges } from "./attack.js";
import { clearAnnihilationCorridorTileEffects, clearEquipmentTerrainSnapshots } from "./content-modules-api.js";
import { createDefaultCombatState } from "./types.js";
import { isTowerEnemy } from "./content-modules-api.js";

export function resetUnitCombatState(player: Player): void {
  const maxHp = getPlayerMaxHp(player);
  if (maxHp > 0) player.hp = maxHp;
  delete player.effects;
  delete player.actionBudget;
  delete player.hasteActionTier;
  delete player.turnStartX;
  delete player.turnStartY;
  player.equipmentUses = 1;
  const armor = getArmorByName(player.armor ?? "");
  if (armor?.reversal?.charges != null) {
    player.reversalCharges = armor.reversal.charges;
  } else {
    delete player.reversalCharges;
  }
  player.counters = {};
  initSabaothCharges(player);
  initHeavenBurningLevel(player);
}

export function resetAllPlayersForTaccom(state: GameState): void {
  for (const player of state.players) {
    resetUnitCombatState(player);
  }
}

export function resetEnemiesForTaccomExit(state: GameState, opts?: { removeEnemies?: boolean }): void {
  if (opts?.removeEnemies) {
    state.enemies = state.enemies.filter((e) => isTowerEnemy(e));
  }
  for (const enemy of state.enemies) {
    delete enemy.effects;
    delete enemy.exhausted;
    delete enemy.movementRemaining;
    delete enemy.agnosiaTriggered;
    delete enemy.burrowed;
    const maxHp = getEffectiveEnemyMaxHp(enemy, state);
    if (maxHp > 0) enemy.hp = maxHp;
  }
}

function clearCombatCounters(state: GameState): void {
  if (!state.combat) return;
  state.combat.pendingActions = [];
  state.combat.pendingReaction = null;
  state.combat.pendingClassReaction = null;
  state.combat.activeEnemyId = null;
  state.combat.swarmChipResolvedIds = [];
  state.combat.thrownTraps = [];
  state.combat.boardTokens = [];
  state.combat.attractors = [];
  state.combat.attractorPulledEnemyIds = [];
  state.combat.gearCheckGrants = {};
  state.combat.marks = {};
  state.combat.brands = {};
  state.combat.kopisMarks = {};
  state.combat.chrysaorBrands = {};
  state.combat.pack = {};
  state.combat.countdownKinds = {};
  delete state.combat.passedEnemyIdsByPlayer;
}

export function enterTaccom(state: GameState): void {
  if (!state.combat) {
    state.combat = createDefaultCombatState(state.players.length);
  } else {
    state.combat.playerCountAtStart = state.players.length;
    clearCombatCounters(state);
  }
  state.actedPlayerIds = [];
  state.turnLog = [];
  resetAllPlayersForTaccom(state);
  for (const player of state.players) {
    if (player.speed == null) {
      const armor = getArmorByName(player.armor ?? "");
      player.speed = armor?.speed ?? 4;
    }
  }
}

export function exitTaccom(state: GameState, opts?: { removeEnemies?: boolean }): void {
  resetAllPlayersForTaccom(state);
  resetEnemiesForTaccomExit(state, opts);
  clearAnnihilationCorridorTileEffects(state);
  clearEquipmentTerrainSnapshots(state);
  state.round = 1;
  state.roundPhase = "taccomNotStarted";
  state.turn = { role: "gm" };
  state.actedPlayerIds = [];
  state.turnLog = [];
  state.damageEvents = [];
  if (state.combat) clearCombatCounters(state);
}

export function resetTaccomEncounter(state: GameState, map?: GameMap): void {
  exitTaccom(state, { removeEnemies: false });
  if (map?.startingState) applyResetToStartingState(state, map);
  // After optional snapshot restore, normalize combat currencies again.
  resetEnemiesForTaccomExit(state, { removeEnemies: false });
  enterTaccom(state);
}
