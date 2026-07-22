import type { Enemy, GameState } from "../types.js";
import { enemyLabel } from "../console.js";
import { getEnemyListingByName } from "../enemy-data.js";
import { isSandboxMode } from "../game.js";
import { isInBounds } from "../map.js";
import { swarmGroupForEnemy } from "./swarm.js";

export type AgnosiaHandler = (state: GameState, enemy: Enemy) => string[];

const handlers = new Map<string, AgnosiaHandler>();

export function registerAgnosiaHandler(listingName: string, handler: AgnosiaHandler): void {
  handlers.set(listingName.trim().toLowerCase(), handler);
}

export function clearAgnosiaHandlers(): void {
  handlers.clear();
}

export function getAgnosiaHp(enemy: Pick<Enemy, "name">): number | null {
  const listing = getEnemyListingByName(enemy.name);
  if (listing?.agnosiaHp == null) return null;
  return listing.agnosiaHp;
}

export function agnosiaBoxTiles(
  anchorX: number,
  anchorY: number,
  scale: number,
  boxSize: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const offset = Math.floor((boxSize - scale) / 2);
  return agnosiaPlacementBoxTiles(
    anchorX,
    anchorY,
    scale,
    anchorX - offset,
    anchorY - offset,
    boxSize,
    width,
    height,
  );
}

export function agnosiaCenteredHover(
  anchorX: number,
  anchorY: number,
  scale: number,
  boxSize: number,
): { x: number; y: number } {
  const offset = Math.floor((boxSize - scale) / 2);
  return { x: anchorX - offset, y: anchorY - offset };
}

// NxN containing the full enemy footprint; hover is desired top-left (clamped to valid alignments).
export function agnosiaPlacementBoxTiles(
  anchorX: number,
  anchorY: number,
  scale: number,
  hoverX: number,
  hoverY: number,
  boxSize: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  if (boxSize < 1 || scale < 1) return [];

  const maxOffset = Math.max(0, boxSize - scale);
  const tlx = Math.max(anchorX - maxOffset, Math.min(anchorX, hoverX));
  const tly = Math.max(anchorY - maxOffset, Math.min(anchorY, hoverY));

  const tiles: { x: number; y: number }[] = [];
  for (let dy = 0; dy < boxSize; dy++) {
    for (let dx = 0; dx < boxSize; dx++) {
      const x = tlx + dx;
      const y = tly + dy;
      if (isInBounds(x, y, width, height)) tiles.push({ x, y });
    }
  }
  return tiles;
}

function markAgnosiaTriggered(state: GameState, enemy: Enemy): void {
  const group = swarmGroupForEnemy(state, enemy.id);
  if (group) {
    for (const id of group.memberIds) {
      const member = state.enemies.find((e) => e.id === id);
      if (member) member.agnosiaTriggered = true;
    }
    return;
  }
  enemy.agnosiaTriggered = true;
}

function queueAgnosiaPending(state: GameState, enemy: Enemy, detail: string): void {
  if (!state.combat) return;
  state.combat.pendingActions.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    kind: "enemySpecial",
    label: `${enemyLabel(enemy)} Agnosia`,
    detail,
    actorEnemyId: enemy.id,
    createdAt: Date.now(),
  });
}

export function findAgnosiaPending(state: GameState, enemyId: string) {
  return (
    state.combat?.pendingActions.find(
      (p) => p.kind === "enemySpecial" && p.actorEnemyId === enemyId && p.label.includes("Agnosia"),
    ) ?? null
  );
}

function pushSideEffectMessages(state: GameState, messages: string[]): void {
  if (!messages.length || !state.combat) return;
  if (!state.combat.sideEffectMessages) state.combat.sideEffectMessages = [];
  state.combat.sideEffectMessages.push(...messages);
}

export function takeCombatSideEffectMessages(state: GameState): string[] {
  if (!state.combat?.sideEffectMessages?.length) return [];
  const msgs = state.combat.sideEffectMessages;
  state.combat.sideEffectMessages = [];
  return msgs;
}

export function appendCombatSideEffectMessages(state: GameState, message: string): string {
  const extra = takeCombatSideEffectMessages(state);
  if (!extra.length) return message;
  return `${message}. ${extra.join("; ")}`;
}

export function maybeTriggerAgnosia(state: GameState, enemy: Enemy, hpBefore: number): string[] {
  if (isSandboxMode(state)) return [];
  const threshold = getAgnosiaHp(enemy);
  if (threshold == null) return [];
  if (enemy.agnosiaTriggered) return [];
  const hpAfter = enemy.hp ?? 0;
  if (!(hpBefore > threshold && hpAfter <= threshold)) return [];

  markAgnosiaTriggered(state, enemy);
  const listing = getEnemyListingByName(enemy.name);
  const key = listing?.name.trim().toLowerCase() ?? "";
  const handler = handlers.get(key);
  if (handler) {
    const msgs = handler(state, enemy);
    pushSideEffectMessages(state, msgs);
    return msgs;
  }

  const detail = listing?.agnosia?.trim() || "Resolve Agnosia effect";
  queueAgnosiaPending(state, enemy, detail);
  const msg = `${enemyLabel(enemy)} entered Agnosia (pending GM)`;
  pushSideEffectMessages(state, [msg]);
  return [msg];
}
