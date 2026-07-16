import type { Player } from "@gaem/shared";

export const HEAVEN_BURNING_SWORD_NAME = "Heaven Burning Sword";
export const HEAVEN_BURNING_MIN_LEVEL = 1;
export const HEAVEN_BURNING_MAX_LEVEL = 3;
export const HEAVEN_BURNING_UNFOLD_DETAIL = "heaven_burning_unfold";

export function isHeavenBurningWeaponName(name: string | undefined | null): boolean {
  return name === HEAVEN_BURNING_SWORD_NAME;
}

export function playerHasHeavenBurningWeapon(player: Pick<Player, "weapon" | "weapon2">): boolean {
  return (
    isHeavenBurningWeaponName(player.weapon) || isHeavenBurningWeaponName(player.weapon2)
  );
}

export function initHeavenBurningLevel(player: Player): void {
  if (!player.counters) player.counters = {};
  if (!playerHasHeavenBurningWeapon(player)) {
    delete player.counters.heavenBurningLevel;
    return;
  }
  player.counters.heavenBurningLevel = HEAVEN_BURNING_MIN_LEVEL;
}

export function ensureHeavenBurningLevel(player: Player): void {
  if (!isHeavenBurningWeaponName(player.weapon)) return;
  if (!player.counters) player.counters = {};
  const level = player.counters.heavenBurningLevel ?? HEAVEN_BURNING_MIN_LEVEL;
  player.counters.heavenBurningLevel = Math.max(
    HEAVEN_BURNING_MIN_LEVEL,
    Math.min(HEAVEN_BURNING_MAX_LEVEL, level),
  );
}

export function getHeavenBurningLevel(player: Player): number | null {
  if (!isHeavenBurningWeaponName(player.weapon)) return null;
  ensureHeavenBurningLevel(player);
  return player.counters!.heavenBurningLevel!;
}

export function resetHeavenBurningLevelAfterAttack(
  player: Player,
  weaponName: string | undefined,
): void {
  if (!isHeavenBurningWeaponName(weaponName)) return;
  if (!player.counters) player.counters = {};
  player.counters.heavenBurningLevel = HEAVEN_BURNING_MIN_LEVEL;
}

export function validateHeavenBurningUnfold(player: Player): string | null {
  if (!isHeavenBurningWeaponName(player.weapon)) return "Heaven Burning Sword not equipped";
  ensureHeavenBurningLevel(player);
  if ((getHeavenBurningLevel(player) ?? 0) >= HEAVEN_BURNING_MAX_LEVEL) {
    return "Sword already at max level";
  }
  return null;
}

export function applyHeavenBurningUnfold(player: Player): number {
  ensureHeavenBurningLevel(player);
  const level = getHeavenBurningLevel(player)!;
  player.counters!.heavenBurningLevel = Math.min(level + 1, HEAVEN_BURNING_MAX_LEVEL);
  return player.counters!.heavenBurningLevel!;
}
