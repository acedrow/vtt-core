import { swarmCanonicalDisplayId, swarmGroupForEnemy } from "../combat/swarm.js";
import { describe, expect, it } from "vitest";

import { applyGmForceMove, validateGmForceMove } from "@gaem/shared";
import { coordKey } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState, makeTiles } from "./fixtures.js";

const SWARM_NAME = "Scorned Eyes";

describe("gmForceMove", () => {
  it("teleports a player onto impassable tiles and rejects occupied tiles", () => {
    const blocked = new Set([coordKey(5, 2)]);
    const state = makeGameState({
      tiles: makeTiles(8, 8, blocked),
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    addTestPlayer(state, "p1", { x: 2, y: 2 });
    addTestPlayer(state, "p2", { x: 4, y: 4 });

    expect(validateGmForceMove(state, { kind: "player", id: "p1" }, 5, 2)).toBeNull();
    applyGmForceMove(state, { kind: "player", id: "p1" }, 5, 2);
    expect(state.players[0]!.x).toBe(5);
    expect(state.players[0]!.y).toBe(2);

    expect(validateGmForceMove(state, { kind: "player", id: "p1" }, 4, 4)).toBe("Tile occupied");
    expect(validateGmForceMove(state, { kind: "player", id: "missing" }, 1, 1)).toBe("Unknown player");
    expect(validateGmForceMove(state, { kind: "player", id: "p1" }, 9, 1)).toBe("Out of bounds");
  });

  it("works off GM turn and does not spend enemy movement", () => {
    const state = makeGameState({
      roundPhase: "playerTurn",
      turn: { role: "player", playerId: "p1" },
    });
    addTestPlayer(state, "p1", { x: 1, y: 1 });
    const enemy = addTestEnemy(state, "e1", 3, 3, { name: "Stain Creep" });
    enemy.movementRemaining = 2;

    expect(validateGmForceMove(state, { kind: "enemy", id: "e1" }, 6, 6)).toBeNull();
    applyGmForceMove(state, { kind: "enemy", id: "e1" }, 6, 6);
    expect(enemy.x).toBe(6);
    expect(enemy.y).toBe(6);
    expect(enemy.movementRemaining).toBe(2);
  });

  it("rejects scale-2 footprint overlap with a player and allows landing on impassable", () => {
    const blocked = new Set([coordKey(5, 5), coordKey(6, 6)]);
    const state = makeGameState({ tiles: makeTiles(8, 8, blocked) });
    addTestEnemy(state, "big", 1, 1, { scale: 2, name: "Gorgenaut" });
    addTestPlayer(state, "p1", { x: 4, y: 4 });

    expect(validateGmForceMove(state, { kind: "enemy", id: "big" }, 5, 5)).toBeNull();
    expect(validateGmForceMove(state, { kind: "enemy", id: "big" }, 4, 4)).toBe("Tile occupied");
    expect(validateGmForceMove(state, { kind: "enemy", id: "big" }, 3, 4)).toBe("Tile occupied");

    applyGmForceMove(state, { kind: "enemy", id: "big" }, 5, 5);
    expect(state.enemies.find((e) => e.id === "big")).toMatchObject({ x: 5, y: 5 });
  });

  it("allows force-move onto another enemy tile", () => {
    const state = makeGameState();
    addTestEnemy(state, "ally", 2, 2, { name: "Latent Pudding" });
    addTestEnemy(state, "other", 5, 5, { name: "Latent Pudding" });

    expect(validateGmForceMove(state, { kind: "enemy", id: "ally" }, 5, 5)).toBeNull();
    applyGmForceMove(state, { kind: "enemy", id: "ally" }, 5, 5);
    expect(state.enemies.find((e) => e.id === "ally")).toMatchObject({ x: 5, y: 5 });
    expect(state.enemies.find((e) => e.id === "other")).toMatchObject({ x: 5, y: 5 });
  });

  it("moves a whole swarm as a rigid group and allows stacking on other enemies", () => {
    const state = makeGameState({ width: 10, height: 10, tiles: makeTiles(10, 10) });
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    addTestEnemy(state, "other", 5, 5, { name: "Latent Pudding" });

    const group = swarmGroupForEnemy(state, "a");
    expect(group).not.toBeNull();
    const canonId = swarmCanonicalDisplayId(state, group!.memberIds);

    // Translate so canonical lands at (4, 4) — member relative offsets preserved.
    expect(validateGmForceMove(state, { kind: "enemy", id: "a" }, 4, 4)).toBeNull();
    applyGmForceMove(state, { kind: "enemy", id: "a" }, 4, 4);

    const a = state.enemies.find((e) => e.id === "a")!;
    const b = state.enemies.find((e) => e.id === "b")!;
    expect(a.x - b.x).toBe(2 - 3);
    expect(a.y - b.y).toBe(0);
    expect(state.enemies.find((e) => e.id === canonId)).toMatchObject({ x: 4, y: 4 });

    // From (4,4) canonical, stacking onto another enemy is allowed.
    expect(validateGmForceMove(state, { kind: "enemy", id: "a" }, 5, 5)).toBeNull();
  });

  it("solo swarm member moves alone", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });

    expect(
      validateGmForceMove(state, { kind: "enemy", id: "b" }, 6, 6, { soloSwarmMember: true }),
    ).toBeNull();
    applyGmForceMove(state, { kind: "enemy", id: "b" }, 6, 6, { soloSwarmMember: true });

    expect(state.enemies.find((e) => e.id === "a")).toMatchObject({ x: 2, y: 2 });
    expect(state.enemies.find((e) => e.id === "b")).toMatchObject({ x: 6, y: 6 });
  });

  it("force-moves towers", () => {
    const state = makeGameState();
    addTestEnemy(state, "t1", 2, 2, { name: "Iatros" });
    state.enemies[0]!.kind = "tower";
    state.enemies[0]!.ownerPlayerId = "p1";

    expect(validateGmForceMove(state, { kind: "enemy", id: "t1" }, 7, 7)).toBeNull();
    applyGmForceMove(state, { kind: "enemy", id: "t1" }, 7, 7);
    expect(state.enemies[0]).toMatchObject({ x: 7, y: 7, kind: "tower" });
  });
});
