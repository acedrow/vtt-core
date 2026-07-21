import type { CharacterSheet, Player } from "@vtt-core/shared";
import type { Ref } from "vue";
import { computed, onUnmounted, ref, watch } from "vue";

import { useApi } from "./useApi.js";

export function usePortraitCache(
  sheets: Ref<CharacterSheet[]>,
  players: Ref<Player[] | undefined>,
) {
  const { fetchPortraitUrl } = useApi();
  const urls = ref<Record<string, string>>({});
  let loadGen = 0;

  async function refresh() {
    const gen = ++loadGen;
    const needed = new Set<string>();
    for (const player of players.value ?? []) {
      if (!player.characterSheetId) continue;
      const sheet = sheets.value.find((s) => s.id === player.characterSheetId);
      if (sheet?.portraitKey) needed.add(player.characterSheetId);
    }

    const next: Record<string, string> = {};
    for (const id of needed) {
      if (urls.value[id]) {
        next[id] = urls.value[id]!;
        continue;
      }
      const url = await fetchPortraitUrl(id);
      if (gen !== loadGen) return;
      if (url) next[id] = url;
    }

    for (const [id, url] of Object.entries(urls.value)) {
      if (!needed.has(id)) URL.revokeObjectURL(url);
    }
    urls.value = next;
  }

  // Only refetch when the set of portrait-bearing sheets on the board changes,
  // not on unrelated player/sheet mutations (hp, position, effects, etc.).
  const portraitSignature = computed(() =>
    (players.value ?? [])
      .map((p) => p.characterSheetId)
      .filter((id): id is string => !!id)
      .map((id) => `${id}:${sheets.value.find((s) => s.id === id)?.portraitKey ?? ""}`)
      .sort()
      .join("|"),
  );

  watch(portraitSignature, () => void refresh(), { immediate: true });

  onUnmounted(() => {
    for (const url of Object.values(urls.value)) URL.revokeObjectURL(url);
  });

  function portraitUrlFor(sheetId: string | undefined): string | null {
    if (!sheetId) return null;
    return urls.value[sheetId] ?? null;
  }

  return { portraitUrlFor };
}
