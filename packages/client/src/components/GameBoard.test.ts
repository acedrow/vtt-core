import type { GameState, MapTile } from "@vtt-core/shared";
import { mount, flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useBoardActionMode } from "../composables/useBoardActionMode.js";
import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useGameState } from "../composables/useGameState.js";
import GameBoard from "./GameBoard.vue";

function makeTestGameState(width = 3, height = 3): GameState {
  const tiles: MapTile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, terrain: ["standard"], elevation: 0 });
    }
  }
  return {
    mapId: "test",
    mapName: "Test",
    width,
    height,
    tiles,
    players: [],
    enemies: [],
    round: 1,
    roundPhase: "deployment",
    turn: { role: "gm" },
    actedPlayerIds: [],
    turnLog: [],
    sandboxMode: false,
    campaign: {
      partyResources: { scrap: 0 },
      unlockedUpgrades: [],
    },
  };
}

describe("GameBoard", () => {
  beforeEach(() => {
    useGameState().setGameState(makeTestGameState(), null);
  });

  afterEach(() => {
    useGameState().clearGameState();
    useBoardSelection().clearBoardSelection();
    useBoardActionMode().clearMode();
  });

  it("renders the board grid with one cell per map tile", async () => {
    const wrapper = mount(GameBoard, {
      props: { role: "gm" },
    });
    await flushPromises();

    expect(wrapper.find(".game-board").exists()).toBe(true);
    expect(wrapper.find(".board").exists()).toBe(true);
    expect(wrapper.findAll("button.cell").length).toBe(9);
  });
});
