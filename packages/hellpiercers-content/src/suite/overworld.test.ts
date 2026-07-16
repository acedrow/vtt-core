import { describe, expect, it } from "vitest";

import {
  applyOverworldCampaignAction,
  applyOverworldConvoyAction,
  applyOverworldLocationAction,
  defaultOverworldParty,
  isOverworldDeployDestination,
  isOverworldTravelDestination,
  listOverworldConvoyDestinations,
  listOverworldDeployDestinations,
  listOverworldTravelDestinations,
  overworldTravelReachQuarters,
  regionIdForQuarter,
  validateOverworldCampaignAction,
  validateOverworldConvoyAction,
  validateOverworldLocationAction,
} from "@gaem/shared";
import { makeGameState } from "./fixtures.js";
import { getOverworldQuarterHeight, getOverworldQuarterWidth, getOverworldTravelFuelCost } from "@gaem/shared";

function partyOnMap(overrides: Partial<ReturnType<typeof defaultOverworldParty>> = {}) {
  return { ...defaultOverworldParty(), atDis: false, ...overrides };
}

describe("overworldTravelReachQuarters", () => {
  it("maps Map Speed 1 to 5 quarter-cells (2.5 inches)", () => {
    expect(overworldTravelReachQuarters(1)).toBe(5);
  });

  it("maps Map Speed 1.5 to 8 quarter-cells (3.75 inches, ceiled)", () => {
    expect(overworldTravelReachQuarters(1.5)).toBe(8);
  });

  it("maps Map Speed 2 to 10 quarter-cells (5 inches)", () => {
    expect(overworldTravelReachQuarters(2)).toBe(10);
  });

  it("ceils fractional inch budgets", () => {
    expect(overworldTravelReachQuarters(0.1)).toBe(1);
  });
});

describe("isOverworldTravelDestination", () => {
  const from = { qx: 16, qy: 10 };

  it("allows orthogonal and diagonal cells within reach", () => {
    expect(isOverworldTravelDestination(from, { qx: 21, qy: 10 }, 1)).toBe(true);
    expect(isOverworldTravelDestination(from, { qx: 16, qy: 5 }, 1)).toBe(true);
    expect(isOverworldTravelDestination(from, { qx: 19, qy: 14 }, 1)).toBe(true);
  });

  it("rejects the current cell and out-of-reach cells", () => {
    expect(isOverworldTravelDestination(from, from, 1)).toBe(false);
    expect(isOverworldTravelDestination(from, { qx: 22, qy: 10 }, 1)).toBe(false);
  });

  it("rejects out-of-bounds destinations", () => {
    expect(isOverworldTravelDestination(from, { qx: -1, qy: 10 }, 1)).toBe(false);
    expect(isOverworldTravelDestination(from, { qx: 16.5, qy: 10 }, 1)).toBe(false);
  });
});

describe("listOverworldTravelDestinations", () => {
  it("excludes origin and stays within reach", () => {
    const party = { qx: 16, qy: 10, mapSpeed: 1 };
    const dests = listOverworldTravelDestinations(party);
    expect(dests.some((d) => d.qx === 16 && d.qy === 10)).toBe(false);
    expect(dests.every((d) => isOverworldTravelDestination(party, d, party.mapSpeed))).toBe(true);
    expect(dests.length).toBeGreaterThan(0);
  });
});

describe("overworldCampaignAction travel", () => {
  it("rejects travel while in DIS", () => {
    const state = makeGameState({
      overworldParty: { ...defaultOverworldParty(), fuel: 5, mapSpeed: 1 },
    });
    expect(
      validateOverworldCampaignAction(state, { kind: "travel", qx: 0, qy: 0 }),
    ).toBe("Party is in DIS");
  });

  it("rejects travel without enough fuel", () => {
    const state = makeGameState({
      overworldParty: partyOnMap({ fuel: 1, mapSpeed: 1 }),
    });
    const party = state.campaign!.overworldParty!;
    const dest = listOverworldTravelDestinations(party)[0]!;
    expect(validateOverworldCampaignAction(state, { kind: "travel", qx: dest.qx, qy: dest.qy })).toBe(
      "Not enough fuel",
    );
  });

  it("spends fuel and moves the party token", () => {
    const state = makeGameState({
      overworldParty: partyOnMap({ fuel: 5, mapSpeed: 1 }),
    });
    const party = state.campaign!.overworldParty!;
    const dest = listOverworldTravelDestinations(party)[0]!;
    expect(validateOverworldCampaignAction(state, { kind: "travel", qx: dest.qx, qy: dest.qy })).toBeNull();
    const message = applyOverworldCampaignAction(state, { kind: "travel", qx: dest.qx, qy: dest.qy });
    expect(message).toContain("Traveled");
    expect(state.campaign!.overworldParty!.fuel).toBe(5 - getOverworldTravelFuelCost());
    expect(state.campaign!.overworldParty!.qx).toBe(dest.qx);
    expect(state.campaign!.overworldParty!.qy).toBe(dest.qy);
  });

  it("rejects invalid destinations even with fuel", () => {
    const state = makeGameState({
      overworldParty: partyOnMap({ fuel: 5, mapSpeed: 1 }),
    });
    const party = state.campaign!.overworldParty!;
    expect(
      validateOverworldCampaignAction(state, {
        kind: "travel",
        qx: party.qx + 20,
        qy: party.qy,
      }),
    ).toBe("Invalid travel destination");
  });
});

describe("overworld deploy destinations", () => {
  it("only allows the southernmost quarter-row", () => {
    expect(isOverworldDeployDestination(0, getOverworldQuarterHeight() - 1)).toBe(true);
    expect(isOverworldDeployDestination(16, getOverworldQuarterHeight() - 2)).toBe(false);
    expect(listOverworldDeployDestinations()).toHaveLength(getOverworldQuarterWidth());
  });
});

describe("overworldCampaignAction returnToDis / deployToHell", () => {
  it("returns to DIS and clears journey currencies", () => {
    const state = makeGameState({
      overworldParty: partyOnMap({ fuel: 4, revelations: 3 }),
    });
    expect(validateOverworldCampaignAction(state, { kind: "returnToDis" })).toBeNull();
    const message = applyOverworldCampaignAction(state, { kind: "returnToDis" });
    expect(message).toContain("Returned to DIS");
    expect(state.campaign!.overworldParty!.atDis).toBe(true);
    expect(state.campaign!.overworldParty!.fuel).toBe(0);
    expect(state.campaign!.overworldParty!.revelations).toBe(0);
  });

  it("rejects return when already in DIS", () => {
    const state = makeGameState({ overworldParty: defaultOverworldParty() });
    expect(validateOverworldCampaignAction(state, { kind: "returnToDis" })).toBe(
      "Party is already in DIS",
    );
  });

  it("deploys from DIS to a southern cell", () => {
    const state = makeGameState({ overworldParty: defaultOverworldParty() });
    const qx = 10;
    const qy = getOverworldQuarterHeight() - 1;
    expect(validateOverworldCampaignAction(state, { kind: "deployToHell", qx, qy })).toBeNull();
    const message = applyOverworldCampaignAction(state, { kind: "deployToHell", qx, qy });
    expect(message).toContain("Deployed to Hell");
    expect(state.campaign!.overworldParty!.atDis).toBe(false);
    expect(state.campaign!.overworldParty!.qx).toBe(qx);
    expect(state.campaign!.overworldParty!.qy).toBe(qy);
  });

  it("rejects deploy when not in DIS or destination is invalid", () => {
    const state = makeGameState({ overworldParty: partyOnMap() });
    expect(
      validateOverworldCampaignAction(state, {
        kind: "deployToHell",
        qx: 0,
        qy: getOverworldQuarterHeight() - 1,
      }),
    ).toBe("Party is not in DIS");

    const inDis = makeGameState({ overworldParty: defaultOverworldParty() });
    expect(
      validateOverworldCampaignAction(inDis, { kind: "deployToHell", qx: 0, qy: 0 }),
    ).toBe("Invalid deploy destination");
  });
});

describe("overworldCampaignAction adjustments", () => {
  it("adjusts map speed, fuel, and revelations", () => {
    const state = makeGameState();
    expect(validateOverworldCampaignAction(state, { kind: "adjustMapSpeed", delta: 0.5 })).toBeNull();
    applyOverworldCampaignAction(state, { kind: "adjustMapSpeed", delta: 0.5 });
    expect(state.campaign!.overworldParty!.mapSpeed).toBe(1.5);

    applyOverworldCampaignAction(state, { kind: "adjustFuel", delta: 3 });
    expect(state.campaign!.overworldParty!.fuel).toBe(3);

    applyOverworldCampaignAction(state, { kind: "adjustRevelations", delta: 2 });
    expect(state.campaign!.overworldParty!.revelations).toBe(2);
  });

  it("blocks adjustments below zero", () => {
    const state = makeGameState({
      overworldParty: partyOnMap({ fuel: 0, revelations: 0, mapSpeed: 0 }),
    });
    expect(validateOverworldCampaignAction(state, { kind: "adjustFuel", delta: -1 })).toBe(
      "Insufficient fuel",
    );
    expect(validateOverworldCampaignAction(state, { kind: "adjustRevelations", delta: -1 })).toBe(
      "Insufficient revelations",
    );
    expect(validateOverworldCampaignAction(state, { kind: "adjustMapSpeed", delta: -0.5 })).toBe(
      "Insufficient map speed",
    );
  });
});

describe("regionIdForQuarter", () => {
  it("maps quarter columns to the three equal region thirds", () => {
    expect(regionIdForQuarter(0)).toBe("west");
    expect(regionIdForQuarter(11)).toBe("west");
    expect(regionIdForQuarter(12)).toBe("center");
    expect(regionIdForQuarter(23)).toBe("center");
    expect(regionIdForQuarter(24)).toBe("east");
    expect(regionIdForQuarter(33)).toBe("east");
  });
});

describe("overworldLocationAction", () => {
  it("places a location on an empty quarter cell", () => {
    const state = makeGameState();
    const action = {
      kind: "place" as const,
      qx: 4,
      qy: 5,
      name: "  Oraios's Vengence  ",
      factionId: "syncrasis" as const,
    };
    expect(validateOverworldLocationAction(state, action)).toBeNull();
    const message = applyOverworldLocationAction(state, action);
    expect(message).toContain('Placed location "Oraios\'s Vengence"');
    expect(state.campaign!.overworldLocations).toHaveLength(1);
    expect(state.campaign!.overworldLocations![0]).toMatchObject({
      qx: 4,
      qy: 5,
      name: "Oraios's Vengence",
      factionId: "syncrasis",
    });
    expect(state.campaign!.overworldLocations![0]!.id).toBeTruthy();
  });

  it("rejects place when the cell is occupied or name is empty", () => {
    const state = makeGameState({
      overworldLocations: [
        { id: "loc-1", qx: 4, qy: 5, name: "Existing", factionId: "syncrasis" },
      ],
    });
    expect(
      validateOverworldLocationAction(state, {
        kind: "place",
        qx: 4,
        qy: 5,
        name: "Another",
        factionId: "syncrasis",
      }),
    ).toBe("A location is already placed here");
    expect(
      validateOverworldLocationAction(state, {
        kind: "place",
        qx: 1,
        qy: 1,
        name: "   ",
        factionId: "syncrasis",
      }),
    ).toBe("Location name is required");
  });

  it("removes a placed location by id", () => {
    const state = makeGameState({
      overworldLocations: [
        { id: "loc-1", qx: 4, qy: 5, name: "Existing", factionId: "syncrasis" },
      ],
    });
    expect(validateOverworldLocationAction(state, { kind: "remove", locationId: "loc-1" })).toBeNull();
    const message = applyOverworldLocationAction(state, { kind: "remove", locationId: "loc-1" });
    expect(message).toBe('Removed location "Existing"');
    expect(state.campaign!.overworldLocations).toEqual([]);
  });

  it("rejects remove for unknown ids", () => {
    const state = makeGameState();
    expect(validateOverworldLocationAction(state, { kind: "remove", locationId: "missing" })).toBe(
      "Location not found",
    );
  });

  it("toggles location info visibility for players", () => {
    const state = makeGameState({
      overworldLocations: [
        { id: "loc-1", qx: 4, qy: 5, name: "Existing", factionId: "syncrasis" },
      ],
    });
    expect(
      validateOverworldLocationAction(state, {
        kind: "setInfoVisible",
        locationId: "loc-1",
        visible: false,
      }),
    ).toBeNull();
    expect(
      applyOverworldLocationAction(state, {
        kind: "setInfoVisible",
        locationId: "loc-1",
        visible: false,
      }),
    ).toContain("Hid location");
    expect(state.campaign!.overworldLocations![0]!.infoVisibleToPlayers).toBe(false);
    applyOverworldLocationAction(state, {
      kind: "setInfoVisible",
      locationId: "loc-1",
      visible: true,
    });
    expect(state.campaign!.overworldLocations![0]!.infoVisibleToPlayers).toBeUndefined();
  });
});

describe("overworldConvoyAction", () => {
  it("places a convoy hidden from players by default", () => {
    const state = makeGameState();
    const action = {
      kind: "place" as const,
      qx: 8,
      qy: 10,
      type: "supply" as const,
      factionId: "paracletus" as const,
    };
    expect(validateOverworldConvoyAction(state, action)).toBeNull();
    const message = applyOverworldConvoyAction(state, action);
    expect(message).toContain("Deployed supply convoy");
    expect(state.campaign!.overworldConvoys).toHaveLength(1);
    expect(state.campaign!.overworldConvoys![0]).toMatchObject({
      qx: 8,
      qy: 10,
      type: "supply",
      factionId: "paracletus",
      infoVisibleToPlayers: false,
    });
  });

  it("allows placing a convoy on a cell that already has one", () => {
    const state = makeGameState({
      overworldConvoys: [
        {
          id: "c-1",
          qx: 8,
          qy: 10,
          type: "decoy",
          factionId: "syncrasis",
          infoVisibleToPlayers: false,
        },
      ],
    });
    expect(
      validateOverworldConvoyAction(state, {
        kind: "place",
        qx: 8,
        qy: 10,
        type: "support",
        factionId: "syncrasis",
      }),
    ).toBeNull();
    applyOverworldConvoyAction(state, {
      kind: "place",
      qx: 8,
      qy: 10,
      type: "support",
      factionId: "syncrasis",
    });
    expect(state.campaign!.overworldConvoys).toHaveLength(2);
  });

  it("moves a convoy within party map speed reach", () => {
    const state = makeGameState({
      overworldParty: partyOnMap({ qx: 0, qy: 0, mapSpeed: 1 }),
      overworldConvoys: [
        {
          id: "c-1",
          qx: 10,
          qy: 10,
          type: "assault",
          factionId: "autophyes",
          infoVisibleToPlayers: false,
        },
      ],
    });
    expect(
      validateOverworldConvoyAction(state, { kind: "move", convoyId: "c-1", qx: 13, qy: 10 }),
    ).toBeNull();
    applyOverworldConvoyAction(state, { kind: "move", convoyId: "c-1", qx: 13, qy: 10 });
    expect(state.campaign!.overworldConvoys![0]).toMatchObject({ qx: 13, qy: 10 });
  });

  it("allows moving a convoy onto another convoy's cell", () => {
    const state = makeGameState({
      overworldParty: partyOnMap({ mapSpeed: 1 }),
      overworldConvoys: [
        {
          id: "c-1",
          qx: 10,
          qy: 10,
          type: "assault",
          factionId: "autophyes",
          infoVisibleToPlayers: false,
        },
        {
          id: "c-2",
          qx: 13,
          qy: 10,
          type: "supply",
          factionId: "syncrasis",
          infoVisibleToPlayers: false,
        },
      ],
    });
    expect(
      validateOverworldConvoyAction(state, { kind: "move", convoyId: "c-1", qx: 13, qy: 10 }),
    ).toBeNull();
    applyOverworldConvoyAction(state, { kind: "move", convoyId: "c-1", qx: 13, qy: 10 });
    expect(state.campaign!.overworldConvoys!.filter((c) => c.qx === 13 && c.qy === 10)).toHaveLength(2);
  });

  it("rejects convoy moves beyond map speed reach", () => {
    const state = makeGameState({
      overworldParty: partyOnMap({ mapSpeed: 1 }),
      overworldConvoys: [
        {
          id: "c-1",
          qx: 10,
          qy: 10,
          type: "assault",
          factionId: "autophyes",
          infoVisibleToPlayers: false,
        },
      ],
    });
    expect(
      validateOverworldConvoyAction(state, { kind: "move", convoyId: "c-1", qx: 20, qy: 10 }),
    ).toBe("Invalid convoy destination");
  });

  it("lists destinations within map speed reach", () => {
    const dests = listOverworldConvoyDestinations({ qx: 10, qy: 10 }, 1);
    expect(dests.some((d) => d.qx === 11 && d.qy === 10)).toBe(true);
    expect(dests.some((d) => d.qx === 20 && d.qy === 10)).toBe(false);
  });

  it("removes and reveals convoys", () => {
    const state = makeGameState({
      overworldConvoys: [
        {
          id: "c-1",
          qx: 8,
          qy: 10,
          type: "diplomatic",
          factionId: "syncrasis",
          infoVisibleToPlayers: false,
        },
      ],
    });
    applyOverworldConvoyAction(state, {
      kind: "setInfoVisible",
      convoyId: "c-1",
      visible: true,
    });
    expect(state.campaign!.overworldConvoys![0]!.infoVisibleToPlayers).toBe(true);
    applyOverworldConvoyAction(state, { kind: "remove", convoyId: "c-1" });
    expect(state.campaign!.overworldConvoys).toEqual([]);
  });
});
