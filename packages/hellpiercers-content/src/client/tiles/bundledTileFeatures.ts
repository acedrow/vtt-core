import { getTileSetLabel } from "@gaem/client/content-pack";

export type BundledTileFeature = {
  name: string;
  key: string;
  url: string;
  setId: string;
  /** Subfolder under the set, if this PNG is a randomized group member. */
  groupId?: string;
};

export type BundledTileFeatureSet = {
  id: string;
  label: string;
  features: BundledTileFeature[];
};

/** Gallery row: a single PNG, or a folder of variants painted at random. */
export type TileFeatureGalleryEntry = {
  kind: "single" | "group";
  name: string;
  /** Brush key — concrete PNG key, or `tiles/features/{setId}/{groupId}` for groups. */
  key: string;
  url: string;
  setId: string;
  members?: BundledTileFeature[];
};

const FEATURES_PREFIX = "tiles/features/";

const LEGACY_FEATURE_KEYS: Record<string, string> = {
  "tiles/features/trench.png": "tiles/features/base/trench.png",
  "tiles/features/trench-corner.png": "tiles/features/base/trench-corner.png",
};

const featureModules = import.meta.glob(
  "../../../assets/tiles/features/{base,chaos-explosions,hellpiercers,paracletus-ruins,paracletus-teethlands}/**/*.png",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

function fileBaseName(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.png$/i, "");
}

function setLabel(id: string): string {
  return getTileSetLabel("features", id);
}

function resolveLegacyFeatureKey(key: string): string {
  return LEGACY_FEATURE_KEYS[key] ?? key;
}

/** Parse `.../features/{setId}/{file}.png` or `.../features/{setId}/{groupId}/{file}.png`. */
function featureFromModulePath(path: string): BundledTileFeature | null {
  const marker = "/assets/tiles/features/";
  const idx = path.replace(/\\/g, "/").lastIndexOf(marker);
  if (idx < 0) return null;
  const rel = path.slice(idx + marker.length);
  const parts = rel.split("/");
  if (parts.length === 2 && parts[1]?.toLowerCase().endsWith(".png")) {
    const setId = parts[0]!;
    const name = fileBaseName(parts[1]!);
    return {
      name,
      setId,
      key: `${FEATURES_PREFIX}${setId}/${name}.png`,
      url: `/tiles/features/${setId}/${name}.png`,
    };
  }
  if (parts.length === 3 && parts[2]?.toLowerCase().endsWith(".png")) {
    const setId = parts[0]!;
    const groupId = parts[1]!;
    const name = fileBaseName(parts[2]!);
    return {
      name,
      setId,
      groupId,
      key: `${FEATURES_PREFIX}${setId}/${groupId}/${name}.png`,
      url: `/tiles/features/${setId}/${groupId}/${name}.png`,
    };
  }
  return null;
}

export const BUNDLED_TILE_FEATURES: BundledTileFeature[] = Object.keys(featureModules)
  .map(featureFromModulePath)
  .filter((f): f is BundledTileFeature => f !== null)
  .sort((a, b) => a.key.localeCompare(b.key));

export const BUNDLED_TILE_FEATURE_SETS: BundledTileFeatureSet[] = (() => {
  const bySet = new Map<string, BundledTileFeature[]>();
  for (const feature of BUNDLED_TILE_FEATURES) {
    const list = bySet.get(feature.setId) ?? [];
    list.push(feature);
    bySet.set(feature.setId, list);
  }
  return [...bySet.entries()]
    .map(([id, features]) => ({
      id,
      get label() {
        return setLabel(id);
      },
      features,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
})();

const featureByKey = new Map(BUNDLED_TILE_FEATURES.map((f) => [f.key, f]));

const groupsByKey = new Map<string, BundledTileFeature[]>();
for (const feature of BUNDLED_TILE_FEATURES) {
  if (!feature.groupId) continue;
  const groupKey = `${FEATURES_PREFIX}${feature.setId}/${feature.groupId}`;
  const list = groupsByKey.get(groupKey) ?? [];
  list.push(feature);
  groupsByKey.set(groupKey, list);
}
for (const list of groupsByKey.values()) {
  list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export function galleryEntriesForFeatureSet(setId: string): TileFeatureGalleryEntry[] {
  const features =
    BUNDLED_TILE_FEATURE_SETS.find((set) => set.id === setId)?.features ?? [];
  const entries: TileFeatureGalleryEntry[] = [];
  const seenGroups = new Set<string>();

  for (const feature of features) {
    if (feature.groupId) {
      const groupKey = `${FEATURES_PREFIX}${feature.setId}/${feature.groupId}`;
      if (seenGroups.has(groupKey)) continue;
      seenGroups.add(groupKey);
      const members = groupsByKey.get(groupKey) ?? [feature];
      const preview = members[0]!;
      entries.push({
        kind: "group",
        name: feature.groupId,
        key: groupKey,
        url: preview.url,
        setId: feature.setId,
        members,
      });
      continue;
    }
    entries.push({
      kind: "single",
      name: feature.name,
      key: feature.key,
      url: feature.url,
      setId: feature.setId,
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function isFeatureGroupKey(key: string): boolean {
  return groupsByKey.has(resolveLegacyFeatureKey(key));
}

export function pickRandomFeatureFromGroup(groupKey: string): string | null {
  const members = groupsByKey.get(resolveLegacyFeatureKey(groupKey));
  if (!members?.length) return null;
  const pick = members[Math.floor(Math.random() * members.length)]!;
  return pick.key;
}

/** Resolve brush key to a concrete PNG key for paint (groups → random member). */
export function resolveFeatureKeyForPaint(key: string | null): string | null {
  if (!key) return null;
  const resolved = resolveLegacyFeatureKey(key);
  if (isFeatureGroupKey(resolved)) return pickRandomFeatureFromGroup(resolved);
  return resolved;
}

export function isBundledTileFeatureKey(key: string): boolean {
  const resolved = resolveLegacyFeatureKey(key);
  if (featureByKey.has(resolved) || groupsByKey.has(resolved)) return true;
  return resolved.startsWith(FEATURES_PREFIX);
}

export function setIdFromFeatureKey(key: string): string | null {
  const resolved = resolveLegacyFeatureKey(key);
  const match = /^tiles\/features\/([^/]+)\//.exec(resolved);
  if (!match) return null;
  const setId = match[1]!;
  return BUNDLED_TILE_FEATURE_SETS.some((set) => set.id === setId) ? setId : null;
}

export function bundledTileFeatureUrl(key: string): string {
  const resolved = resolveLegacyFeatureKey(key);
  if (isFeatureGroupKey(resolved)) {
    const preview = groupsByKey.get(resolved)?.[0];
    if (preview) return preview.url;
  }
  return `/${resolved}`;
}
