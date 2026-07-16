import type {
  CampaignRuntimeState,
  GameState,
  LegacyCampaignGameStateFields,
} from "./types.js";

const LEGACY_CAMPAIGN_KEYS = [
  "partyResources",
  "constructedBaseUpgrades",
  "gmIchor",
  "overworldRegions",
  "overworldParty",
  "overworldLocations",
  "overworldConvoys",
  "factionStates",
] as const satisfies ReadonlyArray<keyof LegacyCampaignGameStateFields>;

export function ensureCampaignBag(state: GameState): CampaignRuntimeState {
  if (!state.campaign) state.campaign = {};
  return state.campaign;
}

export function liftLegacyCampaignFields(state: GameState): void {
  const legacy = state as GameState & LegacyCampaignGameStateFields;
  let hasLegacy = false;
  for (const key of LEGACY_CAMPAIGN_KEYS) {
    if (legacy[key] !== undefined) {
      hasLegacy = true;
      break;
    }
  }
  if (!hasLegacy) return;

  const bag = ensureCampaignBag(state);
  for (const key of LEGACY_CAMPAIGN_KEYS) {
    const value = legacy[key];
    if (value === undefined) continue;
    if (bag[key] === undefined) {
      (bag as LegacyCampaignGameStateFields)[key] = value as never;
    }
    delete legacy[key];
  }
}
