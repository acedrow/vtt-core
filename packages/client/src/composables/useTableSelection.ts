import { getReconTable, type ReconTableId } from "@gaem/shared";
import { ref } from "vue";

import { readPersistedUi } from "./uiPersist.js";
import { boardSelection } from "./useBoardSelection.js";
import { useCharacterSheetSelection } from "./useCharacterSheetSelection.js";
import { selectedFactionId } from "./useFactionSelection.js";
import { activeTab } from "./useGameConsole.js";
import { clearActiveTool } from "./useGmTools.js";
import { useInfoDataSelection } from "./useInfoDataSelection.js";
import { selectedMapId } from "./useMapSelection.js";

const persisted = readPersistedUi();
export const selectedTableId = ref<ReconTableId | null>(
  persisted.selectedTableId && getReconTable(persisted.selectedTableId)
    ? persisted.selectedTableId
    : null,
);
export const tablesExpanded = ref(persisted.tablesExpanded);

export function useTableSelection() {
  const { selectSheet } = useCharacterSheetSelection();
  const { clearDataCategory } = useInfoDataSelection();

  function selectTable(id: ReconTableId | null) {
    if (id) {
      clearActiveTool();
      boardSelection.value = null;
      selectSheet(null);
      selectedMapId.value = null;
      selectedFactionId.value = null;
      clearDataCategory();
      activeTab.value = "info";
    }
    selectedTableId.value = id;
  }

  function clearTable() {
    selectedTableId.value = null;
  }

  return {
    selectedTableId,
    tablesExpanded,
    selectTable,
    clearTable,
  };
}
