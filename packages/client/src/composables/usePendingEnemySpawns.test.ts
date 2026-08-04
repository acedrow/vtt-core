import type { GameState } from "@vtt-core/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

import { usePendingEnemySpawns } from "./usePendingEnemySpawns.js";

function makeTestGameState(enemies: GameState["enemies"] = []): GameState {
  return {
    mapId: "test",
    mapName: "Test",
    width: 3,
    height: 3,
    tiles: [{ x: 0, y: 0, terrain: ["standard"], elevation: 0 }],
    players: [],
    enemies,
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

describe("usePendingEnemySpawns", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears a pending spawn once a matching enemy shows up in gameState", async () => {
    const gameState = ref<GameState | null>(makeTestGameState());
    const onTimeout = vi.fn();
    const { pendingEnemySpawns, startPendingSpawn } = usePendingEnemySpawns(gameState, onTimeout);

    const id = startPendingSpawn(1, 1, "Goblin");
    expect(pendingEnemySpawns.value.has(id)).toBe(true);

    gameState.value = makeTestGameState([
      { id: "e1", name: "Goblin", x: 1, y: 1, hp: 5, maxHp: 5 } as GameState["enemies"][number],
    ]);
    await Promise.resolve();

    expect(pendingEnemySpawns.value.has(id)).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("times out and reports an error if no matching enemy ever appears", () => {
    vi.useFakeTimers();
    const gameState = ref<GameState | null>(makeTestGameState());
    const onTimeout = vi.fn();
    const { pendingEnemySpawns, startPendingSpawn } = usePendingEnemySpawns(gameState, onTimeout);

    const id = startPendingSpawn(1, 1, "Goblin");
    expect(pendingEnemySpawns.value.has(id)).toBe(true);

    vi.advanceTimersByTime(10_000);

    expect(pendingEnemySpawns.value.has(id)).toBe(false);
    expect(onTimeout).toHaveBeenCalledWith(expect.stringMatching(/goblin/i));
  });
});
