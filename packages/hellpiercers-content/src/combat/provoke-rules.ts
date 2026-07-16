import type { Enemy, Player } from "@gaem/shared";

export const MURIEL_ARMOR_NAME = "MURIEL";
export const JEHOEL_ARMOR_NAME = "JEHOEL";
export const KOPIS_CLASS_NAME = "KOPIS";
export const EXPANDED_AGGRESSION_GEAR = "Expanded Aggression Rituals (Armor)";

export function isMurielArmor(armor: string | undefined): boolean {
  return armor === MURIEL_ARMOR_NAME;
}

export function isJehoelArmor(armor: string | undefined): boolean {
  return armor === JEHOEL_ARMOR_NAME;
}

export function isKopisClass(cls: string | undefined): boolean {
  return cls === KOPIS_CLASS_NAME;
}

export function isExpandedAggressionGear(gear: string | undefined): boolean {
  return gear === EXPANDED_AGGRESSION_GEAR;
}

export function skipEnemyAsProvokeSource(enemy: Pick<Enemy, "name">): boolean {
  return enemy.name === "Stain Flower";
}

export function playerUsesMurielPassedTracking(player: Pick<Player, "armor">): boolean {
  return isMurielArmor(player.armor);
}

export function playerUsesJehoelTerrainImmunity(player: Pick<Player, "armor">): boolean {
  return isJehoelArmor(player.armor);
}

export function playerUsesKopisRetaliation(player: Pick<Player, "class">): boolean {
  return isKopisClass(player.class);
}
