import type { TerrainType, TileColorTint, TileImageRotation, TilePaintPreset } from "./types.js";
import { DEFAULT_OBSTACLE_HP, TERRAIN_TYPES, TILE_IMAGE_ROTATIONS } from "./types.js";

export const TILE_NAME_MAX_LENGTH = 80;

const BASE_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidTileBaseColor(hex: string): boolean {
  return BASE_COLOR_RE.test(hex);
}

export function isValidTileImageRotation(value: unknown): value is TileImageRotation {
  return typeof value === "number" && (TILE_IMAGE_ROTATIONS as readonly number[]).includes(value);
}

/** Returns a normalized tint, or null if `value` is not a valid TileColorTint. */
export function parseTileColorTint(value: unknown): TileColorTint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const t = value as Record<string, unknown>;
  if (typeof t.color !== "string" || !isValidTileBaseColor(t.color)) return null;
  if (typeof t.opacity !== "number" || !Number.isFinite(t.opacity) || t.opacity < 0 || t.opacity > 1) {
    return null;
  }
  return { color: t.color, opacity: t.opacity };
}

export function isValidTileColorTint(value: unknown): value is TileColorTint {
  return parseTileColorTint(value) != null;
}

export function normalizeTileName(name: string): string {
  return name.trim();
}

/** Old stain PNGs lived under features; rewrite to overlays path. */
export function migrateLegacyStainFeatureKey(key: string): string | null {
  const prefix = "tiles/features/stain/";
  if (!key.startsWith(prefix)) return null;
  return `tiles/overlays/stain/${key.slice(prefix.length)}`;
}

export function parseTilePaintPreset(raw: unknown, label: string): TilePaintPreset {
  if (!raw || typeof raw !== "object") {
    throw new Error(`${label} must be an object`);
  }
  const p = raw as Record<string, unknown>;

  const elevation = p.elevation;
  if (!Number.isInteger(elevation) || (elevation as number) < -3 || (elevation as number) > 3) {
    throw new Error(`${label} elevation must be an integer from -3 to 3`);
  }

  const terrain = p.terrain;
  if (typeof terrain !== "string" || !TERRAIN_TYPES.includes(terrain as TerrainType)) {
    throw new Error(`${label} has invalid terrain type: ${terrain}`);
  }

  const tileEffectId = p.tileEffectId;
  if (typeof tileEffectId !== "string") {
    throw new Error(`${label} tileEffectId must be a string`);
  }

  const tileEffectStacks = p.tileEffectStacks;
  if (!Number.isInteger(tileEffectStacks)) {
    throw new Error(`${label} tileEffectStacks must be an integer`);
  }

  const tileName = p.tileName;
  if (typeof tileName !== "string") {
    throw new Error(`${label} tileName must be a string`);
  }
  const normalizedTileName = normalizeTileName(tileName);
  if (normalizedTileName.length > TILE_NAME_MAX_LENGTH) {
    throw new Error(`${label} tileName must be at most ${TILE_NAME_MAX_LENGTH} characters`);
  }

  const preset: TilePaintPreset = {
    elevation: elevation as number,
    terrain: terrain as TerrainType,
    tileEffectId,
    tileEffectStacks: tileEffectStacks as number,
    tileName: normalizedTileName,
  };

  const obstacleHp = p.obstacleHp;
  if (obstacleHp !== undefined) {
    if (!Number.isInteger(obstacleHp) || (obstacleHp as number) < 1) {
      throw new Error(`${label} obstacleHp must be a positive integer`);
    }
    if (terrain !== "obstacle") {
      throw new Error(`${label} obstacleHp is only valid when terrain is obstacle`);
    }
    preset.obstacleHp = obstacleHp as number;
  } else if (terrain === "obstacle") {
    preset.obstacleHp = DEFAULT_OBSTACLE_HP;
  }

  const baseColor = p.baseColor;
  if (baseColor !== undefined) {
    if (typeof baseColor !== "string" || !isValidTileBaseColor(baseColor)) {
      throw new Error(`${label} baseColor must be a #RGB or #RRGGBB hex color`);
    }
    preset.baseColor = baseColor;
  }

  const appearanceKey = p.appearanceKey;
  if (appearanceKey !== undefined) {
    if (typeof appearanceKey !== "string" || !appearanceKey.trim()) {
      throw new Error(`${label} appearanceKey must be a non-empty string`);
    }
    preset.appearanceKey = appearanceKey.trim();
  }

  const overlayKey = p.overlayKey;
  if (overlayKey !== undefined) {
    if (typeof overlayKey !== "string" || !overlayKey.trim()) {
      throw new Error(`${label} overlayKey must be a non-empty string`);
    }
    preset.overlayKey = overlayKey.trim();
  }

  const featureKey = p.featureKey;
  if (featureKey !== undefined) {
    if (typeof featureKey !== "string" || !featureKey.trim()) {
      throw new Error(`${label} featureKey must be a non-empty string`);
    }
    const trimmedFeature = featureKey.trim();
    const migratedOverlay = migrateLegacyStainFeatureKey(trimmedFeature);
    if (migratedOverlay) {
      if (!preset.overlayKey) preset.overlayKey = migratedOverlay;
    } else {
      preset.featureKey = trimmedFeature;
    }
  }

  const appearanceTint = p.appearanceTint;
  if (appearanceTint !== undefined) {
    const parsed = parseTileColorTint(appearanceTint);
    if (!parsed) {
      throw new Error(
        `${label} appearanceTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }`,
      );
    }
    preset.appearanceTint = parsed;
  }

  const overlayTint = p.overlayTint;
  if (overlayTint !== undefined) {
    const parsed = parseTileColorTint(overlayTint);
    if (!parsed) {
      throw new Error(
        `${label} overlayTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }`,
      );
    }
    preset.overlayTint = parsed;
  }

  const featureTint = p.featureTint;
  if (featureTint !== undefined) {
    const parsed = parseTileColorTint(featureTint);
    if (!parsed) {
      throw new Error(
        `${label} featureTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }`,
      );
    }
    preset.featureTint = parsed;
  }

  function readRotation(key: string, legacyFallback: unknown): TileImageRotation | undefined {
    const value = p[key] !== undefined ? p[key] : legacyFallback;
    if (value === undefined) return undefined;
    if (!isValidTileImageRotation(value)) {
      throw new Error(`${label} ${key} must be 0, 90, 180, or 270`);
    }
    return value !== 0 ? value : undefined;
  }

  function readFlip(key: string, legacyFallback: unknown): true | undefined {
    const value = p[key] !== undefined ? p[key] : legacyFallback;
    if (value === undefined) return undefined;
    if (typeof value !== "boolean") {
      throw new Error(`${label} ${key} must be a boolean`);
    }
    return value ? true : undefined;
  }

  const legacyRotation = p.imageRotation;
  const legacyFlip = p.imageFlip;
  if (legacyRotation !== undefined && !isValidTileImageRotation(legacyRotation)) {
    throw new Error(`${label} imageRotation must be 0, 90, 180, or 270`);
  }
  if (legacyFlip !== undefined && typeof legacyFlip !== "boolean") {
    throw new Error(`${label} imageFlip must be a boolean`);
  }

  const appearanceRotation = readRotation("appearanceRotation", legacyRotation);
  if (appearanceRotation !== undefined) preset.appearanceRotation = appearanceRotation;
  const overlayRotation = readRotation("overlayRotation", undefined);
  if (overlayRotation !== undefined) preset.overlayRotation = overlayRotation;
  const featureRotation = readRotation("featureRotation", legacyRotation);
  if (featureRotation !== undefined) preset.featureRotation = featureRotation;

  if (readFlip("appearanceFlip", legacyFlip)) preset.appearanceFlip = true;
  if (readFlip("overlayFlip", undefined)) preset.overlayFlip = true;
  if (readFlip("featureFlip", legacyFlip)) preset.featureFlip = true;

  return preset;
}

export function parseTilePresets(raw: unknown): Record<string, TilePaintPreset> | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("tilePresets must be an object");
  }
  const obj = raw as Record<string, unknown>;
  const presets: Record<string, TilePaintPreset> = {};
  const seen = new Set<string>();
  for (const [name, value] of Object.entries(obj)) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("tilePresets keys must be non-empty strings");
    if (seen.has(trimmed)) throw new Error(`Duplicate tile preset name: ${trimmed}`);
    seen.add(trimmed);
    presets[trimmed] = parseTilePaintPreset(value, `tilePresets["${trimmed}"]`);
  }
  return presets;
}
