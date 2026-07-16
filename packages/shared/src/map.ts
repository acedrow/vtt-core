import type { EffectStacks, Enemy, GameMap, GameMapSummary, GameState, MapTile, TerrainType } from "./types.js";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./constants.js";
import { DEFAULT_OBSTACLE_HP, TERRAIN_TYPES } from "./types.js";
import { getEnemyMaxHpByName, getEnemyScale, getEnemyScaleByName, enemyFootprintTiles, refreshEnemyMovement } from "./enemy-data.js";
import { isKnownEffectId } from "./effects-data.js";
import {
  defaultOverworldParty,
  defaultOverworldRegions,
  defaultPartyResources,
} from "./campaign-hooks.js";
import {
  isValidTileBaseColor,
  isValidTileImageRotation,
  migrateLegacyStainFeatureKey,
  normalizeTileName,
  parseTileColorTint,
  parseTilePresets,
  TILE_NAME_MAX_LENGTH,
} from "./tile-cosmetics.js";

const BLOCKING_TERRAIN = new Set<TerrainType>(["impassable", "obstacle", "void"]);
const TERRAIN_SET = new Set<string>(TERRAIN_TYPES);

export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function boardCellKey(x: number, y: number): string {
  return `${x}-${y}`;
}

export function isInBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function isFootprintInBounds(
  x: number,
  y: number,
  scale: number,
  width: number,
  height: number,
): boolean {
  return x >= 0 && y >= 0 && x + scale <= width && y + scale <= height;
}

export function buildTileIndex(tiles: MapTile[]): Map<string, MapTile> {
  const index = new Map<string, MapTile>();
  for (const tile of tiles) {
    index.set(coordKey(tile.x, tile.y), tile);
  }
  return index;
}

let cachedTiles: MapTile[] | null = null;
let cachedIndex: Map<string, MapTile> | null = null;

function getTileIndex(tiles: MapTile[]): Map<string, MapTile> {
  if (cachedTiles === tiles && cachedIndex) return cachedIndex;
  cachedIndex = buildTileIndex(tiles);
  cachedTiles = tiles;
  return cachedIndex;
}

export function tileAt(
  tiles: MapTile[] | Map<string, MapTile>,
  x: number,
  y: number,
): MapTile | undefined {
  if (tiles instanceof Map) return tiles.get(coordKey(x, y));
  return getTileIndex(tiles).get(coordKey(x, y));
}

export function computeWalkable(tile: MapTile): boolean {
  return !tile.terrain.some((t) => BLOCKING_TERRAIN.has(t));
}

export function isTerrainType(value: string): value is TerrainType {
  return TERRAIN_SET.has(value);
}

export function setTileTerrain(tile: MapTile, terrain: TerrainType): void {
  tile.terrain = [terrain];
  delete tile.walkable;
  if (terrain === "obstacle") {
    if (tile.obstacleHp == null) tile.obstacleHp = DEFAULT_OBSTACLE_HP;
  } else {
    delete tile.obstacleHp;
  }
}

export function isWalkable(tile: MapTile | undefined): boolean {
  if (!tile) return false;
  if (tile.walkable !== undefined) return tile.walkable;
  return computeWalkable(tile);
}

export function isImpassableOrObstacleTile(tile: MapTile | undefined): boolean {
  if (!tile) return false;
  return tile.terrain.includes("impassable") || tile.terrain.includes("obstacle");
}

export function isObstacleTile(tile: MapTile | undefined): boolean {
  return !!tile?.terrain.includes("obstacle");
}

export function getObstacleHp(tile: MapTile): number {
  if (!isObstacleTile(tile)) return 0;
  return tile.obstacleHp ?? DEFAULT_OBSTACLE_HP;
}

export function ensureObstacleHp(tile: MapTile): number {
  if (!isObstacleTile(tile)) return 0;
  if (tile.obstacleHp == null || !Number.isInteger(tile.obstacleHp) || tile.obstacleHp < 1) {
    tile.obstacleHp = DEFAULT_OBSTACLE_HP;
  }
  return tile.obstacleHp;
}

export function parseGameMap(raw: unknown): GameMap {
  if (!raw || typeof raw !== "object") {
    throw new Error("Map must be an object");
  }
  const obj = raw as Record<string, unknown>;

  const id = obj.id;
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("Map id must be a non-empty string");
  }

  const width = obj.width;
  const height = obj.height;
  if (!Number.isInteger(width) || (width as number) <= 0) {
    throw new Error("Map width must be a positive integer");
  }
  if (!Number.isInteger(height) || (height as number) <= 0) {
    throw new Error("Map height must be a positive integer");
  }

  if (!Array.isArray(obj.tiles)) {
    throw new Error("Map tiles must be an array");
  }

  const w = width as number;
  const h = height as number;
  const expected = w * h;
  if (obj.tiles.length !== expected) {
    throw new Error(`Map must have ${expected} tiles, got ${obj.tiles.length}`);
  }

  const seen = new Set<string>();
  const tiles: MapTile[] = [];

  for (const entry of obj.tiles) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Each tile must be an object");
    }
    const t = entry as Record<string, unknown>;

    const x = t.x;
    const y = t.y;
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error("Tile x and y must be integers");
    }
    if (!isInBounds(x as number, y as number, w, h)) {
      throw new Error(`Tile (${x}, ${y}) is out of bounds`);
    }

    const key = coordKey(x as number, y as number);
    if (seen.has(key)) {
      throw new Error(`Duplicate tile at (${x}, ${y})`);
    }
    seen.add(key);

    if (!Array.isArray(t.terrain) || t.terrain.length === 0) {
      throw new Error(`Tile (${x}, ${y}) must have at least one terrain type`);
    }

    const terrain: TerrainType[] = [];
    const terrainSeen = new Set<string>();
    for (const value of t.terrain) {
      if (typeof value !== "string" || !TERRAIN_SET.has(value)) {
        throw new Error(`Tile (${x}, ${y}) has invalid terrain type: ${value}`);
      }
      if (terrainSeen.has(value)) {
        throw new Error(`Tile (${x}, ${y}) has duplicate terrain type: ${value}`);
      }
      terrainSeen.add(value);
      terrain.push(value as TerrainType);
    }

    const elevation = t.elevation;
    if (!Number.isInteger(elevation) || (elevation as number) < -3 || (elevation as number) > 3) {
      throw new Error(`Tile (${x}, ${y}) elevation must be an integer from -3 to 3`);
    }

    const tile: MapTile = {
      x: x as number,
      y: y as number,
      terrain,
      elevation: elevation as number,
    };

    const tileName = t.name;
    if (tileName !== undefined) {
      if (typeof tileName !== "string") {
        throw new Error(`Tile (${x}, ${y}) name must be a string`);
      }
      const normalized = normalizeTileName(tileName);
      if (normalized.length > TILE_NAME_MAX_LENGTH) {
        throw new Error(`Tile (${x}, ${y}) name must be at most ${TILE_NAME_MAX_LENGTH} characters`);
      }
      if (normalized) tile.name = normalized;
    }

    const baseColor = t.baseColor;
    if (baseColor !== undefined) {
      if (typeof baseColor !== "string" || !isValidTileBaseColor(baseColor)) {
        throw new Error(`Tile (${x}, ${y}) baseColor must be a #RGB or #RRGGBB hex color`);
      }
      tile.baseColor = baseColor;
    }

    const appearanceKey = t.appearanceKey;
    if (appearanceKey !== undefined) {
      if (typeof appearanceKey !== "string" || !appearanceKey.trim()) {
        throw new Error(`Tile (${x}, ${y}) appearanceKey must be a non-empty string`);
      }
      tile.appearanceKey = appearanceKey.trim();
    }

    const overlayKey = t.overlayKey;
    if (overlayKey !== undefined) {
      if (typeof overlayKey !== "string" || !overlayKey.trim()) {
        throw new Error(`Tile (${x}, ${y}) overlayKey must be a non-empty string`);
      }
      tile.overlayKey = overlayKey.trim();
    }

    const featureKey = t.featureKey;
    if (featureKey !== undefined) {
      if (typeof featureKey !== "string" || !featureKey.trim()) {
        throw new Error(`Tile (${x}, ${y}) featureKey must be a non-empty string`);
      }
      const trimmedFeature = featureKey.trim();
      const migratedOverlay = migrateLegacyStainFeatureKey(trimmedFeature);
      if (migratedOverlay) {
        if (!tile.overlayKey) tile.overlayKey = migratedOverlay;
      } else {
        tile.featureKey = trimmedFeature;
      }
    }

    const appearanceTint = t.appearanceTint;
    if (appearanceTint !== undefined) {
      const parsed = parseTileColorTint(appearanceTint);
      if (!parsed) {
        throw new Error(
          `Tile (${x}, ${y}) appearanceTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }`,
        );
      }
      tile.appearanceTint = parsed;
    }

    const overlayTint = t.overlayTint;
    if (overlayTint !== undefined) {
      const parsed = parseTileColorTint(overlayTint);
      if (!parsed) {
        throw new Error(
          `Tile (${x}, ${y}) overlayTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }`,
        );
      }
      tile.overlayTint = parsed;
    }

    const featureTint = t.featureTint;
    if (featureTint !== undefined) {
      const parsed = parseTileColorTint(featureTint);
      if (!parsed) {
        throw new Error(
          `Tile (${x}, ${y}) featureTint must be { color: #RGB|#RRGGBB, opacity: 0–1 }`,
        );
      }
      tile.featureTint = parsed;
    }

    const legacyRotation = t.imageRotation;
    const legacyFlip = t.imageFlip;
    if (legacyRotation !== undefined && !isValidTileImageRotation(legacyRotation)) {
      throw new Error(`Tile (${x}, ${y}) imageRotation must be 0, 90, 180, or 270`);
    }
    if (legacyFlip !== undefined && typeof legacyFlip !== "boolean") {
      throw new Error(`Tile (${x}, ${y}) imageFlip must be a boolean`);
    }

    function readTileRotation(
      key: "appearanceRotation" | "overlayRotation" | "featureRotation",
      useLegacy: boolean,
    ): void {
      const raw = t[key] !== undefined ? t[key] : useLegacy ? legacyRotation : undefined;
      if (raw === undefined) return;
      if (!isValidTileImageRotation(raw)) {
        throw new Error(`Tile (${x}, ${y}) ${key} must be 0, 90, 180, or 270`);
      }
      if (raw !== 0) tile[key] = raw;
    }

    function readTileFlip(
      key: "appearanceFlip" | "overlayFlip" | "featureFlip",
      useLegacy: boolean,
    ): void {
      const raw = t[key] !== undefined ? t[key] : useLegacy ? legacyFlip : undefined;
      if (raw === undefined) return;
      if (typeof raw !== "boolean") {
        throw new Error(`Tile (${x}, ${y}) ${key} must be a boolean`);
      }
      if (raw) tile[key] = true;
    }

    readTileRotation("appearanceRotation", true);
    readTileRotation("overlayRotation", false);
    readTileRotation("featureRotation", true);
    readTileFlip("appearanceFlip", true);
    readTileFlip("overlayFlip", false);
    readTileFlip("featureFlip", true);

    const obstacleHp = t.obstacleHp;
    if (obstacleHp !== undefined) {
      if (!Number.isInteger(obstacleHp) || (obstacleHp as number) < 1) {
        throw new Error(`Tile (${x}, ${y}) obstacleHp must be a positive integer`);
      }
      if (!terrain.includes("obstacle")) {
        throw new Error(`Tile (${x}, ${y}) obstacleHp is only valid on obstacle terrain`);
      }
      tile.obstacleHp = obstacleHp as number;
    } else if (terrain.includes("obstacle")) {
      tile.obstacleHp = DEFAULT_OBSTACLE_HP;
    }

    const tileEffects = t.tileEffects;
    if (tileEffects !== undefined) {
      if (!tileEffects || typeof tileEffects !== "object" || Array.isArray(tileEffects)) {
        throw new Error(`Tile (${x}, ${y}) tileEffects must be an object`);
      }
      const stacks: EffectStacks = {};
      for (const [id, value] of Object.entries(tileEffects as Record<string, unknown>)) {
        if (!id.trim() || !isKnownEffectId(id)) {
          throw new Error(`Tile (${x}, ${y}) has unknown tile effect: ${id}`);
        }
        if (!Number.isInteger(value) || (value as number) < 1) {
          throw new Error(`Tile (${x}, ${y}) tile effect ${id} stacks must be a positive integer`);
        }
        stacks[id] = value as number;
      }
      if (Object.keys(stacks).length > 0) tile.tileEffects = stacks;
    }

    tile.walkable = computeWalkable(tile);
    tiles.push(tile);
  }

  const enemies = parseMapEnemies(obj.enemies, w, h);

  const name = obj.name;
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    throw new Error("Map name must be a non-empty string");
  }

  const tilePresets = parseTilePresets(obj.tilePresets);
  const startingState = parseStartingState(obj.startingState, w, h);

  return {
    id: id.trim(),
    name: typeof name === "string" ? name.trim() : undefined,
    width: w,
    height: h,
    tiles,
    enemies,
    tilePresets,
    ...(startingState ? { startingState } : {}),
  };
}

function parseMapEnemies(raw: unknown, width: number, height: number): Enemy[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error("Map enemies must be an array");
  }

  const seenIds = new Set<string>();
  const seenPositions = new Set<string>();
  const enemies: Enemy[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Each enemy must be an object");
    }
    const e = entry as Record<string, unknown>;

    const id = e.id;
    if (typeof id !== "string" || !id.trim()) {
      throw new Error("Enemy id must be a non-empty string");
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate enemy id: ${id}`);
    }
    seenIds.add(id);

    const x = e.x;
    const y = e.y;
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error(`Enemy ${id} x and y must be integers`);
    }

    const name = e.name;
    if (name !== undefined && typeof name !== "string") {
      throw new Error(`Enemy ${id} name must be a string`);
    }

    const rawScale = e.scale;
    if (rawScale !== undefined && (!Number.isInteger(rawScale) || (rawScale as number) < 1)) {
      throw new Error(`Enemy ${id} scale must be a positive integer`);
    }
    const scale =
      rawScale !== undefined
        ? (rawScale as number)
        : getEnemyScaleByName(name as string | undefined);

    for (const tile of enemyFootprintTiles(x as number, y as number, scale)) {
      if (!isInBounds(tile.x, tile.y, width, height)) {
        throw new Error(`Enemy ${id} footprint at (${x}, ${y}) is out of bounds`);
      }
      const posKey = coordKey(tile.x, tile.y);
      if (seenPositions.has(posKey)) {
        throw new Error(`Enemy footprints overlap at (${tile.x}, ${tile.y})`);
      }
      seenPositions.add(posKey);
    }

    enemies.push({
      id: id.trim(),
      x: x as number,
      y: y as number,
      scale,
      ...(name !== undefined ? { name: name as string } : {}),
    });
  }

  return enemies;
}

function parseStartingState(
  raw: unknown,
  width: number,
  height: number,
): { tiles: MapTile[]; enemies: Enemy[] } | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object") {
    throw new Error("Map startingState must be an object");
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.tiles)) {
    throw new Error("Map startingState.tiles must be an array");
  }
  if (!Array.isArray(obj.enemies)) {
    throw new Error("Map startingState.enemies must be an array");
  }
  const expected = width * height;
  if (obj.tiles.length !== expected) {
    throw new Error(`Map startingState must have ${expected} tiles, got ${obj.tiles.length}`);
  }

  // Starting-state tiles/enemies are written by applySaveStartingState; re-parse via
  // the normal map path for tiles, and accept full runtime enemy fields for enemies.
  const tiles = parseGameMap({
    id: "starting-state",
    width,
    height,
    tiles: obj.tiles,
  }).tiles;

  const enemies: Enemy[] = [];
  const seenIds = new Set<string>();
  for (const entry of obj.enemies) {
    if (!entry || typeof entry !== "object") {
      throw new Error("Each startingState enemy must be an object");
    }
    const e = entry as Record<string, unknown>;
    const id = e.id;
    if (typeof id !== "string" || !id.trim()) {
      throw new Error("StartingState enemy id must be a non-empty string");
    }
    if (seenIds.has(id)) {
      throw new Error(`Duplicate startingState enemy id: ${id}`);
    }
    seenIds.add(id);
    const x = e.x;
    const y = e.y;
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error(`StartingState enemy ${id} x and y must be integers`);
    }
    if (!isInBounds(x as number, y as number, width, height)) {
      throw new Error(`StartingState enemy ${id} is out of bounds`);
    }
    enemies.push(cloneEnemy(e as unknown as Enemy));
  }

  return { tiles, enemies };
}

export function toMapSummary(map: GameMap): GameMapSummary {
  return {
    id: map.id,
    name: map.name ?? map.id,
    width: map.width,
    height: map.height,
  };
}

export function createBlankGameMap(
  id: string,
  name: string,
  width = BOARD_WIDTH,
  height = BOARD_HEIGHT,
): GameMap {
  const tiles: MapTile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, terrain: ["standard"], elevation: 0 });
    }
  }
  return { id, name, width, height, tiles };
}

export function cloneMapTile(tile: MapTile): MapTile {
  return {
    x: tile.x,
    y: tile.y,
    elevation: tile.elevation,
    terrain: [...tile.terrain],
    ...(tile.walkable !== undefined ? { walkable: tile.walkable } : {}),
    ...(tile.obstacleHp !== undefined ? { obstacleHp: tile.obstacleHp } : {}),
    ...(tile.tileEffects ? { tileEffects: { ...tile.tileEffects } } : {}),
    ...(tile.name ? { name: tile.name } : {}),
    ...(tile.baseColor ? { baseColor: tile.baseColor } : {}),
    ...(tile.appearanceKey ? { appearanceKey: tile.appearanceKey } : {}),
    ...(tile.overlayKey ? { overlayKey: tile.overlayKey } : {}),
    ...(tile.featureKey ? { featureKey: tile.featureKey } : {}),
    ...(tile.appearanceTint ? { appearanceTint: { ...tile.appearanceTint } } : {}),
    ...(tile.overlayTint ? { overlayTint: { ...tile.overlayTint } } : {}),
    ...(tile.featureTint ? { featureTint: { ...tile.featureTint } } : {}),
    ...(tile.appearanceRotation ? { appearanceRotation: tile.appearanceRotation } : {}),
    ...(tile.appearanceFlip ? { appearanceFlip: true } : {}),
    ...(tile.overlayRotation ? { overlayRotation: tile.overlayRotation } : {}),
    ...(tile.overlayFlip ? { overlayFlip: true } : {}),
    ...(tile.featureRotation ? { featureRotation: tile.featureRotation } : {}),
    ...(tile.featureFlip ? { featureFlip: true } : {}),
  };
}

export function cloneEnemy(enemy: Enemy): Enemy {
  return {
    ...enemy,
    ...(enemy.effects ? { effects: { ...enemy.effects } } : {}),
    ...(enemy.falling ? { falling: { ...enemy.falling } } : {}),
  };
}

export function applySaveStartingState(state: GameState, map: GameMap): string {
  map.startingState = {
    tiles: state.tiles.map(cloneMapTile),
    enemies: state.enemies.map(cloneEnemy),
  };
  return "Starting state saved";
}

export function validateResetToStartingState(map: GameMap | undefined): string | null {
  if (!map) return "Map not found";
  if (!map.startingState) return "No starting state saved for this map";
  return null;
}

export function applyResetToStartingState(state: GameState, map: GameMap): string {
  const snapshot = map.startingState!;
  state.tiles = snapshot.tiles.map(cloneMapTile);
  state.enemies = snapshot.enemies.map(cloneEnemy);
  return "Board reset to starting state";
}

export function createInitialStateFromMap(map: GameMap): GameState {
  const enemies = (map.enemies ?? []).map((e) => {
    const enemy = {
      ...e,
      scale: getEnemyScale(e),
      hp: getEnemyMaxHpByName(e.name),
    };
    refreshEnemyMovement(enemy);
    return enemy;
  });

  return {
    mapId: map.id,
    mapName: map.name ?? map.id,
    width: map.width,
    height: map.height,
    tiles: map.tiles.map(cloneMapTile),
    players: [],
    enemies,
    round: 1,
    roundPhase: "taccomNotStarted",
    turn: { role: "gm" },
    actedPlayerIds: [],
    turnLog: [],
    sandboxMode: false,
    campaign: {
      partyResources: defaultPartyResources(),
      constructedBaseUpgrades: [],
      overworldRegions: defaultOverworldRegions(),
      overworldParty: defaultOverworldParty(),
    },
  };
}

export function validateActivateMap(mapId: string, map: GameMap | undefined): string | null {
  if (!mapId.trim()) return "Map id is required";
  if (!map) return "Map not found";
  if (map.id !== mapId) return "Map not found";
  return null;
}

export function persistMapTileFromState(map: GameMap, source: MapTile): void {
  const mapTile = tileAt(map.tiles, source.x, source.y);
  if (!mapTile) return;
  mapTile.elevation = source.elevation;
  mapTile.terrain = [...source.terrain];
  delete mapTile.walkable;
  if (source.obstacleHp !== undefined && source.terrain.includes("obstacle")) {
    mapTile.obstacleHp = source.obstacleHp;
  } else {
    delete mapTile.obstacleHp;
  }
  if (source.name) mapTile.name = source.name;
  else delete mapTile.name;
  if (source.baseColor) mapTile.baseColor = source.baseColor;
  else delete mapTile.baseColor;
  if (source.appearanceKey) mapTile.appearanceKey = source.appearanceKey;
  else delete mapTile.appearanceKey;
  if (source.overlayKey) mapTile.overlayKey = source.overlayKey;
  else delete mapTile.overlayKey;
  if (source.featureKey) mapTile.featureKey = source.featureKey;
  else delete mapTile.featureKey;
  if (source.appearanceTint) mapTile.appearanceTint = { ...source.appearanceTint };
  else delete mapTile.appearanceTint;
  if (source.overlayTint) mapTile.overlayTint = { ...source.overlayTint };
  else delete mapTile.overlayTint;
  if (source.featureTint) mapTile.featureTint = { ...source.featureTint };
  else delete mapTile.featureTint;
  if (source.appearanceRotation) mapTile.appearanceRotation = source.appearanceRotation;
  else delete mapTile.appearanceRotation;
  if (source.appearanceFlip) mapTile.appearanceFlip = true;
  else delete mapTile.appearanceFlip;
  if (source.overlayRotation) mapTile.overlayRotation = source.overlayRotation;
  else delete mapTile.overlayRotation;
  if (source.overlayFlip) mapTile.overlayFlip = true;
  else delete mapTile.overlayFlip;
  if (source.featureRotation) mapTile.featureRotation = source.featureRotation;
  else delete mapTile.featureRotation;
  if (source.featureFlip) mapTile.featureFlip = true;
  else delete mapTile.featureFlip;
  delete mapTile.tileEffects;
}

export function persistMapTileAt(state: GameState, map: GameMap, x: number, y: number): void {
  const stateTile = tileAt(state.tiles, x, y);
  if (!stateTile) return;
  persistMapTileFromState(map, stateTile);
}

export function persistMapTilesAt(
  state: GameState,
  map: GameMap,
  coords: { x: number; y: number }[],
): void {
  for (const { x, y } of coords) persistMapTileAt(state, map, x, y);
}
