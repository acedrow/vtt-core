import type { GameState, Player } from "../types.js";
import type { PlayerAction } from "./types.js";

export type WeaponActiveAction = Extract<PlayerAction, { action: "weaponActive" }>;

export type WeaponActiveHandler = {
  id: string;
  match: (player: Player, action: WeaponActiveAction) => boolean;
  validate: (state: GameState, player: Player, action: WeaponActiveAction) => string | null;
  apply: (state: GameState, player: Player, action: WeaponActiveAction) => string;
};

let handlers: WeaponActiveHandler[] = [];

export function replaceWeaponActiveHandlers(next: WeaponActiveHandler[]): void {
  handlers = next.slice();
}

export function clearWeaponActiveHandlers(): void {
  handlers = [];
}

export function getWeaponActiveHandlers(): WeaponActiveHandler[] {
  return handlers;
}

export function findWeaponActiveHandler(
  player: Player,
  action: WeaponActiveAction,
): WeaponActiveHandler | null {
  return handlers.find((h) => h.match(player, action)) ?? null;
}
