import {
  GORGENAUT_AGNOSIA_BOX,
  GORGENAUT_AGNOSIA_CONFIRM_KIND,
  STAIN_GEYSER_OVERLAY_GROUP_KEY,
  findGorgenautAgnosiaPending,
  isGorgenautEnemy,
} from "@gaem/hellpiercers-content/combat-ui";
import { agnosiaCenteredHover, agnosiaPlacementBoxTiles, coordKey, getEnemyScale, type ClientMessage } from "@gaem/shared";
import { computed, ref, watch } from "vue";

import { bundledTileOverlayUrl } from "../lib/bundledTileOverlays.js";
import { useGameState } from "./useGameState.js";
import { useSession } from "./useSession.js";

const pendingEnemyId = ref<string | null>(null);
const hover = ref<{ x: number; y: number } | null>(null);

export function useGorgenautAgnosiaPlacement() {
  const { gameState, send } = useGameState();
  const { hasGmCapabilities } = useSession();

  const gorgenautAgnosiaPlacementActive = computed(() => pendingEnemyId.value != null);

  const pendingEnemy = computed(() => {
    const id = pendingEnemyId.value;
    const s = gameState.value;
    if (!id || !s) return null;
    return s.enemies.find((e) => e.id === id) ?? null;
  });

  const gorgenautAgnosiaPreviewTiles = computed(() => {
    const enemy = pendingEnemy.value;
    const s = gameState.value;
    if (!enemy || !s) return [] as { x: number; y: number }[];
    const h =
      hover.value ??
      agnosiaCenteredHover(enemy.x, enemy.y, getEnemyScale(enemy), GORGENAUT_AGNOSIA_BOX);
    return agnosiaPlacementBoxTiles(
      enemy.x,
      enemy.y,
      getEnemyScale(enemy),
      h.x,
      h.y,
      GORGENAUT_AGNOSIA_BOX,
      s.width,
      s.height,
    );
  });

  const gorgenautAgnosiaPreviewKeys = computed(() => {
    const keys = new Set<string>();
    for (const t of gorgenautAgnosiaPreviewTiles.value) keys.add(coordKey(t.x, t.y));
    return keys;
  });

  const gorgenautAgnosiaPreviewOverlayUrl = computed(() =>
    pendingEnemyId.value ? bundledTileOverlayUrl(STAIN_GEYSER_OVERLAY_GROUP_KEY) : null,
  );

  function beginGorgenautAgnosiaPlacement(enemyId: string) {
    const s = gameState.value;
    const enemy = s?.enemies.find((e) => e.id === enemyId);
    if (!enemy || !s) return;
    pendingEnemyId.value = enemyId;
    hover.value = agnosiaCenteredHover(
      enemy.x,
      enemy.y,
      getEnemyScale(enemy),
      GORGENAUT_AGNOSIA_BOX,
    );
  }

  function clearGorgenautAgnosiaPlacement() {
    pendingEnemyId.value = null;
    hover.value = null;
  }

  function setGorgenautAgnosiaHover(x: number, y: number) {
    if (!pendingEnemyId.value) return;
    hover.value = { x, y };
  }

  function tryApplyGorgenautAgnosiaPlacement(x: number, y: number): boolean {
    const enemyId = pendingEnemyId.value;
    const s = gameState.value;
    if (!enemyId || !s) return false;
    hover.value = { x, y };
    const msg: ClientMessage = {
      type: "confirmPending",
      kind: GORGENAUT_AGNOSIA_CONFIRM_KIND,
      enemyId,
      hoverX: x,
      hoverY: y,
    };
    send(msg);
    clearGorgenautAgnosiaPlacement();
    return true;
  }

  watch(
    () => {
      const s = gameState.value;
      if (!hasGmCapabilities.value || !s?.combat) return null;
      for (const enemy of s.enemies) {
        if (!isGorgenautEnemy(enemy)) continue;
        if (findGorgenautAgnosiaPending(s, enemy.id)) return enemy.id;
      }
      return null;
    },
    (enemyId) => {
      if (enemyId) {
        if (pendingEnemyId.value !== enemyId) beginGorgenautAgnosiaPlacement(enemyId);
      } else if (pendingEnemyId.value) {
        clearGorgenautAgnosiaPlacement();
      }
    },
    { immediate: true },
  );

  return {
    pendingGorgenautAgnosiaEnemyId: pendingEnemyId,
    gorgenautAgnosiaPlacementActive,
    gorgenautAgnosiaPreviewTiles,
    gorgenautAgnosiaPreviewKeys,
    gorgenautAgnosiaPreviewOverlayUrl,
    beginGorgenautAgnosiaPlacement,
    clearGorgenautAgnosiaPlacement,
    setGorgenautAgnosiaHover,
    tryApplyGorgenautAgnosiaPlacement,
  };
}
