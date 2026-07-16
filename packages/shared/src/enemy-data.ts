import { assertContentPackRegistered } from "./content-pack-state.js";
import type { EnemyAttack } from "./combat/types.js";
import type { FactionId } from "./faction-data.js";
import type { Enemy } from "./types.js";

export type EnemyListing = {
  name: string;
  portrait?: string;
  portraitBgExcludeHues?: [number, number][];
  codename?: string;
  title?: string;
  description?: string;
  summary?: string;
  hp: number;
  agnosiaHp?: number;
  crown?: number;
  scale?: number;
  speed?: number;
  actions?: string;
  tags?: string[];
  requiresUpgrade?: string;
  attacks?: EnemyAttack[];
  agnosia?: string;
  special?: string;
  stainwalk?: string;
};

export type EnemyFaction = {
  name: string;
  enemies: EnemyListing[];
};

const ENEMY_FACTIONS: EnemyFaction[] = [];

const ENEMY_LISTING_BY_KEY = new Map<string, EnemyListing>();
const ENEMY_FACTION_BY_KEY = new Map<string, FactionId>();
const PORTRAIT_BG_EXCLUDE_HUES = new Map<string, [number, number][]>();
const ENEMY_LISTINGS_BY_FACTION = new Map<FactionId, EnemyListing[]>();

export function replaceEnemyCatalog(factions: EnemyFaction[]): void {
  ENEMY_FACTIONS.length = 0;
  ENEMY_FACTIONS.push(...factions);
  ENEMY_LISTING_BY_KEY.clear();
  ENEMY_FACTION_BY_KEY.clear();
  PORTRAIT_BG_EXCLUDE_HUES.clear();
  ENEMY_LISTINGS_BY_FACTION.clear();
  for (const faction of ENEMY_FACTIONS) {
    const factionId = faction.name.trim().toLowerCase() as FactionId;
    ENEMY_LISTINGS_BY_FACTION.set(factionId, faction.enemies);
    for (const enemy of faction.enemies) {
      const nameKey = enemy.name.trim().toLowerCase();
      ENEMY_LISTING_BY_KEY.set(nameKey, enemy);
      ENEMY_FACTION_BY_KEY.set(nameKey, factionId);
      if (enemy.codename) {
        const codeKey = enemy.codename.trim().toLowerCase();
        ENEMY_LISTING_BY_KEY.set(codeKey, enemy);
        ENEMY_FACTION_BY_KEY.set(codeKey, factionId);
      }
      if (enemy.portrait && enemy.portraitBgExcludeHues?.length) {
        PORTRAIT_BG_EXCLUDE_HUES.set(enemy.portrait, enemy.portraitBgExcludeHues);
      }
    }
  }
}

export function listEnemyListings(): EnemyListing[] {
  assertContentPackRegistered();
  return ENEMY_FACTIONS.flatMap((faction) => faction.enemies);
}

export function listEnemyFactionIds(): FactionId[] {
  assertContentPackRegistered();
  return ENEMY_FACTIONS.map((faction) => faction.name.trim().toLowerCase() as FactionId);
}

export function listEnemyListingsForFaction(factionId: FactionId): EnemyListing[] {
  assertContentPackRegistered();
  return ENEMY_LISTINGS_BY_FACTION.get(factionId) ?? [];
}

export function factionHasEnemyListings(factionId: FactionId): boolean {
  return listEnemyListingsForFaction(factionId).length > 0;
}

function findEnemyListing(name: string | undefined): EnemyListing | undefined {
  assertContentPackRegistered();
  if (!name) return undefined;
  return ENEMY_LISTING_BY_KEY.get(name.trim().toLowerCase());
}

export function getEnemyListingByName(name: string | undefined): EnemyListing | undefined {
  return findEnemyListing(name);
}

export function getEnemyAttacks(name: string | undefined): EnemyAttack[] {
  return findEnemyListing(name)?.attacks ?? [];
}

export function getEnemyAttack(name: string | undefined, index: number): EnemyAttack | undefined {
  return getEnemyAttacks(name)[index];
}

export function getEnemyFactionId(name: string | undefined): FactionId | undefined {
  assertContentPackRegistered();
  if (!name) return undefined;
  return ENEMY_FACTION_BY_KEY.get(name.trim().toLowerCase());
}

export function getEnemyPortraitUrl(listing: EnemyListing | undefined): string | null {
  if (!listing?.portrait) return null;
  const factionId = getEnemyFactionId(listing.name);
  if (!factionId) return null;
  return `/enemies/${factionId}/${listing.portrait}.png`;
}

export function getPortraitBgExcludeHues(portraitSlug: string | undefined): [number, number][] | undefined {
  assertContentPackRegistered();
  if (!portraitSlug) return undefined;
  return PORTRAIT_BG_EXCLUDE_HUES.get(portraitSlug);
}

export function isFortificationEnemy(enemy: Pick<Enemy, "name">): boolean {
  return findEnemyListing(enemy.name)?.tags?.includes("Fortification") ?? false;
}

export function getEnemyMaxHpByName(name: string | undefined): number {
  return findEnemyListing(name)?.hp ?? 0;
}

export function getEnemyScaleByName(name: string | undefined): number {
  const scale = findEnemyListing(name)?.scale;
  return scale != null && scale >= 1 ? Math.trunc(scale) : 1;
}

export function getEnemyScale(enemy: Pick<Enemy, "scale" | "name">): number {
  if (enemy.scale != null && enemy.scale >= 1) return Math.trunc(enemy.scale);
  return getEnemyScaleByName(enemy.name);
}

export function getEnemySpeedByName(name: string | undefined): number {
  const speed = findEnemyListing(name)?.speed;
  return speed != null && speed >= 0 ? Math.trunc(speed) : 0;
}

export function getEnemySpeed(enemy: Pick<Enemy, "speed" | "name">): number {
  if (enemy.speed != null && enemy.speed >= 0) return Math.trunc(enemy.speed);
  return getEnemySpeedByName(enemy.name);
}

export function refreshEnemyMovement(enemy: Enemy): void {
  const speed = getEnemySpeed(enemy);
  enemy.speed = speed;
  enemy.movementRemaining = speed;
}

export function ensureEnemyMovement(enemy: Enemy): void {
  const speed = getEnemySpeed(enemy);
  enemy.speed = speed;
  if (enemy.movementRemaining === undefined) enemy.movementRemaining = speed;
}

export function spendEnemyMovement(enemy: Enemy, cost: number): boolean {
  ensureEnemyMovement(enemy);
  if ((enemy.movementRemaining ?? 0) < cost) return false;
  enemy.movementRemaining = (enemy.movementRemaining ?? 0) - cost;
  return true;
}

export function enemyFootprintTiles(
  x: number,
  y: number,
  scale: number,
): { x: number; y: number }[] {
  if (scale <= 1) return [{ x, y }];
  const tiles: { x: number; y: number }[] = [];
  for (let dy = 0; dy < scale; dy++) {
    for (let dx = 0; dx < scale; dx++) {
      tiles.push({ x: x + dx, y: y + dy });
    }
  }
  return tiles;
}
