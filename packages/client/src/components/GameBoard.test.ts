import type { ClientMessage, GameState, MapTile } from "@vtt-core/shared";
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

  it("shows deployment zones to the GM before TACCOM starts", async () => {
    const state = makeTestGameState();
    state.roundPhase = "taccomNotStarted";
    state.tiles[4]!.deploymentZone = true;
    useGameState().setGameState(state, null);

    const wrapper = mount(GameBoard, { props: { role: "gm" } });
    await flushPromises();

    expect(wrapper.findAll("button.cell")[4]!.classes()).toContain("deployment-zone");
  });

  it("highlights, previews, and sends a full reachable player path", async () => {
    const state = makeTestGameState(4, 3);
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.players.push({
      id: "p1",
      x: 0,
      y: 0,
      speed: 3,
      hp: 10,
      actionBudget: {
        main: true,
        support: true,
        aux: true,
        movementRemaining: 3,
        movementMax: 3,
      },
    });
    const sent: ClientMessage[] = [];
    useGameState().setGameState(state, "p1");
    useGameState().registerSend((message) => sent.push(message));
    const wrapper = mount(GameBoard, { props: { role: "player" } });
    await flushPromises();

    const destination = wrapper.findAll("button.cell")[2]!;
    expect(destination.classes()).toContain("move-secondary");

    await destination.trigger("mouseenter");
    expect(wrapper.find(".movement-path-overlay").exists()).toBe(true);
    expect(wrapper.find(".tooltip-move-cost").text()).toBe("Move cost: 2");

    await destination.trigger("click");
    expect(sent).toContainEqual({
      type: "movePath",
      path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
    });
    expect(wrapper.find(".teleport-overlay").exists()).toBe(true);

    await wrapper.findAll("button.cell")[1]!.trigger("click");
    expect(sent.filter((message) => message.type === "movePath")).toHaveLength(1);

    await destination.trigger("mouseleave");
    expect(wrapper.find(".movement-path-overlay").exists()).toBe(false);
    wrapper.unmount();
  });

  it("sends a full reachable path for a selected non-swarm enemy", async () => {
    const state = makeTestGameState(4, 3);
    state.roundPhase = "gmTurn";
    state.turn = { role: "gm" };
    state.enemies.push({
      id: "e1",
      x: 0,
      y: 0,
      hp: 5,
      speed: 3,
      movementRemaining: 3,
    });
    const sent: ClientMessage[] = [];
    useGameState().setGameState(state, null);
    useGameState().registerSend((message) => sent.push(message));
    useBoardSelection().selectBoardEnemy("e1");
    const wrapper = mount(GameBoard, { props: { role: "gm" } });
    await flushPromises();

    const destination = wrapper.findAll("button.cell")[2]!;
    expect(destination.classes()).toContain("gm-movable");
    await destination.trigger("click");

    expect(sent).toContainEqual({
      type: "gmEnemyAction",
      action: {
        action: "move",
        enemyId: "e1",
        path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
      },
    });
  });
});
