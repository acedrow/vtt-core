import type { Enemy, GameState, Player } from "../types.js";

export type CombatLifecycleHooks = {
  onPlayerEndOfTurn?: (state: GameState, player: Player) => string[];
  onGmTurnEnd?: (state: GameState) => string[];
  onEnemyAdded?: (state: GameState, enemy: Enemy) => void;
  onEnemyRoundReset?: (state: GameState, enemy: Enemy) => void;
  onEnemyDamageAdjustment?: (state: GameState, enemy: Enemy) => number;
  onEnemyDefeated?: (
    state: GameState,
    enemy: Enemy,
    killerPlayerId?: string,
  ) => string | null;
  getEnemyMaxHpOverride?: (enemy: Enemy) => number | null | undefined;
  isPersistentEnemy?: (enemy: Enemy) => boolean;
  onRoundAdvance?: (state: GameState) => void;
};

let hooks: CombatLifecycleHooks = {};

export function replaceCombatLifecycleHooks(next: CombatLifecycleHooks): void {
  hooks = { ...next };
}

export function clearCombatLifecycleHooks(): void {
  hooks = {};
}

export function getCombatLifecycleHooks(): CombatLifecycleHooks {
  return hooks;
}

export function runPlayerEndOfTurn(state: GameState, player: Player): string[] {
  return hooks.onPlayerEndOfTurn?.(state, player) ?? [];
}

export function runGmTurnEnd(state: GameState): string[] {
  return hooks.onGmTurnEnd?.(state) ?? [];
}

export function runEnemyAdded(state: GameState, enemy: Enemy): void {
  hooks.onEnemyAdded?.(state, enemy);
}

export function runEnemyRoundReset(state: GameState, enemy: Enemy): void {
  hooks.onEnemyRoundReset?.(state, enemy);
}

export function runEnemyDamageAdjustment(state: GameState, enemy: Enemy): number {
  return hooks.onEnemyDamageAdjustment?.(state, enemy) ?? 0;
}

export function runEnemyDefeated(
  state: GameState,
  enemy: Enemy,
  killerPlayerId?: string,
): string | null {
  return hooks.onEnemyDefeated?.(state, enemy, killerPlayerId) ?? null;
}

export function runEnemyMaxHpOverride(enemy: Enemy): number | null | undefined {
  return hooks.getEnemyMaxHpOverride?.(enemy);
}

export function runIsPersistentEnemy(enemy: Enemy): boolean {
  return hooks.isPersistentEnemy?.(enemy) ?? false;
}

export function runRoundAdvance(state: GameState): void {
  hooks.onRoundAdvance?.(state);
}
