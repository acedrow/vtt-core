import { afterEach, describe, expect, it } from "vitest";
import {
  listOverworldRegionIds,
  listPartyResourceKeys,
  getRegionFactionId,
  getStarterUnlocks,
} from "./campaign-registry.js";
import { hasSpecialIdHandler } from "./combat/special-id.js";
import {
  getContentPack,
  registerContentPack,
  requireContentPack,
  resetContentPackForTests,
} from "./content-pack.js";
import { ensureFactionStates } from "./campaign-hooks.js";
import { listFactionIds } from "./faction-data.js";
import { getEnemyListingByName, listEnemyFactionIds } from "./enemy-data.js";
import { getClassByName, getWeaponByName } from "./player-data.js";
import {
  createFixtureContentPack,
  FIXTURE_CONTENT_PACK_ID,
} from "./fixture-content-pack.js";
import { makeGameState } from "./test/fixtures.js";

function restoreFixturePack(): void {
  resetContentPackForTests();
  registerContentPack(createFixtureContentPack());
}

describe("content pack registry", () => {
  afterEach(() => {
    restoreFixturePack();
  });

  it("defaults to fixture pack in engine setup", () => {
    expect(requireContentPack().id).toBe(FIXTURE_CONTENT_PACK_ID);
    expect(getEnemyListingByName("Test Grunt")?.hp).toBe(10);
    expect(getClassByName("Test Class")?.hp).toBe(25);
    expect(getWeaponByName("Test Weapon")).toBeDefined();
    expect(getEnemyListingByName("Stain Flower")).toBeUndefined();
    expect(hasSpecialIdHandler("flowerbud-plant")).toBe(false);
  });

  it("treats same id and version as idempotent", () => {
    const pack = createFixtureContentPack();
    resetContentPackForTests();
    registerContentPack(pack);
    registerContentPack(pack);
    expect(getContentPack()?.id).toBe(FIXTURE_CONTENT_PACK_ID);
  });

  it("throws when registering a different pack", () => {
    resetContentPackForTests();
    registerContentPack(createFixtureContentPack());
    expect(() =>
      registerContentPack({
        ...createFixtureContentPack(),
        id: "other-pack",
      }),
    ).toThrow(/already registered/);
  });

  it("throws from getters when unregistered", () => {
    resetContentPackForTests();
    expect(() => getEnemyListingByName("Test Grunt")).toThrow(/not registered/);
    expect(() => requireContentPack()).toThrow(/not registered/);
  });

  it("clears combat hooks on reset before fixture register", () => {
    resetContentPackForTests();
    expect(hasSpecialIdHandler("flowerbud-plant")).toBe(false);
    registerContentPack(createFixtureContentPack());
    expect(hasSpecialIdHandler("flowerbud-plant")).toBe(false);
  });

  it("applies fixture campaign config", () => {
    resetContentPackForTests();
    registerContentPack(createFixtureContentPack());

    expect(listFactionIds()).toEqual(["fixture-faction"]);
    expect(listEnemyFactionIds()).toEqual(["fixture-faction"]);
    expect(listOverworldRegionIds()).toEqual(["west"]);
    expect(getRegionFactionId("west")).toBe("fixture-faction");
    expect(listPartyResourceKeys()).toEqual(["scrap"]);
    expect(getStarterUnlocks().classes).toEqual(["Test Class"]);

    const state = makeGameState({ campaign: { factionStates: undefined } });
    const factions = ensureFactionStates(state);
    expect(Object.keys(factions)).toEqual(["fixture-faction"]);
    expect(factions["fixture-faction"]).toBeDefined();
  });

  it("restores fixture campaign config after reset", () => {
    expect(listFactionIds()).toEqual(["fixture-faction"]);
    expect(listPartyResourceKeys()).toEqual(["scrap"]);
    expect(getRegionFactionId("west")).toBe("fixture-faction");
  });
});
