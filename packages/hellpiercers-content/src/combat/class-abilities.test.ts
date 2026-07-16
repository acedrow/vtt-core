import { describe, expect, it } from "vitest";
import { applyClassActive, applyResolveClassReaction, handleEnemyDefeated, validateClassActive } from "./class-abilities.js";
import { applyPlayerAction, validatePlayerAction } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../../../shared/src/test/fixtures.js";
import { tileAt } from "@gaem/shared";

describe("class-abilities", () => {
  it("KOPIS Mag Dump marks enemy", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, class: "KOPIS", actionBudget: true });
    addTestEnemy(state, "e1", 3, 2, { name: "Gorgenaut" });
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(1);

    const msg = applyClassActive(state, "p1", {
      action: "classActive",
      kind: "mag_dump",
      targetEnemyIds: ["e1"],
    });
    expect(msg).toContain("Mag Dump");
    expect(state.combat!.kopisMarks!.p1).toBe("e1");
    expect(state.enemies.find((e) => e.id === "e1")?.effects?.["Mag Dump"]).toBe(1);
  });

  it("KOPIS Mag Dump rejects enemy blocked by obstacle", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", { x: 2, y: 2, class: "KOPIS", actionBudget: true });
    addTestEnemy(state, "e1", 5, 2, { name: "Gorgenaut" });
    tileAt(state.tiles, 3, 2)!.terrain = ["obstacle"];
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(1);

    expect(
      validateClassActive(state, player, {
        action: "classActive",
        kind: "mag_dump",
        targetEnemyIds: ["e1"],
      }),
    ).toBe("No line of sight");
  });

  it("drops Kopis token when marked enemy defeated", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { class: "KOPIS" });
    const enemy = addTestEnemy(state, "e1", 3, 2, { hp: 0 });
    state.combat = createDefaultCombatState(1);
    state.combat!.kopisMarks = { p1: "e1" };

    const msg = handleEnemyDefeated(state, enemy, "p1");
    expect(msg).toContain("token");
    expect(state.combat!.boardTokens!.length).toBe(1);
  });

  it("HEPHAESTUS Synesis restores equipment on kill", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", {
      x: 2,
      y: 2,
      class: "HEPHAESTUS",
      equipmentUses: 0,
      actionBudget: true,
    });
    addTestEnemy(state, "e1", 3, 2, { name: "Stain Creep", hp: 1 });
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(1);

    const msg = applyClassActive(state, "p1", {
      action: "classActive",
      kind: "synesis_conversion",
      targetEnemyIds: ["e1"],
    });
    expect(msg).toContain("Equipment restored");
    expect(player.equipmentUses).toBe(1);
  });

  it("HEPHAESTUS Synesis restores equipment after Haste-spent Support", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", {
      x: 2,
      y: 2,
      class: "HEPHAESTUS",
      equipmentUses: 0,
      actionBudget: true,
      equipment: "Hylic Annihilation Corridor",
      effects: { Haste: 1 },
    });
    addTestEnemy(state, "e1", 3, 2, { name: "Stain Creep", hp: 1 });
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(1);

    // Spend Support on equipment, then Haste another Support for Synesis
    player.actionBudget!.support = false;
    player.hasteActionTier = "support";

    const msg = applyPlayerAction(state, "p1", {
      action: "classActive",
      kind: "synesis_conversion",
      targetEnemyIds: ["e1"],
    });
    expect(msg).toContain("Equipment restored");
    expect(player.equipmentUses).toBe(1);
    expect(player.actionBudget?.support).toBe(false);
    expect(player.hasteActionTier).toBeUndefined();
    expect(player.effects?.Haste ?? 0).toBe(0);
    // Charge is back but Support was spent on Synesis — Use needs Support again
    expect(
      validatePlayerAction(state, "p1", {
        action: "useEquipment",
        detail: player.equipment,
      }),
    ).toBe("Support action spent");
  });

  it("HEPHAESTUS Synesis does not restore when armor blocks the kill", () => {
    const state = makeGameState();
    const player = addTestPlayer(state, "p1", {
      x: 2,
      y: 2,
      class: "HEPHAESTUS",
      equipmentUses: 0,
      actionBudget: true,
    });
    addTestEnemy(state, "e1", 3, 2, {
      name: "Stain Creep",
      hp: 1,
      effects: { Armor: 10 },
    });
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(1);

    const msg = applyClassActive(state, "p1", {
      action: "classActive",
      kind: "synesis_conversion",
      targetEnemyIds: ["e1"],
    });
    expect(msg).not.toContain("Equipment restored");
    expect(player.equipmentUses).toBe(0);
  });

  it("HEPHAESTUS Synesis allows scale:2 enemy adjacent via non-anchor footprint", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1", {
      x: 5,
      y: 2,
      class: "HEPHAESTUS",
      actionBudget: true,
    });
    // Gorgenaut at (3,2) occupies (3,2)(4,2)(3,3)(4,3); player is adjacent to (4,2)
    addTestEnemy(state, "e1", 3, 2, { name: "Gorgenaut", hp: 50 });
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(1);

    expect(
      validateClassActive(state, player, {
        action: "classActive",
        kind: "synesis_conversion",
        targetEnemyIds: ["e1"],
      }),
    ).toBeNull();
  });

  it("HEPHAESTUS Synesis rejects scale:2 enemy that is not footprint-adjacent", () => {
    const state = makeGameState({ width: 10, height: 10 });
    const player = addTestPlayer(state, "p1", {
      x: 6,
      y: 2,
      class: "HEPHAESTUS",
      actionBudget: true,
    });
    addTestEnemy(state, "e1", 3, 2, { name: "Gorgenaut", hp: 50 });
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(1);

    expect(
      validateClassActive(state, player, {
        action: "classActive",
        kind: "synesis_conversion",
        targetEnemyIds: ["e1"],
      }),
    ).toBe("Range 1");
  });

  it("VARUNASTRA Borrowing sets follow-up pending reaction", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", {
      x: 2,
      y: 2,
      class: "VARUNASTRA",
      weapon: "Ten Thousand Year Reign Shattering Blade",
      actionBudget: true,
    });
    addTestPlayer(state, "p2", {
      x: 2,
      y: 3,
      weapon: "Regrettable Precaution",
    });
    addTestEnemy(state, "e1", 4, 2, { hp: 20 });
    state.roundPhase = "playerTurn";
    state.turn = { role: "player", playerId: "p1" };
    state.combat = createDefaultCombatState(2);

    applyClassActive(state, "p1", {
      action: "classActive",
      kind: "borrowing_this",
      allyPlayerId: "p2",
      direction: "e",
    });

    const reaction = state.combat!.pendingClassReaction;
    expect(reaction?.kind).toBe("borrowing_follow_up");
    if (reaction?.kind === "borrowing_follow_up") {
      expect(reaction.extraEnemyIds).toContain("e1");
    }
  });

  it("VARUNASTRA follow-up applies max damage without re-attacking", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 2, y: 2, class: "VARUNASTRA", actionBudget: true });
    const enemy = addTestEnemy(state, "e1", 4, 2, { name: "Gorgenaut", hp: 15 });
    state.combat = createDefaultCombatState(1);
    state.combat!.pendingClassReaction = {
      kind: "borrowing_follow_up",
      playerId: "p1",
      allyPlayerId: "p2",
      direction: "e",
      extraEnemyIds: ["e1"],
      maxDamage: 12,
    };

    const msg = applyResolveClassReaction(state, "p1", {
      action: "resolveClassReaction",
      accept: true,
    });
    expect(msg).toContain("max damage");
    expect(enemy.hp).toBe(3);
    expect(state.combat!.pendingClassReaction).toBeNull();
  });
});
