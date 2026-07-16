import type { GameState } from "../types.js";

export type PendingConfirmHandlerContext = {
  state: GameState;
  enemyId: string;
  hoverX: number;
  hoverY: number;
};

export type PendingConfirmHandler = {
  validate: (ctx: PendingConfirmHandlerContext) => string | null;
  apply: (ctx: PendingConfirmHandlerContext) => {
    message: string;
    coords?: { x: number; y: number }[];
  };
};

const handlers = new Map<string, PendingConfirmHandler>();

export function registerPendingConfirmHandler(kind: string, handler: PendingConfirmHandler): void {
  handlers.set(kind, handler);
}

export function getPendingConfirmHandler(kind: string): PendingConfirmHandler | undefined {
  return handlers.get(kind);
}

export function clearPendingConfirmHandlers(): void {
  handlers.clear();
}
