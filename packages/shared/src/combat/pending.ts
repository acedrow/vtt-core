import type { AssistedActionKind, AssistedOutcome, PendingAction } from "./types.js";
import type { GameState } from "../types.js";
import { applyEffectStacks, applyEnemyEffectStacks } from "./effects.js";
import { applyDamageToEnemy, applyDamageToPlayer } from "./attack.js";
import { appendCombatSideEffectMessages } from "./agnosia.js";
import { clampHp, getPlayerMaxHp } from "../game.js";

function newPendingId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createPendingAction(
  kind: AssistedActionKind,
  label: string,
  opts?: Partial<Omit<PendingAction, "id" | "kind" | "label" | "createdAt">>,
): PendingAction {
  return {
    id: newPendingId(),
    kind,
    label,
    createdAt: Date.now(),
    ...opts,
  };
}

export function addPendingAction(state: GameState, action: PendingAction): void {
  if (!state.combat) return;
  state.combat.pendingActions.push(action);
}

export function removePendingAction(state: GameState, pendingId: string): PendingAction | null {
  if (!state.combat) return null;
  const idx = state.combat.pendingActions.findIndex((p) => p.id === pendingId);
  if (idx < 0) return null;
  return state.combat.pendingActions.splice(idx, 1)[0] ?? null;
}

export function applyAssistedOutcome(state: GameState, outcome: AssistedOutcome): string | null {
  const pending = removePendingAction(state, outcome.pendingId);
  if (!pending) return "Unknown pending action";
  if (outcome.reject) return `Rejected: ${pending.label}`;

  if (outcome.damageByEnemyId) {
    for (const [enemyId, damage] of Object.entries(outcome.damageByEnemyId)) {
      const enemy = state.enemies.find((e) => e.id === enemyId);
      if (enemy) applyDamageToEnemy(enemy, damage, state);
    }
  }
  if (outcome.damageByPlayerId) {
    for (const [playerId, damage] of Object.entries(outcome.damageByPlayerId)) {
      const player = state.players.find((p) => p.id === playerId);
      if (player) applyDamageToPlayer(player, damage, state);
    }
  }
  if (outcome.healByPlayerId) {
    for (const [playerId, heal] of Object.entries(outcome.healByPlayerId)) {
      const player = state.players.find((p) => p.id === playerId);
      if (!player) continue;
      player.hp = clampHp((player.hp ?? 0) + heal, getPlayerMaxHp(player));
    }
  }
  if (outcome.effectsByEnemyId) {
    for (const [enemyId, effects] of Object.entries(outcome.effectsByEnemyId)) {
      const enemy = state.enemies.find((e) => e.id === enemyId);
      if (enemy) applyEnemyEffectStacks(state, enemy, effects);
    }
  }
  if (outcome.effectsByPlayerId) {
    for (const [playerId, effects] of Object.entries(outcome.effectsByPlayerId)) {
      const player = state.players.find((p) => p.id === playerId);
      if (player) applyEffectStacks(player, effects);
    }
  }
  return appendCombatSideEffectMessages(state, `Applied: ${pending.label}`);
}
