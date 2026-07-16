import type { BaseUpgradeOptions } from "./base-upgrades-data.js";
import { assertContentPackRegistered } from "./content-pack-state.js";

export type OverworldGeometry = {
  width: number;
  height: number;
  travelFuelCost: number;
};

export type ClassLoadoutRules = {
  secondWeaponClasses?: string[];
  dualGearClasses?: string[];
};

export type CampaignContribution = {
  regionFactions: Record<string, string>;
  partyResourceKeys: string[];
  partyResourceLabels?: Record<string, string>;
  defaultPartyResources?: Record<string, number>;
  starterUnlocks: BaseUpgradeOptions;
  upgradeFeatures: Record<string, string[]>;
  overworldGeometry: OverworldGeometry;
  classRules?: ClassLoadoutRules;
};

let regionFactions: Record<string, string> = {};
let partyResourceKeys: string[] = [];
let partyResourceLabels: Record<string, string> = {};
let defaultPartyResources: Record<string, number> = {};
let starterUnlocks: BaseUpgradeOptions = {
  weapons: [],
  armor: [],
  classes: [],
  equipment: [],
  gear: [],
  haloSystems: [],
};
let upgradeFeatures: Record<string, string[]> = {};
let overworldGeometry: OverworldGeometry = { width: 1, height: 1, travelFuelCost: 1 };
let secondWeaponClasses = new Set<string>();
let dualGearClasses = new Set<string>();

function emptyStarterUnlocks(): BaseUpgradeOptions {
  return {
    weapons: [],
    armor: [],
    classes: [],
    equipment: [],
    gear: [],
    haloSystems: [],
  };
}

export function emptyCampaignContribution(): CampaignContribution {
  return {
    regionFactions: {},
    partyResourceKeys: [],
    partyResourceLabels: {},
    defaultPartyResources: {},
    starterUnlocks: emptyStarterUnlocks(),
    upgradeFeatures: {},
    overworldGeometry: { width: 1, height: 1, travelFuelCost: 1 },
  };
}

export function clearCampaignContribution(): void {
  replaceCampaignContribution(emptyCampaignContribution());
}

export function replaceCampaignContribution(campaign: CampaignContribution): void {
  regionFactions = { ...campaign.regionFactions };
  partyResourceKeys = [...campaign.partyResourceKeys];
  partyResourceLabels = { ...(campaign.partyResourceLabels ?? {}) };
  defaultPartyResources = { ...(campaign.defaultPartyResources ?? {}) };
  const starter = campaign.starterUnlocks;
  starterUnlocks = {
    weapons: [...starter.weapons],
    armor: [...starter.armor],
    classes: [...starter.classes],
    equipment: [...starter.equipment],
    gear: [...starter.gear],
    haloSystems: [...starter.haloSystems],
  };
  upgradeFeatures = {};
  for (const [id, features] of Object.entries(campaign.upgradeFeatures)) {
    upgradeFeatures[id] = [...features];
  }
  const geom = campaign.overworldGeometry;
  overworldGeometry = {
    width: Math.max(1, Math.floor(geom.width)),
    height: Math.max(1, Math.floor(geom.height)),
    travelFuelCost: Math.max(0, Math.floor(geom.travelFuelCost)),
  };
  secondWeaponClasses = new Set(campaign.classRules?.secondWeaponClasses ?? []);
  dualGearClasses = new Set(campaign.classRules?.dualGearClasses ?? []);
}

export function listOverworldRegionIds(): string[] {
  assertContentPackRegistered();
  return Object.keys(regionFactions);
}

export function getRegionFactionId(regionId: string): string | undefined {
  assertContentPackRegistered();
  return regionFactions[regionId];
}

export function getRegionFactions(): Record<string, string> {
  assertContentPackRegistered();
  return { ...regionFactions };
}

export function listPartyResourceKeys(): string[] {
  assertContentPackRegistered();
  return [...partyResourceKeys];
}

export function getPartyResourceLabel(key: string): string {
  assertContentPackRegistered();
  return partyResourceLabels[key] ?? key;
}

export function defaultPartyResourcesFromPack(): Record<string, number> {
  assertContentPackRegistered();
  const out: Record<string, number> = {};
  for (const key of partyResourceKeys) {
    const raw = defaultPartyResources[key];
    out[key] = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  }
  return out;
}

export function getStarterUnlocks(): BaseUpgradeOptions {
  assertContentPackRegistered();
  return {
    weapons: [...starterUnlocks.weapons],
    armor: [...starterUnlocks.armor],
    classes: [...starterUnlocks.classes],
    equipment: [...starterUnlocks.equipment],
    gear: [...starterUnlocks.gear],
    haloSystems: [...starterUnlocks.haloSystems],
  };
}

export function getUpgradeFeatures(upgradeId: string): string[] {
  assertContentPackRegistered();
  return [...(upgradeFeatures[upgradeId] ?? [])];
}

export function listUpgradeFeatures(): Record<string, string[]> {
  assertContentPackRegistered();
  const out: Record<string, string[]> = {};
  for (const [id, features] of Object.entries(upgradeFeatures)) {
    out[id] = [...features];
  }
  return out;
}

export function getOverworldWidth(): number {
  assertContentPackRegistered();
  return overworldGeometry.width;
}

export function getOverworldHeight(): number {
  assertContentPackRegistered();
  return overworldGeometry.height;
}

export function getOverworldQuarterWidth(): number {
  assertContentPackRegistered();
  return overworldGeometry.width * 2;
}

export function getOverworldQuarterHeight(): number {
  assertContentPackRegistered();
  return overworldGeometry.height * 2;
}

export function getOverworldTravelFuelCost(): number {
  assertContentPackRegistered();
  return overworldGeometry.travelFuelCost;
}

export function classGrantsSecondWeapon(className: string | undefined): boolean {
  if (!className) return false;
  assertContentPackRegistered();
  return secondWeaponClasses.has(className);
}

export function classGrantsDualGear(className: string | undefined): boolean {
  if (!className) return false;
  assertContentPackRegistered();
  return dualGearClasses.has(className);
}
