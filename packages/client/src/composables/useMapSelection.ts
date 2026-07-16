import { ref } from "vue";

import { readPersistedUi } from "./uiPersist.js";
import { boardSelection } from "./useBoardSelection.js";
import { selectedFactionId } from "./useFactionSelection.js";
import { activeTab } from "./useGameConsole.js";
import { clearActiveTool } from "./useGmTools.js";
import { useCharacterSheetSelection } from "./useCharacterSheetSelection.js";
import { useInfoDataSelection } from "./useInfoDataSelection.js";
import { activeMainTab } from "./useMainSectionTab.js";
import { selectedTableId } from "./useTableSelection.js";

const persisted = readPersistedUi();
export const selectedMapId = ref<string | null>(persisted.selectedMapId);
export const mapsExpanded = ref(persisted.mapsExpanded);
export const mapsVersion = ref(0);

export function useMapSelection() {
  const { selectSheet } = useCharacterSheetSelection();
  const { clearDataCategory } = useInfoDataSelection();

  function selectMap(id: string | null) {
    if (id) {
      clearActiveTool();
      boardSelection.value = null;
      selectSheet(null);
      selectedFactionId.value = null;
      selectedTableId.value = null;
      clearDataCategory();
    }
    selectedMapId.value = id;
    if (id) {
      activeMainTab.value = "taccom";
      activeTab.value = "info";
    }
  }

  function notifyMapsChanged() {
    mapsVersion.value++;
  }

  return {
    selectedMapId,
    mapsExpanded,
    mapsVersion,
    selectMap,
    notifyMapsChanged,
  };
}
