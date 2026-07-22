import type { PatternDirection } from "../pattern-data.js";
import type { TerrainType } from "../types.js";

export const ACTION_TIERS = ["main", "support", "aux"] as const;
export type ActionTier = (typeof ACTION_TIERS)[number];

export type ActionBudget = {
  main: boolean;
  support: boolean;
  aux: boolean;
  movementRemaining: number;
  movementMax: number;
  sprintRemaining?: number;
  sprintMax?: number;
};

export type EffectStacks = Record<string, number>;

export type RelativeTile = readonly [number, number];

export type WeaponPatternLevel = {
  label: string;
  damage: string;
  tiles: RelativeTile[];
};

export type WeaponBombPattern = {
  name: string;
  damage: string;
  range?: string;
  description?: string;
  tiles: RelativeTile[];
  anchorTile?: RelativeTile;
  healTiles?: RelativeTile[];
  boundsTiles?: RelativeTile[];
  heal?: boolean;
  effects?: string[];
};

export type AttackRangeSpan = { min: number; max: number };

export type WeaponAttackSpec = {
  patternId?: string;
  tiles?: RelativeTile[];
  levels?: WeaponPatternLevel[];
  bombs?: WeaponBombPattern[];
  rangeTargets?: { range: number; maxTargets: number };
  rangeSpan?: AttackRangeSpan;
  anchorTile?: RelativeTile;
  size?: number;
  range?: number;
  width?: number;
  damage: string;
  effects?: string[];
  heal?: boolean;
};

export type EnemyAttackTargeting = "pattern" | "select" | "self" | "none" | "assisted";

export type EnemyAttackOnHit =
  | { kind: "pullTowardActor"; distance: number }
  | { kind: "stainTiles" };

export type EnemyAttackSpec = {
  targeting: EnemyAttackTargeting;
  patternId?: string;
  size?: number;
  range?: number;
  width?: number;
  damage?: string;
  effects?: string[];
  adjacent?: boolean;
  onHit?: EnemyAttackOnHit[];
  specialId?: string;
};

export type EnemyAttack = {
  text: string;
  attack: EnemyAttackSpec;
};

export type StructuredArmorAction =
  | { tier: "support"; kind: "teleport_adjacent" }
  | { tier: "support"; kind: "push_recoil"; push?: number }
  | { tier: "support"; kind: "place_tower"; range: number }
  | { tier: "support"; kind: "assisted" };

export type AssistedActionKind =
  | "classActive"
  | "weaponActive"
  | "useEquipment"
  | "interact"
  | "enemyAttack"
  | "enemySpecial"
  | "reversal";

export type PendingAction = {
  id: string;
  actorPlayerId?: string;
  actorEnemyId?: string;
  kind: AssistedActionKind;
  label: string;
  detail?: string;
  targetEnemyIds?: string[];
  targetPlayerIds?: string[];
  direction?: PatternDirection;
  damage?: number;
  effects?: string[];
  createdAt: number;
};

export type PendingReaction = {
  playerId: string;
  sourceEnemyId?: string;
  trigger: string;
  label: string;
  incomingDamage?: number;
};

export type ThrownTrap = {
  ownerId: string;
  weaponName: string;
  x: number;
  y: number;
  originX: number;
  originY: number;
};

export type BoardToken = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  kind: string;
};

export type AttractorTile = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  void: boolean;
};

export type HarpeTrapPullReaction = {
  kind: "harpe_trap_pull";
  playerId: string;
  enemyId: string;
  trapOwnerId: string;
  weaponName: string;
  trapX: number;
  trapY: number;
  damageDealt: number;
};

export type BorrowingFollowUpReaction = {
  kind: "borrowing_follow_up";
  playerId: string;
  allyPlayerId: string;
  direction: import("../pattern-data.js").PatternDirection;
  anchorX?: number;
  anchorY?: number;
  extraEnemyIds: string[];
  maxDamage: number;
};

export type OffhandPistolPushReaction = {
  kind: "offhand_pistol_push";
  playerId: string;
  enemyIds: string[];
  originX: number;
  originY: number;
};

export type BrandStripCandidate =
  | { kind: "enemy"; id: string }
  | { kind: "player"; id: string }
  | { kind: "obstacle"; x: number; y: number };

export type BrandStripReaction = {
  kind: "brand_strip";
  playerId: string;
  candidates: BrandStripCandidate[];
};

export type PendingClassReaction =
  | HarpeTrapPullReaction
  | BorrowingFollowUpReaction
  | OffhandPistolPushReaction
  | BrandStripReaction;

export type ClassActiveKind = string;

export type AttackPreviewMode = string;

export type AttackPreviewState = {
  playerId?: string;
  mode: AttackPreviewMode;
  direction?: PatternDirection;
  aimed?: boolean;
  anchorX?: number;
  anchorY?: number;
  hoverX?: number;
  hoverY?: number;
  targetEnemyIds?: string[];
  targetObstacleCoords?: { x: number; y: number }[];
  borrowAllyId?: string;
  forceProjectionX?: number;
  forceProjectionY?: number;
  /** Pack-owned opaque preview extras (e.g. omnistrikeStep / BombIndices / Anchors). */
  pack?: Record<string, unknown>;
  enemyId?: string;
  attackIndex?: number;
};

export type CombatState = {
  playerCountAtStart: number;
  pendingActions: PendingAction[];
  pendingReaction: PendingReaction | null;
  pendingClassReaction: PendingClassReaction | null;
  activeEnemyId: string | null;
  attackPreview?: AttackPreviewState | null;
  passedEnemyIdsByPlayer?: Record<string, string[]>;
  thrownTraps?: ThrownTrap[];
  boardTokens?: BoardToken[];
  attractors?: AttractorTile[];
  attractorPulledEnemyIds?: string[];
  gearCheckGrants?: Record<string, string>;
  // Generic mark map (enemyId → owner player id).
  marks?: Record<string, string>;
  // Brand target key (unit id or `obs:x,y`) → owner player id.
  brands?: Record<string, string>;
  /** Pack-owned opaque combat extras (e.g. swarmChipResolvedIds). */
  pack?: Record<string, unknown>;
  countdownKinds?: Record<string, string>;
  equipmentTerrainSnapshots?: { x: number; y: number; terrain: TerrainType[] }[];
  sideEffectMessages?: string[];
};

// Legacy keys dual-read only inside migrators (persisted rooms / in-flight WS).
type LegacyCombatBag = CombatState & {
  swarmChipResolvedIds?: string[];
  kopisMarks?: Record<string, string>;
  chrysaorBrands?: Record<string, string>;
};

type LegacyAttackPreviewBag = AttackPreviewState & {
  omnistrikeStep?: "placeFirst" | "placeSecond" | "confirm";
  omnistrikeBombIndices?: [number, number];
  omnistrikeAnchors?: [{ x: number; y: number } | null, { x: number; y: number } | null];
};

export type PlayerAction =
  | {
      action: "attack";
      direction: PatternDirection;
      anchorX?: number;
      anchorY?: number;
      damageRoll?: number;
      targetEnemyId?: string;
      targetEnemyIds?: string[];
      targetObstacleCoords?: { x: number; y: number }[];
      weaponName?: string;
      useBreaker?: boolean;
      elevationBonusTile?: { x: number; y: number };
    }
  | { action: "shove"; targetEnemyId?: string; targetPlayerId?: string }
  | { action: "sprint" }
  | { action: "sprintMove"; x: number; y: number; flying?: boolean }
  | { action: "sprintCancel" }
  | { action: "weaponSwap" }
  | { action: "selectWeaponVariant"; index: number }
  | { action: "rez"; targetPlayerId: string }
  | { action: "pack"; kind: string; detail?: Record<string, unknown> }
  | {
      action: "resolveClassReaction";
      pullDistance?: number;
      pullToward?: "self" | "weapon";
      accept?: boolean;
      targetEnemyId?: string;
      targetPlayerId?: string;
      x?: number;
      y?: number;
    }
  | {
      action: "useEquipment";
      detail?: string;
      direction?: PatternDirection;
      anchorX?: number;
      anchorY?: number;
      coverTiles?: { x: number; y: number }[];
      sourceEnemyId?: string;
      attackIndex?: number;
      targetEnemyId?: string;
      projectionX?: number;
      projectionY?: number;
      weaponName?: string;
      damageRoll?: number;
      targetEnemyIds?: string[];
      useBreaker?: boolean;
    }
  | { action: "interact"; detail?: string }
  | { action: "commitHaste"; tier: ActionTier };

export type GmEnemyAction =
  | { action: "move"; enemyId: string; path: { x: number; y: number }[] }
  | {
      action: "attack";
      enemyId: string;
      attackIndex: number;
      direction?: PatternDirection;
      originX?: number;
      originY?: number;
      damage?: number;
      targetPlayerId?: string;
      targetEnemyId?: string;
      destX?: number;
      destY?: number;
      swarmStrikes?: number;
    }
  | { action: "pack"; kind: string; enemyId: string; detail?: Record<string, unknown> }
  | { action: "assisted"; enemyId: string; label: string; detail?: string; damage?: number; targetPlayerId?: string; effects?: string[] }
  | { action: "exhaust"; enemyId: string };

export type AssistedOutcome = {
  pendingId: string;
  damageByEnemyId?: Record<string, number>;
  damageByPlayerId?: Record<string, number>;
  effectsByEnemyId?: Record<string, string[]>;
  effectsByPlayerId?: Record<string, string[]>;
  healByPlayerId?: Record<string, number>;
  reject?: boolean;
};

export function createDefaultActionBudget(speed: number): ActionBudget {
  return {
    main: true,
    support: true,
    aux: true,
    movementRemaining: speed,
    movementMax: speed,
  };
}

export function createDefaultCombatState(playerCount: number): CombatState {
  return {
    playerCountAtStart: playerCount,
    pendingActions: [],
    pendingReaction: null,
    pendingClassReaction: null,
    activeEnemyId: null,
    thrownTraps: [],
    boardTokens: [],
    attractors: [],
    gearCheckGrants: {},
    marks: {},
    brands: {},
    pack: { swarmChipResolvedIds: [] },
    countdownKinds: {},
  };
}

export function migrateAttackPreviewFields(preview: AttackPreviewState): void {
  const legacy = preview as LegacyAttackPreviewBag;
  if (!preview.pack) preview.pack = {};
  const pack = preview.pack;

  if (pack.omnistrikeStep == null && legacy.omnistrikeStep != null) {
    pack.omnistrikeStep = legacy.omnistrikeStep;
  }
  if (pack.omnistrikeBombIndices == null && legacy.omnistrikeBombIndices != null) {
    pack.omnistrikeBombIndices = legacy.omnistrikeBombIndices;
  }
  if (pack.omnistrikeAnchors == null && legacy.omnistrikeAnchors != null) {
    pack.omnistrikeAnchors = legacy.omnistrikeAnchors;
  }

  delete legacy.omnistrikeStep;
  delete legacy.omnistrikeBombIndices;
  delete legacy.omnistrikeAnchors;
}

// Lift legacy IP-named / first-class bags onto generic marks/brands and combat.pack.
export function migrateCombatStateFields(combat: CombatState): void {
  const legacy = combat as LegacyCombatBag;

  if (!combat.marks) combat.marks = { ...(legacy.kopisMarks ?? {}) };
  else if (legacy.kopisMarks) Object.assign(combat.marks, legacy.kopisMarks);
  delete legacy.kopisMarks;

  if (!combat.brands) combat.brands = { ...(legacy.chrysaorBrands ?? {}) };
  else if (legacy.chrysaorBrands) Object.assign(combat.brands, legacy.chrysaorBrands);
  delete legacy.chrysaorBrands;

  if (!combat.pack) combat.pack = {};
  if (combat.pack.swarmChipResolvedIds == null) {
    combat.pack.swarmChipResolvedIds = legacy.swarmChipResolvedIds ?? [];
  }
  delete legacy.swarmChipResolvedIds;

  if (combat.attackPreview) migrateAttackPreviewFields(combat.attackPreview);
}
