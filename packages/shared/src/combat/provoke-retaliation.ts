import type { GameState, Player } from "../types.js";

export type ProvokeRetaliationTrigger = {
  sourceId: string;
  sourceKind: "enemy" | "player";
  label: string;
  dice: number;
};

export type ProvokeRetaliationHandler = (
  state: GameState,
  player: Player,
  triggers: ProvokeRetaliationTrigger[],
  rng?: () => number,
) => string | undefined;

let handler: ProvokeRetaliationHandler | null = null;

export function registerProvokeRetaliationHandler(next: ProvokeRetaliationHandler): void {
  handler = next;
}

export function getProvokeRetaliationHandler(): ProvokeRetaliationHandler | null {
  return handler;
}

export function clearProvokeRetaliationHandler(): void {
  handler = null;
}
