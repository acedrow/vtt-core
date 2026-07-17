import type { CharacterSheet, Player } from "./types.js";
import { RULE_EFFECTS, getEffectSummary as getEffectSummaryFromData } from "./effects-data.js";
import type { RuleEffect } from "./effects-data.js";
import type { ClassActiveKind, ActionTier, StructuredArmorAction, WeaponAttackSpec } from "./combat/types.js";
import type { AbilityText } from "./rule-text.js";
import {
  validateCharacterSheetLoadout,
  classGrantsDualGear,
  type CharacterSheetLoadoutFields,
} from "./base-upgrades-unlocks.js";
import { getCampaignHooks } from "./campaign-hooks.js";
import { assertContentPackRegistered } from "./content-pack-state.js";

export type { StructuredArmorAction, WeaponAttackSpec, AbilityText };

export type DataBagTarget = {
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export function getPlayerDataString(
  target: DataBagTarget | null | undefined,
  key: string,
): string | undefined {
  if (!target) return undefined;
  const fromData = target.data?.[key];
  if (typeof fromData === "string" && fromData) return fromData;
  const legacy = target[key];
  if (typeof legacy === "string" && legacy) return legacy;
  return undefined;
}

export function setPlayerDataString(
  target: DataBagTarget,
  key: string,
  value: string | undefined,
): void {
  if (!target.data) target.data = {};
  if (value) target.data[key] = value;
  else delete target.data[key];
  delete target[key];
}

/** Lift a legacy top-level string field into data (sheet/player load). */
export function liftLegacyTopLevelIntoData(target: DataBagTarget, key: string): void {
  const legacy = typeof target[key] === "string" ? (target[key] as string) : undefined;
  if (legacy) {
    if (!target.data) target.data = {};
    if (typeof target.data[key] !== "string" || !target.data[key]) {
      target.data[key] = legacy;
    }
  }
  delete target[key];
}

export function getSheetDataKeys(): readonly string[] {
  return getCampaignHooks()?.sheetDataKeys ?? [];
}

export function liftSheetDataKeys(target: DataBagTarget): void {
  for (const key of getSheetDataKeys()) {
    liftLegacyTopLevelIntoData(target, key);
  }
}

/** Merge body.data with pack sheetDataKeys lifted from body top-level. */
export function collectSheetDataFromBody(
  body: Record<string, unknown> | null | undefined,
  baseData?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const data: Record<string, unknown> = { ...(baseData ?? {}) };
  let has = Object.keys(data).length > 0;
  if (body?.data != null && typeof body.data === "object" && !Array.isArray(body.data)) {
    Object.assign(data, body.data as Record<string, unknown>);
    has = true;
  }
  for (const key of getSheetDataKeys()) {
    if (body?.[key] === undefined) continue;
    const raw = body[key];
    data[key] = typeof raw === "string" ? raw.trim() : raw;
    has = true;
  }
  return has ? data : undefined;
}

/** Apply string values for pack sheetDataKeys from a data bag onto a sheet. */
export function applySheetDataKeys(
  sheet: CharacterSheet,
  data: Record<string, unknown> | undefined,
): void {
  if (!data) return;
  for (const key of getSheetDataKeys()) {
    if (!(key in data)) continue;
    const raw = data[key];
    setPlayerDataString(sheet, key, typeof raw === "string" ? raw.trim() || undefined : undefined);
  }
}

/**
 * Replace sheet.data. Pack sheetDataKeys omitted from nextData are preserved
 * when clearing (null); when nextData is an object, keys present in it win.
 */
export function replaceSheetDataBag(
  sheet: CharacterSheet,
  nextData: Record<string, unknown> | null,
  keyOverrides?: Record<string, string | undefined>,
): void {
  const keys = getSheetDataKeys();
  const preserved: Record<string, string | undefined> = {};
  for (const key of keys) {
    preserved[key] = getPlayerDataString(sheet, key);
  }
  if (nextData === null) {
    delete sheet.data;
    for (const key of keys) {
      const value = keyOverrides && key in keyOverrides ? keyOverrides[key] : preserved[key];
      setPlayerDataString(sheet, key, value || undefined);
    }
    return;
  }
  sheet.data = { ...nextData };
  for (const key of keys) {
    if (keyOverrides && key in keyOverrides) {
      setPlayerDataString(sheet, key, keyOverrides[key] || undefined);
    } else if (key in nextData) {
      const raw = nextData[key];
      setPlayerDataString(sheet, key, typeof raw === "string" ? raw.trim() || undefined : undefined);
    } else {
      setPlayerDataString(sheet, key, preserved[key]);
    }
  }
}

/** Extract sheetDataKey updates from a patch body for validation/apply. */
export function sheetDataKeyUpdatesFromBody(
  body: Record<string, unknown>,
): Record<string, string> | undefined {
  const updates: Record<string, string> = {};
  let has = false;
  for (const key of getSheetDataKeys()) {
    if (body[key] !== undefined) {
      updates[key] = typeof body[key] === "string" ? (body[key] as string).trim() : "";
      has = true;
    } else if (
      body.data != null &&
      typeof body.data === "object" &&
      !Array.isArray(body.data) &&
      (body.data as Record<string, unknown>)[key] !== undefined
    ) {
      const raw = (body.data as Record<string, unknown>)[key];
      updates[key] = typeof raw === "string" ? raw.trim() : "";
      has = true;
    }
  }
  return has ? updates : undefined;
}

export type PlayerClassPocketDimension = {
  gridSize: string;
  perspectiveOptions?: string[];
  wraith?: {
    hp: number;
    scale?: number;
    speed: number;
    strike: string;
    onDeath: string;
    notes: string;
  };
  hermeticCrystal?: {
    tags?: string[];
    hp: number;
    speed: number;
    special: string;
  };
};

export type PlayerClass = {
  name: string;
  hp: number;
  summary?: string;
  description?: string;
  activeTier?: ActionTier;
  activeKind?: ClassActiveKind;
  passiveKind?: string;
  activeAbility?: AbilityText;
  passiveAbility?: AbilityText;
  maxCharges?: number;
  startingCharges?: number;
  sharedHp?: number;
  pocketDimension?: PlayerClassPocketDimension;
};

export type PlayerArmorTower = {
  name: string;
  hp: number;
  scale: number;
  tags: string;
  special: string;
};

export type PlayerArmor = {
  name: string;
  speed: number;
  summary?: string;
  description?: string;
  special?: string;
  armorAction?: AbilityText;
  specialMovement?: AbilityText;
  armorActionStructured?: StructuredArmorAction;
  reversal?: {
    description?: string;
    charges: number;
    trigger: string;
    effect: string;
  };
  towers?: PlayerArmorTower[];
};

export type PlayerWeapon = {
  name: string;
  description?: string;
  activeAbility?: AbilityText;
  passiveAbility?: AbilityText;
  attack?: WeaponAttackSpec;
};

export type PlayerEquipment = {
  name: string;
  description?: string;
  effect: string;
  placement?: {
    tiles?: readonly (readonly [number, number])[];
    anchorTile?: readonly [number, number];
    patternId?: string;
    size?: number;
    width?: number;
    directional?: boolean;
  };
};

export type PlayerGear = {
  name: string;
  slot: string;
  description?: string;
  effect: string;
};

export type EffectGlossaryEntry = RuleEffect;

export const PLAYER_CLASSES: PlayerClass[] = [];
export const PLAYER_ARMOR: PlayerArmor[] = [];
export const PLAYER_WEAPONS: PlayerWeapon[] = [];
export const PLAYER_EQUIPMENT: PlayerEquipment[] = [];
export const PLAYER_GEAR: PlayerGear[] = [];
export const EFFECT_GLOSSARY = RULE_EFFECTS;

const classNames = new Set<string>();
const armorNames = new Set<string>();
const weaponNames = new Set<string>();
const equipmentNames = new Set<string>();
const gearNames = new Set<string>();

export function replacePlayerCatalog(input: {
  classes: PlayerClass[];
  armor: PlayerArmor[];
  weapons: PlayerWeapon[];
  equipment: PlayerEquipment[];
  gear: PlayerGear[];
}): void {
  PLAYER_CLASSES.length = 0;
  PLAYER_ARMOR.length = 0;
  PLAYER_WEAPONS.length = 0;
  PLAYER_EQUIPMENT.length = 0;
  PLAYER_GEAR.length = 0;
  PLAYER_CLASSES.push(...input.classes);
  PLAYER_ARMOR.push(...input.armor);
  PLAYER_WEAPONS.push(...input.weapons);
  PLAYER_EQUIPMENT.push(...input.equipment);
  PLAYER_GEAR.push(...input.gear);
  classNames.clear();
  armorNames.clear();
  weaponNames.clear();
  equipmentNames.clear();
  gearNames.clear();
  for (const c of PLAYER_CLASSES) classNames.add(c.name);
  for (const a of PLAYER_ARMOR) armorNames.add(a.name);
  for (const w of PLAYER_WEAPONS) weaponNames.add(w.name);
  for (const e of PLAYER_EQUIPMENT) equipmentNames.add(e.name);
  for (const g of PLAYER_GEAR) gearNames.add(g.name);
}

export function getClassByName(name: string): PlayerClass | undefined {
  assertContentPackRegistered();
  return PLAYER_CLASSES.find((c) => c.name === name);
}

export function getClassActiveTier(className: string | undefined): ActionTier {
  const cls = getClassByName(className ?? "");
  return cls?.activeTier ?? "support";
}

export function getClassActiveKind(className: string | undefined): ClassActiveKind | undefined {
  return getClassByName(className ?? "")?.activeKind;
}

export { classGrantsSecondWeapon, classGrantsDualGear } from "./base-upgrades-unlocks.js";

export function getClassMaxHp(className: string | undefined): number {
  if (!className) return 0;
  return getClassByName(className)?.hp ?? 0;
}

export function getArmorByName(name: string): PlayerArmor | undefined {
  assertContentPackRegistered();
  return PLAYER_ARMOR.find((a) => a.name === name);
}

export function getWeaponByName(name: string): PlayerWeapon | undefined {
  assertContentPackRegistered();
  return PLAYER_WEAPONS.find((w) => w.name === name);
}

export function getEquipmentByName(name: string): PlayerEquipment | undefined {
  assertContentPackRegistered();
  return PLAYER_EQUIPMENT.find((e) => e.name === name);
}

export function getGearByName(name: string): PlayerGear | undefined {
  assertContentPackRegistered();
  return PLAYER_GEAR.find((g) => g.name === name);
}

export function getArmorSpeed(armorName: string | undefined): number {
  if (!armorName) return 4;
  return getArmorByName(armorName)?.speed ?? 4;
}

export function applyLoadoutToPlayer(
  player: Player,
  loadout: {
    className: string;
    armor: string;
    weapon: string;
    equipment?: string;
    gear?: string;
    weapon2?: string;
    gearArmor?: string;
    data?: Record<string, unknown>;
  },
): void {
  player.class = loadout.className;
  player.armor = loadout.armor;
  player.weapon = loadout.weapon;
  player.equipment = loadout.equipment || undefined;
  player.gear = loadout.gear || undefined;
  player.gearArmor = loadout.gearArmor || undefined;
  player.weapon2 = loadout.weapon2 || undefined;
  player.speed = getArmorSpeed(loadout.armor);
  const armor = getArmorByName(loadout.armor);
  if (armor?.reversal?.charges != null) {
    player.reversalCharges = armor.reversal.charges;
  }
  if (player.equipmentUses === undefined) player.equipmentUses = 1;
  if (!player.counters) player.counters = {};
  getCampaignHooks()?.applySheetLoadoutExtras?.(player, {
    armor: loadout.armor,
    data: loadout.data,
  });
  player.hp = normalizePlayerHp(player);
}

export function syncCharacterSheetWeaponsFromPlayer(
  sheet: CharacterSheet,
  player: Pick<Player, "characterSheetId" | "weapon" | "weapon2">,
): boolean {
  if (player.characterSheetId !== sheet.id) return false;
  const weapon = player.weapon ?? sheet.weapon;
  const weapon2 = player.weapon2;
  if (sheet.weapon === weapon && sheet.weapon2 === weapon2) return false;
  sheet.weapon = weapon;
  sheet.weapon2 = weapon2;
  sheet.updatedAt = new Date().toISOString();
  return true;
}

function normalizePlayerHp(player: Player): number {
  const maxHp = getClassMaxHp(player.class);
  const current = player.hp ?? maxHp;
  return Math.max(0, Math.min(current, maxHp));
}

export { getEffectSummaryFromData as getEffectSummary };

export function validateCharacterSheetRefs(
  fields: CharacterSheetLoadoutFields,
  constructedIds: readonly string[] = [],
  existing?: CharacterSheetLoadoutFields,
): string | null {
  assertContentPackRegistered();
  if (fields.class !== undefined && !classNames.has(fields.class)) {
    return `Invalid class: ${fields.class}`;
  }
  if (fields.armor !== undefined && !armorNames.has(fields.armor)) {
    return `Invalid armor: ${fields.armor}`;
  }
  if (fields.weapon !== undefined && !weaponNames.has(fields.weapon)) {
    return `Invalid weapon: ${fields.weapon}`;
  }
  if (fields.equipment !== undefined && fields.equipment && !equipmentNames.has(fields.equipment)) {
    return `Invalid equipment: ${fields.equipment}`;
  }
  if (fields.gear !== undefined && fields.gear && !gearNames.has(fields.gear)) {
    return `Invalid gear: ${fields.gear}`;
  }
  if (fields.gear !== undefined && fields.gear) {
    const className = fields.class ?? existing?.class;
    const gear = getGearByName(fields.gear);
    if (classGrantsDualGear(className) && gear?.slot !== "weapon") {
      return "Weapon gear slot requires weapon gear";
    }
  }
  if (fields.gearArmor !== undefined && fields.gearArmor && !gearNames.has(fields.gearArmor)) {
    return `Invalid gear: ${fields.gearArmor}`;
  }
  if (fields.gearArmor !== undefined && fields.gearArmor) {
    const gear = getGearByName(fields.gearArmor);
    if (gear?.slot !== "armor") {
      return "Armor gear slot requires armor gear";
    }
  }
  if (fields.weapon2 !== undefined && fields.weapon2 && !weaponNames.has(fields.weapon2)) {
    return `Invalid weapon: ${fields.weapon2}`;
  }
  const extrasErr = getCampaignHooks()?.validateSheetLoadoutExtras?.(fields, existing);
  if (extrasErr) return extrasErr;
  return validateCharacterSheetLoadout(fields, constructedIds, existing);
}
