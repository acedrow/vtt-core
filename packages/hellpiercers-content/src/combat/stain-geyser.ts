import { isFactionUpgradeUnlocked } from "@gaem/shared";
import { isInBounds } from "@gaem/shared";
import type { GameState } from "@gaem/shared";

export const STAIN_GEYSER_NAME = "Stain Geyser";
export const STAIN_GEYSER_OVERLAY_GROUP_KEY = "tiles/overlays/stain/stain";
const INTERATOMIC_DOWSING = "Interatomic Dowsing";

export function stainGeyserAreaSize(state: GameState): number {
  const faction = state.campaign?.factionStates?.paracletus;
  if (faction && isFactionUpgradeUnlocked(faction, INTERATOMIC_DOWSING)) return 6;
  return 4;
}

// NxN containing the geyser; hover picks alignment among valid placements.
export function stainGeyserBoxTiles(
  gx: number,
  gy: number,
  hoverX: number,
  hoverY: number,
  size: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  if (size < 1) return [];

  const maxOffset = size - 1;
  const hx = Math.max(gx - maxOffset, Math.min(gx + maxOffset, hoverX));
  const hy = Math.max(gy - maxOffset, Math.min(gy + maxOffset, hoverY));

  const minX = Math.min(gx, hx);
  const maxX = Math.max(gx, hx);
  const minY = Math.min(gy, hy);
  const maxY = Math.max(gy, hy);

  let tlx = Math.round((gx + hx) / 2 - maxOffset / 2);
  let tly = Math.round((gy + hy) / 2 - maxOffset / 2);
  tlx = Math.max(maxX - maxOffset, Math.min(minX, tlx));
  tly = Math.max(maxY - maxOffset, Math.min(minY, tly));

  const tiles: { x: number; y: number }[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const x = tlx + dx;
      const y = tly + dy;
      if (isInBounds(x, y, width, height)) tiles.push({ x, y });
    }
  }
  return tiles;
}
