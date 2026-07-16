import type { EffectStacks, GameState } from "../types.js";
import { tileAt } from "../map.js";
import { applyBleedBonus, removeEffectStacks } from "./effects.js";

export type DamageTarget = {
  effects?: EffectStacks;
  x?: number;
  y?: number;
};

export type ResolveDamageOpts = {
  damageSpec?: string;
  hitTile?: { x: number; y: number };
  state?: GameState;
  piercing?: boolean;
};

function coverReduction(target: DamageTarget, state: GameState | undefined, hitTile?: { x: number; y: number }): number {
  let cover = target.effects?.Cover ?? 0;
  if (state) {
    const tile = hitTile
      ? tileAt(state.tiles, hitTile.x, hitTile.y)
      : target.x != null && target.y != null
        ? tileAt(state.tiles, target.x, target.y)
        : undefined;
    if (tile?.terrain.includes("cover")) cover += 1;
  }
  return cover;
}

export function resolveDamageAgainstTarget(
  baseDamage: number,
  target: DamageTarget,
  opts?: ResolveDamageOpts,
): number {
  let damage = baseDamage;
  if ((target.effects?.Broken ?? 0) > 0 && opts?.damageSpec) {
    damage = maxWeaponDamage(opts.damageSpec);
  }
  damage = applyBleedBonus(damage, target.effects);
  const armor = target.effects?.Armor ?? 0;
  if (armor > 0) damage -= armor;
  if (!opts?.piercing) {
    const cover = coverReduction(target, opts?.state, opts?.hitTile);
    if (cover > 0) damage -= cover;
  }
  return Math.max(0, damage);
}

export function consumeBrokenStack(target: DamageTarget): void {
  if ((target.effects?.Broken ?? 0) > 0) {
    removeEffectStacks(target, ["Broken:1"]);
  }
}

export function rollDice(count: number, sides: number, rng = Math.random): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(Math.floor(rng() * sides) + 1);
  }
  return rolls;
}

export function parseAndRollDamage(spec: string, rng = Math.random): { total: number; detail: string } {
  const trimmed = spec.trim();
  const match = trimmed.match(/^(\d+)(?:\+(\d+)D(\d+))?$/i);
  if (!match) {
    const fixed = Number(trimmed);
    if (Number.isFinite(fixed)) {
      return { total: fixed, detail: String(fixed) };
    }
    return { total: 0, detail: spec };
  }
  const base = Number(match[1]);
  if (!match[2]) {
    return { total: base, detail: String(base) };
  }
  const count = Number(match[2]);
  const sides = Number(match[3]);
  const rolls = rollDice(count, sides, rng);
  const rollSum = rolls.reduce((a, b) => a + b, 0);
  const total = base + rollSum;
  const detail = `${base}+${rolls.map((r) => `[${r}]`).join("")}=${total}`;
  return { total, detail };
}

export function maxWeaponDamage(spec: string): number {
  const trimmed = spec.trim();
  const match = trimmed.match(/^(\d+)(?:\+(\d+)D(\d+))?$/i);
  if (!match) {
    const fixed = Number(trimmed);
    return Number.isFinite(fixed) ? fixed : 0;
  }
  const base = Number(match[1]);
  if (!match[2]) return base;
  const count = Number(match[2]);
  const sides = Number(match[3]);
  return base + count * sides;
}

export function minWeaponDamage(spec: string): number {
  const trimmed = spec.trim();
  const match = trimmed.match(/^(\d+)(?:\+(\d+)D(\d+))?$/i);
  if (!match) {
    const fixed = Number(trimmed);
    return Number.isFinite(fixed) ? fixed : 0;
  }
  const base = Number(match[1]);
  if (!match[2]) return base;
  return base + Number(match[2]);
}
