import type { MapTile } from "@vtt-core/shared";
import type { Ref } from "vue";
import { computed, onUnmounted, ref, watch } from "vue";

import { useApi } from "./useApi.js";

export function useTileAppearanceCache(tilesSource: Ref<{ tiles?: MapTile[] } | null>) {
  const { fetchTileAppearanceUrl } = useApi();
  const urls = ref<Record<string, string>>({});
  let loadGen = 0;

  const imageKeys = computed(() => {
    const keys = new Set<string>();
    for (const tile of tilesSource.value?.tiles ?? []) {
      if (tile.appearanceKey) keys.add(tile.appearanceKey);
      if (tile.overlayKey) keys.add(tile.overlayKey);
      if (tile.featureKey) keys.add(tile.featureKey);
    }
    return [...keys].sort().join("|");
  });

  async function refresh() {
    const gen = ++loadGen;
    const needed = new Set<string>();
    for (const tile of tilesSource.value?.tiles ?? []) {
      if (tile.appearanceKey) needed.add(tile.appearanceKey);
      if (tile.overlayKey) needed.add(tile.overlayKey);
      if (tile.featureKey) needed.add(tile.featureKey);
    }

    const next: Record<string, string> = {};
    const missing: string[] = [];
    for (const key of needed) {
      const cached = urls.value[key];
      if (cached) next[key] = cached;
      else missing.push(key);
    }

    const fetched = await Promise.all(
      missing.map(async (key) => {
        const url = await fetchTileAppearanceUrl(key);
        return [key, url] as const;
      }),
    );
    if (gen !== loadGen) return;

    for (const [key, url] of fetched) {
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
