import type { ClientMessage, GameState } from "@vtt-core/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_GM_TOOLS } from "./uiPersist.js";
import { useGameState } from "./useGameState.js";
import { applyPersistedGmTools, useGmTools } from "./useGmTools.js";

function makeTestGameState(): GameState {
  return {
    mapId: "test",
    mapName: "Test",
    width: 2,
    height: 1,
    tiles: [
      { x: 0, y: 0, terrain: ["standard"], elevation: 0 },
      { x: 1, y: 0, terrain: ["standard"], elevation: 0, deploymentZone: true },
    ],
    players: [],
    enemies: [],
    round: 1,
    roundPhase: "taccomNotStarted",
    turn: { role: "gm" },
    actedPlayerIds: [],
    turnLog: [],
    campaign: {
      partyResources: { scrap: 0 },
      unlockedUpgrades: [],
    },
  };
}

describe("useGmTools deployment zone paintbrush", () => {
  beforeEach(() => {
    applyPersistedGmTools({
      ...DEFAULT_GM_TOOLS,
      paintbrushEnableDeploymentZone: true,
    });
    useGmTools().disableAllPaintbrushOptions();
    useGameState().setGameState(makeTestGameState(), null);
  });

  afterEach(() => {
    useGmTools().clearBulkSelection();
    useGameState().clearGameState();
  });

  it("toggles each selected tile's deployment zone independently", () => {
    const sent: ClientMessage[] = [];
    useGameState().registerSend((message) => sent.push(message));
    const tools = useGmTools();
    tools.setBulkSelection({
      kind: "tiles",
      coords: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });

    tools.applyPaintbrushToTile(0, 0);

    expect(sent).toEqual([
      {
        type: "gmPaintTile",
        coords: [{ x: 0, y: 0 }],
        deploymentZone: true,
      },
      {
        type: "gmPaintTile",
        coords: [{ x: 1, y: 0 }],
        deploymentZone: false,
      },
    ]);
  });
});
