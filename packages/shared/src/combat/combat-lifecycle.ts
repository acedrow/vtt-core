import type { Enemy, GameState, Player } from "../types.js";

export type CombatLifecycleHooks = {
  onPlayerEndOfTurn?: (state: GameState, player: Player) => string[];
  onGmTurnEnd?: (state: GameState) => string[];
  onEnemyAdded?: (state: GameState, enemy: Enemy) => void;
  onEnemyRemoved?: (state: GameState, removed: Enemy[]) => void;
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
  onAfterGmPaintTile?: (
    state: GameState,
    x: number,
    y: number,
    fields: { tileEffects?: string[]; overlayKey?: string | null },
  ) => void;
  onEnemyMoved?: (state: GameState, enemy: Enemy, fromX: number, fromY: number) => void;
  movementBlockReason?: (state: GameState, unit: Player | Enemy) => string | null | undefined;
  tryPlayerInteract?: (state: GameState, player: Player) => string | null | undefined;
  onUnitDamaged?: (state: GameState, unit: Player | Enemy, dealt: number) => string[];
  pushBlockReason?: (state: GameState, unit: Player | Enemy) => string | null | undefined;
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

export function runEnemyRemoved(state: GameState, removed: Enemy[]): void {
  if (!removed.length) return;
  hooks.onEnemyRemoved?.(state, removed);
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

export function runAfterGmPaintTile(
  state: GameState,
  x: number,
  y: number,
  fields: { tileEffects?: string[]; overlayKey?: string | null },
): void {
  hooks.onAfterGmPaintTile?.(state, x, y, fields);
}

export function runEnemyMoved(
  state: GameState,
  enemy: Enemy,
  fromX: number,
  fromY: number,
): void {
  hooks.onEnemyMoved?.(state, enemy, fromX, fromY);
}

export function runMovementBlockReason(
  state: GameState,
  unit: Player | Enemy,
): string | null {
  return hooks.movementBlockReason?.(state, unit) ?? null;
}

export function runPushBlockReason(state: GameState, unit: Player | Enemy): string | null {
  return hooks.pushBlockReason?.(state, unit) ?? null;
}

export function runTryPlayerInteract(state: GameState, player: Player): string | null {
  return hooks.tryPlayerInteract?.(state, player) ?? null;
}

export function runUnitDamaged(
  state: GameState,
  unit: Player | Enemy,
  dealt: number,
): void {
  if (dealt <= 0) return;
  const msgs = hooks.onUnitDamaged?.(state, unit, dealt) ?? [];
  if (!msgs.length || !state.combat) return;
  if (!state.combat.sideEffectMessages) state.combat.sideEffectMessages = [];
  state.combat.sideEffectMessages.push(...msgs);
}
