import type {
  CampaignRuntimeState,
  GameState,
  LegacyCampaignGameStateFields,
} from "./types.js";

const LEGACY_CAMPAIGN_KEYS = [
  "partyResources",
  "unlockedUpgrades",
  "gmResource",
  "mapRegions",
  "mapParty",
  "mapLocations",
  "mapConvoys",
  "factionStates",
  "constructedBaseUpgrades",
  "gmIchor",
  "overworldRegions",
  "overworldParty",
  "overworldLocations",
  "overworldConvoys",
] as const satisfies ReadonlyArray<keyof LegacyCampaignGameStateFields>;

const CAMPAIGN_KEY_RENAMES = [
  ["gmIchor", "gmResource"],
  ["constructedBaseUpgrades", "unlockedUpgrades"],
  ["overworldRegions", "mapRegions"],
  ["overworldParty", "mapParty"],
  ["overworldLocations", "mapLocations"],
  ["overworldConvoys", "mapConvoys"],
] as const satisfies ReadonlyArray<
  readonly [keyof LegacyCampaignGameStateFields, keyof CampaignRuntimeState]
>;

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

  const bag = ensureCampaignBag(state) as CampaignRuntimeState & LegacyCampaignGameStateFields;
  for (const key of LEGACY_CAMPAIGN_KEYS) {
    const value = legacy[key];
    if (value === undefined) continue;
    if (bag[key] === undefined) {
      bag[key] = value as never;
    }
    delete legacy[key];
  }
}

export function migrateCampaignRuntimeKeys(campaign: CampaignRuntimeState): void {
  const bag = campaign as CampaignRuntimeState & LegacyCampaignGameStateFields;
  for (const [oldKey, newKey] of CAMPAIGN_KEY_RENAMES) {
    if (bag[newKey] === undefined && bag[oldKey] !== undefined) {
      bag[newKey] = bag[oldKey] as never;
    }
    delete bag[oldKey];
  }
}
