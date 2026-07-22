import { replaceBaseUpgradesCatalog, type BaseUpgrade } from "./base-upgrades-data.js";
import {
  clearAgnosiaHandlers,
  registerAgnosiaHandler,
  type AgnosiaHandler,
} from "./combat/agnosia.js";
import {
  clearCountdownHandlers,
  clearCountdownKindInferrer,
  registerCountdownHandler,
  registerCountdownKindInferrer,
  type CountdownHandler,
  type CountdownKindInferrer,
} from "./combat/countdown.js";
import {
  clearPendingConfirmHandlers,
  registerPendingConfirmHandler,
  type PendingConfirmHandler,
} from "./combat/pending-confirm.js";
import {
  clearCombatLifecycleHooks,
  replaceCombatLifecycleHooks,
  type CombatLifecycleHooks,
} from "./combat/combat-lifecycle.js";
import {
  clearProvokeRetaliationHandler,
  registerProvokeRetaliationHandler,
  type ProvokeRetaliationHandler,
} from "./combat/provoke-retaliation.js";
import {
  clearWeaponActiveHandlers,
  replaceWeaponActiveHandlers,
  type WeaponActiveHandler,
} from "./combat/weapon-active.js";
import {
  clearSpecialIdHandlers,
  registerSpecialIdHandler,
  type SpecialIdHandler,
} from "./combat/special-id.js";
import { clearCombatModules, replaceCombatModules } from "./combat-modules.js";
import {
  getContentPackMeta,
  setContentPackMeta,
  assertContentPackRegistered,
} from "./content-pack-state.js";
import {
  clearCampaignContribution,
  emptyCampaignContribution,
  replaceCampaignContribution,
  type CampaignContribution,
} from "./campaign-registry.js";
import {
  clearCampaignHooks,
  replaceCampaignHooks,
  type CampaignHookContribution,
} from "./campaign-hooks.js";
import { replaceConvoysCatalog, type ConvoyTypeInfo } from "./convoys-data.js";
import { replaceEffectsCatalog, type RuleEffect } from "./effects-data.js";
import { replaceEnemyCatalog, type EnemyFaction, type EnemyListing } from "./enemy-data.js";
import { replaceFactionCatalog, type FactionListing } from "./faction-data.js";
import { replaceGameTermsCatalog, type GameTerm } from "./game-terms-data.js";
import { replaceGmStratcomActionsCatalog, type GmStratcomAction } from "./gm-stratcom-actions-data.js";
import {
  replacePatternCatalog,
  type PatternModifier,
  type TargetingPattern,
} from "./pattern-data.js";
import {
  replacePlayerCatalog,
  type PlayerArmor,
  type PlayerClass,
  type PlayerEquipment,
  type PlayerGear,
  type PlayerWeapon,
} from "./player-data.js";
import { replaceReconMovesCatalog, type ReconMove } from "./recon-moves-data.js";
import { replaceReconTablesCatalog, type ReconTable } from "./recon-tables-data.js";
import { replaceTerrainCatalog, type TerrainTypeEntry } from "./terrain-data.js";
import { TERRAIN_TYPES } from "./types.js";

export type { EnemyListing, EnemyFaction };

export type CatalogContribution = {
  enemyFactions: EnemyFaction[];
  classes: PlayerClass[];
  armor: PlayerArmor[];
  weapons: PlayerWeapon[];
  equipment: PlayerEquipment[];
  gear: PlayerGear[];
  unitEffects: RuleEffect[];
  weaponEffects: RuleEffect[];
  tileEffects: RuleEffect[];
  patterns: TargetingPattern[];
  modifiers: PatternModifier[];
  terrainTypes: TerrainTypeEntry[];
  factions: FactionListing[];
  baseUpgrades: BaseUpgrade[];
  convoyTypes: ConvoyTypeInfo[];
  gmStratcomActions: GmStratcomAction[];
  reconMoves: ReconMove[];
  reconTables: ReconTable[];
  gameTerms: GameTerm[];
};

export type CombatHookContribution = {
  specialIdHandlers?: Record<string, SpecialIdHandler>;
  countdownHandlers?: Record<string, CountdownHandler>;
  countdownKindInferrer?: CountdownKindInferrer;
  agnosiaHandlers?: Record<string, AgnosiaHandler>;
  pendingConfirmHandlers?: Record<string, PendingConfirmHandler>;
  onProvokeRetaliation?: ProvokeRetaliationHandler;
  lifecycle?: CombatLifecycleHooks;
  weaponActiveHandlers?: WeaponActiveHandler[];
  modules?: Record<string, object>;
};

export type { CombatLifecycleHooks, WeaponActiveHandler };

export type { CampaignContribution, CampaignHookContribution };

export type ContentPack = {
  id: string;
  version: string;
  catalogs: CatalogContribution;
  combat?: CombatHookContribution;
  campaign?: CampaignContribution;
  campaignHooks?: CampaignHookContribution;
};

let registeredPack: ContentPack | null = null;

function applyCatalogs(catalogs: CatalogContribution): void {
  replaceEnemyCatalog(catalogs.enemyFactions);
  replacePlayerCatalog({
    classes: catalogs.classes,
    armor: catalogs.armor,
    weapons: catalogs.weapons,
    equipment: catalogs.equipment,
    gear: catalogs.gear,
  });
  replaceEffectsCatalog({
    unitEffects: catalogs.unitEffects,
    weaponEffects: catalogs.weaponEffects,
    tileEffects: catalogs.tileEffects,
  });
  replacePatternCatalog({
    patterns: catalogs.patterns,
    modifiers: catalogs.modifiers,
  });
  replaceTerrainCatalog(catalogs.terrainTypes);
  replaceFactionCatalog(catalogs.factions);
  replaceBaseUpgradesCatalog(catalogs.baseUpgrades);
  replaceConvoysCatalog(catalogs.convoyTypes);
  replaceGmStratcomActionsCatalog(catalogs.gmStratcomActions);
  replaceReconMovesCatalog(catalogs.reconMoves);
  replaceReconTablesCatalog(catalogs.reconTables);
  replaceGameTermsCatalog(catalogs.gameTerms);
}

function clearCombatHooks(): void {
  clearSpecialIdHandlers();
  clearCountdownHandlers();
  clearCountdownKindInferrer();
  clearAgnosiaHandlers();
  clearPendingConfirmHandlers();
  clearProvokeRetaliationHandler();
  clearCombatLifecycleHooks();
  clearWeaponActiveHandlers();
  clearCombatModules();
}

function replaceCombatHooks(combat: CombatHookContribution): void {
  clearCombatHooks();
  replaceCombatModules(combat.modules ?? {});
  replaceCombatLifecycleHooks(combat.lifecycle ?? {});
  replaceWeaponActiveHandlers(combat.weaponActiveHandlers ?? []);
  for (const [id, handler] of Object.entries(combat.specialIdHandlers ?? {})) {
    registerSpecialIdHandler(id, handler);
  }
  for (const [kind, handler] of Object.entries(combat.countdownHandlers ?? {})) {
    registerCountdownHandler(kind, handler);
  }
  if (combat.countdownKindInferrer) {
    registerCountdownKindInferrer(combat.countdownKindInferrer);
  }
  for (const [listingName, handler] of Object.entries(combat.agnosiaHandlers ?? {})) {
    registerAgnosiaHandler(listingName, handler);
  }
  for (const [kind, handler] of Object.entries(combat.pendingConfirmHandlers ?? {})) {
    registerPendingConfirmHandler(kind, handler);
  }
  if (combat.onProvokeRetaliation) {
    registerProvokeRetaliationHandler(combat.onProvokeRetaliation);
  }
}

function emptyTerrainCatalog(): TerrainTypeEntry[] {
  return TERRAIN_TYPES.map((id) => ({
    id,
    name: id,
    summary: "",
    description: "",
  }));
}

function clearCatalogs(): void {
  replaceEnemyCatalog([]);
  replacePlayerCatalog({
    classes: [],
    armor: [],
    weapons: [],
    equipment: [],
    gear: [],
  });
  replaceEffectsCatalog({ unitEffects: [], weaponEffects: [], tileEffects: [] });
  replacePatternCatalog({ patterns: [], modifiers: [] });
  replaceTerrainCatalog(emptyTerrainCatalog());
  replaceFactionCatalog([]);
  replaceBaseUpgradesCatalog([]);
  replaceConvoysCatalog([]);
  replaceGmStratcomActionsCatalog([]);
  replaceReconMovesCatalog([]);
  replaceReconTablesCatalog([]);
  replaceGameTermsCatalog([]);
}

export function registerContentPack(pack: ContentPack): void {
  const existing = getContentPackMeta();
  if (existing) {
    if (existing.id === pack.id && existing.version === pack.version) return;
    throw new Error(
      `Content pack already registered: ${existing.id}@${existing.version}`,
    );
  }
  applyCatalogs(pack.catalogs);
  replaceCombatHooks(pack.combat ?? {});
  replaceCampaignContribution(pack.campaign ?? emptyCampaignContribution());
  replaceCampaignHooks(pack.campaignHooks ?? null);
  registeredPack = pack;
  setContentPackMeta({ id: pack.id, version: pack.version });
}

export function getContentPack(): ContentPack | null {
  return registeredPack;
}

export function requireContentPack(): ContentPack {
  assertContentPackRegistered();
  return registeredPack!;
}

export function resetContentPackForTests(): void {
  registeredPack = null;
  setContentPackMeta(null);
  clearCatalogs();
  clearCombatHooks();
  clearCampaignContribution();
  clearCampaignHooks();
}

export { assertContentPackRegistered };
