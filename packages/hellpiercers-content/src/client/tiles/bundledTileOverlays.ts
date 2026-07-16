import { getTileSetLabel } from "@gaem/client/content-pack";

export type BundledTileOverlay = {
  name: string;
  key: string;
  url: string;
  setId: string;
  /** Subfolder under the set, if this PNG is a randomized group member. */
  groupId?: string;
};

export type BundledTileOverlaySet = {
  id: string;
  label: string;
  overlays: BundledTileOverlay[];
};

/** Gallery row: a single PNG, or a folder of variants painted at random. */
export type TileOverlayGalleryEntry = {
  kind: "single" | "group";
  name: string;
  /** Brush key — concrete PNG key, or `tiles/overlays/{setId}/{groupId}` for groups. */
  key: string;
  url: string;
  setId: string;
  members?: BundledTileOverlay[];
};

const OVERLAYS_PREFIX = "tiles/overlays/";
const LEGACY_STAIN_FEATURES_PREFIX = "tiles/features/stain/";

const overlayModules = import.meta.glob(
  "../../../assets/tiles/overlays/stain/**/*.png",
  { eager: true, query: "?url", import: "default" },
) as Record<string, string>;

function fileBaseName(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.png$/i, "");
}

function setLabel(id: string): string {
  return getTileSetLabel("overlays", id);
}

function resolveLegacyOverlayKey(key: string): string {
  if (key.startsWith(LEGACY_STAIN_FEATURES_PREFIX)) {
    return `${OVERLAYS_PREFIX}stain/${key.slice(LEGACY_STAIN_FEATURES_PREFIX.length)}`;
  }
  return key;
}

/** Parse `.../overlays/{setId}/{file}.png` or `.../overlays/{setId}/{groupId}/{file}.png`. */
function overlayFromModulePath(path: string): BundledTileOverlay | null {
  const marker = "/assets/tiles/overlays/";
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
      key: `${OVERLAYS_PREFIX}${setId}/${name}.png`,
      url: `/tiles/overlays/${setId}/${name}.png`,
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
      key: `${OVERLAYS_PREFIX}${setId}/${groupId}/${name}.png`,
      url: `/tiles/overlays/${setId}/${groupId}/${name}.png`,
    };
  }
  return null;
}

export const BUNDLED_TILE_OVERLAYS: BundledTileOverlay[] = Object.keys(overlayModules)
  .map(overlayFromModulePath)
  .filter((o): o is BundledTileOverlay => o !== null)
  .sort((a, b) => a.key.localeCompare(b.key));

export const BUNDLED_TILE_OVERLAY_SETS: BundledTileOverlaySet[] = (() => {
  const bySet = new Map<string, BundledTileOverlay[]>();
  for (const overlay of BUNDLED_TILE_OVERLAYS) {
    const list = bySet.get(overlay.setId) ?? [];
    list.push(overlay);
    bySet.set(overlay.setId, list);
  }
  return [...bySet.entries()]
    .map(([id, overlays]) => ({
      id,
      get label() {
        return setLabel(id);
      },
      overlays,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
})();

const overlayByKey = new Map(BUNDLED_TILE_OVERLAYS.map((o) => [o.key, o]));

const groupsByKey = new Map<string, BundledTileOverlay[]>();
for (const overlay of BUNDLED_TILE_OVERLAYS) {
  if (!overlay.groupId) continue;
  const groupKey = `${OVERLAYS_PREFIX}${overlay.setId}/${overlay.groupId}`;
  const list = groupsByKey.get(groupKey) ?? [];
  list.push(overlay);
  groupsByKey.set(groupKey, list);
}
for (const list of groupsByKey.values()) {
  list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export function galleryEntriesForOverlaySet(setId: string): TileOverlayGalleryEntry[] {
  const overlays =
    BUNDLED_TILE_OVERLAY_SETS.find((set) => set.id === setId)?.overlays ?? [];
  const entries: TileOverlayGalleryEntry[] = [];
  const seenGroups = new Set<string>();

  for (const overlay of overlays) {
    if (overlay.groupId) {
      const groupKey = `${OVERLAYS_PREFIX}${overlay.setId}/${overlay.groupId}`;
      if (seenGroups.has(groupKey)) continue;
      seenGroups.add(groupKey);
      const members = groupsByKey.get(groupKey) ?? [overlay];
      const preview = members[0]!;
      entries.push({
        kind: "group",
        name: overlay.groupId,
        key: groupKey,
        url: preview.url,
        setId: overlay.setId,
        members,
      });
      continue;
    }
    entries.push({
      kind: "single",
      name: overlay.name,
      key: overlay.key,
      url: overlay.url,
      setId: overlay.setId,
    });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

export function isOverlayGroupKey(key: string): boolean {
  return groupsByKey.has(resolveLegacyOverlayKey(key));
}

export function pickRandomOverlayFromGroup(groupKey: string): string | null {
  const members = groupsByKey.get(resolveLegacyOverlayKey(groupKey));
  if (!members?.length) return null;
  const pick = members[Math.floor(Math.random() * members.length)]!;
  return pick.key;
}

/** Resolve brush key to a concrete PNG key for paint (groups → random member). */
export function resolveOverlayKeyForPaint(key: string | null): string | null {
  if (!key) return null;
  const resolved = resolveLegacyOverlayKey(key);
  if (isOverlayGroupKey(resolved)) return pickRandomOverlayFromGroup(resolved);
  return resolved;
}

export function isBundledTileOverlayKey(key: string): boolean {
  const resolved = resolveLegacyOverlayKey(key);
  if (overlayByKey.has(resolved) || groupsByKey.has(resolved)) return true;
  return resolved.startsWith(OVERLAYS_PREFIX);
}

export function setIdFromOverlayKey(key: string): string | null {
  const resolved = resolveLegacyOverlayKey(key);
  const match = /^tiles\/overlays\/([^/]+)\//.exec(resolved);
  if (!match) return null;
  const setId = match[1]!;
  return BUNDLED_TILE_OVERLAY_SETS.some((set) => set.id === setId) ? setId : null;
}

export function bundledTileOverlayUrl(key: string): string {
  const resolved = resolveLegacyOverlayKey(key);
  if (isOverlayGroupKey(resolved)) {
    const preview = groupsByKey.get(resolved)?.[0];
    if (preview) return preview.url;
  }
  return `/${resolved}`;
}
