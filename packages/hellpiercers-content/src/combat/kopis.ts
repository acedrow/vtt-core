import type { GameState, Enemy, Player } from "@gaem/shared";
import {
  applyDamageToEnemy,
  applyEnemyEffectStacks,
  enemyLabel,
  getEnemyMaxHpByName,
  removeEffectStacks,
  rollDice,
  type ProvokeRetaliationHandler,
} from "@gaem/shared";
import { isKopisClass } from "./provoke-rules.js";
import { swarmGroupForEnemy } from "./swarm.js";

export const MAG_DUMP_EFFECT = "Mag Dump";

export function ensureKopisCombatFields(state: GameState): boolean {
  if (!state.combat) return false;
  if (!state.combat.boardTokens) state.combat.boardTokens = [];
  if (!state.combat.kopisMarks) state.combat.kopisMarks = {};
  syncKopisMarkEffects(state);
  return true;
}

export function clearKopisMarkEffect(state: GameState, enemyId: string): void {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy) return;
  const group = swarmGroupForEnemy(state, enemyId);
  const ids = group?.memberIds ?? [enemyId];
  for (const id of ids) {
    const member = state.enemies.find((e) => e.id === id);
    if (member) removeEffectStacks(member, [`${MAG_DUMP_EFFECT}:1`]);
  }
}

export function syncKopisMarkEffects(state: GameState): void {
  if (!state.combat?.kopisMarks) return;
  const markedIds = new Set(Object.values(state.combat.kopisMarks));
  const markedMemberIds = new Set<string>();
  for (const enemyId of markedIds) {
    const group = swarmGroupForEnemy(state, enemyId);
    for (const id of group?.memberIds ?? [enemyId]) markedMemberIds.add(id);
  }
  for (const enemy of state.enemies) {
    if ((enemy.effects?.[MAG_DUMP_EFFECT] ?? 0) > 0 && !markedMemberIds.has(enemy.id)) {
      removeEffectStacks(enemy, [`${MAG_DUMP_EFFECT}:1`]);
    }
  }
  for (const enemyId of markedIds) {
    const enemy = state.enemies.find((e) => e.id === enemyId);
    if (enemy) applyEnemyEffectStacks(state, enemy, [`${MAG_DUMP_EFFECT}:1`]);
  }
}

export function applyKopisMark(state: GameState, playerId: string, enemyId: string): void {
  if (!ensureKopisCombatFields(state)) return;
  const prevEnemyId = state.combat!.kopisMarks![playerId];
  if (prevEnemyId && prevEnemyId !== enemyId) {
    clearKopisMarkEffect(state, prevEnemyId);
  }
  state.combat!.kopisMarks![playerId] = enemyId;
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (enemy) applyEnemyEffectStacks(state, enemy, [`${MAG_DUMP_EFFECT}:1`]);
}

export function handleEnemyDefeated(
  state: GameState,
  enemy: Enemy,
  killerPlayerId?: string,
): string | null {
  if (!ensureKopisCombatFields(state)) return null;
  clearKopisMarkEffect(state, enemy.id);

  let tokenMsg: string | null = null;
  if (killerPlayerId) {
    const markEnemyId = state.combat!.kopisMarks?.[killerPlayerId];
    if (markEnemyId === enemy.id) {
      delete state.combat!.kopisMarks![killerPlayerId];
      const tokenId = `kopis-${killerPlayerId}-${enemy.x}-${enemy.y}-${Date.now()}`;
      state.combat!.boardTokens!.push({
        id: tokenId,
        ownerId: killerPlayerId,
        x: enemy.x,
        y: enemy.y,
        kind: "kopis",
      });
      tokenMsg = `Kopis token dropped at (${enemy.x}, ${enemy.y})`;
    }
  }

  for (const [playerId, markedId] of Object.entries(state.combat!.kopisMarks ?? {})) {
    if (markedId === enemy.id) {
      delete state.combat!.kopisMarks![playerId];
    }
  }

  return tokenMsg;
}

function isEnemyAlive(enemy: Enemy): boolean {
  const maxHp = getEnemyMaxHpByName(enemy.name) || 10;
  return (enemy.hp ?? maxHp) > 0;
}

export function applyKopisRetaliation(
  state: GameState,
  player: Player,
  triggers: Array<{ sourceId: string; sourceKind: "enemy" | "player"; label: string; dice: number }>,
  rng = Math.random,
): string | undefined {
  if (!isKopisClass(player.class)) return undefined;
  if (!player.counters?.movedThisTurn) return undefined;
  const enemyTriggers = triggers.filter((t) => t.sourceKind === "enemy");
  if (!enemyTriggers.length) return undefined;

  const parts: string[] = [];
  const pushEligible: string[] = [];
  for (const trigger of enemyTriggers) {
    const enemy = state.enemies.find((e) => e.id === trigger.sourceId);
    if (!enemy || !isEnemyAlive(enemy)) continue;
    const roll = rollDice(1, 6, rng)[0]!;
    const dealt = applyDamageToEnemy(enemy, roll, state);
    let part = `${enemyLabel(enemy)} ${dealt}`;
    if (dealt !== roll) part += ` (rolled ${roll})`;
    if ((enemy.hp ?? 0) <= 0) {
      const tokenMsg = handleEnemyDefeated(state, enemy, player.id);
      if (tokenMsg) part += `; ${tokenMsg}`;
    } else if (dealt >= 4 && isEnemyAlive(enemy)) {
      pushEligible.push(enemy.id);
      part += " (Push:1 available)";
    }
    parts.push(part);
  }
  if (!parts.length) return undefined;
  if (pushEligible.length && !state.combat!.pendingClassReaction) {
    state.combat!.pendingClassReaction = {
      kind: "offhand_pistol_push",
      playerId: player.id,
      enemyIds: pushEligible,
      originX: player.x,
      originY: player.y,
    };
  }
  return `Offhand Pistol → ${parts.join(", ")}`;
}

export const onProvokeRetaliation: ProvokeRetaliationHandler = (
  state,
  player,
  triggers,
  rng = Math.random,
) => applyKopisRetaliation(state, player, triggers, rng);
