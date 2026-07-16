import type { ClientMessage, GameState } from "@gaem/shared";
import { ref } from "vue";

const gameState = ref<GameState | null>(null);
const yourPlayerId = ref<string | null>(null);
let sendFn: ((msg: ClientMessage) => void) | null = null;

export function useGameState() {
  function setGameState(state: GameState, playerId: string | null) {
    gameState.value = state;
    yourPlayerId.value = playerId;
  }

  function registerSend(fn: (msg: ClientMessage) => void) {
    sendFn = fn;
  }

  function send(msg: ClientMessage) {
    sendFn?.(msg);
  }

  function clearGameState() {
    gameState.value = null;
    yourPlayerId.value = null;
    sendFn = null;
  }

  return {
    gameState,
    yourPlayerId,
    setGameState,
    registerSend,
    send,
    clearGameState,
  };
}
