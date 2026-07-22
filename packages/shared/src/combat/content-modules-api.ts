/* eslint-disable @typescript-eslint/no-explicit-any -- content combat module API */
import { combatMod } from "../combat-modules.js";

// --- chalazaor ---


export function isSoaringBombardier(...args: any[]): any {
  const v = (combatMod("chalazaor") as any).isSoaringBombardier;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function flowerbudPlantTiles(...args: any[]): any {
  const v = (combatMod("chalazaor") as any).flowerbudPlantTiles;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateFlowerbudPlant(...args: any[]): any {
  const v = (combatMod("chalazaor") as any).validateFlowerbudPlant;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyFlowerbudPlant(...args: any[]): any {
  const v = (combatMod("chalazaor") as any).applyFlowerbudPlant;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyChalazaorAgnosia(...args: any[]): any {
  const v = (combatMod("chalazaor") as any).applyChalazaorAgnosia;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function tryChalazaorDamageNegation(...args: any[]): any {
  const v = (combatMod("chalazaor") as any).tryChalazaorDamageNegation;
  if (typeof v !== "function") return v;
  return v(...args);
}


// --- chrysaor ---

export function obstacleBrandKey(...args: any[]): any {
  const v = (combatMod("chrysaor") as any).obstacleBrandKey;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function ensureChrysaorCombatFields(...args: any[]): any {
  const v = (combatMod("chrysaor") as any).ensureChrysaorCombatFields;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function isChrysaorClass(...args: any[]): any {
  const v = (combatMod("chrysaor") as any).isChrysaorClass;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function ownedBrandCandidates(...args: any[]): any {
  const v = (combatMod("chrysaor") as any).ownedBrandCandidates;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applySoulBranding(...args: any[]): any {
  const v = (combatMod("chrysaor") as any).applySoulBranding;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function detonateBrand(...args: any[]): any {
  const v = (combatMod("chrysaor") as any).detonateBrand;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function chrysaorImmuneToAreaEffects(...args: any[]): any {
  const v = (combatMod("chrysaor") as any).chrysaorImmuneToAreaEffects;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function maybeOfferBrandStrip(...args: any[]): any {
  const v = (combatMod("chrysaor") as any).maybeOfferBrandStrip;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function stripOwnedBrand(...args: any[]): any {
  const v = (combatMod("chrysaor") as any).stripOwnedBrand;
  if (typeof v !== "function") return v;
  return v(...args);
}


// --- class-abilities ---

export type MovementHookResult = {
  messages: string[];
  interrupt: boolean;
};

export function validateClassActive(...args: any[]): any {
  const v = (combatMod("classAbilities") as any).validateClassActive;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateClassPassive(...args: any[]): any {
  const v = (combatMod("classAbilities") as any).validateClassPassive;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateResolveClassReaction(...args: any[]): any {
  const v = (combatMod("classAbilities") as any).validateResolveClassReaction;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyClassActive(...args: any[]): any {
  const v = (combatMod("classAbilities") as any).applyClassActive;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyClassPassive(...args: any[]): any {
  const v = (combatMod("classAbilities") as any).applyClassPassive;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyResolveClassReaction(...args: any[]): any {
  const v = (combatMod("classAbilities") as any).applyResolveClassReaction;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyPostMovementHooks(...args: any[]): any {
  const v = (combatMod("classAbilities") as any).applyPostMovementHooks;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function classActiveTierFor(...args: any[]): any {
  const v = (combatMod("classAbilities") as any).classActiveTierFor;
  if (typeof v !== "function") return v;
  return v(...args);
}


// --- equipment ---

export function isHylicAnnihilationCorridor(...args: any[]): any {
  const v = (combatMod("equipment") as any).isHylicAnnihilationCorridor;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function isHylicRejectionField(...args: any[]): any {
  const v = (combatMod("equipment") as any).isHylicRejectionField;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function isThoughtGuidingRedirectionCircuits(...args: any[]): any {
  const v = (combatMod("equipment") as any).isThoughtGuidingRedirectionCircuits;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function isTransientForceProjection(...args: any[]): any {
  const v = (combatMod("equipment") as any).isTransientForceProjection;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function equipmentRequiresBoardPlacement(...args: any[]): any {
  const v = (combatMod("equipment") as any).equipmentRequiresBoardPlacement;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function getEquipmentAttackSpec(...args: any[]): any {
  const v = (combatMod("equipment") as any).getEquipmentAttackSpec;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function collectEquipmentPatternTiles(...args: any[]): any {
  const v = (combatMod("equipment") as any).collectEquipmentPatternTiles;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function areOrthogonallyConnected(...args: any[]): any {
  const v = (combatMod("equipment") as any).areOrthogonallyConnected;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function clearEquipmentTerrainSnapshots(...args: any[]): any {
  const v = (combatMod("equipment") as any).clearEquipmentTerrainSnapshots;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateHylicCorridorAction(...args: any[]): any {
  const v = (combatMod("equipment") as any).validateHylicCorridorAction;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateHylicRejectionField(...args: any[]): any {
  const v = (combatMod("equipment") as any).validateHylicRejectionField;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function isRedirectableEnemyAttack(...args: any[]): any {
  const v = (combatMod("equipment") as any).isRedirectableEnemyAttack;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function listRedirectableEnemyAttackIndices(...args: any[]): any {
  const v = (combatMod("equipment") as any).listRedirectableEnemyAttackIndices;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateRedirectionCircuits(...args: any[]): any {
  const v = (combatMod("equipment") as any).validateRedirectionCircuits;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateForceProjection(...args: any[]): any {
  const v = (combatMod("equipment") as any).validateForceProjection;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyHylicCorridor(...args: any[]): any {
  const v = (combatMod("equipment") as any).applyHylicCorridor;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyHylicRejectionField(...args: any[]): any {
  const v = (combatMod("equipment") as any).applyHylicRejectionField;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyRedirectionCircuits(...args: any[]): any {
  const v = (combatMod("equipment") as any).applyRedirectionCircuits;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyForceProjection(...args: any[]): any {
  const v = (combatMod("equipment") as any).applyForceProjection;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function enemyOnAnnihilationCorridor(...args: any[]): any {
  const v = (combatMod("equipment") as any).enemyOnAnnihilationCorridor;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyAnnihilationCorridorEndOfTurnDamage(...args: any[]): any {
  const v = (combatMod("equipment") as any).applyAnnihilationCorridorEndOfTurnDamage;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function clearAnnihilationCorridorTileEffects(...args: any[]): any {
  const v = (combatMod("equipment") as any).clearAnnihilationCorridorTileEffects;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function rejectionFieldTileKeys(...args: any[]): any {
  const v = (combatMod("equipment") as any).rejectionFieldTileKeys;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function forceProjectionTileKeys(...args: any[]): any {
  const v = (combatMod("equipment") as any).forceProjectionTileKeys;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function redirectionSourceTileKeys(...args: any[]): any {
  const v = (combatMod("equipment") as any).redirectionSourceTileKeys;
  if (typeof v !== "function") return v;
  return v(...args);
}


// --- gorgenaut ---


export function isGorgenaut(...args: any[]): any {
  const v = (combatMod("gorgenaut") as any).isGorgenaut;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyGorgenautConeAttack(...args: any[]): any {
  const v = (combatMod("gorgenaut") as any).applyGorgenautConeAttack;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateGorgenautStainTeleport(...args: any[]): any {
  const v = (combatMod("gorgenaut") as any).validateGorgenautStainTeleport;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyGorgenautStainTeleport(...args: any[]): any {
  const v = (combatMod("gorgenaut") as any).applyGorgenautStainTeleport;
  if (typeof v !== "function") return v;
  return v(...args);
}


// --- kopis ---

export function ensureKopisCombatFields(...args: any[]): any {
  const v = (combatMod("kopis") as any).ensureKopisCombatFields;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function clearKopisMarkEffect(...args: any[]): any {
  const v = (combatMod("kopis") as any).clearKopisMarkEffect;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function syncKopisMarkEffects(...args: any[]): any {
  const v = (combatMod("kopis") as any).syncKopisMarkEffects;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyKopisMark(...args: any[]): any {
  const v = (combatMod("kopis") as any).applyKopisMark;
  if (typeof v !== "function") return v;
  return v(...args);
}


// --- lurking-freak ---


export function isLurkingFreak(...args: any[]): any {
  const v = (combatMod("lurkingFreak") as any).isLurkingFreak;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function enemyBlocksTileOccupancy(...args: any[]): any {
  const v = (combatMod("lurkingFreak") as any).enemyBlocksTileOccupancy;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyLurkingFreakAgnosia(...args: any[]): any {
  const v = (combatMod("lurkingFreak") as any).applyLurkingFreakAgnosia;
  if (typeof v !== "function") return v;
  return v(...args);
}


// --- stain-geyser ---

export function stainGeyserAreaSize(...args: any[]): any {
  const v = (combatMod("stainGeyser") as any).stainGeyserAreaSize;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function stainGeyserBoxTiles(...args: any[]): any {
  const v = (combatMod("stainGeyser") as any).stainGeyserBoxTiles;
  if (typeof v !== "function") return v;
  return v(...args);
}


// --- stainwalk ---

export function stainwalkKind(...args: any[]): any {
  const v = (combatMod("stainwalk") as any).stainwalkKind;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function stainOverlayKeyForTile(...args: any[]): any {
  const v = (combatMod("stainwalk") as any).stainOverlayKeyForTile;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function stainMapTile(...args: any[]): any {
  const v = (combatMod("stainwalk") as any).stainMapTile;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function tileIsStained(...args: any[]): any {
  const v = (combatMod("stainwalk") as any).tileIsStained;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function enemyOnStainedTile(...args: any[]): any {
  const v = (combatMod("stainwalk") as any).enemyOnStainedTile;
  if (typeof v !== "function") return v;
  return v(...args);
}


// --- swarm ---

export type SwarmGroup = {
  canonicalId: string;
  memberIds: string[];
  linkedFlowerIds: string[];
  size: number;
  currentHp: number;
  maxHp: number;
};

export type SwarmReconcileSnapshot = {
  groups: Map<string, string[]>;
  sizes: Map<string, number>;
};

export type SwarmChipTarget = { kind: "player"; id: string; label: string };

export function snapshotSwarmGroups(...args: any[]): any {
  const v = (combatMod("swarm") as any).snapshotSwarmGroups;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function enemyHasSwarmTrait(...args: any[]): any {
  const v = (combatMod("swarm") as any).enemyHasSwarmTrait;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function isStainFlower(...args: any[]): any {
  const v = (combatMod("swarm") as any).isStainFlower;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function linkedStainFlowerIdsNear(...args: any[]): any {
  const v = (combatMod("swarm") as any).linkedStainFlowerIdsNear;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function linkedStainFlowerIds(...args: any[]): any {
  const v = (combatMod("swarm") as any).linkedStainFlowerIds;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function buildSwarmGroups(...args: any[]): any {
  const v = (combatMod("swarm") as any).buildSwarmGroups;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function swarmGroupForEnemy(...args: any[]): SwarmGroup | undefined {
  const v = (combatMod("swarm") as any).swarmGroupForEnemy;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function getSwarmMaxHp(...args: any[]): any {
  const v = (combatMod("swarm") as any).getSwarmMaxHp;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function getSwarmMemberHp(...args: any[]): any {
  const v = (combatMod("swarm") as any).getSwarmMemberHp;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function getEffectiveEnemyMaxHp(...args: any[]): any {
  const v = (combatMod("swarm") as any).getEffectiveEnemyMaxHp;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function getEffectiveEnemyHp(...args: any[]): any {
  const v = (combatMod("swarm") as any).getEffectiveEnemyHp;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function splitHp(...args: any[]): any {
  const v = (combatMod("swarm") as any).splitHp;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function reconcileSwarmHp(...args: any[]): any {
  const v = (combatMod("swarm") as any).reconcileSwarmHp;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function getSwarmMovementRemaining(...args: any[]): any {
  const v = (combatMod("swarm") as any).getSwarmMovementRemaining;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function reconcileSwarmMovement(...args: any[]): any {
  const v = (combatMod("swarm") as any).reconcileSwarmMovement;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function spendSwarmMovement(...args: any[]): any {
  const v = (combatMod("swarm") as any).spendSwarmMovement;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function swarmTilePositions(...args: any[]): { x: number; y: number; id: string }[] {
  const v = (combatMod("swarm") as any).swarmTilePositions;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function swarmFringeTiles(...args: any[]): any {
  const v = (combatMod("swarm") as any).swarmFringeTiles;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function pickSwarmMoveMember(...args: any[]): any {
  const v = (combatMod("swarm") as any).pickSwarmMoveMember;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function canSwarmMemberReachDest(...args: any[]): any {
  const v = (combatMod("swarm") as any).canSwarmMemberReachDest;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateSwarmMemberMove(...args: any[]): any {
  const v = (combatMod("swarm") as any).validateSwarmMemberMove;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applySwarmMemberMove(...args: any[]): any {
  const v = (combatMod("swarm") as any).applySwarmMemberMove;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applySwarmMemberForcedMove(...args: any[]): any {
  const v = (combatMod("swarm") as any).applySwarmMemberForcedMove;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateSwarmMove(...args: any[]): any {
  const v = (combatMod("swarm") as any).validateSwarmMove;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applySwarmMove(...args: any[]): any {
  const v = (combatMod("swarm") as any).applySwarmMove;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function swarmCanonicalDisplayId(...args: any[]): any {
  const v = (combatMod("swarm") as any).swarmCanonicalDisplayId;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function exhaustSwarmMembers(...args: any[]): any {
  const v = (combatMod("swarm") as any).exhaustSwarmMembers;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function weaponHasBreakerTag(...args: any[]): any {
  const v = (combatMod("swarm") as any).weaponHasBreakerTag;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function swarmChipEligibleTargets(...args: any[]): any {
  const v = (combatMod("swarm") as any).swarmChipEligibleTargets;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function swarmChipResolved(...args: any[]): any {
  const v = (combatMod("swarm") as any).swarmChipResolved;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function swarmChipPromptRequired(...args: any[]): any {
  const v = (combatMod("swarm") as any).swarmChipPromptRequired;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function requireSwarmChipResolved(...args: any[]): any {
  const v = (combatMod("swarm") as any).requireSwarmChipResolved;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateSwarmChip(...args: any[]): any {
  const v = (combatMod("swarm") as any).validateSwarmChip;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function markSwarmChipResolved(...args: any[]): any {
  const v = (combatMod("swarm") as any).markSwarmChipResolved;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function countSwarmTilesAdjacentTo(...args: any[]): any {
  const v = (combatMod("swarm") as any).countSwarmTilesAdjacentTo;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function swarmEnemyStrikeCap(...args: any[]): any {
  const v = (combatMod("swarm") as any).swarmEnemyStrikeCap;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function maxSwarmStrikesAgainstTarget(...args: any[]): any {
  const v = (combatMod("swarm") as any).maxSwarmStrikesAgainstTarget;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function attackTargetsSwarm(...args: any[]): any {
  const v = (combatMod("swarm") as any).attackTargetsSwarm;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function dedupeSwarmTargetIds(...args: any[]): any {
  const v = (combatMod("swarm") as any).dedupeSwarmTargetIds;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function swarmMembersHitByTiles(...args: any[]): any {
  const v = (combatMod("swarm") as any).swarmMembersHitByTiles;
  if (typeof v !== "function") return v;
  return v(...args);
}


// --- yadathan ---

export function isYadathanArmorName(...args: any[]): any {
  const v = (combatMod("yadathan") as any).isYadathanArmorName;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function getPlayerYadathanTowerName(...args: any[]): any {
  const v = (combatMod("yadathan") as any).getPlayerYadathanTowerName;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function isValidYadathanTowerName(...args: any[]): any {
  const v = (combatMod("yadathan") as any).isValidYadathanTowerName;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function isTowerEnemy(...args: any[]): any {
  const v = (combatMod("yadathan") as any).isTowerEnemy;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function getPlayerTower(...args: any[]): any {
  const v = (combatMod("yadathan") as any).getPlayerTower;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function getHermndionTowers(...args: any[]): any {
  const v = (combatMod("yadathan") as any).getHermndionTowers;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function yadathanPlacementKeys(...args: any[]): any {
  const v = (combatMod("yadathan") as any).yadathanPlacementKeys;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function towerTeleportLandingKeys(...args: any[]): any {
  const v = (combatMod("yadathan") as any).towerTeleportLandingKeys;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function keraunoAdjacentEnemyIds(...args: any[]): any {
  const v = (combatMod("yadathan") as any).keraunoAdjacentEnemyIds;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validatePlaceTower(...args: any[]): any {
  const v = (combatMod("yadathan") as any).validatePlaceTower;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyPlaceTower(...args: any[]): any {
  const v = (combatMod("yadathan") as any).applyPlaceTower;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateTowerTeleport(...args: any[]): any {
  const v = (combatMod("yadathan") as any).validateTowerTeleport;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyTowerTeleport(...args: any[]): any {
  const v = (combatMod("yadathan") as any).applyTowerTeleport;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function enemyDistanceFrom(...args: any[]): any {
  const v = (combatMod("yadathan") as any).enemyDistanceFrom;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function enemiesInRangeOf(...args: any[]): any {
  const v = (combatMod("yadathan") as any).enemiesInRangeOf;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function resolveKataptyTargetIds(...args: any[]): any {
  const v = (combatMod("yadathan") as any).resolveKataptyTargetIds;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyKataptyStrike(...args: any[]): any {
  const v = (combatMod("yadathan") as any).applyKataptyStrike;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyHermndionAdjacentHaste(...args: any[]): any {
  const v = (combatMod("yadathan") as any).applyHermndionAdjacentHaste;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function findIatrosSeedTile(...args: any[]): any {
  const v = (combatMod("yadathan") as any).findIatrosSeedTile;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyIatrosSeed(...args: any[]): any {
  const v = (combatMod("yadathan") as any).applyIatrosSeed;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function getSeedAt(...args: any[]): any {
  const v = (combatMod("yadathan") as any).getSeedAt;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateSeedInteract(...args: any[]): any {
  const v = (combatMod("yadathan") as any).validateSeedInteract;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applySeedInteract(...args: any[]): any {
  const v = (combatMod("yadathan") as any).applySeedInteract;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function yadathanReversalEligible(...args: any[]): any {
  const v = (combatMod("yadathan") as any).yadathanReversalEligible;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function applyYadathanReversal(...args: any[]): any {
  const v = (combatMod("yadathan") as any).applyYadathanReversal;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function kataptyNeedsTargetPick(...args: any[]): any {
  const v = (combatMod("yadathan") as any).kataptyNeedsTargetPick;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function kataptyTargetKeys(...args: any[]): any {
  const v = (combatMod("yadathan") as any).kataptyTargetKeys;
  if (typeof v !== "function") return v;
  return v(...args);
}

export function validateKataptyEndTurn(...args: any[]): any {
  const v = (combatMod("yadathan") as any).validateKataptyEndTurn;
  if (typeof v !== "function") return v;
  return v(...args);
}


