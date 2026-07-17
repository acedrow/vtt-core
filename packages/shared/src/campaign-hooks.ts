import type {
  BaseCampaignAction,
  CharacterSheet,
  FactionCampaignAction,
  FactionState,
  FactionStates,
  GameState,
  OverworldCampaignAction,
  OverworldConvoy,
  OverworldConvoyAction,
  OverworldLocation,
  OverworldLocationAction,
  OverworldParty,
  OverworldRegion,
  OverworldRegionId,
  PartyResources,
  Player,
} from "./types.js";
import type { BaseUpgradeCost } from "./base-upgrades-data.js";
import type { CharacterSheetLoadoutFields } from "./base-upgrades-unlocks.js";
import type { EnemyListing } from "./enemy-data.js";
import type { FactionId } from "./faction-data.js";
import {
  assertContentPackRegistered,
  type ContentPackMeta,
} from "./content-pack-state.js";

export type CampaignHookContribution = {
  ensure: (state: GameState) => void;
  /** Pack-owned sheet `data` keys also accepted as REST body top-level fields. */
  sheetDataKeys?: readonly string[];
  validateSheetLoadoutExtras?: (
    fields: CharacterSheetLoadoutFields,
    existing?: CharacterSheetLoadoutFields,
  ) => string | null;
  applySheetLoadoutExtras?: (
    player: Player,
    loadout: { armor: string; data?: Record<string, unknown> },
  ) => void;
  /** Migrate/backfill pack-owned sheet data when pack version changes. */
  ensureSheet?: (sheet: CharacterSheet, from: ContentPackMeta | null) => void;
  defaultPartyResources: () => PartyResources;
  ensureCampaignState: (state: GameState) => void;
  canAffordCost: (resources: PartyResources, cost: BaseUpgradeCost) => boolean;
  formatCostDelta: (cost: BaseUpgradeCost, sign: "+" | "−") => string;
  planConstructUpgrade: (constructedIds: readonly string[], upgradeId: string) => string[] | null;
  canAffordUpgradeConstruction: (
    resources: PartyResources,
    constructedIds: readonly string[],
    upgradeId: string,
  ) => boolean;
  validateBaseCampaignAction: (state: GameState, action: BaseCampaignAction) => string | null;
  applyBaseCampaignAction: (state: GameState, action: BaseCampaignAction) => string;
  defaultFactionState: (factionId: FactionId) => FactionState;
  defaultFactionStates: () => FactionStates;
  defaultGmIchor: () => number;
  ensureGmIchor: (state: GameState) => number;
  ensureFactionStates: (state: GameState) => FactionStates;
  isFactionUpgradeUnlocked: (faction: FactionState, upgradeName: string) => boolean;
  isFactionUniqueLocationUnlocked: (faction: FactionState, locationName: string) => boolean;
  isEnemyUpgradeLocked: (
    enemy: Pick<EnemyListing, "requiresUpgrade">,
    faction: FactionState | null | undefined,
  ) => boolean;
  isEnemyCrownGated: (enemy: Pick<EnemyListing, "crown">, factionCrown: number) => boolean;
  validateFactionCampaignAction: (
    state: GameState,
    action: FactionCampaignAction,
  ) => string | null;
  applyFactionCampaignAction: (state: GameState, action: FactionCampaignAction) => string;
  defaultOverworldRegions: () => OverworldRegion[];
  ensureOverworldRegions: (state: GameState) => OverworldRegion[];
  validateSetOverworldRegionImage: (
    state: GameState,
    regionId: OverworldRegionId,
    imageKey: string | null,
  ) => string | null;
  applySetOverworldRegionImage: (
    state: GameState,
    regionId: OverworldRegionId,
    imageKey: string | null,
  ) => string;
  defaultOverworldParty: () => OverworldParty;
  ensureOverworldParty: (state: GameState) => OverworldParty;
  regionIdForQuarter: (qx: number) => OverworldRegionId;
  ensureOverworldLocations: (state: GameState) => OverworldLocation[];
  isLocationInfoVisibleToPlayers: (loc: OverworldLocation) => boolean;
  locationAtQuarter: (state: GameState, qx: number, qy: number) => OverworldLocation | undefined;
  ensureOverworldConvoys: (state: GameState) => OverworldConvoy[];
  convoyAtQuarter: (state: GameState, qx: number, qy: number) => OverworldConvoy | undefined;
  listOverworldConvoyDestinations: (
    convoy: Pick<OverworldConvoy, "qx" | "qy">,
    mapSpeed: number,
  ) => { qx: number; qy: number }[];
  validateOverworldLocationAction: (
    state: GameState,
    action: OverworldLocationAction,
  ) => string | null;
  applyOverworldLocationAction: (state: GameState, action: OverworldLocationAction) => string;
  validateOverworldConvoyAction: (
    state: GameState,
    action: OverworldConvoyAction,
  ) => string | null;
  applyOverworldConvoyAction: (state: GameState, action: OverworldConvoyAction) => string;
  overworldTravelReachQuarters: (mapSpeed: number) => number;
  isOverworldQuarterInBounds: (qx: number, qy: number) => boolean;
  isOverworldTravelDestination: (
    from: { qx: number; qy: number },
    to: { qx: number; qy: number },
    mapSpeed: number,
  ) => boolean;
  listOverworldTravelDestinations: (party: OverworldParty) => { qx: number; qy: number }[];
  isOverworldDeployDestination: (qx: number, qy: number) => boolean;
  listOverworldDeployDestinations: () => { qx: number; qy: number }[];
  validateOverworldCampaignAction: (
    state: GameState,
    action: OverworldCampaignAction,
  ) => string | null;
  applyOverworldCampaignAction: (state: GameState, action: OverworldCampaignAction) => string;
};

let campaignHooks: CampaignHookContribution | null = null;

export function clearCampaignHooks(): void {
  campaignHooks = null;
}

export function replaceCampaignHooks(hooks: CampaignHookContribution | null): void {
  campaignHooks = hooks;
}

export function getCampaignHooks(): CampaignHookContribution | null {
  return campaignHooks;
}

export function requireCampaignHooks(): CampaignHookContribution {
  assertContentPackRegistered();
  if (!campaignHooks) {
    throw new Error("Campaign hooks are not registered");
  }
  return campaignHooks;
}

export function defaultPartyResources(): PartyResources {
  return requireCampaignHooks().defaultPartyResources();
}

export function ensureCampaignState(state: GameState): void {
  requireCampaignHooks().ensureCampaignState(state);
}

export function canAffordCost(resources: PartyResources, cost: BaseUpgradeCost): boolean {
  return requireCampaignHooks().canAffordCost(resources, cost);
}

export function formatCostDelta(cost: BaseUpgradeCost, sign: "+" | "−"): string {
  return requireCampaignHooks().formatCostDelta(cost, sign);
}

export function planConstructUpgrade(
  constructedIds: readonly string[],
  upgradeId: string,
): string[] | null {
  return requireCampaignHooks().planConstructUpgrade(constructedIds, upgradeId);
}

export function canAffordUpgradeConstruction(
  resources: PartyResources,
  constructedIds: readonly string[],
  upgradeId: string,
): boolean {
  return requireCampaignHooks().canAffordUpgradeConstruction(resources, constructedIds, upgradeId);
}

export function validateBaseCampaignAction(
  state: GameState,
  action: BaseCampaignAction,
): string | null {
  return requireCampaignHooks().validateBaseCampaignAction(state, action);
}

export function applyBaseCampaignAction(state: GameState, action: BaseCampaignAction): string {
  return requireCampaignHooks().applyBaseCampaignAction(state, action);
}

export function defaultFactionState(factionId: FactionId): FactionState {
  return requireCampaignHooks().defaultFactionState(factionId);
}

export function defaultFactionStates(): FactionStates {
  return requireCampaignHooks().defaultFactionStates();
}

export function defaultGmIchor(): number {
  return requireCampaignHooks().defaultGmIchor();
}

export function ensureGmIchor(state: GameState): number {
  return requireCampaignHooks().ensureGmIchor(state);
}

export function ensureFactionStates(state: GameState): FactionStates {
  return requireCampaignHooks().ensureFactionStates(state);
}

export function isFactionUpgradeUnlocked(faction: FactionState, upgradeName: string): boolean {
  return requireCampaignHooks().isFactionUpgradeUnlocked(faction, upgradeName);
}

export function isFactionUniqueLocationUnlocked(
  faction: FactionState,
  locationName: string,
): boolean {
  return requireCampaignHooks().isFactionUniqueLocationUnlocked(faction, locationName);
}

export function isEnemyUpgradeLocked(
  enemy: Pick<EnemyListing, "requiresUpgrade">,
  faction: FactionState | null | undefined,
): boolean {
  return requireCampaignHooks().isEnemyUpgradeLocked(enemy, faction);
}

export function isEnemyCrownGated(
  enemy: Pick<EnemyListing, "crown">,
  factionCrown: number,
): boolean {
  return requireCampaignHooks().isEnemyCrownGated(enemy, factionCrown);
}

export function validateFactionCampaignAction(
  state: GameState,
  action: FactionCampaignAction,
): string | null {
  return requireCampaignHooks().validateFactionCampaignAction(state, action);
}

export function applyFactionCampaignAction(
  state: GameState,
  action: FactionCampaignAction,
): string {
  return requireCampaignHooks().applyFactionCampaignAction(state, action);
}

export function defaultOverworldRegions(): OverworldRegion[] {
  return requireCampaignHooks().defaultOverworldRegions();
}

export function ensureOverworldRegions(state: GameState): OverworldRegion[] {
  return requireCampaignHooks().ensureOverworldRegions(state);
}

export function validateSetOverworldRegionImage(
  state: GameState,
  regionId: OverworldRegionId,
  imageKey: string | null,
): string | null {
  return requireCampaignHooks().validateSetOverworldRegionImage(state, regionId, imageKey);
}

export function applySetOverworldRegionImage(
  state: GameState,
  regionId: OverworldRegionId,
  imageKey: string | null,
): string {
  return requireCampaignHooks().applySetOverworldRegionImage(state, regionId, imageKey);
}

export function defaultOverworldParty(): OverworldParty {
  return requireCampaignHooks().defaultOverworldParty();
}

export function ensureOverworldParty(state: GameState): OverworldParty {
  return requireCampaignHooks().ensureOverworldParty(state);
}

export function regionIdForQuarter(qx: number): OverworldRegionId {
  return requireCampaignHooks().regionIdForQuarter(qx);
}

export function ensureOverworldLocations(state: GameState): OverworldLocation[] {
  return requireCampaignHooks().ensureOverworldLocations(state);
}

export function isLocationInfoVisibleToPlayers(loc: OverworldLocation): boolean {
  return requireCampaignHooks().isLocationInfoVisibleToPlayers(loc);
}

export function locationAtQuarter(
  state: GameState,
  qx: number,
  qy: number,
): OverworldLocation | undefined {
  return requireCampaignHooks().locationAtQuarter(state, qx, qy);
}

export function ensureOverworldConvoys(state: GameState): OverworldConvoy[] {
  return requireCampaignHooks().ensureOverworldConvoys(state);
}

export function convoyAtQuarter(
  state: GameState,
  qx: number,
  qy: number,
): OverworldConvoy | undefined {
  return requireCampaignHooks().convoyAtQuarter(state, qx, qy);
}

export function listOverworldConvoyDestinations(
  convoy: Pick<OverworldConvoy, "qx" | "qy">,
  mapSpeed: number,
): { qx: number; qy: number }[] {
  return requireCampaignHooks().listOverworldConvoyDestinations(convoy, mapSpeed);
}

export function validateOverworldLocationAction(
  state: GameState,
  action: OverworldLocationAction,
): string | null {
  return requireCampaignHooks().validateOverworldLocationAction(state, action);
}

export function applyOverworldLocationAction(
  state: GameState,
  action: OverworldLocationAction,
): string {
  return requireCampaignHooks().applyOverworldLocationAction(state, action);
}

export function validateOverworldConvoyAction(
  state: GameState,
  action: OverworldConvoyAction,
): string | null {
  return requireCampaignHooks().validateOverworldConvoyAction(state, action);
}

export function applyOverworldConvoyAction(
  state: GameState,
  action: OverworldConvoyAction,
): string {
  return requireCampaignHooks().applyOverworldConvoyAction(state, action);
}

export function overworldTravelReachQuarters(mapSpeed: number): number {
  return requireCampaignHooks().overworldTravelReachQuarters(mapSpeed);
}

export function isOverworldQuarterInBounds(qx: number, qy: number): boolean {
  return requireCampaignHooks().isOverworldQuarterInBounds(qx, qy);
}

export function isOverworldTravelDestination(
  from: { qx: number; qy: number },
  to: { qx: number; qy: number },
  mapSpeed: number,
): boolean {
  return requireCampaignHooks().isOverworldTravelDestination(from, to, mapSpeed);
}

export function listOverworldTravelDestinations(
  party: OverworldParty,
): { qx: number; qy: number }[] {
  return requireCampaignHooks().listOverworldTravelDestinations(party);
}

export function isOverworldDeployDestination(qx: number, qy: number): boolean {
  return requireCampaignHooks().isOverworldDeployDestination(qx, qy);
}

export function listOverworldDeployDestinations(): { qx: number; qy: number }[] {
  return requireCampaignHooks().listOverworldDeployDestinations();
}

export function validateOverworldCampaignAction(
  state: GameState,
  action: OverworldCampaignAction,
): string | null {
  return requireCampaignHooks().validateOverworldCampaignAction(state, action);
}

export function applyOverworldCampaignAction(
  state: GameState,
  action: OverworldCampaignAction,
): string {
  return requireCampaignHooks().applyOverworldCampaignAction(state, action);
}
