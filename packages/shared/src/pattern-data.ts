import { assertContentPackRegistered } from "./content-pack-state.js";

export type PatternKind = "fixed" | "drawable";
export type ModifierKind = "modifier";
export type PatternDirection = "n" | "e" | "s" | "w";
export type PatternOrigin = "self";

export const PATTERN_DIRECTIONS: PatternDirection[] = ["n", "e", "s", "w"];

export type PatternSizeBounds = {
  min: number;
  max: number;
  default: number;
};

export type TargetingPattern = {
  id: string;
  name: string;
  description: string;
  kind: PatternKind;
  origin: PatternOrigin;
  directional: boolean;
  size: PatternSizeBounds;
  adjacency?: "orthogonal";
  metric?: "chebyshev";
  includesOrigin?: boolean;
  defaultRange?: number;
  lopsided?: boolean;
};

export type PatternModifier = {
  id: string;
  name: string;
  description: string;
  size: PatternSizeBounds;
  standalone?: boolean;
  requiresDirection?: boolean;
  appliesTo?: string[];
};

export type PatternModifierValues = {
  range: number;
  width: number;
  recoil: number;
};

export const TARGETING_PATTERNS: TargetingPattern[] = [];
export const PATTERN_MODIFIERS: PatternModifier[] = [];

const patternById = new Map<string, TargetingPattern>();
const modifierById = new Map<string, PatternModifier>();

export const DEFAULT_MODIFIER_VALUES: PatternModifierValues = {
  range: 0,
  width: 0,
  recoil: 0,
};

export function replacePatternCatalog(input: {
  patterns: TargetingPattern[];
  modifiers: PatternModifier[];
}): void {
  TARGETING_PATTERNS.length = 0;
  PATTERN_MODIFIERS.length = 0;
  TARGETING_PATTERNS.push(...input.patterns);
  PATTERN_MODIFIERS.push(...input.modifiers);
  patternById.clear();
  modifierById.clear();
  for (const pattern of TARGETING_PATTERNS) patternById.set(pattern.id, pattern);
  for (const modifier of PATTERN_MODIFIERS) modifierById.set(modifier.id, modifier);
}

export function getPatternById(id: string): TargetingPattern | undefined {
  assertContentPackRegistered();
  return patternById.get(id);
}

export function getModifierById(id: string): PatternModifier | undefined {
  assertContentPackRegistered();
  return modifierById.get(id);
}

export function findPatternByName(name: string): TargetingPattern | undefined {
  assertContentPackRegistered();
  const lower = name.toLowerCase();
  return TARGETING_PATTERNS.find(
    (pattern) => pattern.id.toLowerCase() === lower || pattern.name.toLowerCase() === lower,
  );
}

export function findModifierByName(name: string): PatternModifier | undefined {
  assertContentPackRegistered();
  const lower = name.toLowerCase();
  return PATTERN_MODIFIERS.find(
    (modifier) => modifier.id.toLowerCase() === lower || modifier.name.toLowerCase() === lower,
  );
}

export function clampPatternSize(pattern: TargetingPattern, size: number): number {
  return Math.max(pattern.size.min, Math.min(pattern.size.max, size));
}

export function clampModifierSize(modifier: PatternModifier, size: number): number {
  return Math.max(modifier.size.min, Math.min(modifier.size.max, size));
}

export function nextPatternDirection(current: PatternDirection): PatternDirection {
  const idx = PATTERN_DIRECTIONS.indexOf(current);
  return PATTERN_DIRECTIONS[(idx + 1) % PATTERN_DIRECTIONS.length];
}
