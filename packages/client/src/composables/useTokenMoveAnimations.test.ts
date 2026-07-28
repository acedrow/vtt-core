import type { Enemy, GameState, MapTile, Player } from "@vtt-core/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

import { useTokenMoveAnimations } from "./useTokenMoveAnimations.js";

function makeTiles(width: number, height: number): MapTile[] {
  const tiles: MapTile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, terrain: ["standard"], elevation: 0 });
    }
  }
  return tiles;
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    mapId: "test",
    mapName: "Test",
    width: 5,
    height: 5,
    tiles: makeTiles(5, 5),
    players: [],
    enemies: [],
    round: 1,
    roundPhase: "gmTurn",
    turn: { role: "gm" },
    actedPlayerIds: [],
    turnLog: [],
    sandboxMode: true,
    campaign: {
      partyResources: { scrap: 0 },
      unlockedUpgrades: [],
    },
    ...overrides,
  };
}

function player(id: string, x: number, y: number): Player {
  return { id, x, y, hp: 10 } as Player;
}

function enemy(id: string, x: number, y: number): Enemy {
  return { id, name: "Test", x, y, hp: 5 } as Enemy;
}

describe("useTokenMoveAnimations", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  it("does not animate on initial state seed", async () => {
    const gameState = ref<GameState | null>(null);
    const boardKey = ref<string | null>(null);
    const { activeEnemyMoves, activePlayerMoves } = useTokenMoveAnimations(gameState, boardKey);

    gameState.value = makeState({
      players: [player("p1", 1, 1)],
      enemies: [enemy("e1", 2, 2)],
    });
    boardKey.value = "test:5x5";
    await nextTick();

    expect(activePlayerMoves.value).toHaveLength(0);
    expect(activeEnemyMoves.value).toHaveLength(0);
  });

  it("starts slides when positions change after seed", async () => {
    const gameState = ref<GameState | null>(
      makeState({
        players: [player("p1", 1, 1)],
        enemies: [enemy("e1", 2, 2)],
      }),
    );
    const boardKey = ref<string | null>("test:5x5");
    const { activeEnemyMoves, activePlayerMoves } = useTokenMoveAnimations(gameState, boardKey);
    await nextTick();

    gameState.value = makeState({
      players: [player("p1", 3, 1)],
      enemies: [enemy("e1", 2, 4)],
    });
    await nextTick();

    expect(activePlayerMoves.value).toHaveLength(1);
    expect(activePlayerMoves.value[0]).toMatchObject({
      id: "p1",
      fromX: 1,
      fromY: 1,
      toX: 3,
      toY: 1,
    });
    expect(activeEnemyMoves.value).toHaveLength(1);
    expect(activeEnemyMoves.value[0]).toMatchObject({
      id: "e1",
      fromX: 2,
      fromY: 2,
      toX: 2,
      toY: 4,
    });
  });

  it("dedupes optimistic start with matching state update", async () => {
    const gameState = ref<GameState | null>(
      makeState({
        enemies: [enemy("e1", 0, 0)],
      }),
    );
    const boardKey = ref<string | null>("test:5x5");
    const { activeEnemyMoves, startEnemyMove } = useTokenMoveAnimations(gameState, boardKey);
    await nextTick();

    startEnemyMove("e1", { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(activeEnemyMoves.value).toHaveLength(1);

    gameState.value = makeState({
      enemies: [enemy("e1", 1, 0)],
    });
    await nextTick();

    expect(activeEnemyMoves.value).toHaveLength(1);
    expect(activeEnemyMoves.value[0]?.toX).toBe(1);
  });

  it("clears animations on boardKey change without animating", async () => {
    const gameState = ref<GameState | null>(
      makeState({
        enemies: [enemy("e1", 0, 0)],
      }),
    );
    const boardKey = ref<string | null>("test:5x5");
    const { activeEnemyMoves, startEnemyMove } = useTokenMoveAnimations(gameState, boardKey);
    await nextTick();

    startEnemyMove("e1", { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(activeEnemyMoves.value).toHaveLength(1);

    gameState.value = makeState({
      mapId: "other",
      enemies: [enemy("e1", 4, 4)],
    });
    boardKey.value = "other:5x5";
    await nextTick();

    expect(activeEnemyMoves.value).toHaveLength(0);
  });

  it("does not animate newly spawned tokens", async () => {
    const gameState = ref<GameState | null>(makeState({ enemies: [] }));
    const boardKey = ref<string | null>("test:5x5");
    const { activeEnemyMoves } = useTokenMoveAnimations(gameState, boardKey);
    await nextTick();

    gameState.value = makeState({
      enemies: [enemy("e1", 2, 2)],
    });
    await nextTick();

    expect(activeEnemyMoves.value).toHaveLength(0);
  });
});
