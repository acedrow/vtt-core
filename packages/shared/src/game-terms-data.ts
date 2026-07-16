import { assertContentPackRegistered } from "./content-pack-state.js";

export type GameTerm = {
  id: string;
  summary: string;
  description: string;
};

export const GAME_TERMS: GameTerm[] = [];

const gameTermById = new Map<string, GameTerm>();

export function replaceGameTermsCatalog(terms: GameTerm[]): void {
  GAME_TERMS.length = 0;
  GAME_TERMS.push(...terms);
  gameTermById.clear();
  for (const term of GAME_TERMS) {
    gameTermById.set(term.id.toLowerCase(), term);
  }
}

export function getGameTermByName(name: string): GameTerm | undefined {
  assertContentPackRegistered();
  return gameTermById.get(name.toLowerCase());
}
