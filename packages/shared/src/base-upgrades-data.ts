import { assertContentPackRegistered } from "./content-pack-state.js";

export type BaseUpgradeCost = Record<string, number | undefined>;

export type BaseUpgradeOptions = {
  weapons: string[];
  armor: string[];
  classes: string[];
  equipment: string[];
  gear: string[];
  haloSystems: string[];
};

export type BaseUpgrade = {
  id: string;
  name: string;
  flavor: string;
  cost: BaseUpgradeCost;
  prerequisites: string[];
  primaryUnlock: string;
  options: BaseUpgradeOptions;
  layout: { x: number; y: number };
};

export const BASE_UPGRADES: BaseUpgrade[] = [];

const byId = new Map<string, BaseUpgrade>();

export function replaceBaseUpgradesCatalog(upgrades: BaseUpgrade[]): void {
  BASE_UPGRADES.length = 0;
  BASE_UPGRADES.push(...upgrades);
  byId.clear();
  for (const upgrade of BASE_UPGRADES) {
    byId.set(upgrade.id, upgrade);
  }
}

export function getBaseUpgradeById(id: string): BaseUpgrade | undefined {
  assertContentPackRegistered();
  return byId.get(id);
}

export const BASE_UPGRADE_CARD_WIDTH = 280;
export const BASE_UPGRADE_CARD_HEIGHT = 400;
