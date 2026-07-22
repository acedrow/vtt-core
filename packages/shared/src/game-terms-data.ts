import { assertContentPackRegistered } from "./content-pack-state.js";

export type GameTerm = {
  id: string;
  summary: string;
  description: string;
};

export type GameTermsCatalog = {
  terms: GameTerm[];
  extraEffectNames?: string[];
  literalTerms?: string[];
  literalTermLookup?: Record<string, string>;
};

export const GAME_TERMS: GameTerm[] = [];
export const EXTRA_EFFECT_NAMES: string[] = [];
export const LITERAL_TERMS: string[] = [];
export const LITERAL_TERM_LOOKUP: Record<string, string> = {};

const gameTermById = new Map<string, GameTerm>();

export function replaceGameTermsCatalog(
  termsOrCatalog: GameTerm[] | GameTermsCatalog,
): void {
  const catalog = Array.isArray(termsOrCatalog)
    ? { terms: termsOrCatalog }
    : termsOrCatalog;
  GAME_TERMS.length = 0;
  GAME_TERMS.push(...catalog.terms);
  gameTermById.clear();
  for (const term of GAME_TERMS) {
    gameTermById.set(term.id.toLowerCase(), term);
  }

  EXTRA_EFFECT_NAMES.length = 0;
  EXTRA_EFFECT_NAMES.push(...(catalog.extraEffectNames ?? []));

  LITERAL_TERMS.length = 0;
  LITERAL_TERMS.push(...(catalog.literalTerms ?? []));

  for (const key of Object.keys(LITERAL_TERM_LOOKUP)) {
    delete LITERAL_TERM_LOOKUP[key];
  }
  Object.assign(LITERAL_TERM_LOOKUP, catalog.literalTermLookup ?? {});
}

export function getGameTermByName(name: string): GameTerm | undefined {
  assertContentPackRegistered();
  return gameTermById.get(name.toLowerCase());
}
