import { getRegionFactionId } from "./campaign-registry.js";
import { assertContentPackRegistered } from "./content-pack-state.js";

export type FactionId = string;

export type FactionQualityDots = {
  force: number;
  subterfuge: number;
  territory: number;
  assets: number;
};

export type FactionLocation = {
  name: string;
  description: string;
  type?: string;
  purpose?: string;
  terrain?: string;
  defenses?: string;
  quality?: Partial<FactionQualityDots>;
  buildTime?: number;
  requires?: string;
};

export type FactionStratcomAction = {
  name: string;
  flavor?: string;
  description: string;
  crownCost?: number;
  requires?: string;
};

export type FactionUpgrade = {
  name: string;
  flavor?: string;
  ichorCost: number;
  effect: string;
  requires?: string;
};

export type FactionListing = {
  id: FactionId;
  name: string;
  tagline: string;
  crown: number;
  description: string;
  qualities: FactionQualityDots;
  uniqueMechanics?: { name: string; effect: string }[];
  startingLocations: FactionLocation[];
  uniqueLocations: FactionLocation[];
  stratcomActions: FactionStratcomAction[];
  upgrades: FactionUpgrade[];
};

export const FACTION_QUALITY_KEYS: (keyof FactionQualityDots)[] = [
  "force",
  "subterfuge",
  "territory",
  "assets",
];

export const FACTIONS: FactionListing[] = [];

const FACTION_BY_ID = new Map<FactionId, FactionListing>();

export function replaceFactionCatalog(factions: FactionListing[]): void {
  FACTIONS.length = 0;
  FACTIONS.push(...factions);
  FACTION_BY_ID.clear();
  for (const faction of FACTIONS) {
    FACTION_BY_ID.set(faction.id, faction);
  }
}

export function listFactionIds(): FactionId[] {
  assertContentPackRegistered();
  return FACTIONS.map((f) => f.id);
}

export function getFactionById(id: FactionId | string | null | undefined): FactionListing | undefined {
  assertContentPackRegistered();
  if (!id) return undefined;
  return FACTION_BY_ID.get(id);
}

export function getFactionForRegion(regionId: string): FactionListing {
  assertContentPackRegistered();
  const factionId = getRegionFactionId(regionId);
  if (!factionId) {
    throw new Error(`No faction mapped for region: ${regionId}`);
  }
  const listing = FACTION_BY_ID.get(factionId);
  if (!listing) {
    throw new Error(`Unknown faction for region ${regionId}: ${factionId}`);
  }
  return listing;
}
