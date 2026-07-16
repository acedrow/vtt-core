import type { Player } from "../types.js";
import { clampHp, getPlayerMaxHp } from "../game.js";

export function applyTransferenceHeal(attacker: Player, damageDealt: number): string | null {
  if (damageDealt <= 0) return null;
  const stacks = attacker.effects?.Transference ?? 0;
  if (stacks <= 0) return null;
  const maxHp = getPlayerMaxHp(attacker);
  const before = attacker.hp ?? maxHp;
  attacker.hp = clampHp(before + damageDealt, maxHp);
  return `Transference +${damageDealt} HP`;
}
