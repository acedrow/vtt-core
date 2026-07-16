import { describe, expect, it } from "vitest";
import {
  applyAttackToEnemies,
  applyOmnistrike,
  evaluateOmnistrikePlacement,
  resolveBombAttackSpec,
  SABAOTH_WEAPON_NAME,
} from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../fixtures.js";
import { tileAt } from "@gaem/shared";

describe("Sabaoth bomb square effects on normal attacks", () => {
  it("Pelti sets Advantageous terrain and Akeomai heals an ally in range, outside Omnistrike", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, weapon: SABAOTH_WEAPON_NAME });
    const ally = addTestPlayer(state, "p2", { x: 3, y: 3, hp: 5, effects: {} });

    const pelti = resolveBombAttackSpec(SABAOTH_WEAPON_NAME, 3)!;
    expect(pelti.name).toBeUndefined();
    applyAttackToEnemies(state, pelti, { x: player.x, y: player.y }, "e", undefined, {
      weaponName: SABAOTH_WEAPON_NAME,
    });
    const hitTile = tileAt(state.tiles, player.x + 1, player.y)!;
    expect(hitTile.terrain).toContain("advantageous");

    const akeomai = resolveBombAttackSpec(SABAOTH_WEAPON_NAME, 4)!;
    applyAttackToEnemies(state, akeomai, { x: player.x, y: player.y }, "e", undefined, {
      weaponName: SABAOTH_WEAPON_NAME,
    });
    expect(ally.effects?.Healing).toBe(2);
  });
});

describe("Omnistrike Swarm and range-band accounting", () => {
  it("hits a Swarm's pooled HP once per bomb, not once per member tile", () => {
    const state = makeGameState({ width: 16, height: 16 });
    const player = addTestPlayer(state, "p1", { x: 6, y: 6, weapon: SABAOTH_WEAPON_NAME });
    // Aragmos's own pattern covers two adjacent tiles ([1,0] and [2,0] off its anchor),
    // so a single bomb call must dedupe the swarm hit across both member tiles.
    // Pooled HP for a 2-member Swarm caps at 20 (getSwarmMaxHp).
    addTestEnemy(state, "e1", 11, 6, { name: "Shadowing Witness", hp: 20 });
    addTestEnemy(state, "e2", 12, 6, { name: "Shadowing Witness", hp: 20 });

    applyOmnistrike(state, player, {
      bombIndices: [0, 0],
      anchors: [
        { x: 13, y: 6 },
        { x: 13, y: 6 },
      ],
      direction: "e",
    });
    // Aragmos deals 5 per bomb × 2 bombs = 10 total, not 20 (once per member tile per bomb).
    expect(state.enemies[0]!.hp).toBe(10);
    expect(state.enemies[1]!.hp).toBe(10);
  });

  it("rejects placing a short-range bomb inside a longer-range bomb's minimum", () => {
    const state = makeGameState({ width: 20, height: 20 });
    const player = { x: 10, y: 10 };
    const pelti = resolveBombAttackSpec(SABAOTH_WEAPON_NAME, 3)!; // Range 3-5
    const akinakis = resolveBombAttackSpec(SABAOTH_WEAPON_NAME, 2)!; // Range 5-6

    // Anchored so Pelti's nearest tile is 4 empty spaces out (legal, min 3) while
    // Akinakis's nearest tile is only 3 empty spaces out (illegal, min 5).
    const peltiPlacement = evaluateOmnistrikePlacement(
      player,
      { x: 15, y: 10 },
      pelti,
      "e",
      state,
    );
    expect(peltiPlacement.tooCloseKeys.size).toBe(0);

    const akinakisPlacement = evaluateOmnistrikePlacement(
      player,
      { x: 15, y: 10 },
      akinakis,
      "e",
      state,
    );
    expect(akinakisPlacement.tooCloseKeys.size).toBeGreaterThan(0);
  });
});
