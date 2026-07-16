export {
  GORGENAUT_AGNOSIA_BOX,
  GORGENAUT_AGNOSIA_CONFIRM_KIND,
  findGorgenautAgnosiaPending,
  isGorgenautEnemy,
} from "./combat/gorgenaut.js";

export {
  HEAVEN_BURNING_MAX_LEVEL,
  HEAVEN_BURNING_SWORD_NAME,
  HEAVEN_BURNING_UNFOLD_DETAIL,
  getHeavenBurningLevel,
  isHeavenBurningWeaponName,
} from "./combat/heaven-burning.js";

export {
  STAIN_GEYSER_NAME,
  STAIN_GEYSER_OVERLAY_GROUP_KEY,
  stainGeyserAreaSize,
  stainGeyserBoxTiles,
} from "./combat/stain-geyser.js";

export { tileIsStained } from "./combat/stainwalk.js";

export { flowerbudPlantTiles } from "./combat/chalazaor.js";

export {
  areOrthogonallyConnected,
  collectEquipmentPatternTiles,
  forceProjectionTileKeys,
  getEquipmentAttackSpec,
  isHylicAnnihilationCorridor,
  isHylicRejectionField,
  isThoughtGuidingRedirectionCircuits,
  isTransientForceProjection,
  listRedirectableEnemyAttackIndices,
  redirectionSourceTileKeys,
  rejectionFieldTileKeys,
} from "./combat/equipment.js";

export {
  TOWER_IATROS,
  YADATHAN_ARMOR_NAME,
  getPlayerTower,
  getSeedAt,
  getYadathanTowerDef,
  isTowerEnemy,
  isYadathanArmorName,
  kataptyNeedsTargetPick,
  kataptyTargetKeys,
  keraunoAdjacentEnemyIds,
  towerTeleportLandingKeys,
  yadathanPlacementKeys,
} from "./combat/yadathan.js";

export type { SwarmChipTarget } from "./combat/swarm.js";
export {
  attackTargetsSwarm,
  buildSwarmGroups,
  canSwarmMemberReachDest,
  getEffectiveEnemyHp,
  getEffectiveEnemyMaxHp,
  getSwarmMaxHp,
  getSwarmMemberHp,
  getSwarmMovementRemaining,
  maxSwarmStrikesAgainstTarget,
  pickSwarmMoveMember,
  swarmCanonicalDisplayId,
  swarmChipEligibleTargets,
  swarmChipPromptRequired,
  swarmFringeTiles,
  swarmGroupForEnemy,
  swarmMembersHitByTiles,
  weaponHasBreakerTag,
} from "./combat/swarm.js";
