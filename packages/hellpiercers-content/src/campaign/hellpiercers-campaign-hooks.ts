import type { CampaignHookContribution, GameState } from "@gaem/shared";

import { applyYadathanSheetLoadout, validateYadathanSheetLoadout } from "../sheet-data.js";
import * as base from "./base-upgrades-campaign.js";
import * as faction from "./faction-campaign.js";
import * as overworld from "./overworld.js";

export function hellpiercersCampaignHooks(): CampaignHookContribution {
  return {
    ensure(state: GameState) {
      base.ensureCampaignState(state);
      overworld.ensureOverworldRegions(state);
      overworld.ensureOverworldParty(state);
      overworld.ensureOverworldLocations(state);
      overworld.ensureOverworldConvoys(state);
      faction.ensureFactionStates(state);
      faction.ensureGmIchor(state);
    },
    validateSheetLoadoutExtras: validateYadathanSheetLoadout,
    applySheetLoadoutExtras: applyYadathanSheetLoadout,
    defaultPartyResources: base.defaultPartyResources,
    ensureCampaignState: base.ensureCampaignState,
    canAffordCost: base.canAffordCost,
    formatCostDelta: base.formatCostDelta,
    planConstructUpgrade: base.planConstructUpgrade,
    canAffordUpgradeConstruction: base.canAffordUpgradeConstruction,
    validateBaseCampaignAction: base.validateBaseCampaignAction,
    applyBaseCampaignAction: base.applyBaseCampaignAction,
    defaultFactionState: faction.defaultFactionState,
    defaultFactionStates: faction.defaultFactionStates,
    defaultGmIchor: faction.defaultGmIchor,
    ensureGmIchor: faction.ensureGmIchor,
    ensureFactionStates: faction.ensureFactionStates,
    isFactionUpgradeUnlocked: faction.isFactionUpgradeUnlocked,
    isFactionUniqueLocationUnlocked: faction.isFactionUniqueLocationUnlocked,
    isEnemyUpgradeLocked: faction.isEnemyUpgradeLocked,
    isEnemyCrownGated: faction.isEnemyCrownGated,
    validateFactionCampaignAction: faction.validateFactionCampaignAction,
    applyFactionCampaignAction: faction.applyFactionCampaignAction,
    defaultOverworldRegions: overworld.defaultOverworldRegions,
    ensureOverworldRegions: overworld.ensureOverworldRegions,
    validateSetOverworldRegionImage: overworld.validateSetOverworldRegionImage,
    applySetOverworldRegionImage: overworld.applySetOverworldRegionImage,
    defaultOverworldParty: overworld.defaultOverworldParty,
    ensureOverworldParty: overworld.ensureOverworldParty,
    regionIdForQuarter: overworld.regionIdForQuarter,
    ensureOverworldLocations: overworld.ensureOverworldLocations,
    isLocationInfoVisibleToPlayers: overworld.isLocationInfoVisibleToPlayers,
    locationAtQuarter: overworld.locationAtQuarter,
    ensureOverworldConvoys: overworld.ensureOverworldConvoys,
    convoyAtQuarter: overworld.convoyAtQuarter,
    listOverworldConvoyDestinations: overworld.listOverworldConvoyDestinations,
    validateOverworldLocationAction: overworld.validateOverworldLocationAction,
    applyOverworldLocationAction: overworld.applyOverworldLocationAction,
    validateOverworldConvoyAction: overworld.validateOverworldConvoyAction,
    applyOverworldConvoyAction: overworld.applyOverworldConvoyAction,
    overworldTravelReachQuarters: overworld.overworldTravelReachQuarters,
    isOverworldQuarterInBounds: overworld.isOverworldQuarterInBounds,
    isOverworldTravelDestination: overworld.isOverworldTravelDestination,
    listOverworldTravelDestinations: overworld.listOverworldTravelDestinations,
    isOverworldDeployDestination: overworld.isOverworldDeployDestination,
    listOverworldDeployDestinations: overworld.listOverworldDeployDestinations,
    validateOverworldCampaignAction: overworld.validateOverworldCampaignAction,
    applyOverworldCampaignAction: overworld.applyOverworldCampaignAction,
  };
}
