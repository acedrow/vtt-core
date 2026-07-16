import { describe, expect, it } from "vitest";

import { computeAttackPreviewHighlights } from "@gaem/shared";
import type { GameState } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { addTestEnemy, makeGameState } from "../fixtures.js";

function baseState(): GameState {
  return {
    mapId: "test",
    mapName: "Test",
    width: 5,
    height: 5,
    tiles: [],
    players: [
      {
        id: "p1",
        x: 2,
        y: 2,
        weapon: "Ten Thousand Year Reign Shattering Blade",
        hp: 10,
      },
    ],
    enemies: [],
    round: 1,
    roundPhase: "playerTurn",
    turn: { role: "player", playerId: "p1" },
    actedPlayerIds: [],
    turnLog: [],
    combat: createDefaultCombatState(1),
  };
}

describe("computeAttackPreviewHighlights", () => {
  it("shows all directional previews before aim", () => {
    const state = baseState();
    const highlights = computeAttackPreviewHighlights(state, {
      playerId: "p1",
      mode: "attack",
      direction: "n",
      aimed: false,
    });
    expect(highlights.primary).toHaveLength(0);
    expect(highlights.secondary.length).toBeGreaterThan(0);
  });

  it("shows only the selected direction after aim", () => {
    const state = baseState();
    const highlights = computeAttackPreviewHighlights(state, {
      playerId: "p1",
      mode: "attack",
      direction: "n",
      aimed: true,
    });
    expect(highlights.primary.length).toBeGreaterThan(0);
  });

  it("gm enemy pattern attack uses aim-then-confirm highlights", () => {
    const state = makeGameState({ width: 10, height: 10 });
    addTestEnemy(state, "g", 4, 4, { name: "Gorgenaut", scale: 2, hp: 100 });
    const unaimed = computeAttackPreviewHighlights(state, {
      mode: "gmEnemyAttack",
      enemyId: "g",
      attackIndex: 0,
      direction: "n",
      aimed: false,
    });
    expect(unaimed.primary).toHaveLength(0);
    expect(unaimed.secondary.length).toBeGreaterThan(0);

    const aimed = computeAttackPreviewHighlights(state, {
      mode: "gmEnemyAttack",
      enemyId: "g",
      attackIndex: 0,
      direction: "n",
      aimed: true,
    });
    expect(aimed.primary.length).toBeGreaterThan(0);
    expect(aimed.primary.every((key) => unaimed.secondary.includes(key))).toBe(true);
    // Scale:2 north face has two origins; default aim uses the west-most edge cell only
    expect(aimed.primary).toContain("4,3");
    expect(aimed.primary).not.toContain("5,3");
  });
});
