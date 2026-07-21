import { getFactionById, type FactionId } from "@vtt-core/shared";
import { ref } from "vue";

import { readPersistedUi } from "./uiPersist.js";
import { boardSelection } from "./useBoardSelection.js";
import { useCharacterSheetSelection } from "./useCharacterSheetSelection.js";
import { activeTab } from "./useGameConsole.js";
import { clearActiveTool } from "./useGmTools.js";
import { useInfoDataSelection } from "./useInfoDataSelection.js";
import { selectedMapId } from "./useMapSelection.js";
import {
  selectedOverworldConvoyId,
  selectedOverworldLocationId,
} from "./useOverworldEntitySelection.js";
import { selectedTableId } from "./useTableSelection.js";

const persisted = readPersistedUi();
export const selectedFactionId = ref<FactionId | null>(
  persisted.selectedFactionId && getFactionById(persisted.selectedFactionId)
    ? persisted.selectedFactionId
    : null,
);
export const factionsExpanded = ref(persisted.factionsExpanded);

export type FactionLocationReveal = {
  factionId: FactionId;
  locationName: string;
  section: "starting" | "unique";
  token: number;
};

export const pendingFactionLocationReveal = ref<FactionLocationReveal | null>(null);

export function useFactionSelection() {
  const { selectSheet } = useCharacterSheetSelection();
  const { clearDataCategory } = useInfoDataSelection();

  function selectFaction(id: FactionId | null) {
    if (id) {
      clearActiveTool();
      boardSelection.value = null;
      selectSheet(null);
      selectedMapId.value = null;
      selectedTableId.value = null;
      clearDataCategory();
      selectedOverworldConvoyId.value = null;
      activeTab.value = "info";
    }
    selectedFactionId.value = id;
  }

  function revealFactionLocation(
    factionId: FactionId,
    locationName: string,
    section: "starting" | "unique",
  ) {
    selectFaction(factionId);
    pendingFactionLocationReveal.value = {
      factionId,
      locationName,
      section,
      token: Date.now(),
    };
  }

  function clearFaction() {
    selectedFactionId.value = null;
    selectedOverworldLocationId.value = null;
  }

  return {
    selectedFactionId,
    factionsExpanded,
    pendingFactionLocationReveal,
    selectFaction,
    revealFactionLocation,
    clearFaction,
  };
}
