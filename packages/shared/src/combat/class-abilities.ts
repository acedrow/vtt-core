import type { Enemy, GameState, Player } from "../types.js";
import { combatMod } from "../combat-modules.js";
import type { ActionTier, PlayerAction } from "./types.js";

type PackAction = Extract<PlayerAction, { action: "pack" }>;
type ResolveClassReactionAction = Extract<PlayerAction, { action: "resolveClassReaction" }>;

export type MovementHookResult = {
  messages: string[];
  interrupt: boolean;
};

type ClassAbilitiesModule = {
  validateClassActive: (state: GameState, player: Player, action: PackAction) => string | null;
  validateClassPassive: (state: GameState, player: Player, action: PackAction) => string | null;
  validateResolveClassReaction: (
    state: GameState,
    playerId: string,
    action: ResolveClassReactionAction,
  ) => string | null;
  applyClassActive: (state: GameState, playerId: string, action: PackAction) => string;
  applyClassPassive: (state: GameState, playerId: string, action: PackAction) => string;
  applyResolveClassReaction: (
    state: GameState,
    playerId: string,
    action: ResolveClassReactionAction,
  ) => string;
  applyPostMovementHooks: (
    state: GameState,
    unit: Player | Enemy,
    kind: "player" | "enemy",
  ) => MovementHookResult;
  classActiveTierFor: (player: Player) => ActionTier;
};

function classAbilities(): ClassAbilitiesModule {
  return combatMod("classAbilities") as ClassAbilitiesModule;
}

export function validateClassActive(
  state: GameState,
  player: Player,
  action: PackAction,
): string | null {
  return classAbilities().validateClassActive(state, player, action);
}

export function validateClassPassive(
  state: GameState,
  player: Player,
  action: PackAction,
): string | null {
  return classAbilities().validateClassPassive(state, player, action);
}

export function validateResolveClassReaction(
  state: GameState,
  playerId: string,
  action: ResolveClassReactionAction,
): string | null {
  return classAbilities().validateResolveClassReaction(state, playerId, action);
}

export function applyClassActive(
  state: GameState,
  playerId: string,
  action: PackAction,
): string {
  return classAbilities().applyClassActive(state, playerId, action);
}

export function applyClassPassive(
  state: GameState,
  playerId: string,
  action: PackAction,
): string {
  return classAbilities().applyClassPassive(state, playerId, action);
}

export function applyResolveClassReaction(
  state: GameState,
  playerId: string,
  action: ResolveClassReactionAction,
): string {
  return classAbilities().applyResolveClassReaction(state, playerId, action);
}

export function applyPostMovementHooks(
  state: GameState,
  unit: Player | Enemy,
  kind: "player" | "enemy",
): MovementHookResult {
  return classAbilities().applyPostMovementHooks(state, unit, kind);
}

export function classActiveTierFor(player: Player): ActionTier {
  return classAbilities().classActiveTierFor(player);
}
