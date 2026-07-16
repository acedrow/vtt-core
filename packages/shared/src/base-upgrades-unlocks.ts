import { getBaseUpgradeById, type BaseUpgradeOptions } from "./base-upgrades-data.js";
import {
  classGrantsDualGear,
  classGrantsSecondWeapon,
  getStarterUnlocks,
  getUpgradeFeatures,
} from "./campaign-registry.js";

export { classGrantsDualGear, classGrantsSecondWeapon };

export type UnlockCategory = keyof BaseUpgradeOptions;

export type CampaignFeature = string;

const OPTION_KEYS: UnlockCategory[] = [
  "weapons",
  "armor",
  "classes",
  "equipment",
  "gear",
  "haloSystems",
];

function emptyOptionSets(): Record<UnlockCategory, Set<string>> {
  return {
    weapons: new Set(),
    armor: new Set(),
    classes: new Set(),
    equipment: new Set(),
    gear: new Set(),
    haloSystems: new Set(),
  };
}

export function getUnlockedOptions(constructedIds: readonly string[]): BaseUpgradeOptions {
  const sets = emptyOptionSets();
  const starter = getStarterUnlocks();
  for (const key of OPTION_KEYS) {
    for (const name of starter[key]) sets[key].add(name);
  }
  for (const id of constructedIds) {
    const upgrade = getBaseUpgradeById(id);
    if (!upgrade) continue;
    for (const key of OPTION_KEYS) {
      for (const name of upgrade.options[key]) sets[key].add(name);
    }
  }
  return {
    weapons: [...sets.weapons],
    armor: [...sets.armor],
    classes: [...sets.classes],
    equipment: [...sets.equipment],
    gear: [...sets.gear],
    haloSystems: [...sets.haloSystems],
  };
}

export function getUnlockedOptionSets(
  constructedIds: readonly string[],
): Record<UnlockCategory, Set<string>> {
  const sets = emptyOptionSets();
  const starter = getStarterUnlocks();
  for (const key of OPTION_KEYS) {
    for (const name of starter[key]) sets[key].add(name);
  }
  for (const id of constructedIds) {
    const upgrade = getBaseUpgradeById(id);
    if (!upgrade) continue;
    for (const key of OPTION_KEYS) {
      for (const name of upgrade.options[key]) sets[key].add(name);
    }
  }
  return sets;
}

export function isOptionUnlocked(
  category: UnlockCategory,
  name: string,
  constructedIds: readonly string[],
): boolean {
  return getUnlockedOptionSets(constructedIds)[category].has(name);
}

export function getUnlockedFeatures(constructedIds: readonly string[]): Set<CampaignFeature> {
  const features = new Set<CampaignFeature>();
  for (const id of constructedIds) {
    for (const feature of getUpgradeFeatures(id)) features.add(feature);
  }
  return features;
}

export function isCampaignFeatureUnlocked(
  feature: CampaignFeature,
  constructedIds: readonly string[],
): boolean {
  return getUnlockedFeatures(constructedIds).has(feature);
}

export type CharacterSheetLoadoutFields = {
  class?: string;
  armor?: string;
  weapon?: string;
  equipment?: string;
  gear?: string;
  gearArmor?: string;
  weapon2?: string;
  data?: Record<string, unknown>;
};

export function validateCharacterSheetLoadout(
  fields: CharacterSheetLoadoutFields,
  constructedIds: readonly string[],
  existing?: CharacterSheetLoadoutFields,
): string | null {
  const unlocked = getUnlockedOptionSets(constructedIds);
  const features = getUnlockedFeatures(constructedIds);

  if (fields.class !== undefined) {
    if (!unlocked.classes.has(fields.class) && fields.class !== existing?.class) {
      return `Class not unlocked: ${fields.class}`;
    }
  }
  if (fields.armor !== undefined) {
    if (!unlocked.armor.has(fields.armor) && fields.armor !== existing?.armor) {
      return `Armor not unlocked: ${fields.armor}`;
    }
  }
  if (fields.weapon !== undefined) {
    if (!unlocked.weapons.has(fields.weapon) && fields.weapon !== existing?.weapon) {
      return `Weapon not unlocked: ${fields.weapon}`;
    }
  }
  if (fields.equipment !== undefined) {
    if (fields.equipment && !features.has("equipmentSlot")) {
      return "Equipment slot not unlocked";
    }
    if (
      fields.equipment &&
      !unlocked.equipment.has(fields.equipment) &&
      fields.equipment !== existing?.equipment
    ) {
      return `Equipment not unlocked: ${fields.equipment}`;
    }
  }
  if (fields.gear !== undefined) {
    const className = fields.class ?? existing?.class;
    const epeusDual = classGrantsDualGear(className);
    if (fields.gear && !features.has("gearSlot") && !epeusDual) {
      return "Gear slot not unlocked";
    }
    if (fields.gear && !unlocked.gear.has(fields.gear) && fields.gear !== existing?.gear) {
      return `Gear not unlocked: ${fields.gear}`;
    }
  }
  if (fields.gearArmor !== undefined) {
    const className = fields.class ?? existing?.class;
    const epeusDual = classGrantsDualGear(className);
    if (fields.gearArmor && !features.has("gearSlot") && !epeusDual) {
      return "Gear slot not unlocked";
    }
    if (
      fields.gearArmor &&
      !unlocked.gear.has(fields.gearArmor) &&
      fields.gearArmor !== existing?.gearArmor
    ) {
      return `Gear not unlocked: ${fields.gearArmor}`;
    }
  }
  if (fields.weapon2 !== undefined) {
    const className = fields.class ?? existing?.class;
    const harpeExtra = classGrantsSecondWeapon(className);
    if (fields.weapon2 && !features.has("secondWeaponSlot") && !harpeExtra) {
      return "Second weapon slot not unlocked";
    }
    if (
      fields.weapon2 &&
      !unlocked.weapons.has(fields.weapon2) &&
      fields.weapon2 !== existing?.weapon2
    ) {
      return `Weapon not unlocked: ${fields.weapon2}`;
    }
  }

  return null;
}
