import type { CatalogContribution, ContentPack } from "./content-pack.js";
import type { CampaignContribution } from "./campaign-registry.js";
import { createFixtureCampaignHooks } from "./fixture-campaign-hooks.js";
import type { FactionListing } from "./faction-data.js";
import { TERRAIN_TYPES } from "./types.js";

export const FIXTURE_CONTENT_PACK_ID = "fixture";
export const FIXTURE_CONTENT_PACK_VERSION = "0.0.1";

const fixtureFaction: FactionListing = {
  id: "fixture-faction",
  name: "Fixture Faction",
  tagline: "test",
  crown: 0,
  description: "Fixture faction for engine tests.",
  qualities: { force: 0, subterfuge: 0, territory: 0, assets: 0 },
  startingLocations: [],
  uniqueLocations: [],
  stratcomActions: [],
  upgrades: [],
};

function fixtureCatalogs(): CatalogContribution {
  return {
    enemyFactions: [
      {
        name: "fixture-faction",
        enemies: [
          {
            name: "Test Grunt",
            hp: 10,
            speed: 3,
            attacks: [{ text: "Poke", attack: { targeting: "none", damage: "1" } }],
          },
          {
            name: "Test Brute",
            codename: "Brute",
            hp: 20,
            speed: 2,
            scale: 2,
          },
        ],
      },
    ],
    classes: [{ name: "Test Class", hp: 25 }],
    armor: [{ name: "Test Armor", speed: 5 }],
    weapons: [{ name: "Test Weapon", description: "A stick." }],
    equipment: [],
    gear: [],
    unitEffects: [
      {
        id: "TestEffect",
        summary: "test",
        description: "Fixture unit effect.",
        icon: "circle",
      },
    ],
    weaponEffects: [],
    tileEffects: [],
    patterns: [
      {
        id: "burst",
        name: "Burst",
        description: "Fixture burst",
        kind: "fixed",
        origin: "self",
        directional: false,
        size: { min: 1, max: 3, default: 1 },
      },
    ],
    modifiers: [],
    terrainTypes: TERRAIN_TYPES.map((id) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      summary: `Fixture ${id}`,
      description: `Fixture terrain ${id}`,
    })),
    factions: [fixtureFaction],
    baseUpgrades: [],
    convoyTypes: [],
    gmStratcomActions: [],
    reconMoves: [],
    reconTables: [],
    gameTerms: [{ id: "FixtureTerm", summary: "term", description: "Fixture game term." }],
    extraEffectNames: ["FixtureEffect"],
    literalTerms: ["Fixture Action"],
    literalTermLookup: { "fixture action": "FixtureTerm" },
  };
}

function fixtureCampaign(): CampaignContribution {
  return {
    regionFactions: { west: "fixture-faction" },
    partyResourceKeys: ["scrap"],
    partyResourceLabels: { scrap: "Scrap" },
    defaultPartyResources: { scrap: 0 },
    starterUnlocks: {
      weapons: ["Test Weapon"],
      armor: ["Test Armor"],
      classes: ["Test Class"],
      equipment: [],
      gear: [],
      haloSystems: [],
    },
    upgradeFeatures: {},
    overworldGeometry: { width: 3, height: 3, travelFuelCost: 1 },
  };
}

export function createFixtureContentPack(): ContentPack {
  return {
    id: FIXTURE_CONTENT_PACK_ID,
    version: FIXTURE_CONTENT_PACK_VERSION,
    catalogs: fixtureCatalogs(),
    campaign: fixtureCampaign(),
    campaignHooks: createFixtureCampaignHooks(),
  };
}
