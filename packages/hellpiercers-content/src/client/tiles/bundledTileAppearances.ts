import { getTileSetLabel } from "@gaem/client/content-pack";

export type BundledTileAppearance = {
  name: string;
  key: string;
  url: string;
  setId: string;
  /** Subfolder under the set, if this JPG is a randomized group member. */
  groupId?: string;
};

export type BundledTileSet = {
  id: string;
  label: string;
  appearances: BundledTileAppearance[];
};

/** Gallery row: a single JPG, or a folder of variants painted at random. */
export type TileAppearanceGalleryEntry = {
  kind: "single" | "group";
  name: string;
  /** Brush key — concrete JPG key, or `tiles/{setId}/{groupId}` for groups. */
  key: string;
  url: string;
  setId: string;
  members?: BundledTileAppearance[];
};

const appearanceModules = import.meta.glob(
  "../../../assets/tiles/{basic,black-tile,generic-stone,paracletus,paracletus-e-fields,paracletus-stain-springs,paracletus-stygian-reef,paracletus-teethlands,paracletus-v-nimbus,rose-quartz,salt-flats}/**/*.jpg",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

function fileBaseName(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.jpe?g$/i, "");
}

function setLabel(id: string): string {
  return getTileSetLabel("appearances", id);
}

/** Parse `.../assets/tiles/{setId}/{file}.jpg` or `.../tiles/{setId}/{groupId}/{file}.jpg`. */
function appearanceFromModulePath(path: string): BundledTileAppearance | null {
  const marker = "/assets/tiles/";
  const idx = path.replace(/\\/g, "/").lastIndexOf(marker);
  if (idx < 0) return null;
  const rel = path.slice(idx + marker.length);
  const parts = rel.split("/");
  if (parts.length === 2 && parts[1]?.toLowerCase().endsWith(".jpg")) {
    const setId = parts[0]!;
    const name = fileBaseName(parts[1]!);
    return {
      name,
      setId,
      key: `tiles/${setId}/${name}.jpg`,
      url: `/tiles/${setId}/${name}.jpg`,
    };
  }
  if (parts.length === 3 && parts[2]?.toLowerCase().endsWith(".jpg")) {
    const setId = parts[0]!;
    const groupId = parts[1]!;
    const name = fileBaseName(parts[2]!);
    return {
      name,
      setId,
      groupId,
      key: `tiles/${setId}/${groupId}/${name}.jpg`,
      url: `/tiles/${setId}/${groupId}/${name}.jpg`,
    };
  }
  return null;
}

export const BUNDLED_TILE_APPEARANCES: BundledTileAppearance[] = Object.keys(appearanceModules)
  .map(appearanceFromModulePath)
  .filter((a): a is BundledTileAppearance => a !== null)
  .sort((a, b) => a.key.localeCompare(b.key));

export const BUNDLED_TILE_SETS: BundledTileSet[] = (() => {
  const bySet = new Map<string, BundledTileAppearance[]>();
  for (const appearance of BUNDLED_TILE_APPEARANCES) {
    const list = bySet.get(appearance.setId) ?? [];
    list.push(appearance);
    bySet.set(appearance.setId, list);
  }
  return [...bySet.entries()]
    .map(([id, appearances]) => ({
      id,
      get label() {
        return setLabel(id);
      },
      appearances,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
})();

const appearanceByKey = new Map(BUNDLED_TILE_APPEARANCES.map((a) => [a.key, a]));

const groupsByKey = new Map<string, BundledTileAppearance[]>();
for (const appearance of BUNDLED_TILE_APPEARANCES) {
  if (!appearance.groupId) continue;
  const groupKey = `tiles/${appearance.setId}/${appearance.groupId}`;
  const list = groupsByKey.get(groupKey) ?? [];
  list.push(appearance);
  groupsByKey.set(groupKey, list);
}
for (const list of groupsByKey.values()) {
  list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** Maps may still store legacy `.png` appearance keys; prefer the `.jpg` twin when present. */
function canonicalAppearanceKey(key: string): string {
  if (/\.png$/i.test(key) && !key.includes("/features/") && !key.includes("/overlays/")) {
    const jpgKey = key.replace(/\.png$/i, ".jpg");
    if (appearanceByKey.has(jpgKey)) return jpgKey;
  }
  return key;
}

export function galleryEntriesForSet(setId: string): TileAppearanceGalleryEntry[] {
  const appearances =
    BUNDLED_TILE_SETS.find((set) => set.id === setId)?.appearances ?? [];
  const entries: TileAppearanceGalleryEntry[] = [];
  const seenGroups = new Set<string>();

  for (const appearance of appearances) {
    if (appearance.groupId) {
      const groupKey = `tiles/${appearance.setId}/${appearance.groupId}`;
      if (seenGroups.has(groupKey)) continue;
      seenGroups.add(groupKey);
      const members = groupsByKey.get(groupKey) ?? [appearance];
      const preview = members[0]!;
      entries.push({
        kind: "group",
        name: appearance.groupId,
        key: groupKey,
        url: preview.url,
        setId: appearance.setId,
        members,
      });
      continue;
    }
    entries.push({
      kind: "single",
      name: appearance.name,
      key: appearance.key,
      url: appearance.url,
      setId: appearance.setId,
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

const LEGACY_APPEARANCE_PREFIX = "tiles/appearance/";

export function isAppearanceGroupKey(key: string): boolean {
  return groupsByKey.has(key);
}

export function appearanceGroupMembers(key: string): BundledTileAppearance[] {
  return groupsByKey.get(key) ?? [];
}

export function pickRandomAppearanceFromGroup(groupKey: string): string | null {
  const members = groupsByKey.get(groupKey);
  if (!members?.length) return null;
  const pick = members[Math.floor(Math.random() * members.length)]!;
  return pick.key;
}

/** Resolve brush key to a concrete JPG key for paint (groups → random member). */
export function resolveAppearanceKeyForPaint(key: string | null): string | null {
  if (!key) return null;
  if (isAppearanceGroupKey(key)) return pickRandomAppearanceFromGroup(key);
  return canonicalAppearanceKey(key);
}

export function isBundledTileAppearanceKey(key: string): boolean {
  if (key.startsWith(LEGACY_APPEARANCE_PREFIX)) return true;
  const canonical = canonicalAppearanceKey(key);
  if (appearanceByKey.has(canonical) || groupsByKey.has(canonical)) return true;
  return BUNDLED_TILE_SETS.some((set) => key.startsWith(`tiles/${set.id}/`));
}

export function setIdFromAppearanceKey(key: string): string | null {
  if (key.startsWith(LEGACY_APPEARANCE_PREFIX)) return "basic";
  const match = /^tiles\/([^/]+)\//.exec(key);
  if (!match) return null;
  const setId = match[1]!;
  return BUNDLED_TILE_SETS.some((set) => set.id === setId) ? setId : null;
}

export function bundledTileAppearanceUrl(key: string): string {
  if (key.startsWith(LEGACY_APPEARANCE_PREFIX)) {
    const name = key.slice(LEGACY_APPEARANCE_PREFIX.length);
    return `/tiles/basic/${name}`;
  }
  const canonical = canonicalAppearanceKey(key);
  if (isAppearanceGroupKey(canonical)) {
    const preview = groupsByKey.get(canonical)?.[0];
    if (preview) return preview.url;
  }
  const bundled = appearanceByKey.get(canonical);
  if (bundled) return bundled.url;
  return `/${canonical}`;
}
