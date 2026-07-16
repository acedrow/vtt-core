import type { GameState, MapTile, Player, Enemy } from "../types.js";
import { enemyLabel, playerLabel } from "../console.js";
import { isSandboxMode } from "../game.js";
import { addPendingAction, createPendingAction } from "./pending.js";

export type CountdownContext = {
  state: GameState;
  unit?: Player | Enemy;
  tile?: MapTile;
  kind?: string;
};

export type CountdownHandler = (ctx: CountdownContext) => string[];
export type CountdownKindInferrer = (enemy: Enemy) => string | undefined;

const handlers = new Map<string, CountdownHandler>();
let kindInferrer: CountdownKindInferrer | null = null;

export function registerCountdownHandler(kind: string, handler: CountdownHandler): void {
  handlers.set(kind, handler);
}

export function clearCountdownHandlers(): void {
  handlers.clear();
}

export function registerCountdownKindInferrer(inferrer: CountdownKindInferrer | null): void {
  kindInferrer = inferrer;
}

export function clearCountdownKindInferrer(): void {
  kindInferrer = null;
}

export function inferCountdownKind(unit: Player | Enemy): string | undefined {
  if ("class" in unit) return undefined;
  return kindInferrer?.(unit as Enemy);
}

export function setCountdownKind(state: GameState, unitId: string, kind: string): void {
  if (!state.combat) return;
  if (!state.combat.countdownKinds) state.combat.countdownKinds = {};
  state.combat.countdownKinds[unitId] = kind;
}

export function getCountdownKind(state: GameState, unitId: string): string | undefined {
  return state.combat?.countdownKinds?.[unitId];
}

export function resolveCountdownExpiry(ctx: CountdownContext): string[] {
  const unitId = ctx.unit?.id;
  const kind =
    ctx.kind ??
    (unitId && ctx.state.combat ? getCountdownKind(ctx.state, unitId) : undefined) ??
    (ctx.unit ? inferCountdownKind(ctx.unit) : undefined);
  if (kind && handlers.has(kind)) {
    const result = handlers.get(kind)!(ctx);
    if (unitId && ctx.state.combat?.countdownKinds) {
      delete ctx.state.combat.countdownKinds[unitId];
    }
    return result;
  }
  const label = ctx.unit
    ? "name" in ctx.unit
      ? enemyLabel(ctx.unit as Enemy)
      : playerLabel(ctx.unit as Player)
    : ctx.tile
      ? `tile (${ctx.tile.x}, ${ctx.tile.y})`
      : "unknown";
  addPendingAction(
    ctx.state,
    createPendingAction("enemySpecial", "Countdown expired", {
      detail: `${label} — resolve countdown effect`,
    }),
  );
  return [`Countdown expired (${label}) — pending GM`];
}

export function trackCountdownKinds(state: GameState, unit: Player | Enemy, tokens: string[]): void {
  if (!tokens.some((t) => t.startsWith("Countdown:"))) return;
  const kind = inferCountdownKind(unit);
  if (kind) setCountdownKind(state, unit.id, kind);
}

export function tickRoundCountdowns(state: GameState): string[] {
  const messages: string[] = [];
  if (isSandboxMode(state)) return messages;
  const units: Array<Player | Enemy> = [...state.players, ...state.enemies];
  for (const unit of units) {
    if (!unit.effects?.Countdown) continue;
    const next = unit.effects.Countdown - 1;
    if (next <= 0) {
      delete unit.effects.Countdown;
      messages.push(...resolveCountdownExpiry({ state, unit }));
    } else {
      unit.effects.Countdown = next;
    }
    if (unit.effects && Object.keys(unit.effects).length === 0) delete unit.effects;
  }
  for (const tile of state.tiles) {
    if (!tile.tileEffects?.Countdown) continue;
    const next = tile.tileEffects.Countdown - 1;
    if (next <= 0) {
      delete tile.tileEffects.Countdown;
      messages.push(...resolveCountdownExpiry({ state, tile }));
    } else {
      tile.tileEffects.Countdown = next;
    }
    if (tile.tileEffects && Object.keys(tile.tileEffects).length === 0) delete tile.tileEffects;
  }
  return messages;
}
