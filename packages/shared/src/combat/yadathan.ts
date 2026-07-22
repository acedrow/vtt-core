import type { Enemy, GameState, Player, TerrainObject } from "../types.js";
import { combatMod } from "../combat-modules.js";

type YadathanModule = {
  isYadathanArmorName: (name: string | undefined | null) => boolean;
  isTowerEnemy: (enemy: Enemy) => boolean;
  getPlayerTower: (state: GameState, playerId: string) => Enemy | undefined;
  getSeedAt: (state: GameState, x: number, y: number) => TerrainObject | undefined;
  validatePlaceTower: (
    state: GameState,
    player: Player,
    x: number,
    y: number,
    range: number,
  ) => string | null;
  applyPlaceTower: (
    state: GameState,
    player: Player,
    x: number,
    y: number,
  ) => { message: string; towerName: string } | { error: string };
  validateTowerTeleport: (
    state: GameState,
    player: Player,
    x: number,
    y: number,
    keraunoTargetEnemyId?: string,
  ) => string | null;
  applyTowerTeleport: (
    state: GameState,
    player: Player,
    x: number,
    y: number,
    keraunoTargetEnemyId?: string,
  ) => string;
  resolveKataptyTargetIds: (
    state: GameState,
    playerId: string,
    selectedIds?: string[],
  ) => { ids: string[] } | { error: string };
  applyKataptyStrike: (state: GameState, tower: Enemy, targetIds: string[]) => string;
  validateSeedInteract: (state: GameState, player: Player) => string | null;
  applySeedInteract: (state: GameState, player: Player) => string | null;
  yadathanReversalEligible: (state: GameState, playerId: string) => boolean;
  applyYadathanReversal: (
    state: GameState,
    player: Player,
    incomingDamage: number,
    extraLines?: { allyId: string; anchor?: "tower" }[],
  ) => string;
  kataptyNeedsTargetPick: (state: GameState, playerId: string) => boolean;
  validateKataptyEndTurn: (
    state: GameState,
    player: Player,
    targetEnemyIds?: string[],
  ) => string | null;
};

function yadathan(): YadathanModule {
  return combatMod("yadathan") as YadathanModule;
}

export function isYadathanArmorName(name: string | undefined | null): boolean {
  return yadathan().isYadathanArmorName(name);
}

export function isTowerEnemy(enemy: Enemy): boolean {
  return yadathan().isTowerEnemy(enemy);
}

export function getPlayerTower(state: GameState, playerId: string): Enemy | undefined {
  return yadathan().getPlayerTower(state, playerId);
}

export function getSeedAt(state: GameState, x: number, y: number): TerrainObject | undefined {
  return yadathan().getSeedAt(state, x, y);
}

export function validatePlaceTower(
  state: GameState,
  player: Player,
  x: number,
  y: number,
  range: number,
): string | null {
  return yadathan().validatePlaceTower(state, player, x, y, range);
}

export function applyPlaceTower(
  state: GameState,
  player: Player,
  x: number,
  y: number,
): { message: string; towerName: string } | { error: string } {
  return yadathan().applyPlaceTower(state, player, x, y);
}

export function validateTowerTeleport(
  state: GameState,
  player: Player,
  x: number,
  y: number,
  keraunoTargetEnemyId?: string,
): string | null {
  return yadathan().validateTowerTeleport(state, player, x, y, keraunoTargetEnemyId);
}

export function applyTowerTeleport(
  state: GameState,
  player: Player,
  x: number,
  y: number,
  keraunoTargetEnemyId?: string,
): string {
  return yadathan().applyTowerTeleport(state, player, x, y, keraunoTargetEnemyId);
}

export function resolveKataptyTargetIds(
  state: GameState,
  playerId: string,
  selectedIds?: string[],
): { ids: string[] } | { error: string } {
  return yadathan().resolveKataptyTargetIds(state, playerId, selectedIds);
}

export function applyKataptyStrike(
  state: GameState,
  tower: Enemy,
  targetIds: string[],
): string {
  return yadathan().applyKataptyStrike(state, tower, targetIds);
}

export function validateSeedInteract(state: GameState, player: Player): string | null {
  return yadathan().validateSeedInteract(state, player);
}

export function applySeedInteract(state: GameState, player: Player): string | null {
  return yadathan().applySeedInteract(state, player);
}

export function yadathanReversalEligible(state: GameState, playerId: string): boolean {
  return yadathan().yadathanReversalEligible(state, playerId);
}

export function applyYadathanReversal(
  state: GameState,
  player: Player,
  incomingDamage: number,
  extraLines?: { allyId: string; anchor?: "tower" }[],
): string {
  return yadathan().applyYadathanReversal(state, player, incomingDamage, extraLines);
}

export function kataptyNeedsTargetPick(state: GameState, playerId: string): boolean {
  return yadathan().kataptyNeedsTargetPick(state, playerId);
}

export function validateKataptyEndTurn(
  state: GameState,
  player: Player,
  targetEnemyIds?: string[],
): string | null {
  return yadathan().validateKataptyEndTurn(state, player, targetEnemyIds);
}
