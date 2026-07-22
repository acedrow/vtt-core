import type { Enemy, GameState } from "@vtt-core/shared";

import { getClientCombatBoard } from "./client-content-pack.js";

export type CombatBoardSwarmGroup = {
  canonicalId: string;
  memberIds: string[];
  linkedFlowerIds: string[];
  size: number;
  currentHp: number;
  maxHp: number;
};

export type CombatBoardSwarmChipTarget = {
  kind: "player";
  id: string;
  label: string;
};

// Pack-owned board helpers. Signatures stay structural so content can evolve without
// dragging Hellpiercers types into the engine type graph.
export type ClientCombatBoardHelpers = {
  swarmGroupForEnemy: (
    state: GameState,
    enemyId: string,
    groups?: Map<string, string[]>,
  ) => CombatBoardSwarmGroup | null;
  swarmCanonicalDisplayId: (state: GameState, memberIds: string[]) => string;
  getEffectiveEnemyHp: (enemy: Enemy, state: GameState) => number;
  getEffectiveEnemyMaxHp: (enemy: Enemy, state: GameState) => number;
  getSwarmMemberHp: (totalHp: number, size: number) => number;
  getSwarmMaxHp: (size: number) => number;
  getSwarmMovementRemaining: (state: GameState, memberIds: string[]) => number;
  buildSwarmGroups: (state: GameState) => Map<string, string[]>;
  // Remaining pack helpers are invoked only from product UI that registers them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  canSwarmMemberReachDest: (...args: any[]) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  swarmFringeTiles: (...args: any[]) => { x: number; y: number }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  pickSwarmMoveMember: (...args: any[]) => string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  attackTargetsSwarm: (...args: any[]) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  weaponHasBreakerTag: (...args: any[]) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  swarmChipEligibleTargets: (...args: any[]) => CombatBoardSwarmChipTarget[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  swarmChipPromptRequired: (...args: any[]) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  swarmMembersHitByTiles: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  maxSwarmStrikesAgainstTarget: (...args: any[]) => number;
  buildOmnistrikeAttackPreviewPack: (fields: {
    omnistrikeStep: "placeFirst" | "placeSecond" | "confirm";
    omnistrikeBombIndices: [number, number];
    omnistrikeAnchors: [{ x: number; y: number } | null, { x: number; y: number } | null];
  }) => Record<string, unknown>;
  readOmnistrikeAttackPreviewFields: (preview: {
    pack?: Record<string, unknown>;
  }) => {
    omnistrikeStep?: "placeFirst" | "placeSecond" | "confirm";
    omnistrikeBombIndices?: [number, number];
    omnistrikeAnchors?: [{ x: number; y: number } | null, { x: number; y: number } | null];
  };
  isTowerEnemy: (enemy: Enemy) => boolean;
  getPlayerTower: (state: GameState, playerId: string) => Enemy | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  getSeedAt: (state: GameState, x: number, y: number) => any;
  isYadathanArmorName: (name: string | undefined | null) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  getYadathanTowerDef: (towerName: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  yadathanPlacementKeys: (...args: any[]) => Set<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  towerTeleportLandingKeys: (...args: any[]) => Set<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  kataptyTargetKeys: (...args: any[]) => Set<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  keraunoAdjacentEnemyIds: (...args: any[]) => string[];
  kataptyNeedsTargetPick: (state: GameState, playerId: string) => boolean;
  TOWER_IATROS: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  getEquipmentAttackSpec: (...args: any[]) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  collectEquipmentPatternTiles: (...args: any[]) => { x: number; y: number }[];
  isHylicAnnihilationCorridor: (name: string | undefined | null) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  areOrthogonallyConnected: (...args: any[]) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  listRedirectableEnemyAttackIndices: (...args: any[]) => number[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  rejectionFieldTileKeys: (...args: any[]) => Set<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  forceProjectionTileKeys: (...args: any[]) => Set<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  redirectionSourceTileKeys: (...args: any[]) => Set<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque pack call signatures
  flowerbudPlantTiles: (...args: any[]) => { x: number; y: number }[];
  tileIsStained: (state: GameState, x: number, y: number) => boolean;
  GORGENAUT_AGNOSIA_BOX: number;
  SETHIAN_DAMAGE_CAP: number;
  HEAVEN_BURNING_MAX_LEVEL: number;
};

function stubHelpers(): ClientCombatBoardHelpers {
  const emptySet = () => new Set<string>();
  const emptyTiles = () => [] as { x: number; y: number }[];
  return {
    swarmGroupForEnemy: () => null,
    swarmCanonicalDisplayId: (_s, ids) => ids[0] ?? "",
    getEffectiveEnemyHp: (enemy) => enemy.hp ?? 0,
    getEffectiveEnemyMaxHp: (enemy) => enemy.hp ?? 0,
    getSwarmMemberHp: (total) => total,
    getSwarmMaxHp: (size) => size * 10,
    getSwarmMovementRemaining: () => 0,
    buildSwarmGroups: () => new Map(),
    canSwarmMemberReachDest: () => false,
    swarmFringeTiles: emptyTiles,
    pickSwarmMoveMember: () => null,
    attackTargetsSwarm: () => false,
    weaponHasBreakerTag: () => false,
    swarmChipEligibleTargets: () => [],
    swarmChipPromptRequired: () => false,
    swarmMembersHitByTiles: () => [],
    maxSwarmStrikesAgainstTarget: () => 0,
    buildOmnistrikeAttackPreviewPack: () => ({}),
    readOmnistrikeAttackPreviewFields: () => ({}),
    isTowerEnemy: () => false,
    getPlayerTower: () => undefined,
    getSeedAt: () => undefined,
    isYadathanArmorName: () => false,
    getYadathanTowerDef: () => undefined,
    yadathanPlacementKeys: emptySet,
    towerTeleportLandingKeys: emptySet,
    kataptyTargetKeys: emptySet,
    keraunoAdjacentEnemyIds: () => [],
    kataptyNeedsTargetPick: () => false,
    TOWER_IATROS: "Iatrós",
    getEquipmentAttackSpec: () => null,
    collectEquipmentPatternTiles: emptyTiles,
    isHylicAnnihilationCorridor: () => false,
    areOrthogonallyConnected: () => false,
    listRedirectableEnemyAttackIndices: () => [],
    rejectionFieldTileKeys: emptySet,
    forceProjectionTileKeys: emptySet,
    redirectionSourceTileKeys: emptySet,
    flowerbudPlantTiles: emptyTiles,
    tileIsStained: () => false,
    GORGENAUT_AGNOSIA_BOX: 5,
    SETHIAN_DAMAGE_CAP: 132,
    HEAVEN_BURNING_MAX_LEVEL: 3,
  };
}

const stubs = stubHelpers();

export function getCombatBoardHelpers(): ClientCombatBoardHelpers {
  return getClientCombatBoard().helpers ?? stubs;
}
