import type { EnemyListing } from "@gaem/shared";
import {
  FACTION_QUALITY_KEYS,
  FACTIONS,
  getFactionById,
  listFactionIds,
  type FactionId,
  type FactionQualityDots,
} from "@gaem/shared";
import type { FactionCampaignAction, FactionState, FactionStates, GameState } from "@gaem/shared";
import { ensureCampaignBag } from "@gaem/shared";

const QUALITY_LABELS: Record<keyof FactionQualityDots, string> = {
  force: "Force",
  subterfuge: "Subterfuge",
  territory: "Territory",
  assets: "Assets",
};

function normalizeNameList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function defaultFactionState(factionId: FactionId): FactionState {
  const listing = getFactionById(factionId)!;
  return {
    crown: listing.crown,
    force: listing.qualities.force,
    subterfuge: listing.qualities.subterfuge,
    territory: listing.qualities.territory,
    assets: listing.qualities.assets,
    defeated: false,
    unlockedUpgrades: [],
    unlockedUniqueLocations: [],
  };
}

export function defaultFactionStates(): FactionStates {
  const states: FactionStates = {};
  for (const id of listFactionIds()) {
    states[id] = defaultFactionState(id);
  }
  return states;
}

export function defaultGmIchor(): number {
  return 0;
}

export function ensureGmIchor(state: GameState): number {
  const campaign = ensureCampaignBag(state);
  if (typeof campaign.gmIchor !== "number" || !Number.isFinite(campaign.gmIchor) || campaign.gmIchor < 0) {
    campaign.gmIchor = defaultGmIchor();
  } else {
    campaign.gmIchor = Math.trunc(campaign.gmIchor);
  }
  return campaign.gmIchor;
}

function clampQuality(value: number): number {
  return Math.max(0, Math.min(5, value));
}

function clampCrown(value: number): number {
  return Math.max(1, Math.min(5, value));
}

function zeroFactionStats(faction: FactionState): void {
  faction.crown = 0;
  faction.force = 0;
  faction.subterfuge = 0;
  faction.territory = 0;
  faction.assets = 0;
  faction.unlockedUpgrades = [];
  faction.unlockedUniqueLocations = [];
}

function normalizeFactionState(raw: Partial<FactionState> | undefined, factionId: FactionId): FactionState {
  const defaults = defaultFactionState(factionId);
  if (!raw) return defaults;
  const defeated = raw.defeated === true;
  if (defeated) {
    return {
      crown: 0,
      force: 0,
      subterfuge: 0,
      territory: 0,
      assets: 0,
      defeated: true,
      unlockedUpgrades: [],
      unlockedUniqueLocations: [],
    };
  }
  return {
    crown: clampCrown(typeof raw.crown === "number" ? raw.crown : defaults.crown),
    force: clampQuality(typeof raw.force === "number" ? raw.force : defaults.force),
    subterfuge: clampQuality(typeof raw.subterfuge === "number" ? raw.subterfuge : defaults.subterfuge),
    territory: clampQuality(typeof raw.territory === "number" ? raw.territory : defaults.territory),
    assets: clampQuality(typeof raw.assets === "number" ? raw.assets : defaults.assets),
    defeated: false,
    unlockedUpgrades: normalizeNameList(raw.unlockedUpgrades),
    unlockedUniqueLocations: normalizeNameList(raw.unlockedUniqueLocations),
  };
}

export function ensureFactionStates(state: GameState): FactionStates {
  const campaign = ensureCampaignBag(state);
  const existing = campaign.factionStates;
  const next: FactionStates = {};
  for (const id of listFactionIds()) {
    next[id] = normalizeFactionState(existing?.[id], id);
  }
  campaign.factionStates = next;
  return next;
}

export function isFactionUpgradeUnlocked(faction: FactionState, upgradeName: string): boolean {
  return faction.unlockedUpgrades.includes(upgradeName);
}

export function isFactionUniqueLocationUnlocked(faction: FactionState, locationName: string): boolean {
  return faction.unlockedUniqueLocations.includes(locationName);
}

export function isEnemyUpgradeLocked(
  enemy: Pick<EnemyListing, "requiresUpgrade">,
  faction: FactionState | null | undefined,
): boolean {
  if (!enemy.requiresUpgrade) return false;
  if (!faction) return true;
  return !isFactionUpgradeUnlocked(faction, enemy.requiresUpgrade);
}

export function isEnemyCrownGated(
  enemy: Pick<EnemyListing, "crown">,
  factionCrown: number,
): boolean {
  return enemy.crown != null && factionCrown > enemy.crown;
}

function findUpgrade(factionId: FactionId, upgradeName: string) {
  return getFactionById(factionId)?.upgrades.find((u) => u.name === upgradeName);
}

function findUniqueLocation(factionId: FactionId, locationName: string) {
  return getFactionById(factionId)?.uniqueLocations.find((l) => l.name === locationName);
}

export function validateFactionCampaignAction(
  state: GameState,
  action: FactionCampaignAction,
): string | null {
  ensureFactionStates(state);
  ensureGmIchor(state);

  if (action.kind === "adjustIchor") {
    if (!Number.isInteger(action.delta) || action.delta === 0) return "Invalid delta";
    const next = ensureCampaignBag(state).gmIchor! + action.delta;
    if (next < 0) return "Ichor cannot go below 0";
    return null;
  }

  if (!getFactionById(action.factionId)) return "Unknown faction";
  const faction = ensureCampaignBag(state).factionStates![action.factionId];

  if (action.kind === "setDefeated") {
    if (typeof action.defeated !== "boolean") return "Invalid defeated value";
    return null;
  }

  if (faction.defeated) return "Faction is defeated";

  if (action.kind === "adjustCrown") {
    if (!Number.isInteger(action.delta) || action.delta === 0) return "Invalid delta";
    const next = faction.crown + action.delta;
    if (next < 1 || next > 5) return "Crown must be between 1 and 5";
    return null;
  }

  if (action.kind === "adjustQuality") {
    if (!FACTION_QUALITY_KEYS.includes(action.quality)) return "Unknown quality";
    if (!Number.isInteger(action.delta) || action.delta === 0) return "Invalid delta";
    const next = faction[action.quality] + action.delta;
    if (next < 0 || next > 5) return "Quality must be between 0 and 5";
    return null;
  }

  if (action.kind === "unlockUpgrade") {
    const upgrade = findUpgrade(action.factionId, action.upgradeName);
    if (!upgrade) return "Unknown upgrade";
    if (isFactionUpgradeUnlocked(faction, action.upgradeName)) return "Upgrade already unlocked";
    if (upgrade.requires && !isFactionUniqueLocationUnlocked(faction, upgrade.requires)) {
      return `Requires ${upgrade.requires}`;
    }
    if (ensureCampaignBag(state).gmIchor! < upgrade.ichorCost) return "Insufficient ichor";
    return null;
  }

  if (action.kind === "lockUpgrade") {
    const upgrade = findUpgrade(action.factionId, action.upgradeName);
    if (!upgrade) return "Unknown upgrade";
    if (!isFactionUpgradeUnlocked(faction, action.upgradeName)) return "Upgrade is not unlocked";
    return null;
  }

  if (action.kind === "unlockUniqueLocation") {
    const location = findUniqueLocation(action.factionId, action.locationName);
    if (!location) return "Unknown unique location";
    if (isFactionUniqueLocationUnlocked(faction, action.locationName)) {
      return "Unique location already unlocked";
    }
    if (location.requires && !isFactionUpgradeUnlocked(faction, location.requires)) {
      return `Requires ${location.requires}`;
    }
    return null;
  }

  if (!findUniqueLocation(action.factionId, action.locationName)) return "Unknown unique location";
  if (!isFactionUniqueLocationUnlocked(faction, action.locationName)) {
    return "Unique location is not unlocked";
  }
  return null;
}

export function applyFactionCampaignAction(state: GameState, action: FactionCampaignAction): string {
  ensureFactionStates(state);
  ensureGmIchor(state);

  if (action.kind === "adjustIchor") {
    ensureCampaignBag(state).gmIchor! += action.delta;
    const sign = action.delta >= 0 ? "+" : "";
    return `Ichor ${sign}${action.delta} → ${ensureCampaignBag(state).gmIchor}`;
  }

  const faction = ensureCampaignBag(state).factionStates![action.factionId];
  const name = FACTIONS.find((f) => f.id === action.factionId)?.name ?? action.factionId;

  if (action.kind === "setDefeated") {
    faction.defeated = action.defeated;
    if (action.defeated) zeroFactionStats(faction);
    return action.defeated ? `${name} marked defeated` : `${name} no longer defeated`;
  }

  if (action.kind === "adjustCrown") {
    faction.crown += action.delta;
    const sign = action.delta >= 0 ? "+" : "";
    return `${name} Crown ${sign}${action.delta} → ${faction.crown}`;
  }

  if (action.kind === "adjustQuality") {
    faction[action.quality] += action.delta;
    const sign = action.delta >= 0 ? "+" : "";
    return `${name} ${QUALITY_LABELS[action.quality]} ${sign}${action.delta} → ${faction[action.quality]}`;
  }

  if (action.kind === "unlockUpgrade") {
    const upgrade = findUpgrade(action.factionId, action.upgradeName)!;
    ensureCampaignBag(state).gmIchor! -= upgrade.ichorCost;
    faction.unlockedUpgrades = [...faction.unlockedUpgrades, action.upgradeName];
    return `${name} unlocked ${action.upgradeName} (−${upgrade.ichorCost} Ichor → ${ensureCampaignBag(state).gmIchor})`;
  }

  if (action.kind === "lockUpgrade") {
    const upgrade = findUpgrade(action.factionId, action.upgradeName)!;
    ensureCampaignBag(state).gmIchor! += upgrade.ichorCost;
    faction.unlockedUpgrades = faction.unlockedUpgrades.filter((u) => u !== action.upgradeName);
    return `${name} locked ${action.upgradeName} (+${upgrade.ichorCost} Ichor → ${ensureCampaignBag(state).gmIchor})`;
  }

  if (action.kind === "unlockUniqueLocation") {
    faction.unlockedUniqueLocations = [...faction.unlockedUniqueLocations, action.locationName];
    return `${name} unlocked unique location ${action.locationName}`;
  }

  faction.unlockedUniqueLocations = faction.unlockedUniqueLocations.filter(
    (l) => l !== action.locationName,
  );
  return `${name} locked unique location ${action.locationName}`;
}
