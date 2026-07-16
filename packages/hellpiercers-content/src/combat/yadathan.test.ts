import { describe, expect, it } from "vitest";
import { getEnemyMaxHp } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../../../shared/src/test/fixtures.js";
import { applyPlaceTower, applyYadathanReversal, getPlayerTower, TOWER_KATAPTY } from "./yadathan.js";

describe("Yadathan towers", () => {
  it("initializes tower HP from armor data, not enemy listings", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, armor: "YADATHAN" });
    player.data = { ...(player.data ?? {}), yadathanTower: TOWER_KATAPTY };

    const result = applyPlaceTower(state, player, 4, 2);
    expect("error" in result).toBe(false);

    const tower = getPlayerTower(state, player.id);
    expect(tower).toBeDefined();
    expect(tower!.hp).toBe(5);
    expect(getEnemyMaxHp(tower!)).toBe(5);
  });

  it("Reversal extra line can run from the tower to an ally instead of from the player", () => {
    const state = makeGameState({ width: 12, height: 12 });
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, armor: "YADATHAN" });
    player.data = { ...(player.data ?? {}), yadathanTower: TOWER_KATAPTY };
    applyPlaceTower(state, player, 4, 2);

    const ally = addTestPlayer(state, "p2", { x: 4, y: 8 });
    // On the straight vertical line from the tower to the ally, but off the
    // diagonal line from the player (2,2) to the ally.
    const enemy = addTestEnemy(state, "e1", 4, 5, { name: "Shadowing Witness", hp: 1 });

    applyYadathanReversal(state, player, 3, [{ allyId: ally.id, anchor: "player" }]);
    expect(enemy.hp).toBe(1);

    applyYadathanReversal(state, player, 3, [{ allyId: ally.id, anchor: "tower" }]);
    expect(enemy.hp).toBe(0);
  });
});
