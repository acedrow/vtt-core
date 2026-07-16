import autophyesEnemies from "./data/enemies/autophyes.json" with { type: "json" };
import paracletusEnemies from "./data/enemies/paracletus.json" with { type: "json" };
import autophyesFaction from "./data/factions/autophyes.json" with { type: "json" };
import paracletusFaction from "./data/factions/paracletus.json" with { type: "json" };
import syncrasisFaction from "./data/factions/syncrasis.json" with { type: "json" };
import armorJson from "./data/player/armor.json" with { type: "json" };
import classesJson from "./data/player/classes.json" with { type: "json" };
import equipmentJson from "./data/player/equipment.json" with { type: "json" };
import gearJson from "./data/player/gear.json" with { type: "json" };
import weaponsJson from "./data/player/weapons.json" with { type: "json" };
import baseUpgradesJson from "./data/rules/base-upgrades.json" with { type: "json" };
import convoysJson from "./data/rules/convoys.json" with { type: "json" };
import gameTermsJson from "./data/rules/game-terms.json" with { type: "json" };
import gmStratcomActionsJson from "./data/rules/gm-stratcom-actions.json" with { type: "json" };
import modifiersJson from "./data/rules/modifiers.json" with { type: "json" };
import patternsJson from "./data/rules/patterns.json" with { type: "json" };
import reconMovesJson from "./data/rules/recon-moves.json" with { type: "json" };
import chambersJson from "./data/rules/recon-tables/chambers.json" with { type: "json" };
import corridorsJson from "./data/rules/recon-tables/corridors.json" with { type: "json" };
import scavengeJson from "./data/rules/recon-tables/scavenge.json" with { type: "json" };
import scoutJson from "./data/rules/recon-tables/scout.json" with { type: "json" };
import travelJson from "./data/rules/recon-tables/travel.json" with { type: "json" };
import vaultsJson from "./data/rules/recon-tables/vaults.json" with { type: "json" };
import terrainTypesJson from "./data/rules/terrain-types.json" with { type: "json" };
import tileEffectsJson from "./data/rules/tile-effects.json" with { type: "json" };
import unitEffectsJson from "./data/rules/unit-effects.json" with { type: "json" };
import weaponEffectsJson from "./data/rules/weapon-effects.json" with { type: "json" };
import {
  registerContentPack,
  type BaseUpgrade,
  type CatalogContribution,
  type ConvoyTypeInfo,
  type EnemyFaction,
  type FactionListing,
  type GameTerm,
  type GmStratcomAction,
  type PatternModifier,
  type PlayerArmor,
  type PlayerClass,
  type PlayerEquipment,
  type PlayerGear,
  type PlayerWeapon,
  type ReconMove,
  type ReconTable,
  type RuleEffect,
  type TargetingPattern,
  type TerrainTypeEntry,
} from "@gaem/shared";
import { hellpiercersCampaignHooks } from "./campaign/hellpiercers-campaign-hooks.js";
import { hellpiercersCampaign } from "./hellpiercers-campaign.js";
import { hellpiercersCombatHooks } from "./hellpiercers-combat.js";

export const HELLPIERCERS_CONTENT_PACK_ID = "hellpiercers";
export const HELLPIERCERS_CONTENT_PACK_VERSION = "1.0.0";

function hellpiercersCatalogs(): CatalogContribution {
  return {
    enemyFactions: [autophyesEnemies, paracletusEnemies] as EnemyFaction[],
    classes: classesJson as PlayerClass[],
    armor: armorJson as PlayerArmor[],
    weapons: weaponsJson as PlayerWeapon[],
    equipment: equipmentJson as PlayerEquipment[],
    gear: gearJson as PlayerGear[],
    unitEffects: unitEffectsJson as RuleEffect[],
    weaponEffects: weaponEffectsJson as RuleEffect[],
    tileEffects: tileEffectsJson as RuleEffect[],
    patterns: patternsJson as TargetingPattern[],
    modifiers: modifiersJson as PatternModifier[],
    terrainTypes: terrainTypesJson as TerrainTypeEntry[],
    factions: [
      syncrasisFaction as FactionListing,
      autophyesFaction as FactionListing,
      paracletusFaction as FactionListing,
    ],
    baseUpgrades: baseUpgradesJson as BaseUpgrade[],
    convoyTypes: convoysJson as ConvoyTypeInfo[],
    gmStratcomActions: gmStratcomActionsJson as GmStratcomAction[],
    reconMoves: reconMovesJson as ReconMove[],
    reconTables: [
      chambersJson as ReconTable,
      corridorsJson as ReconTable,
      vaultsJson as ReconTable,
      scavengeJson as ReconTable,
      scoutJson as ReconTable,
      travelJson as ReconTable,
    ],
    gameTerms: gameTermsJson as GameTerm[],
  };
}

export function registerHellpiercersContent(): void {
  registerContentPack({
    id: HELLPIERCERS_CONTENT_PACK_ID,
    version: HELLPIERCERS_CONTENT_PACK_VERSION,
    catalogs: hellpiercersCatalogs(),
    combat: hellpiercersCombatHooks(),
    campaign: hellpiercersCampaign(),
    campaignHooks: hellpiercersCampaignHooks(),
  });
}
