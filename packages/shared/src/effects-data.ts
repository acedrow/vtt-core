import { assertContentPackRegistered } from "./content-pack-state.js";

export type EffectStacking = "add" | "max";

export type RuleEffect = {
  id: string;
  summary: string;
  description: string;
  stacking?: EffectStacking;
  icon: string;
  iconFill?: boolean;
  displayName?: string;
  presenceOnly?: boolean;
};

export const UNIT_EFFECTS: RuleEffect[] = [];
export const WEAPON_EFFECTS: RuleEffect[] = [];
export const TILE_EFFECTS: RuleEffect[] = [];
export const RULE_EFFECTS: RuleEffect[] = [];

const effectById = new Map<string, RuleEffect>();
const effectIds = new Set<string>();

function rebuildEffectIndexes(): void {
  effectById.clear();
  effectIds.clear();
  RULE_EFFECTS.length = 0;
  const unitEffectIds = new Set(UNIT_EFFECTS.map((e) => e.id));
  RULE_EFFECTS.push(
    ...UNIT_EFFECTS,
    ...WEAPON_EFFECTS.filter((e) => !unitEffectIds.has(e.id)),
    ...TILE_EFFECTS.filter((e) => !unitEffectIds.has(e.id)),
  );
  for (const effect of TILE_EFFECTS) effectById.set(effect.id, effect);
  for (const effect of WEAPON_EFFECTS) effectById.set(effect.id, effect);
  for (const effect of UNIT_EFFECTS) effectById.set(effect.id, effect);
  for (const effect of [...UNIT_EFFECTS, ...WEAPON_EFFECTS, ...TILE_EFFECTS]) {
    effectIds.add(effect.id);
  }
}

export function replaceEffectsCatalog(input: {
  unitEffects: RuleEffect[];
  weaponEffects: RuleEffect[];
  tileEffects: RuleEffect[];
}): void {
  UNIT_EFFECTS.length = 0;
  WEAPON_EFFECTS.length = 0;
  TILE_EFFECTS.length = 0;
  UNIT_EFFECTS.push(...input.unitEffects);
  WEAPON_EFFECTS.push(...input.weaponEffects);
  TILE_EFFECTS.push(...input.tileEffects);
  rebuildEffectIndexes();
}

export function tileEffectDisplayName(id: string): string {
  return effectById.get(id)?.displayName ?? id;
}

export function tileEffectShowsStackCount(id: string): boolean {
  return !effectById.get(id)?.presenceOnly;
}

export function formatTileEffectTooltipLabel(id: string, stacks: number): string {
  const name = tileEffectDisplayName(id);
  if (!tileEffectShowsStackCount(id)) return name;
  return stacks > 1 ? `${name}: ${stacks}` : name;
}

export function getEffectById(id: string): RuleEffect | undefined {
  assertContentPackRegistered();
  return effectById.get(id);
}

export function findEffectByName(name: string): RuleEffect | undefined {
  assertContentPackRegistered();
  const exact = effectById.get(name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return RULE_EFFECTS.find((effect) => effect.id.toLowerCase() === lower);
}

export function getEffectSummary(effectId: string): string | undefined {
  assertContentPackRegistered();
  return effectById.get(effectId)?.summary;
}

export function getEffectStacking(effectId: string): EffectStacking {
  assertContentPackRegistered();
  return effectById.get(effectId)?.stacking ?? "add";
}

export function isKnownEffectId(effectId: string): boolean {
  assertContentPackRegistered();
  return effectIds.has(effectId);
}
