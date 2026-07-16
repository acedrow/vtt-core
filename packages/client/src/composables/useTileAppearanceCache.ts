import type { GameState } from "@gaem/shared";
import type { Ref } from "vue";
import { computed, onUnmounted, ref, watch } from "vue";

import { useApi } from "./useApi.js";

export function useTileAppearanceCache(gameState: Ref<GameState | null>) {
  const { fetchTileAppearanceUrl } = useApi();
  const urls = ref<Record<string, string>>({});
  let loadGen = 0;

  const imageKeys = computed(() => {
    const keys = new Set<string>();
    for (const tile of gameState.value?.tiles ?? []) {
      if (tile.appearanceKey) keys.add(tile.appearanceKey);
      if (tile.overlayKey) keys.add(tile.overlayKey);
      if (tile.featureKey) keys.add(tile.featureKey);
    }
    return [...keys].sort().join("|");
  });

  async function refresh() {
    const gen = ++loadGen;
    const needed = new Set<string>();
    for (const tile of gameState.value?.tiles ?? []) {
      if (tile.appearanceKey) needed.add(tile.appearanceKey);
      if (tile.overlayKey) needed.add(tile.overlayKey);
      if (tile.featureKey) needed.add(tile.featureKey);
    }

    const next: Record<string, string> = {};
    for (const key of needed) {
      if (urls.value[key]) {
        next[key] = urls.value[key]!;
        continue;
      }
      const url = await fetchTileAppearanceUrl(key);
      if (gen !== loadGen) return;
      if (url) next[key] = url;
    }

    for (const [key, url] of Object.entries(urls.value)) {
      if (!needed.has(key) && url.startsWith("blob:")) URL.revokeObjectURL(url);
    }
    urls.value = next;
  }

  watch(imageKeys, () => void refresh(), { immediate: true });

  onUnmounted(() => {
    for (const url of Object.values(urls.value)) {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }
  });

  function tileAppearanceUrlFor(key: string | undefined): string | null {
    if (!key) return null;
    return urls.value[key] ?? null;
  }

  return { tileAppearanceUrlFor };
}
