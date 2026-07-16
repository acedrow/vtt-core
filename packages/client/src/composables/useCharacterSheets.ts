import type { CharacterSheet } from "@gaem/shared";
import { ref, watch } from "vue";

import { useApi } from "./useApi.js";
import { useCharacterSheetSelection } from "./useCharacterSheetSelection.js";

const sheets = ref<CharacterSheet[]>([]);
const loading = ref(false);
const loadError = ref<string | null>(null);
let loadPromise: Promise<void> | null = null;

export function useCharacterSheets() {
  const { apiFetch } = useApi();
  const { sheetsVersion } = useCharacterSheetSelection();

  async function loadSheets() {
    if (loadPromise) return loadPromise;
    loading.value = true;
    loadError.value = null;
    loadPromise = (async () => {
      try {
        const res = await apiFetch("/api/character-sheets");
        if (!res.ok) throw new Error("Failed to load character sheets");
        const data = (await res.json()) as { sheets: CharacterSheet[] };
        sheets.value = data.sheets;
      } catch {
        loadError.value = "Unable to load sheets";
        sheets.value = [];
      } finally {
        loading.value = false;
        loadPromise = null;
      }
    })();
    return loadPromise;
  }

  watch(sheetsVersion, () => {
    void loadSheets();
  });

  return { sheets, loading, loadError, loadSheets };
}
