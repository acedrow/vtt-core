import type {
  GameState,
  OverworldCampaignAction,
  OverworldConvoy,
  OverworldConvoyAction,
  OverworldLocation,
  OverworldLocationAction,
  OverworldParty,
  OverworldRegion,
  OverworldRegionId,
} from "@gaem/shared";
import {
  ensureCampaignBag,
  getConvoyTypeInfo,
  getFactionById,
  getOverworldQuarterHeight,
  getOverworldQuarterWidth,
  getOverworldTravelFuelCost,
  getOverworldWidth,
  listOverworldRegionIds,
  MAP_SPEED_INCHES,
  QUARTER_CELL_INCHES,
} from "@gaem/shared";

const REGION_IMAGE_KEY_RE = /^region-images\/[0-9a-f-]+\.(png|jpe?g|webp)$/i;

function knownRegionIds(): OverworldRegionId[] {
  return listOverworldRegionIds();
}

export function defaultOverworldRegions(): OverworldRegion[] {
  return knownRegionIds().map((id) => ({ id }));
}

export function ensureOverworldRegions(state: GameState): OverworldRegion[] {
  const campaign = ensureCampaignBag(state);
  const regionIds = knownRegionIds();
  if (
    !campaign.overworldRegions ||
    campaign.overworldRegions.length !== regionIds.length ||
    !regionIds.every((id) => campaign.overworldRegions!.some((r) => r.id === id))
  ) {
    campaign.overworldRegions = defaultOverworldRegions();
    return campaign.overworldRegions;
  }
  const byId = new Map(campaign.overworldRegions.map((r) => [r.id, r]));
  campaign.overworldRegions = regionIds.map((id) => {
    const existing = byId.get(id);
    return existing ? { id, ...(existing.imageKey ? { imageKey: existing.imageKey } : {}) } : { id };
  });
  return campaign.overworldRegions;
}

export function validateSetOverworldRegionImage(
  state: GameState,
  regionId: OverworldRegionId,
  imageKey: string | null,
): string | null {
  ensureOverworldRegions(state);
  if (!knownRegionIds().includes(regionId)) return "Unknown region";
  if (imageKey != null && !REGION_IMAGE_KEY_RE.test(imageKey)) {
    return "Invalid region image key";
  }
  return null;
}

export function applySetOverworldRegionImage(
  state: GameState,
  regionId: OverworldRegionId,
  imageKey: string | null,
): string {
  const regions = ensureOverworldRegions(state);
  const region = regions.find((r) => r.id === regionId)!;
  if (imageKey) region.imageKey = imageKey;
  else delete region.imageKey;
  const label = regionId.charAt(0).toUpperCase() + regionId.slice(1);
  return imageKey ? `Set ${label} region image` : `Cleared ${label} region image`;
}

export function defaultOverworldParty(): OverworldParty {
  return {
    qx: Math.floor((getOverworldQuarterWidth() - 1) / 2),
    qy: Math.floor((getOverworldQuarterHeight() - 1) / 2),
    atDis: true,
    mapSpeed: 1,
    fuel: 0,
    revelations: 0,
  };
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export function ensureOverworldParty(state: GameState): OverworldParty {
  const campaign = ensureCampaignBag(state);
  const defaults = defaultOverworldParty();
  const existing = campaign.overworldParty;
  if (!existing) {
    campaign.overworldParty = defaults;
    return defaults;
  }
  existing.qx = clampInt(existing.qx, 0, getOverworldQuarterWidth() - 1);
  existing.qy = clampInt(existing.qy, 0, getOverworldQuarterHeight() - 1);
  existing.atDis = existing.atDis === true;
  existing.mapSpeed = normalizeNonNeg(existing.mapSpeed);
  existing.fuel = Math.floor(normalizeNonNeg(existing.fuel));
  existing.revelations = Math.floor(normalizeNonNeg(existing.revelations));
  campaign.overworldParty = existing;
  return existing;
}

export function regionIdForQuarter(qx: number): OverworldRegionId {
  const majorX = Math.floor(qx / 2);
  const third = getOverworldWidth() / 3;
  if (majorX < third) return "west";
  if (majorX < third * 2) return "center";
  return "east";
}

function newLocationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ensureOverworldLocations(state: GameState): OverworldLocation[] {
  const campaign = ensureCampaignBag(state);
  if (!Array.isArray(campaign.overworldLocations)) {
    campaign.overworldLocations = [];
    return campaign.overworldLocations;
  }
  const seen = new Set<string>();
  const out: OverworldLocation[] = [];
  for (const loc of campaign.overworldLocations) {
    if (!loc || typeof loc !== "object") continue;
    if (typeof loc.id !== "string" || !loc.id) continue;
    if (typeof loc.name !== "string" || !loc.name.trim()) continue;
    if (!getFactionById(loc.factionId)) continue;
    if (!isOverworldQuarterInBounds(loc.qx, loc.qy)) continue;
    const key = `${loc.qx},${loc.qy}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry: OverworldLocation = {
      id: loc.id,
      qx: loc.qx,
      qy: loc.qy,
      name: loc.name.trim(),
      factionId: loc.factionId,
    };
    if (loc.infoVisibleToPlayers === false) entry.infoVisibleToPlayers = false;
    out.push(entry);
  }
  campaign.overworldLocations = out;
  return out;
}

export function isLocationInfoVisibleToPlayers(loc: OverworldLocation): boolean {
  return loc.infoVisibleToPlayers !== false;
}

export function locationAtQuarter(
  state: GameState,
  qx: number,
  qy: number,
): OverworldLocation | undefined {
  return ensureOverworldLocations(state).find((loc) => loc.qx === qx && loc.qy === qy);
}

function newConvoyId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ensureOverworldConvoys(state: GameState): OverworldConvoy[] {
  const campaign = ensureCampaignBag(state);
  if (!Array.isArray(campaign.overworldConvoys)) {
    campaign.overworldConvoys = [];
    return campaign.overworldConvoys;
  }
  const seenIds = new Set<string>();
  const out: OverworldConvoy[] = [];
  for (const convoy of campaign.overworldConvoys) {
    if (!convoy || typeof convoy !== "object") continue;
    if (typeof convoy.id !== "string" || !convoy.id) continue;
    if (seenIds.has(convoy.id)) continue;
    if (!getConvoyTypeInfo(convoy.type)) continue;
    if (!getFactionById(convoy.factionId)) continue;
    if (!isOverworldQuarterInBounds(convoy.qx, convoy.qy)) continue;
    seenIds.add(convoy.id);
    out.push({
      id: convoy.id,
      qx: convoy.qx,
      qy: convoy.qy,
      type: convoy.type,
      factionId: convoy.factionId,
      infoVisibleToPlayers: convoy.infoVisibleToPlayers === true,
    });
  }
  campaign.overworldConvoys = out;
  return out;
}

export function convoyAtQuarter(
  state: GameState,
  qx: number,
  qy: number,
): OverworldConvoy | undefined {
  return ensureOverworldConvoys(state).find((c) => c.qx === qx && c.qy === qy);
}

export function listOverworldConvoyDestinations(
  convoy: Pick<OverworldConvoy, "qx" | "qy">,
  mapSpeed: number,
): { qx: number; qy: number }[] {
  const reach = overworldTravelReachQuarters(mapSpeed);
  if (reach <= 0) return [];
  const out: { qx: number; qy: number }[] = [];
  const minQx = Math.max(0, Math.floor(convoy.qx - reach));
  const maxQx = Math.min(getOverworldQuarterWidth() - 1, Math.ceil(convoy.qx + reach));
  const minQy = Math.max(0, Math.floor(convoy.qy - reach));
  const maxQy = Math.min(getOverworldQuarterHeight() - 1, Math.ceil(convoy.qy + reach));
  for (let qy = minQy; qy <= maxQy; qy++) {
    for (let qx = minQx; qx <= maxQx; qx++) {
      if (!isOverworldTravelDestination(convoy, { qx, qy }, mapSpeed)) continue;
      out.push({ qx, qy });
    }
  }
  return out;
}

export function validateOverworldLocationAction(
  state: GameState,
  action: OverworldLocationAction,
): string | null {
  ensureOverworldLocations(state);
  switch (action.kind) {
    case "place": {
      if (!isOverworldQuarterInBounds(action.qx, action.qy)) return "Out of bounds";
      if (!getFactionById(action.factionId)) return "Unknown faction";
      const name = typeof action.name === "string" ? action.name.trim() : "";
      if (!name) return "Location name is required";
      if (locationAtQuarter(state, action.qx, action.qy)) {
        return "A location is already placed here";
      }
      return null;
    }
    case "remove": {
      if (typeof action.locationId !== "string" || !action.locationId) {
        return "Location id is required";
      }
      if (!ensureCampaignBag(state).overworldLocations!.some((loc) => loc.id === action.locationId)) {
        return "Location not found";
      }
      return null;
    }
    case "setInfoVisible": {
      if (typeof action.locationId !== "string" || !action.locationId) {
        return "Location id is required";
      }
      if (typeof action.visible !== "boolean") return "Visibility must be a boolean";
      if (!ensureCampaignBag(state).overworldLocations!.some((loc) => loc.id === action.locationId)) {
        return "Location not found";
      }
      return null;
    }
  }
}

export function applyOverworldLocationAction(
  state: GameState,
  action: OverworldLocationAction,
): string {
  const locations = ensureOverworldLocations(state);
  switch (action.kind) {
    case "place": {
      const name = action.name.trim();
      locations.push({
        id: newLocationId(),
        qx: action.qx,
        qy: action.qy,
        name,
        factionId: action.factionId,
      });
      return `Placed location "${name}" at (${action.qx}, ${action.qy})`;
    }
    case "remove": {
      const idx = locations.findIndex((loc) => loc.id === action.locationId);
      const removed = locations[idx]!;
      locations.splice(idx, 1);
      return `Removed location "${removed.name}"`;
    }
    case "setInfoVisible": {
      const loc = locations.find((l) => l.id === action.locationId)!;
      if (action.visible) delete loc.infoVisibleToPlayers;
      else loc.infoVisibleToPlayers = false;
      return action.visible
        ? `Revealed location "${loc.name}" to players`
        : `Hid location "${loc.name}" from players`;
    }
  }
}

export function validateOverworldConvoyAction(
  state: GameState,
  action: OverworldConvoyAction,
): string | null {
  ensureOverworldConvoys(state);
  const party = ensureOverworldParty(state);
  switch (action.kind) {
    case "place": {
      if (!isOverworldQuarterInBounds(action.qx, action.qy)) return "Out of bounds";
      if (!getConvoyTypeInfo(action.type)) return "Unknown convoy type";
      if (!getFactionById(action.factionId)) return "Unknown faction";
      return null;
    }
    case "remove": {
      if (typeof action.convoyId !== "string" || !action.convoyId) {
        return "Convoy id is required";
      }
      if (!ensureCampaignBag(state).overworldConvoys!.some((c) => c.id === action.convoyId)) {
        return "Convoy not found";
      }
      return null;
    }
    case "move": {
      if (typeof action.convoyId !== "string" || !action.convoyId) {
        return "Convoy id is required";
      }
      const convoy = ensureCampaignBag(state).overworldConvoys!.find((c) => c.id === action.convoyId);
      if (!convoy) return "Convoy not found";
      if (!isOverworldTravelDestination(convoy, { qx: action.qx, qy: action.qy }, party.mapSpeed)) {
        return "Invalid convoy destination";
      }
      return null;
    }
    case "setInfoVisible": {
      if (typeof action.convoyId !== "string" || !action.convoyId) {
        return "Convoy id is required";
      }
      if (typeof action.visible !== "boolean") return "Visibility must be a boolean";
      if (!ensureCampaignBag(state).overworldConvoys!.some((c) => c.id === action.convoyId)) {
        return "Convoy not found";
      }
      return null;
    }
  }
}

export function applyOverworldConvoyAction(
  state: GameState,
  action: OverworldConvoyAction,
): string {
  const convoys = ensureOverworldConvoys(state);
  switch (action.kind) {
    case "place": {
      convoys.push({
        id: newConvoyId(),
        qx: action.qx,
        qy: action.qy,
        type: action.type,
        factionId: action.factionId,
        infoVisibleToPlayers: false,
      });
      return `Deployed ${action.type} convoy at (${action.qx}, ${action.qy})`;
    }
    case "remove": {
      const idx = convoys.findIndex((c) => c.id === action.convoyId);
      const removed = convoys[idx]!;
      convoys.splice(idx, 1);
      return `Removed ${removed.type} convoy`;
    }
    case "move": {
      const convoy = convoys.find((c) => c.id === action.convoyId)!;
      convoy.qx = action.qx;
      convoy.qy = action.qy;
      return `Moved ${convoy.type} convoy to (${action.qx}, ${action.qy})`;
    }
    case "setInfoVisible": {
      const convoy = convoys.find((c) => c.id === action.convoyId)!;
      convoy.infoVisibleToPlayers = action.visible;
      return action.visible
        ? `Revealed ${convoy.type} convoy to players`
        : `Hid ${convoy.type} convoy from players`;
    }
  }
}

export function overworldTravelReachQuarters(mapSpeed: number): number {
  const speed = normalizeNonNeg(mapSpeed);
  return Math.ceil((speed * MAP_SPEED_INCHES) / QUARTER_CELL_INCHES);
}

export function isOverworldQuarterInBounds(qx: number, qy: number): boolean {
  return (
    Number.isInteger(qx) &&
    Number.isInteger(qy) &&
    qx >= 0 &&
    qy >= 0 &&
    qx < getOverworldQuarterWidth() &&
    qy < getOverworldQuarterHeight()
  );
}

export function isOverworldTravelDestination(
  from: { qx: number; qy: number },
  to: { qx: number; qy: number },
  mapSpeed: number,
): boolean {
  if (!isOverworldQuarterInBounds(to.qx, to.qy)) return false;
  if (to.qx === from.qx && to.qy === from.qy) return false;
  const reach = overworldTravelReachQuarters(mapSpeed);
  if (reach <= 0) return false;
  const dist = Math.hypot(to.qx - from.qx, to.qy - from.qy);
  return dist <= reach;
}

export function listOverworldTravelDestinations(
  party: Pick<OverworldParty, "qx" | "qy" | "mapSpeed">,
): { qx: number; qy: number }[] {
  const reach = overworldTravelReachQuarters(party.mapSpeed);
  if (reach <= 0) return [];
  const out: { qx: number; qy: number }[] = [];
  const minQx = Math.max(0, Math.floor(party.qx - reach));
  const maxQx = Math.min(getOverworldQuarterWidth() - 1, Math.ceil(party.qx + reach));
  const minQy = Math.max(0, Math.floor(party.qy - reach));
  const maxQy = Math.min(getOverworldQuarterHeight() - 1, Math.ceil(party.qy + reach));
  for (let qy = minQy; qy <= maxQy; qy++) {
    for (let qx = minQx; qx <= maxQx; qx++) {
      if (isOverworldTravelDestination(party, { qx, qy }, party.mapSpeed)) {
        out.push({ qx, qy });
      }
    }
  }
  return out;
}

export function isOverworldDeployDestination(qx: number, qy: number): boolean {
  return isOverworldQuarterInBounds(qx, qy) && qy === getOverworldQuarterHeight() - 1;
}

export function listOverworldDeployDestinations(): { qx: number; qy: number }[] {
  const qy = getOverworldQuarterHeight() - 1;
  const out: { qx: number; qy: number }[] = [];
  for (let qx = 0; qx < getOverworldQuarterWidth(); qx++) {
    out.push({ qx, qy });
  }
  return out;
}

export function validateOverworldCampaignAction(
  state: GameState,
  action: OverworldCampaignAction,
): string | null {
  const party = ensureOverworldParty(state);
  switch (action.kind) {
    case "adjustMapSpeed": {
      if (!Number.isFinite(action.delta) || action.delta === 0) return "Invalid speed adjustment";
      if (party.mapSpeed + action.delta < 0) return "Insufficient map speed";
      return null;
    }
    case "adjustFuel": {
      if (!Number.isInteger(action.delta) || action.delta === 0) return "Invalid fuel adjustment";
      if (party.fuel + action.delta < 0) return "Insufficient fuel";
      return null;
    }
    case "adjustRevelations": {
      if (!Number.isInteger(action.delta) || action.delta === 0) return "Invalid revelations adjustment";
      if (party.revelations + action.delta < 0) return "Insufficient revelations";
      return null;
    }
    case "travel": {
      if (party.atDis) return "Party is in DIS";
      if (party.fuel < getOverworldTravelFuelCost()) return "Not enough fuel";
      if (!isOverworldTravelDestination(party, { qx: action.qx, qy: action.qy }, party.mapSpeed)) {
        return "Invalid travel destination";
      }
      return null;
    }
    case "returnToDis": {
      if (party.atDis) return "Party is already in DIS";
      return null;
    }
    case "deployToHell": {
      if (!party.atDis) return "Party is not in DIS";
      if (!isOverworldDeployDestination(action.qx, action.qy)) {
        return "Invalid deploy destination";
      }
      return null;
    }
  }
}

export function applyOverworldCampaignAction(
  state: GameState,
  action: OverworldCampaignAction,
): string {
  const party = ensureOverworldParty(state);
  switch (action.kind) {
    case "adjustMapSpeed": {
      party.mapSpeed = normalizeNonNeg(party.mapSpeed + action.delta);
      const sign = action.delta >= 0 ? "+" : "";
      return `Map Speed ${sign}${action.delta} (now ${party.mapSpeed})`;
    }
    case "adjustFuel": {
      party.fuel = Math.floor(normalizeNonNeg(party.fuel + action.delta));
      const sign = action.delta >= 0 ? "+" : "";
      return `Fuel ${sign}${action.delta} (now ${party.fuel})`;
    }
    case "adjustRevelations": {
      party.revelations = Math.floor(normalizeNonNeg(party.revelations + action.delta));
      const sign = action.delta >= 0 ? "+" : "";
      return `Revelations ${sign}${action.delta} (now ${party.revelations})`;
    }
    case "travel": {
      party.fuel -= getOverworldTravelFuelCost();
      party.qx = action.qx;
      party.qy = action.qy;
      return `Traveled to (${action.qx}, ${action.qy}) (−${getOverworldTravelFuelCost()} Fuel)`;
    }
    case "returnToDis": {
      party.atDis = true;
      party.fuel = 0;
      party.revelations = 0;
      return "Returned to DIS (Fuel and Revelations cleared)";
    }
    case "deployToHell": {
      party.atDis = false;
      party.qx = action.qx;
      party.qy = action.qy;
      return `Deployed to Hell at (${action.qx}, ${action.qy})`;
    }
  }
}
