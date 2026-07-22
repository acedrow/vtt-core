import type {
  ActionBudget,
  ActionTier,
  AssistedOutcome,
  AttackPreviewState,
  CombatState,
  EffectStacks,
  GmEnemyAction,
  PlayerAction,
} from "./combat/types.js";

export type { ActionBudget, AssistedOutcome, CombatState, EffectStacks, GmEnemyAction, PlayerAction };
export type {
  AttackPreviewState,
  PendingAction,
  PendingReaction,
  WeaponAttackSpec,
  StructuredArmorAction,
} from "./combat/types.js";

export const TERRAIN_TYPES = [
  "standard",
  "uneasy",
  "impassable",
  "cover",
  "obstacle",
  "advantageous",
  "void",
] as const;

export type TerrainType = (typeof TERRAIN_TYPES)[number];

/** HP used when an obstacle tile has none set (legacy maps / unspecified). */
export const DEFAULT_OBSTACLE_HP = 15;

export const TILE_IMAGE_ROTATIONS = [0, 90, 180, 270] as const;
export type TileImageRotation = (typeof TILE_IMAGE_ROTATIONS)[number];

/** Color tint applied to a tile appearance or feature image. */
export type TileColorTint = {
  color: string;
  opacity: number;
};

export type MapTile = {
  x: number;
  y: number;
  terrain: TerrainType[];
  elevation: number;
  walkable?: boolean;
  tileEffects?: EffectStacks;
  obstacleHp?: number;
  name?: string;
  baseColor?: string;
  appearanceKey?: string;
  overlayKey?: string;
  featureKey?: string;
  appearanceTint?: TileColorTint;
  overlayTint?: TileColorTint;
  featureTint?: TileColorTint;
  appearanceRotation?: TileImageRotation;
  appearanceFlip?: boolean;
  overlayRotation?: TileImageRotation;
  overlayFlip?: boolean;
  featureRotation?: TileImageRotation;
  featureFlip?: boolean;
};

export type TilePaintPreset = {
  elevation: number;
  terrain: TerrainType;
  tileEffectId: string;
  tileEffectStacks: number;
  tileName: string;
  obstacleHp?: number;
  baseColor?: string;
  appearanceKey?: string;
  overlayKey?: string;
  featureKey?: string;
  appearanceTint?: TileColorTint;
  overlayTint?: TileColorTint;
  featureTint?: TileColorTint;
  appearanceRotation?: TileImageRotation;
  appearanceFlip?: boolean;
  overlayRotation?: TileImageRotation;
  overlayFlip?: boolean;
  featureRotation?: TileImageRotation;
  featureFlip?: boolean;
};

export type Enemy = {
  id: string;
  x: number;
  y: number;
  name?: string;
  hp?: number;
  scale?: number;
  speed?: number;
  movementRemaining?: number;
  effects?: EffectStacks;
  exhausted?: boolean;
  agnosiaTriggered?: boolean;
  burrowed?: boolean;
  kind?: "enemy" | "tower";
  ownerPlayerId?: string;
  elevation?: number;
  falling?: { peak: number };
};

export type TerrainObject = {
  id: string;
  x: number;
  y: number;
  name?: string;
  kind?: "seed";
  ownerPlayerId?: string;
};

export type GameMap = {
  id: string;
  name?: string;
  width: number;
  height: number;
  tiles: MapTile[];
  enemies?: Enemy[];
  tilePresets?: Record<string, TilePaintPreset>;
  startingState?: { tiles: MapTile[]; enemies: Enemy[] };
};

export type GameMapSummary = {
  id: string;
  name: string;
  width: number;
  height: number;
};

export type Player = {
  id: string;
  x: number;
  y: number;
  nickname?: string;
  playerKey?: string;
  characterSheetId?: string;
  class?: string;
  armor?: string;
  weapon?: string;
  equipment?: string;
  gear?: string;
  gearArmor?: string;
  weapon2?: string;
  speed?: number;
  hp?: number;
  equipmentUses?: number;
  reversalCharges?: number;
  actionBudget?: ActionBudget;
  hasteActionTier?: ActionTier;
  turnStartX?: number;
  turnStartY?: number;
  effects?: EffectStacks;
  counters?: Record<string, number>;
  elevation?: number;
  falling?: { peak: number };
  /** Pack-owned live loadout extras (e.g. yadathanTower). */
  data?: Record<string, unknown>;
};

export const ROUND_PHASES = [
  "taccomNotStarted",
  "deployment",
  "startRoundEffects",
  "playersChoice",
  "playerTurn",
  "gmTurn",
  "countdownTags",
] as const;

export type RoundPhase = (typeof ROUND_PHASES)[number];

export type TurnHolder =
  | { role: "gm"; gmPhase?: "startRoundEffects" | "countdownTags" }
  | { role: "player"; playerId: string };

export type PhaseAction =
  | "doEffects"
  | "takeTurn"
  | "endPlayerTurn"
  | "endGmTurn"
  | "countdownTags"
  | "endRound"
  | "resetRound"
  | "gmEndRound"
  | "gmEndTurn"
  | "startTaccom"
  | "endDeployment"
  | "resetCombat"
  | "endCombat"
  | "removeAllEnemies"
  | "rewindPhase"
  | "resetPhase";

export type RoundTurnLog = {
  round: number;
  turns: TurnHolder[];
};

export type DamageEvent = {
  x: number;
  y: number;
  amount: number;
};

export type PartyResourceKey = string;

export type PartyResources = Record<string, number>;

export type BaseCampaignAction =
  | { kind: "construct"; upgradeId: string }
  | { kind: "demolish"; upgradeId: string }
  | { kind: "adjustResource"; resource: PartyResourceKey; delta: number };

export const MAP_SPEED_INCHES = 2.5;
export const MAJOR_CELL_INCHES = 1;
export const QUARTER_CELL_INCHES = MAJOR_CELL_INCHES / 2;

export type OverworldRegionId = string;

export type OverworldRegion = {
  id: OverworldRegionId;
  imageKey?: string;
};

export type OverworldParty = {
  qx: number;
  qy: number;
  atDis: boolean;
  mapSpeed: number;
  fuel: number;
  revelations: number;
};

export type OverworldCampaignAction =
  | { kind: "adjustMapSpeed"; delta: number }
  | { kind: "adjustFuel"; delta: number }
  | { kind: "adjustRevelations"; delta: number }
  | { kind: "travel"; qx: number; qy: number }
  | { kind: "returnToDis" }
  | { kind: "deployToHell"; qx: number; qy: number };

export type FactionState = {
  crown: number;
  force: number;
  subterfuge: number;
  territory: number;
  assets: number;
  defeated: boolean;
  unlockedUpgrades: string[];
  unlockedUniqueLocations: string[];
};

export type FactionStates = Record<string, FactionState>;

export type OverworldLocation = {
  id: string;
  qx: number;
  qy: number;
  name: string;
  factionId: string;
  infoVisibleToPlayers?: boolean;
};

export type OverworldLocationAction =
  | { kind: "place"; qx: number; qy: number; name: string; factionId: string }
  | { kind: "remove"; locationId: string }
  | { kind: "setInfoVisible"; locationId: string; visible: boolean };

export type OverworldConvoyType = string;

export type OverworldConvoy = {
  id: string;
  qx: number;
  qy: number;
  type: OverworldConvoyType;
  factionId: string;
  infoVisibleToPlayers: boolean;
};

export type OverworldConvoyAction =
  | {
      kind: "place";
      qx: number;
      qy: number;
      type: OverworldConvoyType;
      factionId: string;
    }
  | { kind: "remove"; convoyId: string }
  | { kind: "move"; convoyId: string; qx: number; qy: number }
  | { kind: "setInfoVisible"; convoyId: string; visible: boolean };

export type FactionCampaignAction =
  | {
      kind: "adjustQuality";
      factionId: string;
      quality: "force" | "subterfuge" | "territory" | "assets";
      delta: number;
    }
  | { kind: "adjustCrown"; factionId: string; delta: number }
  | { kind: "setDefeated"; factionId: string; defeated: boolean }
  | { kind: "adjustIchor"; delta: number }
  | { kind: "unlockUpgrade"; factionId: string; upgradeName: string }
  | { kind: "lockUpgrade"; factionId: string; upgradeName: string }
  | { kind: "unlockUniqueLocation"; factionId: string; locationName: string }
  | { kind: "lockUniqueLocation"; factionId: string; locationName: string };

/** Pack-owned campaign runtime; engine owns the shape, pack owns values. */
export type CampaignRuntimeState = {
  partyResources?: PartyResources;
  constructedBaseUpgrades?: string[];
  gmIchor?: number;
  overworldRegions?: OverworldRegion[];
  overworldParty?: OverworldParty;
  overworldLocations?: OverworldLocation[];
  overworldConvoys?: OverworldConvoy[];
  factionStates?: FactionStates;
};

/** Pre-nesting wire fields; only used by liftLegacyCampaignFields. */
export type LegacyCampaignGameStateFields = {
  partyResources?: PartyResources;
  constructedBaseUpgrades?: string[];
  gmIchor?: number;
  overworldRegions?: OverworldRegion[];
  overworldParty?: OverworldParty;
  overworldLocations?: OverworldLocation[];
  overworldConvoys?: OverworldConvoy[];
  factionStates?: FactionStates;
};

export type ContentPackStamp = {
  id: string;
  version: string;
};

export type GameState = {
  mapId: string;
  mapName: string;
  width: number;
  height: number;
  tiles: MapTile[];
  players: Player[];
  enemies: Enemy[];
  terrainObjects?: TerrainObject[];
  round: number;
  roundPhase: RoundPhase;
  turn: TurnHolder | null;
  actedPlayerIds: string[];
  turnLog: RoundTurnLog[];
  sandboxMode?: boolean;
  combat?: CombatState;
  damageEvents?: DamageEvent[];
  silentHpEnemyIds?: string[];
  campaign?: CampaignRuntimeState;
  /** Pack that last wrote this room state; stamped on normalize/save. */
  contentPack?: ContentPackStamp;
};

/**
 * Persisted in KV. Keep top-level fields stable and append
 * future attributes under `data`.
 */
export type PlayerProfile = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  gmPermissions?: boolean;
  data: Record<string, unknown>;
};

export type VttRole = "gm" | "player";

export type { ConsoleActor, ConsoleLogEntry } from "./console.js";

/**
 * Persisted in KV. Keep top-level fields stable; append pack-owned
 * extras under `data` (do not add new content-specific top-level keys).
 */
export type CharacterSheet = {
  id: string;
  player: string;
  name: string;
  portraitKey: string | null;
  class: string;
  armor: string;
  weapon: string;
  equipment?: string;
  gear?: string;
  gearArmor?: string;
  weapon2?: string;
  tags?: string[];
  data?: Record<string, unknown>;
  /** Pack that last wrote this sheet; stamped on create/patch. */
  contentPack?: ContentPackStamp;
  createdAt: string;
  updatedAt: string;
};

export type MapPingSurface = "taccom" | "overworld";

/** Server → client */
export type ServerMessage =
  | { type: "state"; state: GameState; yourPlayerId: string | null }
  | { type: "console"; entry: import("./console.js").ConsoleLogEntry }
  | { type: "consoleSync"; entries: import("./console.js").ConsoleLogEntry[] }
  | { type: "error"; message: string }
  | {
      type: "mapPing";
      fromId: string;
      fromName: string;
      role: "gm" | "player";
      surface: MapPingSurface;
      x: number;
      y: number;
      active: boolean;
    };

/** Client → server */
export type ClientMessage =
  | {
      type: "join";
      role?: "player" | "gm";
      nickname?: string;
      playerKey?: string;
      characterSheetId?: string;
      token?: string;
    }
  | { type: "move"; x: number; y: number }
  | { type: "movePath"; path: { x: number; y: number }[]; flying?: boolean | boolean[] }
  | { type: "resetMovement" }
  | { type: "moveEnemy"; enemyId: string; x: number; y: number; soloSwarmMember?: boolean }
  | { type: "addEnemy"; x: number; y: number; name?: string }
  | { type: "removeEnemy"; enemyId: string; entireSwarm?: boolean }
  | { type: "setPlayerHp"; playerId: string; hp: number }
  | { type: "setEnemyHp"; enemyId: string; hp: number }
  | {
      type: "syncPlayerSheet";
      characterSheetId: string;
      class: string;
      armor?: string;
      weapon?: string;
      equipment?: string;
      gear?: string;
      gearArmor?: string;
      weapon2?: string;
      data?: Record<string, unknown>;
    }
  | { type: "playerAction"; action: PlayerAction }
  | { type: "restorePlayerActionTier"; playerId: string; tier: ActionTier }
  | { type: "setAttackPreview"; preview: AttackPreviewState | null }
  | { type: "gmEnemyAction"; action: GmEnemyAction }
  | { type: "applyAssistedOutcome"; outcome: AssistedOutcome }
  | { type: "packCombat"; kind: string; detail?: Record<string, unknown> }
  | { type: "triggerReversal"; extraLines?: { allyId: string; anchor?: "tower" }[] }
  | { type: "declineReversal" }
  | {
      type: "gmForceMove";
      target: { kind: "player" | "enemy"; id: string };
      x: number;
      y: number;
      soloSwarmMember?: boolean;
    }
  | {
      type: "gmApplyDamage";
      target:
        | { kind: "player" | "enemy"; id: string }
        | { kind: "obstacle"; x: number; y: number };
      amount: number;
    }
  | {
      type: "applyEffect";
      target: { kind: "player" | "enemy"; id: string };
      effects: string[];
    }
  | {
      type: "clearEffects";
      target: { kind: "player" | "enemy"; id: string };
    }
  | {
      type: "applyTileEffect";
      x: number;
      y: number;
      effects: string[];
    }
  | { type: "clearTileEffects"; x: number; y: number }
  | { type: "setTileTerrain"; x: number; y: number; terrain: TerrainType }
  | {
      type: "gmPaintTile";
      coords: { x: number; y: number }[];
      elevation?: number;
      terrain?: TerrainType;
      tileEffects?: string[];
      tileName?: string;
      obstacleHp?: number;
      baseColor?: string | null;
      appearanceKey?: string | null;
      overlayKey?: string | null;
      featureKey?: string | null;
      appearanceTint?: TileColorTint | null;
      overlayTint?: TileColorTint | null;
      featureTint?: TileColorTint | null;
      appearanceRotation?: TileImageRotation | null;
      appearanceFlip?: boolean | null;
      overlayRotation?: TileImageRotation | null;
      overlayFlip?: boolean | null;
      featureRotation?: TileImageRotation | null;
      featureFlip?: boolean | null;
    }
  | {
      type: "confirmPending";
      kind: string;
      enemyId: string;
      hoverX: number;
      hoverY: number;
    }
  | { type: "removeAttractor"; x: number; y: number }
  | { type: "phaseAction"; action: PhaseAction }
  | { type: "setSandboxMode"; sandboxMode: boolean }
  | { type: "baseCampaignAction"; action: BaseCampaignAction }
  | { type: "overworldCampaignAction"; action: OverworldCampaignAction }
  | {
      type: "setOverworldRegionImage";
      regionId: OverworldRegionId;
      imageKey: string | null;
    }
  | { type: "factionCampaignAction"; action: FactionCampaignAction }
  | { type: "overworldLocationAction"; action: OverworldLocationAction }
  | { type: "overworldConvoyAction"; action: OverworldConvoyAction }
  | { type: "spawnPlayerToken"; characterSheetId: string }
  | { type: "removePlayerToken"; playerId: string }
  | { type: "activateMap"; mapId: string }
  | { type: "saveStartingState" }
  | { type: "resetToStartingState" }
  | {
      type: "mapPing";
      surface: MapPingSurface;
      x: number;
      y: number;
      active: boolean;
    };
