import { computed } from "vue";

import type { PhaseAction } from "@vtt-core/shared";
import { isPlayerDowned, isSandboxMode, remainingPlayerIds } from "@vtt-core/shared";

import { getCombatBoardHelpers } from "../combat-board-helpers.js";
import { useBoardActionMode } from "./useBoardActionMode.js";
import { useBoardSelection } from "./useBoardSelection.js";
import { useGameState } from "./useGameState.js";
import { useSession } from "./useSession.js";
import { showToast } from "./useToasts.js";

export function usePhaseAction() {
  const { role, hasGmCapabilities } = useSession();
  const { gameState, yourPlayerId, send } = useGameState();
  const { selectBoardPlayer } = useBoardSelection();
  const { setMode } = useBoardActionMode();

  const yourPlayer = computed(() => {
    const s = gameState.value;
    const id = yourPlayerId.value;
    if (!s || !id) return null;
    return s.players.find((p) => p.id === id) ?? null;
  });

  const phaseAction = computed((): { label: string; action: PhaseAction } | null => {
    const s = gameState.value;
    if (!s || !role.value || isSandboxMode(s)) return null;

    if (s.roundPhase === "taccomNotStarted" && hasGmCapabilities.value) {
      return { label: "Start TACCOM", action: "startTaccom" };
    }
    if (s.roundPhase === "deployment" && hasGmCapabilities.value) {
      return { label: "End deployment", action: "endDeployment" };
    }
    if (s.roundPhase === "startRoundEffects" && hasGmCapabilities.value) {
      return { label: "Do effects", action: "doEffects" };
    }
    if (
      s.roundPhase === "playersChoice" &&
      role.value === "player" &&
      yourPlayerId.value &&
      yourPlayer.value &&
      !isPlayerDowned(yourPlayer.value) &&
      !s.actedPlayerIds.includes(yourPlayerId.value)
    ) {
      return { label: "Take turn", action: "takeTurn" };
    }
    if (
      s.roundPhase === "playerTurn" &&
      role.value === "player" &&
      yourPlayerId.value &&
      s.turn?.role === "player" &&
      s.turn.playerId === yourPlayerId.value
    ) {
      return { label: "End turn", action: "endPlayerTurn" };
    }
    if (s.roundPhase === "gmTurn" && hasGmCapabilities.value) {
      if (remainingPlayerIds(s).length > 0) {
        return { label: "End turn", action: "endGmTurn" };
      }
      return { label: "End turn", action: "countdownTags" };
    }
    if (s.roundPhase === "countdownTags" && hasGmCapabilities.value) {
      return { label: "End round", action: "endRound" };
    }
    return null;
  });

  function onPhaseAction() {
    if (!phaseAction.value) return;
    const action = phaseAction.value.action;
    if (action === "takeTurn" && yourPlayerId.value) {
      const player = gameState.value?.players.find((p) => p.id === yourPlayerId.value);
      if (player) selectBoardPlayer(player.id, player.characterSheetId);
    }
    if (gameState.value) {
      const gate = getCombatBoardHelpers().beforePhaseAction?.(
        gameState.value,
        action,
        yourPlayerId.value,
      );
      if (gate) {
        if (gate.boardMode) setMode(gate.boardMode);
        showToast(gate.message);
        return;
      }
    }
    send({ type: "phaseAction", action });
  }

  return { phaseAction, onPhaseAction };
}
