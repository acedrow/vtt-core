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
  omnistrikeStep?: "placeFirst" | "placeSecond" | "confirm";
  omnistrikeBombIndices?: [number, number];
  omnistrikeAnchors?: [{ x: number; y: number } | null, { x: number; y: number } | null];
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
  swarmChipResolvedIds?: string[];
  passedEnemyIdsByPlayer?: Record<string, string[]>;
  thrownTraps?: ThrownTrap[];
  boardTokens?: BoardToken[];
  attractors?: AttractorTile[];
  attractorPulledEnemyIds?: string[];
  gearCheckGrants?: Record<string, string>;
  // Generic mark map (enemyId → owner player id). Prefer over legacy kopisMarks.
  marks?: Record<string, string>;
  // Brand target key (unit id or `obs:x,y`) → owner player id. Prefer over chrysaorBrands.
  brands?: Record<string, string>;
  /** @deprecated Use marks */
  kopisMarks?: Record<string, string>;
  /** @deprecated Use brands */
  chrysaorBrands?: Record<string, string>;
  /** Pack-owned opaque combat extras. */
  pack?: Record<string, unknown>;
  countdownKinds?: Record<string, string>;
  equipmentTerrainSnapshots?: { x: number; y: number; terrain: TerrainType[] }[];
  sideEffectMessages?: string[];
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
  | {
      action: "armorAction";
      kind?: "tower_teleport" | "katapty_end_turn" | string;
      targetEnemyId?: string;
      targetPlayerId?: string;
      landingX?: number;
      landingY?: number;
      push?: 1 | 2 | 3;
      x?: number;
      y?: number;
      keraunoTargetEnemyId?: string;
      targetEnemyIds?: string[];
    }
  | { action: "assistedLaunch"; anchorX: number; anchorY: number }
  | {
      action: "classActive";
      kind?: ClassActiveKind;
      harpeRecall?: boolean;
      harpeEquipWeapon?: string;
      targetEnemyIds?: string[];
      targetPlayerIds?: string[];
      x?: number;
      y?: number;
      allyPlayerId?: string;
      direction?: PatternDirection;
      anchorX?: number;
      anchorY?: number;
      followUpMaxDamage?: boolean;
      gearSlot?: "weapon" | "armor";
      gearName?: string;
    }
  | {
      action: "classPassive";
      kind: "baseline_communism";
      targetPlayerId: string;
    }
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
      action: "weaponActive";
      detail?: string;
      targetEnemyIds?: string[];
      targetPlayerIds?: string[];
      direction?: PatternDirection;
      omnistrike?: {
        bombIndices: [number, number];
        anchors: [{ x: number; y: number }, { x: number; y: number }];
        direction: PatternDirection;
      };
      warhook?: {
        targetEnemyId?: string;
        targetX: number;
        targetY: number;
        landingX: number;
        landingY: number;
        damageRoll?: number;
        useBreaker?: boolean;
      };
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
  | { action: "swarmChip"; enemyId: string; targetPlayerIds: string[] }
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
    swarmChipResolvedIds: [],
    thrownTraps: [],
    boardTokens: [],
    attractors: [],
    gearCheckGrants: {},
    marks: {},
    brands: {},
    pack: {},
    countdownKinds: {},
  };
}

// Lift legacy IP-named maps onto generic bags (and keep aliases in sync for readers).
export function migrateCombatStateFields(combat: CombatState): void {
  if (!combat.marks) combat.marks = { ...(combat.kopisMarks ?? {}) };
  else if (combat.kopisMarks) Object.assign(combat.marks, combat.kopisMarks);
  combat.kopisMarks = combat.marks;

  if (!combat.brands) combat.brands = { ...(combat.chrysaorBrands ?? {}) };
  else if (combat.chrysaorBrands) Object.assign(combat.brands, combat.chrysaorBrands);
  combat.chrysaorBrands = combat.brands;

  if (!combat.pack) combat.pack = {};
}
