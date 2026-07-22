import type { BoardOccupancy } from "../game.js";
import type { Enemy, GameState, Player } from "../types.js";
import { combatMod } from "../combat-modules.js";

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

type SwarmModule = {
  snapshotSwarmGroups: (state: GameState) => SwarmReconcileSnapshot;
  reconcileSwarmHp: (
    state: GameState,
    prev?: Map<string, string[]> | SwarmReconcileSnapshot,
  ) => void;
  swarmGroupForEnemy: (
    state: GameState,
    enemyId: string,
    groups?: Map<string, string[]>,
  ) => SwarmGroup | null;
  swarmCanonicalDisplayId: (state: GameState, memberIds: string[]) => string;
  validateSwarmMove: (
    state: GameState,
    anchorEnemyId: string,
    destX: number,
    destY: number,
  ) => string | null;
  applySwarmMove: (
    state: GameState,
    anchorEnemyId: string,
    destX: number,
    destY: number,
  ) => string | null;
  validateSwarmMemberMove: (
    state: GameState,
    memberId: string,
    destX: number,
    destY: number,
    occupancy?: BoardOccupancy,
  ) => string | null;
  applySwarmMemberMove: (
    state: GameState,
    memberId: string,
    destX: number,
    destY: number,
  ) => void;
  enemyHasSwarmTrait: (enemy: Pick<Enemy, "name">) => boolean;
  getEffectiveEnemyMaxHp: (enemy: Enemy, state: GameState) => number;
  requireSwarmChipResolved: (state: GameState, enemyId: string) => string | null;
  applySwarmMemberForcedMove: (
    state: GameState,
    memberId: string,
    destX: number,
    destY: number,
  ) => void;
  linkedStainFlowerIdsNear: (
    state: GameState,
    positions: { x: number; y: number }[],
  ) => string[];
  pickSwarmMoveMember: (
    state: GameState,
    memberIds: string[],
    destX: number,
    destY: number,
  ) => string | null;
  swarmTilePositions: (
    state: GameState,
    memberIds: string[],
  ) => { x: number; y: number; id: string }[];
  reconcileSwarmMovement: (state: GameState) => void;
  countSwarmTilesAdjacentTo: (
    state: GameState,
    memberIds: string[],
    target: { x: number; y: number },
  ) => number;
  getSwarmMemberHp: (totalHp: number, size: number) => number;
  swarmEnemyStrikeCap: (targetScale: number) => number;
  swarmMembersHitByTiles: (
    state: GameState,
    tiles: { x: number; y: number }[],
  ) => { enemyId: string; x: number; y: number }[];
  weaponHasBreakerTag: (
    player: Pick<Player, "weapon"> & Partial<Pick<Player, "counters">>,
    weaponName?: string,
    attackHasBreaker?: boolean,
  ) => boolean;
  dedupeSwarmTargetIds: (state: GameState, enemyIds: string[]) => string[];
  exhaustSwarmMembers: (state: GameState, enemyId: string) => void;
  markSwarmChipResolved: (state: GameState, enemyId: string) => void;
  maxSwarmStrikesAgainstTarget: (
    state: GameState,
    enemyId: string,
    target: { x: number; y: number },
    targetScale?: number,
  ) => number;
  validateSwarmChip: (
    state: GameState,
    enemyId: string,
    targetPlayerIds: string[],
  ) => string | null;
};

function swarm(): SwarmModule {
  return combatMod("swarm") as SwarmModule;
}

export function snapshotSwarmGroups(state: GameState): SwarmReconcileSnapshot {
  return swarm().snapshotSwarmGroups(state);
}

export function reconcileSwarmHp(
  state: GameState,
  prev?: Map<string, string[]> | SwarmReconcileSnapshot,
): void {
  swarm().reconcileSwarmHp(state, prev);
}

export function swarmGroupForEnemy(
  state: GameState,
  enemyId: string,
  groups?: Map<string, string[]>,
): SwarmGroup | null {
  return swarm().swarmGroupForEnemy(state, enemyId, groups);
}

export function swarmCanonicalDisplayId(state: GameState, memberIds: string[]): string {
  return swarm().swarmCanonicalDisplayId(state, memberIds);
}

export function validateSwarmMove(
  state: GameState,
  anchorEnemyId: string,
  destX: number,
  destY: number,
): string | null {
  return swarm().validateSwarmMove(state, anchorEnemyId, destX, destY);
}

export function applySwarmMove(
  state: GameState,
  anchorEnemyId: string,
  destX: number,
  destY: number,
): string | null {
  return swarm().applySwarmMove(state, anchorEnemyId, destX, destY);
}

export function validateSwarmMemberMove(
  state: GameState,
  memberId: string,
  destX: number,
  destY: number,
  occupancy?: BoardOccupancy,
): string | null {
  return swarm().validateSwarmMemberMove(state, memberId, destX, destY, occupancy);
}

export function applySwarmMemberMove(
  state: GameState,
  memberId: string,
  destX: number,
  destY: number,
): void {
  swarm().applySwarmMemberMove(state, memberId, destX, destY);
}

export function enemyHasSwarmTrait(enemy: Pick<Enemy, "name">): boolean {
  return swarm().enemyHasSwarmTrait(enemy);
}

export function getEffectiveEnemyMaxHp(enemy: Enemy, state: GameState): number {
  return swarm().getEffectiveEnemyMaxHp(enemy, state);
}

export function requireSwarmChipResolved(state: GameState, enemyId: string): string | null {
  return swarm().requireSwarmChipResolved(state, enemyId);
}

export function applySwarmMemberForcedMove(
  state: GameState,
  memberId: string,
  destX: number,
  destY: number,
): void {
  swarm().applySwarmMemberForcedMove(state, memberId, destX, destY);
}

export function linkedStainFlowerIdsNear(
  state: GameState,
  positions: { x: number; y: number }[],
): string[] {
  return swarm().linkedStainFlowerIdsNear(state, positions);
}

export function pickSwarmMoveMember(
  state: GameState,
  memberIds: string[],
  destX: number,
  destY: number,
): string | null {
  return swarm().pickSwarmMoveMember(state, memberIds, destX, destY);
}

export function swarmTilePositions(
  state: GameState,
  memberIds: string[],
): { x: number; y: number; id: string }[] {
  return swarm().swarmTilePositions(state, memberIds);
}

export function reconcileSwarmMovement(state: GameState): void {
  swarm().reconcileSwarmMovement(state);
}

export function countSwarmTilesAdjacentTo(
  state: GameState,
  memberIds: string[],
  target: { x: number; y: number },
): number {
  return swarm().countSwarmTilesAdjacentTo(state, memberIds, target);
}

export function getSwarmMemberHp(totalHp: number, size: number): number {
  return swarm().getSwarmMemberHp(totalHp, size);
}

export function swarmEnemyStrikeCap(targetScale: number): number {
  return swarm().swarmEnemyStrikeCap(targetScale);
}

export function swarmMembersHitByTiles(
  state: GameState,
  tiles: { x: number; y: number }[],
): { enemyId: string; x: number; y: number }[] {
  return swarm().swarmMembersHitByTiles(state, tiles);
}

export function weaponHasBreakerTag(
  player: Pick<Player, "weapon"> & Partial<Pick<Player, "counters">>,
  weaponName?: string,
  attackHasBreaker?: boolean,
): boolean {
  return swarm().weaponHasBreakerTag(player, weaponName, attackHasBreaker);
}

export function dedupeSwarmTargetIds(state: GameState, enemyIds: string[]): string[] {
  return swarm().dedupeSwarmTargetIds(state, enemyIds);
}

export function exhaustSwarmMembers(state: GameState, enemyId: string): void {
  swarm().exhaustSwarmMembers(state, enemyId);
}

export function markSwarmChipResolved(state: GameState, enemyId: string): void {
  swarm().markSwarmChipResolved(state, enemyId);
}

export function maxSwarmStrikesAgainstTarget(
  state: GameState,
  enemyId: string,
  target: { x: number; y: number },
  targetScale?: number,
): number {
  return swarm().maxSwarmStrikesAgainstTarget(state, enemyId, target, targetScale);
}

export function validateSwarmChip(
  state: GameState,
  enemyId: string,
  targetPlayerIds: string[],
): string | null {
  return swarm().validateSwarmChip(state, enemyId, targetPlayerIds);
}
