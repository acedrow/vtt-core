import { computed } from "vue";

import { boardSelection } from "./useBoardSelection.js";
import { gearPick } from "./useCharacterSheetSelection.js";
import { activeTab } from "./useGameConsole.js";
import { gameState } from "./useGameState.js";
import { activeTool } from "./useGmTools.js";
import { dataCategory, dataFocus } from "./useInfoDataSelection.js";
import { activeMainTab } from "./useMainSectionTab.js";
import { selectedMapId } from "./useMapSelection.js";

// True when Info would show MapPanel for a map that is not the live board.
export const previewMapId = computed(() => {
  if (activeMainTab.value !== "taccom") return null;
  if (activeTab.value !== "info") return null;
  const id = selectedMapId.value;
  if (!id) return null;
  if (id === gameState.value?.mapId) return null;
  if (activeTool.value) return null;
  const sel = boardSelection.value;
  if (sel?.kind === "enemy") return null;
  if (sel?.kind === "player") {
    const player = gameState.value?.players.find((p) => p.id === sel.id);
    if (!player?.characterSheetId) return null;
  }
  if (dataCategory.value || dataFocus.value) return null;
  if (gearPick.value) return null;
  return id;
});

export function useMapPreview() {
  return { previewMapId };
}
