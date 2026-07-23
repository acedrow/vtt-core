import { describe, expect, it } from "vitest";
import {
  liftLegacyCampaignFields,
  migrateCampaignRuntimeKeys,
} from "./campaign-state.js";
import { normalizeGameState } from "./game.js";
import { makeGameState } from "./test/fixtures.js";
import type {
  CampaignRuntimeState,
  GameState,
  LegacyCampaignGameStateFields,
  OverworldConvoy,
  OverworldLocation,
  OverworldParty,
  OverworldRegion,
} from "./types.js";

const OLD_KEYS = [
  "gmIchor",
  "constructedBaseUpgrades",
  "overworldRegions",
  "overworldParty",
  "overworldLocations",
  "overworldConvoys",
] as const;

function party(fuel: number): OverworldParty {
  return { qx: 1, qy: 2, atDis: false, mapSpeed: 6, fuel, revelations: 0 };
}

function convoy(id: string): OverworldConvoy {
  return { id, qx: 0, qy: 0, type: "test", factionId: "f1", infoVisibleToPlayers: true };
}

function location(id: string): OverworldLocation {
  return { id, qx: 0, qy: 0, name: id, factionId: "f1" };
}

function region(id: string): OverworldRegion {
  return { id };
}

function assertNoOldKeys(bag: CampaignRuntimeState): void {
  const legacy = bag as CampaignRuntimeState & LegacyCampaignGameStateFields;
  for (const key of OLD_KEYS) {
    expect(legacy[key], `old key ${key} should be absent`).toBeUndefined();
  }
}

describe("migrateCampaignRuntimeKeys", () => {
  it("old-only bag → new keys and deletes old", () => {
    const bag = {
      gmIchor: 7,
      constructedBaseUpgrades: ["u1"],
      overworldRegions: [region("west")],
      overworldParty: party(3),
      overworldLocations: [location("loc-old")],
      overworldConvoys: [convoy("cv-old")],
    } as CampaignRuntimeState & LegacyCampaignGameStateFields;

    migrateCampaignRuntimeKeys(bag);

    expect(bag.gmResource).toBe(7);
    expect(bag.unlockedUpgrades).toEqual(["u1"]);
    expect(bag.mapRegions).toEqual([region("west")]);
    expect(bag.mapParty).toEqual(party(3));
    expect(bag.mapLocations).toEqual([location("loc-old")]);
    expect(bag.mapConvoys).toEqual([convoy("cv-old")]);
    assertNoOldKeys(bag);
  });

  it("both present → prefer new and delete old", () => {
    const bag = {
      gmIchor: 3,
      gmResource: 9,
      constructedBaseUpgrades: ["old"],
      unlockedUpgrades: ["new"],
      overworldRegions: [region("old")],
      mapRegions: [region("a"), region("b")],
      overworldParty: party(1),
      mapParty: party(2),
      overworldLocations: [location("old")],
      mapLocations: [location("new")],
      overworldConvoys: [convoy("old")],
      mapConvoys: [convoy("new")],
    } as CampaignRuntimeState & LegacyCampaignGameStateFields;

    migrateCampaignRuntimeKeys(bag);

    expect(bag.gmResource).toBe(9);
    expect(bag.unlockedUpgrades).toEqual(["new"]);
    expect(bag.mapRegions).toEqual([region("a"), region("b")]);
    expect(bag.mapParty).toEqual(party(2));
    expect(bag.mapLocations).toEqual([location("new")]);
    expect(bag.mapConvoys).toEqual([convoy("new")]);
    assertNoOldKeys(bag);
  });

  it("new-only unchanged and introduces no old keys", () => {
    const bag: CampaignRuntimeState = {
      gmResource: 4,
      unlockedUpgrades: ["u"],
      mapRegions: [region("west")],
      mapParty: party(5),
      mapLocations: [],
      mapConvoys: [],
    };

    migrateCampaignRuntimeKeys(bag);

    expect(bag.gmResource).toBe(4);
    expect(bag.unlockedUpgrades).toEqual(["u"]);
    expect(bag.mapRegions).toEqual([region("west")]);
    expect(bag.mapParty).toEqual(party(5));
    assertNoOldKeys(bag);
  });

  it("partial mix migrates independently per pair", () => {
    const bag = {
      gmIchor: 1,
      unlockedUpgrades: ["kept"],
      constructedBaseUpgrades: ["ignored"],
      overworldRegions: [region("west")],
      mapParty: party(8),
      overworldParty: party(1),
    } as CampaignRuntimeState & LegacyCampaignGameStateFields;

    migrateCampaignRuntimeKeys(bag);

    expect(bag.gmResource).toBe(1);
    expect(bag.unlockedUpgrades).toEqual(["kept"]);
    expect(bag.mapRegions).toEqual([region("west")]);
    expect(bag.mapParty).toEqual(party(8));
    assertNoOldKeys(bag);
  });

  it("keepers untouched", () => {
    const partyResources = { scrap: 2 };
    const factionStates = {
      f1: {
        crown: 1,
        force: 0,
        subterfuge: 0,
        territory: 0,
        assets: 0,
        defeated: false,
        unlockedUpgrades: [],
        unlockedUniqueLocations: [],
      },
    };
    const bag = {
      partyResources,
      factionStates,
      gmIchor: 2,
    } as CampaignRuntimeState & LegacyCampaignGameStateFields;

    migrateCampaignRuntimeKeys(bag);

    expect(bag.partyResources).toBe(partyResources);
    expect(bag.factionStates).toBe(factionStates);
    expect(bag.gmResource).toBe(2);
    assertNoOldKeys(bag);
  });
});

describe("normalizeGameState campaign key dual-read", () => {
  // Uses fixture pack + combat stubs from src/test/setup-content-pack.ts.
  // Do not resetContentPackForTests here — that drops combat module stubs needed by normalizeGameState.

  it("nested old-only → new keys only", () => {
    const state = makeGameState();
    state.campaign = {
      partyResources: state.campaign?.partyResources,
      gmIchor: 11,
      constructedBaseUpgrades: ["rev"],
      overworldRegions: [region("west")],
      overworldParty: party(4),
      overworldLocations: [location("L")],
      overworldConvoys: [convoy("C")],
    } as CampaignRuntimeState;

    normalizeGameState(state);

    expect(state.campaign?.gmResource).toBe(11);
    expect(state.campaign?.unlockedUpgrades).toEqual(["rev"]);
    expect(state.campaign?.mapParty).toEqual(party(4));
    expect(state.campaign?.mapLocations).toEqual([location("L")]);
    expect(state.campaign?.mapConvoys).toEqual([convoy("C")]);
    expect(state.campaign?.mapRegions?.length).toBeGreaterThan(0);
    assertNoOldKeys(state.campaign!);
  });

  it("legacy top-level old names lift then migrate", () => {
    const state = makeGameState() as GameState & LegacyCampaignGameStateFields;
    delete state.campaign;
    state.gmIchor = 6;
    state.constructedBaseUpgrades = ["top"];
    state.overworldRegions = [region("east")];
    state.overworldParty = party(9);
    state.overworldLocations = [location("top-loc")];
    state.overworldConvoys = [convoy("top-cv")];

    normalizeGameState(state);

    expect(state.gmIchor).toBeUndefined();
    expect(state.constructedBaseUpgrades).toBeUndefined();
    expect(state.overworldRegions).toBeUndefined();
    expect(state.overworldParty).toBeUndefined();
    expect(state.overworldLocations).toBeUndefined();
    expect(state.overworldConvoys).toBeUndefined();
    expect(state.campaign?.gmResource).toBe(6);
    expect(state.campaign?.unlockedUpgrades).toEqual(["top"]);
    expect(state.campaign?.mapParty).toEqual(party(9));
    expect(state.campaign?.mapLocations).toEqual([location("top-loc")]);
    expect(state.campaign?.mapConvoys).toEqual([convoy("top-cv")]);
    expect(state.campaign?.mapRegions?.length).toBeGreaterThan(0);
    assertNoOldKeys(state.campaign!);
  });

  it("top-level old + nested new prefers nested new", () => {
    const state = makeGameState({
      campaign: { gmResource: 5 },
    }) as GameState & LegacyCampaignGameStateFields;
    state.gmIchor = 1;

    normalizeGameState(state);

    expect(state.gmIchor).toBeUndefined();
    expect(state.campaign?.gmResource).toBe(5);
    assertNoOldKeys(state.campaign!);
  });

  it("top-level old + nested old prefers nested then migrates", () => {
    const state = makeGameState() as GameState & LegacyCampaignGameStateFields;
    state.campaign = { gmIchor: 8 } as CampaignRuntimeState;
    state.gmIchor = 1;

    liftLegacyCampaignFields(state);
    expect((state.campaign as LegacyCampaignGameStateFields).gmIchor).toBe(8);
    expect(state.gmIchor).toBeUndefined();

    normalizeGameState(state);
    expect(state.campaign?.gmResource).toBe(8);
    assertNoOldKeys(state.campaign!);
  });

  it("already migrated is idempotent", () => {
    const state = makeGameState({
      campaign: {
        gmResource: 3,
        unlockedUpgrades: ["a"],
        mapRegions: [region("west")],
        mapParty: party(2),
        mapLocations: [],
        mapConvoys: [],
      },
    });

    normalizeGameState(state);
    const first = structuredClone(state.campaign);
    normalizeGameState(state);

    expect(state.campaign).toEqual(first);
    assertNoOldKeys(state.campaign!);
  });

  it("empty campaign seeds defaults under new keys", () => {
    const state = makeGameState();
    state.campaign = {};

    normalizeGameState(state);

    expect(state.campaign?.gmResource).toBe(0);
    expect(state.campaign?.unlockedUpgrades).toEqual([]);
    expect(state.campaign?.mapRegions?.length).toBeGreaterThan(0);
    expect(state.campaign?.mapParty).toBeDefined();
    expect(state.campaign?.mapLocations).toEqual([]);
    expect(state.campaign?.mapConvoys).toEqual([]);
    assertNoOldKeys(state.campaign!);
  });
});
