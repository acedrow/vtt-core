import { describe, expect, it } from "vitest";
import {
  applySwarmMemberMove,
  buildSwarmGroups,
  countSwarmTilesAdjacentTo,
  getEffectiveEnemyHp,
  getSwarmMaxHp,
  getSwarmMemberHp,
  reconcileSwarmHp,
  snapshotSwarmGroups,
  splitHp,
  swarmChipEligibleTargets,
  swarmChipPromptRequired,
  swarmGroupForEnemy,
  validateSwarmMemberMove,
  markSwarmChipResolved,
  requireSwarmChipResolved,
} from "./swarm.js";
import {
  applyBreakerAttackToSwarm,
  applyDamageToEnemy,
  applyRangeAttackToEnemies,
  applySwarmEnemyAttackToPlayer,
  previewSwarmEnemyAttack,
  SETHIAN_DAMAGE_CAP,
} from "@gaem/shared";
import {
  applyEnemyEffectStacks,
  tickUnitEndOfTurn,
  tickUnitStartOfTurn,
} from "@gaem/shared";
import { addEnemy, normalizeGameState, removeEnemy } from "@gaem/shared";
import { createDefaultCombatState } from "@gaem/shared";
import { addTestEnemy, addTestPlayer, makeGameState } from "../../../shared/src/test/fixtures.js";

const SWARM_NAME = "Scorned Eyes";
const FLOWER_NAME = "Stain Flower";

describe("swarm", () => {
  it("buildSwarmGroups groups adjacent same-name swarm enemies", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    addTestEnemy(state, "c", 5, 5, { name: SWARM_NAME });

    const groups = buildSwarmGroups(state);
    expect(groups.size).toBe(1);
    expect([...groups.values()][0]!.sort()).toEqual(["a", "b"]);
  });

  it("getSwarmMaxHp and getEffectiveEnemyHp", () => {
    expect(getSwarmMaxHp(1)).toBe(10);
    expect(getSwarmMaxHp(3)).toBe(30);
    expect(getSwarmMemberHp(78, 8)).toBe(9);

    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME, hp: 20 });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME, hp: 20 });
    const member = state.enemies[0]!;
    expect(getEffectiveEnemyHp(member, state)).toBe(20);
  });

  it("reconcileSwarmHp pools HP when enemies merge", () => {
    const state = makeGameState();
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });

    const groups = buildSwarmGroups(state);
    expect(groups.size).toBe(1);
    const hp = state.enemies[0]!.hp;
    expect(hp).toBeGreaterThan(0);
    expect(state.enemies[0]!.hp).toBe(state.enemies[1]!.hp);
  });

  it("reconcileSwarmHp splits HP when swarm separates", () => {
    const state = makeGameState();
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    const prevGroups = buildSwarmGroups(state);
    const pooledHp = state.enemies[0]!.hp!;

    state.enemies.find((e) => e.id === "b")!.x = 5;
    reconcileSwarmHp(state, prevGroups);

    expect(buildSwarmGroups(state).size).toBe(0);
    const soloA = state.enemies.find((e) => e.id === "a")!;
    const soloB = state.enemies.find((e) => e.id === "b")!;
    expect(soloA.hp).toBeLessThanOrEqual(10);
    expect(soloB.hp).toBeLessThanOrEqual(10);
    expect((soloA.hp ?? 0) + (soloB.hp ?? 0)).toBeGreaterThanOrEqual(pooledHp - 1);
  });

  it("splitHp divides current HP evenly among groups (33 → 17 and 16)", () => {
    expect(splitHp(33, [3, 2])).toEqual([17, 16]);
    expect(splitHp(33, [2, 3])).toEqual([16, 17]);
    // Even 26+25, then clamp pair to max 20
    expect(splitHp(51, [3, 2])).toEqual([26, 20]);
  });

  it("reconcileSwarmHp preserves damaged HP when composition is unchanged", () => {
    const state = makeGameState();
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    expect(state.enemies[0]!.hp).toBe(20);

    for (const e of state.enemies) e.hp = 7;
    reconcileSwarmHp(state, buildSwarmGroups(state));

    expect(state.enemies.every((e) => e.hp === 7)).toBe(true);
  });

  it("normalizeGameState preserves damaged swarm HP", () => {
    const state = makeGameState();
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "c", x: 2, y: 3, name: SWARM_NAME, hp: 1 });
    for (const e of state.enemies) e.hp = 12;

    normalizeGameState(state);

    expect(state.enemies.every((e) => e.hp === 12)).toBe(true);
    expect(getSwarmMaxHp(3)).toBe(30);
  });

  it("swarm attack expend does not heal remaining pooled HP", () => {
    const state = makeGameState();
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "c", x: 2, y: 3, name: SWARM_NAME, hp: 1 });
    addTestPlayer(state, "p1", { x: 3, y: 3, hp: 50 });
    for (const e of state.enemies) e.hp = 12;

    applySwarmEnemyAttackToPlayer(
      state,
      "a",
      { raw: "", damage: 2, range: 1 },
      "p1",
      { strikeCount: 2 },
    );

    expect(state.enemies).toHaveLength(2);
    expect(state.enemies.every((e) => e.hp === 12)).toBe(true);
  });

  it("swarmChipEligibleTargets finds adjacent players only", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    addTestEnemy(state, "other", 2, 1, { name: "Other Demon" });
    addTestPlayer(state, "p1", 2, 3);
    reconcileSwarmHp(state);

    const targets = swarmChipEligibleTargets(state, "a");
    expect(targets.some((t) => t.id === "p1")).toBe(true);
    expect(targets.some((t) => t.id === "other")).toBe(false);
  });

  it("requireSwarmChipResolved skips swarms with no adjacent chip targets", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    reconcileSwarmHp(state);
    state.roundPhase = "gmTurn";
    state.turn = { role: "gm" };
    state.combat = createDefaultCombatState(0);

    expect(swarmChipEligibleTargets(state, "a")).toEqual([]);
    expect(requireSwarmChipResolved(state, "a")).toBeNull();
  });

  it("swarmChipPromptRequired skips swarms that have already moved this phase", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    addTestPlayer(state, "p1", 2, 3);
    reconcileSwarmHp(state);
    state.roundPhase = "gmTurn";
    state.turn = { role: "gm" };
    state.combat = createDefaultCombatState(0);

    expect(swarmChipPromptRequired(state, "a")).toBe(true);

    for (const e of state.enemies.filter((en) => en.name === SWARM_NAME)) {
      e.movementRemaining = (e.movementRemaining ?? e.speed ?? 4) - 1;
    }
    expect(swarmChipPromptRequired(state, "a")).toBe(false);
    expect(requireSwarmChipResolved(state, "a")).toBeNull();
  });

  it("applyBreakerAttackToSwarm breaks squares when damage is sufficient", () => {
    const state = makeGameState();
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    reconcileSwarmHp(state);

    const { brokenIds } = applyBreakerAttackToSwarm(state, [{ x: 2, y: 2 }], 10);
    expect(brokenIds).toContain("a");
    expect(state.enemies.find((e) => e.id === "a")?.hp).toBe(0);
    expect(state.enemies.find((e) => e.id === "b")).toBeDefined();
  });

  it("applyRangeAttackToEnemies with Breaker breaks each selected swarm member", () => {
    const state = makeGameState();
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "c", x: 2, y: 3, name: SWARM_NAME, hp: 1 });
    reconcileSwarmHp(state);

    const spec = { damage: "10", rangeTargets: { range: 4, maxTargets: 3 } };
    const { targets } = applyRangeAttackToEnemies(state, spec, ["a", "b", "c"], undefined, {
      useBreaker: true,
    });

    expect(targets.map((t) => t.enemyId).sort()).toEqual(["a", "b", "c"]);
    expect(state.enemies.find((e) => e.id === "a")?.hp).toBe(0);
    expect(state.enemies.find((e) => e.id === "b")?.hp).toBe(0);
    expect(state.enemies.find((e) => e.id === "c")?.hp).toBe(0);
  });

  it("previewSwarmEnemyAttack counts adjacent strikes", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    addTestEnemy(state, "c", 2, 3, { name: SWARM_NAME });
    addTestPlayer(state, "p1", 3, 3);
    reconcileSwarmHp(state);

    const preview = previewSwarmEnemyAttack(
      state,
      "a",
      { raw: "", damage: 2, size: 1 },
      "p1",
      {},
    );
    expect(preview.strikeCount).toBe(2);
    expect(preview.totalDamage).toBe(7);
  });

  it("SETHIAN_DAMAGE_CAP is 132", () => {
    expect(SETHIAN_DAMAGE_CAP).toBe(132);
  });

  it("validateSwarmMemberMove allows rearrange and break-away moves", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    addTestEnemy(state, "c", 4, 2, { name: SWARM_NAME });
    reconcileSwarmHp(state);
    state.roundPhase = "gmTurn";
    state.turn = { role: "gm" };
    state.combat = createDefaultCombatState(0);
    markSwarmChipResolved(state, "a");

    expect(validateSwarmMemberMove(state, "a", 2, 1)).toBeNull();
    applySwarmMemberMove(state, "a", 2, 1);
    // Even split of 30 among solo+pair → 15/15, then clamp solo to max 10 → 10 and 15
    const soloA = state.enemies.find((e) => e.id === "a")!;
    expect(soloA.hp).toBe(10);
    expect(state.enemies.find((e) => e.id === "b")!.hp).toBe(15);
    expect(state.enemies.find((e) => e.id === "c")!.hp).toBe(15);
    const groups = buildSwarmGroups(state);
    expect(groups.size).toBe(1);
    expect([...groups.values()][0]!.sort()).toEqual(["b", "c"]);
  });

  it("Stain Flower bumps swarm size without joining memberIds", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    addTestEnemy(state, "flower", 2, 3, { name: FLOWER_NAME });
    reconcileSwarmHp(state);

    const group = swarmGroupForEnemy(state, "a");
    expect(group).not.toBeNull();
    expect(group!.memberIds.sort()).toEqual(["a", "b"]);
    expect(group!.linkedFlowerIds).toEqual(["flower"]);
    expect(group!.size).toBe(3);
    expect(group!.maxHp).toBe(30);
    expect(group!.currentHp).toBe(30);
    expect(state.enemies.find((e) => e.id === "a")!.hp).toBe(30);
    expect(swarmGroupForEnemy(state, "flower")).toBeNull();
  });

  it("moving a swarm into Stain Flower range increases current HP with max", () => {
    const state = makeGameState({ sandboxMode: true });
    // L-shape so a one-step move can reach the flower without breaking connectivity
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "c", x: 3, y: 3, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "flower", x: 2, y: 4, name: FLOWER_NAME, hp: 10 });
    expect(swarmGroupForEnemy(state, "a")!.maxHp).toBe(30);
    expect(swarmGroupForEnemy(state, "a")!.linkedFlowerIds).toEqual([]);
    expect(state.enemies.find((e) => e.id === "a")!.hp).toBe(30);

    applySwarmMemberMove(state, "c", 2, 3);

    const group = swarmGroupForEnemy(state, "a")!;
    expect(group.memberIds.sort()).toEqual(["a", "b", "c"]);
    expect(group.linkedFlowerIds).toEqual(["flower"]);
    expect(group.size).toBe(4);
    expect(group.maxHp).toBe(40);
    expect(group.currentHp).toBe(40);
    expect(state.enemies.find((e) => e.id === "a")!.hp).toBe(40);
    expect(state.enemies.find((e) => e.id === "c")!.hp).toBe(40);
  });

  it("linking a Stain Flower heals damaged swarms by the max HP gain", () => {
    const state = makeGameState();
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    for (const e of state.enemies) e.hp = 14;
    addEnemy(state, { id: "flower", x: 2, y: 3, name: FLOWER_NAME, hp: 10 });

    const group = swarmGroupForEnemy(state, "a")!;
    expect(group.maxHp).toBe(30);
    expect(group.currentHp).toBe(24);
    expect(state.enemies.find((e) => e.id === "a")!.hp).toBe(24);
  });

  it("lone swarm minion plus adjacent Stain Flower forms a swarm", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "flower", 3, 2, { name: FLOWER_NAME });
    reconcileSwarmHp(state);

    const groups = buildSwarmGroups(state);
    expect(groups.size).toBe(1);
    expect([...groups.values()][0]).toEqual(["a"]);
    const group = swarmGroupForEnemy(state, "a")!;
    expect(group.size).toBe(2);
    expect(group.maxHp).toBe(20);
    expect(group.memberIds).toEqual(["a"]);
    expect(state.enemies.find((e) => e.id === "a")!.hp).toBe(20);
  });

  it("Stain Flower alone or next to non-swarm minion does not form a swarm", () => {
    const state = makeGameState();
    addTestEnemy(state, "flower", 2, 2, { name: FLOWER_NAME });
    addTestEnemy(state, "creep", 3, 2, { name: "Stain Creep" });
    reconcileSwarmHp(state);

    expect(buildSwarmGroups(state).size).toBe(0);
    expect(swarmGroupForEnemy(state, "creep")).toBeNull();
    expect(swarmGroupForEnemy(state, "flower")).toBeNull();
  });

  it("countSwarmTilesAdjacentTo and chip eligibility include Stain Flower tiles", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    addTestEnemy(state, "flower", 4, 2, { name: FLOWER_NAME });
    addTestPlayer(state, "p1", 4, 3);
    reconcileSwarmHp(state);

    expect(countSwarmTilesAdjacentTo(state, ["a", "b"], { x: 4, y: 3 })).toBe(1);
    const targets = swarmChipEligibleTargets(state, "a");
    expect(targets.some((t) => t.id === "p1")).toBe(true);
  });

  it("removing Stain Flower shrinks swarm size and max HP", () => {
    const state = makeGameState();
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "flower", x: 2, y: 3, name: FLOWER_NAME, hp: 10 });
    expect(swarmGroupForEnemy(state, "a")!.size).toBe(3);
    expect(state.enemies.find((e) => e.id === "a")!.hp).toBe(30);

    for (const e of state.enemies.filter((en) => en.name === SWARM_NAME)) e.hp = 28;
    removeEnemy(state, "flower");

    const group = swarmGroupForEnemy(state, "a")!;
    expect(group.size).toBe(2);
    expect(group.maxHp).toBe(20);
    expect(state.enemies.every((e) => e.name !== FLOWER_NAME)).toBe(true);
    // Unlink reverses the +10 size delta: 28 - 10 = 18
    expect(state.enemies.find((e) => e.id === "a")!.hp).toBe(18);
  });

  it("merging members while newly adjacent to a Stain Flower grants +10", () => {
    const state = makeGameState({ sandboxMode: true });
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "c", x: 5, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "flower", x: 4, y: 3, name: FLOWER_NAME, hp: 10 });
    expect(swarmGroupForEnemy(state, "a")!.size).toBe(2);
    expect(swarmGroupForEnemy(state, "c")).toBeNull();
    expect(state.enemies.find((e) => e.id === "a")!.hp).toBe(20);

    const prev = snapshotSwarmGroups(state);
    state.enemies.find((e) => e.id === "c")!.x = 4;
    reconcileSwarmHp(state, prev);

    const group = swarmGroupForEnemy(state, "a")!;
    expect(group.memberIds.sort()).toEqual(["a", "b", "c"]);
    expect(group.linkedFlowerIds).toEqual(["flower"]);
    expect(group.size).toBe(4);
    expect(group.maxHp).toBe(40);
    // Prior pools 20 + solo join 10 + new flower 10
    expect(group.currentHp).toBe(40);
    expect(state.enemies.find((e) => e.id === "a")!.hp).toBe(40);
  });

  it("damaging Stain Flower does not change swarm pooled HP", () => {
    const state = makeGameState();
    addEnemy(state, { id: "a", x: 2, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "b", x: 3, y: 2, name: SWARM_NAME, hp: 1 });
    addEnemy(state, { id: "flower", x: 2, y: 3, name: FLOWER_NAME, hp: 10 });
    for (const e of state.enemies.filter((en) => en.name === SWARM_NAME)) e.hp = 18;

    const flower = state.enemies.find((e) => e.id === "flower")!;
    applyDamageToEnemy(flower, 4, state);

    expect(flower.hp).toBe(6);
    expect(state.enemies.find((e) => e.id === "a")!.hp).toBe(18);
    expect(state.enemies.find((e) => e.id === "b")!.hp).toBe(18);
  });

  it("applies Blazing to all swarm members and ticks 1 pooled HP", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    addTestEnemy(state, "c", 3, 3, { name: SWARM_NAME });
    reconcileSwarmHp(state);

    const primary = state.enemies.find((e) => e.id === "a")!;
    applyEnemyEffectStacks(state, primary, ["Blazing:2"]);
    for (const id of ["a", "b", "c"]) {
      expect(state.enemies.find((e) => e.id === id)!.effects?.Blazing).toBe(2);
      expect(state.enemies.find((e) => e.id === id)!.hp).toBe(30);
    }

    const msgs = tickUnitStartOfTurn(state, primary, "enemy");
    expect(msgs.some((m) => m.includes("Blazing damage"))).toBe(true);
    for (const id of ["a", "b", "c"]) {
      expect(state.enemies.find((e) => e.id === id)!.hp).toBe(29);
    }
  });

  it("does not apply Pin to a swarm", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    reconcileSwarmHp(state);

    applyEnemyEffectStacks(state, state.enemies.find((e) => e.id === "a")!, ["Pin:2", "Slow:1"]);
    for (const id of ["a", "b"]) {
      const member = state.enemies.find((e) => e.id === id)!;
      expect(member.effects?.Pin).toBeUndefined();
      expect(member.effects?.Slow).toBe(1);
    }
  });

  it("spreads Blazing from an adjacent player onto the whole swarm", () => {
    const state = makeGameState();
    addTestPlayer(state, "p1", { x: 1, y: 2, hp: 10, class: "HARPE", effects: { Blazing: 1 } });
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    reconcileSwarmHp(state);

    const primary = state.enemies.find((e) => e.id === "a")!;
    tickUnitStartOfTurn(state, primary, "enemy");
    for (const id of ["a", "b"]) {
      expect(state.enemies.find((e) => e.id === id)!.effects?.Blazing).toBe(1);
      expect(state.enemies.find((e) => e.id === id)!.hp).toBe(19);
    }
  });

  it("sibling swarm limbs alone do not prevent Blazing decay", () => {
    const state = makeGameState();
    addTestEnemy(state, "a", 2, 2, { name: SWARM_NAME });
    addTestEnemy(state, "b", 3, 2, { name: SWARM_NAME });
    reconcileSwarmHp(state);

    applyEnemyEffectStacks(state, state.enemies.find((e) => e.id === "a")!, ["Blazing:2"]);
    const msgs = tickUnitEndOfTurn(state, state.enemies.find((e) => e.id === "a")!);
    expect(msgs.some((m) => m.includes("Blazing"))).toBe(true);
    for (const id of ["a", "b"]) {
      expect(state.enemies.find((e) => e.id === id)!.effects?.Blazing).toBe(1);
    }
  });
});
