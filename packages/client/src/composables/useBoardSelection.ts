import { swarmGroupForEnemy } from "@vtt-core/hellpiercers-content/combat-ui";
import type { GameState } from "@vtt-core/shared";
import { computed, ref, watch } from "vue";

import { readPersistedUi } from "./uiPersist.js";
import { selectedFactionId } from "./useFactionSelection.js";
import { clearActiveTool } from "./useGmTools.js";
import { selectedMapId } from "./useMapSelection.js";
import { useCharacterSheetSelection } from "./useCharacterSheetSelection.js";
import { activeTab } from "./useGameConsole.js";
import { useGameState } from "./useGameState.js";
import { useInfoDataSelection } from "./useInfoDataSelection.js";
import { selectedTableId } from "./useTableSelection.js";

export type BoardSelection =
  | { kind: "player"; id: string }
  | { kind: "enemy"; id: string; swarmMemberIds?: string[]; soloSwarmMember?: boolean };

const persisted = readPersistedUi();
export const boardSelection = ref<BoardSelection | null>(persisted.boardSelection);

function reconcileEnemyBoardSelection(s: GameState) {
  const sel = boardSelection.value;
  if (sel?.kind !== "enemy") return;

  const trackedIds = sel.swarmMemberIds ?? [sel.id];
  if (!trackedIds.some((id) => s.enemies.some((e) => e.id === id))) {
    boardSelection.value = null;
    return;
  }

  const anchorId = sel.soloSwarmMember
    ? sel.id
    : (trackedIds.find((id) => s.enemies.some((e) => e.id === id)) ?? sel.id);
  const group = swarmGroupForEnemy(s, anchorId);
  if (!group || group.size < 2) return;

  const hasAll =
    !sel.soloSwarmMember &&
    sel.id === group.canonicalId &&
    group.memberIds.length === trackedIds.length &&
    group.memberIds.every((id) => trackedIds.includes(id));
  if (hasAll) return;

  boardSelection.value = {
    kind: "enemy",
    id: group.canonicalId,
    swarmMemberIds: group.memberIds,
  };
}

let selectionWatchStarted = false;

export function useBoardSelection() {
  const { selectSheet, cancelGearPick, gearPick } = useCharacterSheetSelection();
  const { gameState } = useGameState();

  if (!selectionWatchStarted) {
    selectionWatchStarted = true;
    watch(
      gameState,
      (s) => {
        if (!s) return;
        const sel = boardSelection.value;
        if (!sel) return;
        if (sel.kind === "player" && !s.players.some((p) => p.id === sel.id)) {
          boardSelection.value = null;
          return;
        }
        if (sel.kind === "enemy") reconcileEnemyBoardSelection(s);
      },
      { immediate: true },
    );
  }
  const { clearDataCategory, dataCategory, dataFocus } = useInfoDataSelection();

  const selectedEnemyId = computed(() =>
    boardSelection.value?.kind === "enemy" ? boardSelection.value.id : null,
  );

  const selectedSwarmMemberIds = computed(() =>
    boardSelection.value?.kind === "enemy" ? boardSelection.value.swarmMemberIds : undefined,
  );

  const isSoloSwarmMemberSelected = computed(
    () =>
      boardSelection.value?.kind === "enemy" && boardSelection.value.soloSwarmMember === true,
  );

  function clearBoardSelection() {
    boardSelection.value = null;
  }

  function closeRightPanel() {
    if (gearPick.value) {
      cancelGearPick();
      return;
    }
    if (boardSelection.value) clearBoardSelection();
    else if (dataCategory.value || dataFocus.value) clearDataCategory();
    else if (selectedMapId.value) selectedMapId.value = null;
    else if (selectedFactionId.value) selectedFactionId.value = null;
    else if (selectedTableId.value) selectedTableId.value = null;
    else selectSheet(null);
  }

  function selectBoardPlayer(playerId: string, characterSheetId?: string) {
    clearDataCategory();
    selectedFactionId.value = null;
    selectedTableId.value = null;
    boardSelection.value = { kind: "player", id: playerId };
    activeTab.value = "info";
    if (characterSheetId) {
      selectSheet(characterSheetId);
      return;
    }
  }

  function toggleBoardEnemy(enemyId: string) {
    const sel = boardSelection.value;
    if (sel?.kind === "enemy") {
      const members = sel.swarmMemberIds ?? [sel.id];
      if (members.includes(enemyId)) {
        clearBoardSelection();
        return;
      }
    }
    selectBoardEnemy(enemyId);
  }

  function selectBoardEnemy(enemyId: string) {
    clearDataCategory();
    selectedFactionId.value = null;
    selectedTableId.value = null;
    const s = gameState.value;
    const group = s ? swarmGroupForEnemy(s, enemyId) : null;
    boardSelection.value = {
      kind: "enemy",
      id: group?.canonicalId ?? enemyId,
      swarmMemberIds: group && group.size > 1 ? group.memberIds : undefined,
    };
    activeTab.value = "info";
  }

  function selectBoardEnemyMember(enemyId: string) {
    clearDataCategory();
    selectedFactionId.value = null;
    selectedTableId.value = null;
    const s = gameState.value;
    const group = s ? swarmGroupForEnemy(s, enemyId) : null;
    if (!group || group.size < 2) {
      selectBoardEnemy(enemyId);
      return;
    }
    boardSelection.value = {
      kind: "enemy",
      id: enemyId,
      swarmMemberIds: [enemyId],
      soloSwarmMember: true,
    };
    activeTab.value = "info";
  }

  function selectSheetFromNav(sheetId: string) {
    clearActiveTool();
    selectedMapId.value = null;
    selectedFactionId.value = null;
    selectedTableId.value = null;
    clearDataCategory();
    selectSheet(sheetId);
    const player = gameState.value?.players.find((p) => p.characterSheetId === sheetId);
    boardSelection.value = player ? { kind: "player", id: player.id } : null;
  }

  function isPlayerSelected(playerId: string): boolean {
    return boardSelection.value?.kind === "player" && boardSelection.value.id === playerId;
  }

  function isEnemySelected(enemyId: string): boolean {
    const sel = boardSelection.value;
    if (sel?.kind !== "enemy") return false;
    if (sel.soloSwarmMember) return sel.id === enemyId;
    if (sel.id === enemyId) return true;
    return sel.swarmMemberIds?.includes(enemyId) ?? false;
  }

  return {
    boardSelection,
    selectedEnemyId,
    selectedSwarmMemberIds,
    isSoloSwarmMemberSelected,
    clearBoardSelection,
    closeRightPanel,
    selectBoardPlayer,
    selectBoardEnemy,
    selectBoardEnemyMember,
    toggleBoardEnemy,
    selectSheetFromNav,
    isPlayerSelected,
    isEnemySelected,
  };
}
