import { describe, expect, it } from "vitest";
import { applyDamageToEnemy } from "@gaem/shared";
import {
  applyStainwalkGmTurnEnd,
  applyStainwalkMovement,
  enemyOnStainedTile,
  stainwalkDamageAdjustment,
  stainwalkKind,
} from "./stainwalk.js";
import { addEnemy, applyPhaseAction } from "@gaem/shared";
import { tileAt } from "@gaem/shared";
import { addTestEnemy, gmCtx, makeGameState } from "../../../shared/src/test/fixtures.js";

function stainTile(state: ReturnType<typeof makeGameState>, x: number, y: number): void {
  const tile = tileAt(state.tiles, x, y)!;
  tile.tileEffects = { ...(tile.tileEffects ?? {}), Stained: 1 };
}

describe("stainwalk", () => {
  describe("stainwalkKind / enemyOnStainedTile", () => {
    it("resolves canonical kinds by listing name", () => {
      expect(stainwalkKind({ name: "OROBAS" })).toBe("orobas");
      expect(stainwalkKind({ name: "PRISTIR" })).toBe("eyesting-rose");
      expect(stainwalkKind({ name: "RETIARIUS" })).toBe("gorgenaut");
      expect(stainwalkKind({ name: "POTAGON" })).toBe("lurking-freak");
      expect(stainwalkKind({ name: "Stain Creep" })).toBe("stain-creep");
      expect(stainwalkKind({ name: "Latent Pudding" })).toBeNull();
    });

    it("detects stained footprint tiles", () => {
      const state = makeGameState();
      const enemy = addTestEnemy(state, "e1", 2, 2, { name: "OROBAS", scale: 3 });
      expect(enemyOnStainedTile(state, enemy)).toBe(false);
      stainTile(state, 4, 4);
      expect(enemyOnStainedTile(state, enemy)).toBe(true);
    });
  });

  describe("applyStainwalkMovement", () => {
    it("doubles OROBAS movement when on Stain", () => {
      const state = makeGameState();
      stainTile(state, 3, 3);
      const err = addEnemy(state, { id: "boss", name: "OROBAS", x: 3, y: 3, scale: 3 });
      expect(err).toBeNull();
      expect(state.enemies[0]!.movementRemaining).toBe(8);
    });

    it("does not double OROBAS movement off Stain", () => {
      const state = makeGameState();
      const err = addEnemy(state, { id: "boss", name: "OROBAS", x: 3, y: 3, scale: 3 });
      expect(err).toBeNull();
      expect(state.enemies[0]!.movementRemaining).toBe(4);
    });

    it("leaves other enemies at base speed on Stain", () => {
      const state = makeGameState();
      stainTile(state, 2, 2);
      const enemy = addTestEnemy(state, "e1", 2, 2, { name: "Gorgenaut", scale: 2 });
      applyStainwalkMovement(state, enemy);
      expect(enemy.movementRemaining).toBe(6);
    });
  });

  describe("applyStainwalkGmTurnEnd", () => {
    it("heals Gorgenaut on Stain and damages Lurking Freak off Stain", () => {
      const state = makeGameState();
      stainTile(state, 2, 2);
      const gorgenaut = addTestEnemy(state, "g", 2, 2, { name: "Gorgenaut", scale: 2, hp: 50 });
      const freak = addTestEnemy(state, "f", 5, 5, { name: "Lurking Freak", scale: 2, hp: 90 });

      const msgs = applyStainwalkGmTurnEnd(state);
      expect(gorgenaut.hp).toBe(60);
      expect(freak.hp).toBe(80);
      expect(msgs.some((m) => m.includes("Gorgenaut") && m.includes("10 HP"))).toBe(true);
      expect(msgs.some((m) => m.includes("Lurking Freak") && m.includes("10 damage"))).toBe(true);
    });

    it("heals Gorgenaut when only a non-anchor footprint tile is Stained", () => {
      const state = makeGameState();
      stainTile(state, 3, 3);
      const gorgenaut = addTestEnemy(state, "g", 2, 2, { name: "Gorgenaut", scale: 2, hp: 50 });

      expect(enemyOnStainedTile(state, gorgenaut)).toBe(true);
      const msgs = applyStainwalkGmTurnEnd(state);
      expect(gorgenaut.hp).toBe(60);
      expect(msgs).toEqual(["Gorgenaut recovered 10 HP (Stainwalk)"]);
    });

    it("skips Gorgenaut off Stain and Lurking Freak on Stain", () => {
      const state = makeGameState();
      stainTile(state, 5, 5);
      const gorgenaut = addTestEnemy(state, "g", 2, 2, { name: "Gorgenaut", scale: 2, hp: 50 });
      const freak = addTestEnemy(state, "f", 5, 5, { name: "Lurking Freak", scale: 2, hp: 90 });

      expect(applyStainwalkGmTurnEnd(state)).toEqual([]);
      expect(gorgenaut.hp).toBe(50);
      expect(freak.hp).toBe(90);
    });

    it("skips dead enemies and sandbox mode", () => {
      const state = makeGameState();
      stainTile(state, 2, 2);
      addTestEnemy(state, "g", 2, 2, { name: "Gorgenaut", scale: 2, hp: 0 });
      expect(applyStainwalkGmTurnEnd(state)).toEqual([]);

      const sandbox = makeGameState({ sandboxMode: true });
      stainTile(sandbox, 2, 2);
      addTestEnemy(sandbox, "g", 2, 2, { name: "Gorgenaut", scale: 2, hp: 50 });
      expect(applyStainwalkGmTurnEnd(sandbox)).toEqual([]);
      expect(sandbox.enemies[0]!.hp).toBe(50);
    });

    it("runs from countdownTags phase action", () => {
      const state = makeGameState({
        roundPhase: "gmTurn",
        turn: { role: "gm" },
        actedPlayerIds: ["p1"],
      });
      stainTile(state, 2, 2);
      addTestEnemy(state, "g", 2, 2, { name: "Gorgenaut", scale: 2, hp: 40 });
      const msg = applyPhaseAction(state, "countdownTags", gmCtx());
      expect(state.roundPhase).toBe("countdownTags");
      expect(state.enemies[0]!.hp).toBe(50);
      expect(msg).toContain("Gorgenaut recovered 10 HP (Stainwalk)");
    });
  });

  describe("stainwalkDamageAdjustment", () => {
    it("adds 2 damage to Eyesting Rose on Stain", () => {
      const state = makeGameState();
      stainTile(state, 2, 2);
      const rose = addTestEnemy(state, "rose", 2, 2, { name: "Eyesting Rose", hp: 100 });
      expect(stainwalkDamageAdjustment(state, rose)).toBe(2);
      applyDamageToEnemy(rose, 5, state);
      expect(rose.hp).toBe(93);
    });

    it("reduces damage for allies on connected Stained tiles", () => {
      const state = makeGameState();
      stainTile(state, 2, 2);
      stainTile(state, 3, 2);
      stainTile(state, 4, 2);
      addTestEnemy(state, "rose", 2, 2, { name: "Eyesting Rose", hp: 100 });
      const ally = addTestEnemy(state, "ally", 4, 2, { name: "Latent Pudding", hp: 1 });
      expect(stainwalkDamageAdjustment(state, ally)).toBe(-2);
      applyDamageToEnemy(ally, 5, state);
      expect(ally.hp).toBe(0);
      expect(state.damageEvents?.[0]?.amount).toBe(3);
    });

    it("does not reduce damage for disconnected or unstained allies", () => {
      const state = makeGameState();
      stainTile(state, 2, 2);
      stainTile(state, 6, 6);
      addTestEnemy(state, "rose", 2, 2, { name: "Eyesting Rose", hp: 100 });
      const disconnected = addTestEnemy(state, "d", 6, 6, { name: "Latent Pudding", hp: 1 });
      const unstained = addTestEnemy(state, "u", 4, 4, { name: "Latent Pudding", hp: 1 });
      expect(stainwalkDamageAdjustment(state, disconnected)).toBe(0);
      expect(stainwalkDamageAdjustment(state, unstained)).toBe(0);
    });

    it("does nothing when Eyesting Rose is off Stain", () => {
      const state = makeGameState();
      stainTile(state, 4, 4);
      addTestEnemy(state, "rose", 2, 2, { name: "Eyesting Rose", hp: 100 });
      const ally = addTestEnemy(state, "ally", 4, 4, { name: "Latent Pudding", hp: 1 });
      expect(stainwalkDamageAdjustment(state, ally)).toBe(0);
    });
  });
});
