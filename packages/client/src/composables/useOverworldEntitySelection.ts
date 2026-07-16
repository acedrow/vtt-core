import { ref } from "vue";

import { boardSelection } from "./useBoardSelection.js";
import { useCharacterSheetSelection } from "./useCharacterSheetSelection.js";
import { activeTab } from "./useGameConsole.js";
import { clearActiveTool } from "./useGmTools.js";
import { useInfoDataSelection } from "./useInfoDataSelection.js";
import { selectedMapId } from "./useMapSelection.js";
import { selectedTableId } from "./useTableSelection.js";

export const selectedOverworldConvoyId = ref<string | null>(null);
export const selectedOverworldLocationId = ref<string | null>(null);

export function useOverworldEntitySelection() {
  const { selectSheet } = useCharacterSheetSelection();
  const { clearDataCategory } = useInfoDataSelection();

  function clearOverworldEntitySelection() {
    selectedOverworldConvoyId.value = null;
    selectedOverworldLocationId.value = null;
  }

  function prepareInfoPane() {
    clearActiveTool();
    boardSelection.value = null;
    selectSheet(null);
    selectedMapId.value = null;
    selectedTableId.value = null;
    clearDataCategory();
    activeTab.value = "info";
  }

  function selectOverworldConvoy(id: string | null) {
    if (id) {
      prepareInfoPane();
      selectedOverworldLocationId.value = null;
    }
    selectedOverworldConvoyId.value = id;
  }

  function selectOverworldLocation(id: string | null) {
    if (id) {
      prepareInfoPane();
      selectedOverworldConvoyId.value = null;
    }
    selectedOverworldLocationId.value = id;
  }

  return {
    selectedOverworldConvoyId,
    selectedOverworldLocationId,
    selectOverworldConvoy,
    selectOverworldLocation,
    clearOverworldEntitySelection,
  };
}
