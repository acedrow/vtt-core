import { STAIN_GEYSER_NAME, STAIN_GEYSER_OVERLAY_GROUP_KEY, stainGeyserAreaSize, stainGeyserBoxTiles } from "@gaem/hellpiercers-content/combat-ui";
import { coordKey, tileAt, type ClientMessage, type GameState } from "@gaem/shared";
import { computed, ref } from "vue";

import {
  bundledTileOverlayUrl,
  resolveOverlayKeyForPaint,
} from "../lib/bundledTileOverlays.js";
import { useGameState } from "./useGameState.js";

export type StainGeyserPlacement = { x: number; y: number };

const pendingStainGeyserPlacement = ref<StainGeyserPlacement | null>(null);
const stainGeyserHover = ref<StainGeyserPlacement | null>(null);

function mergedTileEffectTokens(state: GameState, x: number, y: number): string[] {
  const tile = tileAt(state.tiles, x, y);
  const effects = { ...(tile?.tileEffects ?? {}) };
  effects.Stained = Math.max(effects.Stained ?? 0, 1);
  return Object.entries(effects)
    .filter(([, stacks]) => stacks !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, stacks]) => `${id}:${stacks}`);
}

export function useStainGeyserPlacement() {
  const { gameState, send } = useGameState();

  const stainGeyserPlacementActive = computed(() => pendingStainGeyserPlacement.value != null);

  const stainGeyserPreviewTiles = computed(() => {
    const pending = pendingStainGeyserPlacement.value;
    const s = gameState.value;
    if (!pending || !s) return [] as { x: number; y: number }[];
    const hover = stainGeyserHover.value ?? pending;
    const size = stainGeyserAreaSize(s);
    return stainGeyserBoxTiles(pending.x, pending.y, hover.x, hover.y, size, s.width, s.height);
  });

  const stainGeyserPreviewKeys = computed(() => {
    const keys = new Set<string>();
    for (const t of stainGeyserPreviewTiles.value) keys.add(coordKey(t.x, t.y));
    return keys;
  });

  const stainGeyserPreviewOverlayUrl = computed(() =>
    pendingStainGeyserPlacement.value
      ? bundledTileOverlayUrl(STAIN_GEYSER_OVERLAY_GROUP_KEY)
      : null,
  );

  function beginStainGeyserPlacement(x: number, y: number) {
    pendingStainGeyserPlacement.value = { x, y };
    stainGeyserHover.value = { x, y };
  }

  function clearStainGeyserPlacement() {
    pendingStainGeyserPlacement.value = null;
    stainGeyserHover.value = null;
  }

  function setStainGeyserHover(x: number, y: number) {
    if (!pendingStainGeyserPlacement.value) return;
    stainGeyserHover.value = { x, y };
  }

  function tryApplyStainGeyserPlacement(x: number, y: number): boolean {
    const pending = pendingStainGeyserPlacement.value;
    const s = gameState.value;
    if (!pending || !s) return false;

    stainGeyserHover.value = { x, y };
    const size = stainGeyserAreaSize(s);
    const tiles = stainGeyserBoxTiles(pending.x, pending.y, x, y, size, s.width, s.height);
    for (const coord of tiles) {
      const overlayKey = resolveOverlayKeyForPaint(STAIN_GEYSER_OVERLAY_GROUP_KEY);
      const msg: ClientMessage = {
        type: "gmPaintTile",
        coords: [coord],
        tileEffects: mergedTileEffectTokens(s, coord.x, coord.y),
        ...(overlayKey ? { overlayKey } : {}),
      };
      send(msg);
    }
    clearStainGeyserPlacement();
    return true;
  }

  return {
    STAIN_GEYSER_NAME,
    pendingStainGeyserPlacement,
    stainGeyserPlacementActive,
    stainGeyserPreviewTiles,
    stainGeyserPreviewKeys,
    stainGeyserPreviewOverlayUrl,
    beginStainGeyserPlacement,
    clearStainGeyserPlacement,
    setStainGeyserHover,
    tryApplyStainGeyserPlacement,
  };
}
