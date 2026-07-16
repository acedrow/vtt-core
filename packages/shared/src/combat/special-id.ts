import type { Enemy, GameState } from "../types.js";
import type { EnemyAttackSpec, GmEnemyAction } from "./types.js";

export type SpecialIdHandlerContext = {
  state: GameState;
  enemy: Enemy;
  action: GmEnemyAction;
  attackSpec: EnemyAttackSpec;
};

export type SpecialIdHandler = {
  validate: (ctx: SpecialIdHandlerContext) => string | null;
  apply: (ctx: SpecialIdHandlerContext) => string;
};

const handlers = new Map<string, SpecialIdHandler>();

export function registerSpecialIdHandler(id: string, handler: SpecialIdHandler): void {
  handlers.set(id, handler);
}

export function getSpecialIdHandler(id: string | undefined): SpecialIdHandler | undefined {
  if (!id) return undefined;
  return handlers.get(id);
}

export function hasSpecialIdHandler(id: string | undefined): boolean {
  return getSpecialIdHandler(id) != null;
}

export function clearSpecialIdHandlers(): void {
  handlers.clear();
}
