import type { BoardCoord } from "../patterns.js";
import type { GameState, Player } from "../types.js";
import { combatMod } from "../combat-modules.js";

export type AssistedLaunchAnchor = {
  x: number;
  y: number;
  kind: "impassable" | "obstacle" | "edge" | "ally";
  allyId?: string;
};

export type AssistedLaunchResult = {
  path: BoardCoord[];
  landing: BoardCoord;
};

type AssistedLaunchModule = {
  KUSHIEL_ARMOR_NAME: string;
  isKushielArmorName: (name: string | undefined | null) => boolean;
  computeAssistedLaunch: (
    state: GameState,
    playerId: string,
    anchorX: number,
    anchorY: number,
  ) => AssistedLaunchResult | null;
  assistedLaunchAnchors: (state: GameState, playerId: string) => AssistedLaunchAnchor[];
  canUseAssistedLaunch: (state: GameState, playerId: string) => boolean;
  validateAssistedLaunch: (
    state: GameState,
    playerId: string,
    anchorX: number,
    anchorY: number,
  ) => string | null;
  applyAssistedLaunch: (
    state: GameState,
    playerId: string,
    anchorX: number,
    anchorY: number,
  ) => { landing: BoardCoord; path: BoardCoord[] };
  formatAssistedLaunchMessage: (player: Player, result: AssistedLaunchResult) => string;
};

function assistedLaunch(): AssistedLaunchModule {
  return combatMod("assistedLaunch") as AssistedLaunchModule;
}

export const KUSHIEL_ARMOR_NAME = "KUSHIEL";

export function isKushielArmorName(name: string | undefined | null): boolean {
  return assistedLaunch().isKushielArmorName(name);
}

export function computeAssistedLaunch(
  state: GameState,
  playerId: string,
  anchorX: number,
  anchorY: number,
): AssistedLaunchResult | null {
  return assistedLaunch().computeAssistedLaunch(state, playerId, anchorX, anchorY);
}

export function assistedLaunchAnchors(state: GameState, playerId: string): AssistedLaunchAnchor[] {
  return assistedLaunch().assistedLaunchAnchors(state, playerId);
}

export function canUseAssistedLaunch(state: GameState, playerId: string): boolean {
  return assistedLaunch().canUseAssistedLaunch(state, playerId);
}

export function validateAssistedLaunch(
  state: GameState,
  playerId: string,
  anchorX: number,
  anchorY: number,
): string | null {
  return assistedLaunch().validateAssistedLaunch(state, playerId, anchorX, anchorY);
}

export function applyAssistedLaunch(
  state: GameState,
  playerId: string,
  anchorX: number,
  anchorY: number,
): { landing: BoardCoord; path: BoardCoord[] } {
  return assistedLaunch().applyAssistedLaunch(state, playerId, anchorX, anchorY);
}

export function formatAssistedLaunchMessage(
  player: Player,
  result: AssistedLaunchResult,
): string {
  return assistedLaunch().formatAssistedLaunchMessage(player, result);
}
