import {
  defaultPartyResourcesFromPack,
  getOverworldQuarterHeight,
  getOverworldQuarterWidth,
  listOverworldRegionIds,
  listPartyResourceKeys,
} from "./campaign-registry.js";
import type { CampaignHookContribution } from "./campaign-hooks.js";
import { ensureCampaignBag } from "./campaign-state.js";
import { listFactionIds, type FactionId } from "./faction-data.js";
import type {
  FactionState,
  FactionStates,
  GameState,
  OverworldParty,
  OverworldRegion,
  PartyResources,
} from "./types.js";
import { MAP_SPEED_INCHES } from "./types.js";

function unsupported(): string {
  return "Campaign action unavailable in fixture pack";
}

function defaultFactionState(_factionId: FactionId): FactionState {
  return {
    crown: 1,
    force: 0,
    subterfuge: 0,
    territory: 0,
    assets: 0,
    defeated: false,
    unlockedUpgrades: [],
    unlockedUniqueLocations: [],
  };
}

export function createFixtureCampaignHooks(): CampaignHookContribution {
  const defaultPartyResources = (): PartyResources => defaultPartyResourcesFromPack();

  const ensureCampaignState = (state: GameState): void => {
    const campaign = ensureCampaignBag(state);
    const defaults = defaultPartyResources();
    if (!campaign.partyResources) {
      campaign.partyResources = defaults;
    } else {
      for (const key of listPartyResourceKeys()) {
        if (
          typeof campaign.partyResources[key] !== "number" ||
          !Number.isFinite(campaign.partyResources[key])
        ) {
          campaign.partyResources[key] = defaults[key] ?? 0;
        }
      }
    }
    if (!campaign.unlockedUpgrades) campaign.unlockedUpgrades = [];
  };

  const defaultOverworldRegions = (): OverworldRegion[] =>
    listOverworldRegionIds().map((id) => ({ id }));

  const defaultOverworldParty = (): OverworldParty => ({
    qx: Math.floor((getOverworldQuarterWidth() - 1) / 2),
    qy: Math.floor((getOverworldQuarterHeight() - 1) / 2),
    atDis: true,
    mapSpeed: MAP_SPEED_INCHES,
    fuel: 0,
    revelations: 0,
  });

  const ensureFactionStates = (state: GameState): FactionStates => {
    const campaign = ensureCampaignBag(state);
    const next: FactionStates = {};
    for (const id of listFactionIds()) {
      next[id] = campaign.factionStates?.[id]
        ? { ...defaultFactionState(id), ...campaign.factionStates[id] }
        : defaultFactionState(id);
    }
    campaign.factionStates = next;
    return next;
  };

  return {
    ensure(state) {
      ensureCampaignState(state);
      const campaign = ensureCampaignBag(state);
      if (!campaign.mapRegions?.length) {
        campaign.mapRegions = defaultOverworldRegions();
      }
      if (!campaign.mapParty) campaign.mapParty = defaultOverworldParty();
      if (!campaign.mapLocations) campaign.mapLocations = [];
      if (!campaign.mapConvoys) campaign.mapConvoys = [];
      ensureFactionStates(state);
      if (typeof campaign.gmResource !== "number") campaign.gmResource = 0;
    },
    defaultPartyResources,
    ensureCampaignState,
    canAffordCost: () => false,
    formatCostDelta: () => "",
    planConstructUpgrade: () => null,
    canAffordUpgradeConstruction: () => false,
    validateBaseCampaignAction: () => unsupported(),
    applyBaseCampaignAction: () => unsupported(),
    defaultFactionState,
    defaultFactionStates: () => {
      const states: FactionStates = {};
      for (const id of listFactionIds()) states[id] = defaultFactionState(id);
      return states;
    },
    defaultGmIchor: () => 0,
    ensureGmIchor: (state) => {
      const campaign = ensureCampaignBag(state);
      if (typeof campaign.gmResource !== "number" || !Number.isFinite(campaign.gmResource)) {
        campaign.gmResource = 0;
      }
      return campaign.gmResource;
    },
    ensureFactionStates,
    isFactionUpgradeUnlocked: (faction, name) => faction.unlockedUpgrades.includes(name),
    isFactionUniqueLocationUnlocked: (faction, name) =>
      faction.unlockedUniqueLocations.includes(name),
    isEnemyUpgradeLocked: () => false,
    isEnemyCrownGated: () => false,
    validateFactionCampaignAction: () => unsupported(),
    applyFactionCampaignAction: () => unsupported(),
    defaultOverworldRegions,
    ensureOverworldRegions: (state) => {
      const campaign = ensureCampaignBag(state);
      campaign.mapRegions = defaultOverworldRegions();
      return campaign.mapRegions;
    },
    validateSetOverworldRegionImage: () => unsupported(),
    applySetOverworldRegionImage: () => unsupported(),
    defaultOverworldParty,
    ensureOverworldParty: (state) => {
      const campaign = ensureCampaignBag(state);
      if (!campaign.mapParty) campaign.mapParty = defaultOverworldParty();
      return campaign.mapParty;
    },
    regionIdForQuarter: () => listOverworldRegionIds()[0] ?? "west",
    ensureOverworldLocations: (state) => {
      const campaign = ensureCampaignBag(state);
      if (!campaign.mapLocations) campaign.mapLocations = [];
      return campaign.mapLocations;
    },
    isLocationInfoVisibleToPlayers: (loc) => loc.infoVisibleToPlayers !== false,
    locationAtQuarter: () => undefined,
    ensureOverworldConvoys: (state) => {
      const campaign = ensureCampaignBag(state);
      if (!campaign.mapConvoys) campaign.mapConvoys = [];
      return campaign.mapConvoys;
    },
    convoyAtQuarter: () => undefined,
    listOverworldConvoyDestinations: () => [],
    validateOverworldLocationAction: () => unsupported(),
    applyOverworldLocationAction: () => unsupported(),
    validateOverworldConvoyAction: () => unsupported(),
    applyOverworldConvoyAction: () => unsupported(),
    overworldTravelReachQuarters: (mapSpeed) => Math.ceil((mapSpeed * 2) / 0.5),
    isOverworldQuarterInBounds: (qx, qy) =>
      qx >= 0 &&
      qy >= 0 &&
      qx < getOverworldQuarterWidth() &&
      qy < getOverworldQuarterHeight(),
    isOverworldTravelDestination: () => false,
    listOverworldTravelDestinations: () => [],
    isOverworldDeployDestination: () => false,
    listOverworldDeployDestinations: () => [],
    validateOverworldCampaignAction: () => unsupported(),
    applyOverworldCampaignAction: () => unsupported(),
  };
}
