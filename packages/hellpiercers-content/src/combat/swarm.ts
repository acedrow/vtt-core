import type { Enemy, GameState, Player } from "@gaem/shared";
import {
  getEnemyListingByName,
  getEnemyScale,
  getEnemySpeed,
  ensureEnemyMovement,
} from "@gaem/shared";
import {
  clampHp,
  getEnemyMaxHp,
  canGmMoveEnemies,
  isSandboxMode,
  validateEnemyFootprint,
  type BoardOccupancy,
  buildBoardOccupancy,
  occupancyBlockedByEnemy,
} from "@gaem/shared";
import { coordKey, isWalkable, tileAt } from "@gaem/shared";
import { getWeaponByName } from "@gaem/shared";
import { isOrthogonallyAdjacent } from "@gaem/shared";
import { enemyHasFlyingTag, syncUnitElevationOnTile } from "@gaem/shared";
import { enemyMoveStepCost } from "@gaem/shared";

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
  // sorted member ids -> effective size (members + linked flowers) before the change
  sizes: Map<string, number>;
};

function swarmMemberKey(memberIds: string[]): string {
  return [...memberIds].sort().join(",");
}

export function snapshotSwarmGroups(state: GameState): SwarmReconcileSnapshot {
  const groups = buildSwarmGroups(state);
  const sizes = new Map<string, number>();
  for (const ids of groups.values()) {
    sizes.set(swarmMemberKey(ids), effectiveSwarmSize(state, ids));
  }
  return { groups, sizes };
}

function resolveSwarmReconcilePrev(
  prev: Map<string, string[]> | SwarmReconcileSnapshot,
): { groups: Map<string, string[]>; sizes: Map<string, number> } {
  if (prev instanceof Map) return { groups: prev, sizes: new Map() };
  return prev;
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function enemyHasSwarmTrait(enemy: Pick<Enemy, "name">): boolean {
  const listing = getEnemyListingByName(enemy.name);
  return listing?.tags?.includes("Swarm") ?? false;
}

export function isStainFlower(enemy: Pick<Enemy, "name">): boolean {
  return enemy.name === "Stain Flower";
}

function stainFlowerAlive(enemy: Enemy): boolean {
  if (!isStainFlower(enemy)) return false;
  const max = getEnemyMaxHp(enemy);
  return (enemy.hp ?? max) > 0;
}

export function linkedStainFlowerIdsNear(
  state: GameState,
  positions: { x: number; y: number }[],
): string[] {
  if (!positions.length) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const flower of state.enemies) {
    if (!stainFlowerAlive(flower) || seen.has(flower.id)) continue;
    if (!positions.some((p) => tilesAdjacent(p, flower))) continue;
    seen.add(flower.id);
    ids.push(flower.id);
  }
  return ids;
}

export function linkedStainFlowerIds(state: GameState, memberIds: string[]): string[] {
  const members = memberIds
    .map((id) => state.enemies.find((e) => e.id === id))
    .filter(Boolean) as Enemy[];
  return linkedStainFlowerIdsNear(
    state,
    members.map((m) => ({ x: m.x, y: m.y })),
  );
}

function swarmEligible(enemy: Enemy): boolean {
  const max = getEnemyMaxHp(enemy);
  if ((enemy.hp ?? max) <= 0) return false;
  return enemyHasSwarmTrait(enemy) && getEnemyScale(enemy) <= 1;
}

function effectiveSwarmSize(state: GameState, memberIds: string[]): number {
  return memberIds.length + linkedStainFlowerIds(state, memberIds).length;
}

function enemiesShareSwarmName(a: Enemy, b: Enemy): boolean {
  return !!a.name && a.name === b.name;
}

function tilesAdjacent(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return isOrthogonallyAdjacent(a, b);
}

function findConnectedComponents(enemies: Enemy[]): string[][] {
  const byId = new Map(enemies.map((e) => [e.id, e]));
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const start of enemies) {
    if (visited.has(start.id)) continue;
    const stack = [start.id];
    const component: string[] = [];
    visited.add(start.id);
    while (stack.length) {
      const id = stack.pop()!;
      component.push(id);
      const current = byId.get(id)!;
      for (const other of enemies) {
        if (visited.has(other.id)) continue;
        if (!enemiesShareSwarmName(current, other)) continue;
        if (tilesAdjacent(current, other)) {
          visited.add(other.id);
          stack.push(other.id);
        }
      }
    }
    components.push(component);
  }
  return components;
}

export function buildSwarmGroups(state: GameState): Map<string, string[]> {
  const eligible = state.enemies.filter(swarmEligible);
  const components = findConnectedComponents(eligible);
  const map = new Map<string, string[]>();
  for (const ids of components) {
    if (ids.length < 2 && effectiveSwarmSize(state, ids) < 2) continue;
    const canonicalId = [...ids].sort()[0]!;
    map.set(canonicalId, ids);
  }
  return map;
}

function groupForEnemyId(groups: Map<string, string[]>, enemyId: string): string[] | null {
  for (const ids of groups.values()) {
    if (ids.includes(enemyId)) return ids;
  }
  return null;
}

export function swarmGroupForEnemy(
  state: GameState,
  enemyId: string,
  groups?: Map<string, string[]>,
): SwarmGroup | null {
  const resolvedGroups = groups ?? buildSwarmGroups(state);
  const memberIds = groupForEnemyId(resolvedGroups, enemyId);
  if (!memberIds) return null;
  const linkedFlowerIds = linkedStainFlowerIds(state, memberIds);
  const size = memberIds.length + linkedFlowerIds.length;
  if (size < 2) return null;
  const canonicalId = [...memberIds].sort()[0]!;
  const first = state.enemies.find((e) => e.id === memberIds[0])!;
  const currentHp = first.hp ?? getEnemyMaxHp(first);
  return {
    canonicalId,
    memberIds,
    linkedFlowerIds,
    size,
    currentHp,
    maxHp: getSwarmMaxHp(size),
  };
}

export function getSwarmMaxHp(size: number): number {
  return size * 10;
}

export function getSwarmMemberHp(totalHp: number, size: number): number {
  return Math.max(1, Math.floor(totalHp / size));
}

export function getEffectiveEnemyMaxHp(enemy: Enemy, state: GameState): number {
  const group = swarmGroupForEnemy(state, enemy.id);
  if (group) return group.maxHp;
  return getEnemyMaxHp(enemy);
}

export function getEffectiveEnemyHp(enemy: Enemy, state: GameState): number {
  const max = getEffectiveEnemyMaxHp(enemy, state);
  return enemy.hp ?? max;
}

function soloJoinContribution(enemy: Enemy): number {
  const soloMax = getEnemyMaxHp(enemy);
  const current = enemy.hp ?? soloMax;
  if (current >= soloMax) return getSwarmMaxHp(1);
  return current;
}

export function splitHp(totalHp: number, sizes: number[]): number[] {
  if (!sizes.length) return [];
  const base = Math.floor(totalHp / sizes.length);
  const shares = sizes.map(() => base);
  let remainder = totalHp - base * sizes.length;
  const order = sizes.map((_, i) => i).sort((a, b) => sizes[b]! - sizes[a]! || a - b);
  let ri = 0;
  while (remainder > 0) {
    shares[order[ri % order.length]!]! += 1;
    remainder -= 1;
    ri += 1;
  }
  return shares.map((share, i) => Math.min(getSwarmMaxHp(sizes[i]!), share));
}

function mergeHp(members: Enemy[], prevGroups: Map<string, string[]>): number {
  const seenGroupKeys = new Set<string>();
  let total = 0;
  for (const member of members) {
    const prevIds = groupForEnemyId(prevGroups, member.id);
    if (prevIds) {
      const key = [...prevIds].sort().join(",");
      if (!seenGroupKeys.has(key)) {
        seenGroupKeys.add(key);
        total += member.hp ?? getEnemyMaxHp(member);
      }
    } else {
      total += soloJoinContribution(member);
    }
  }
  return total;
}

function applyPooledHpToMembers(members: Enemy[], hp: number): void {
  for (const member of members) member.hp = hp;
}

export function reconcileSwarmHp(
  state: GameState,
  prev: Map<string, string[]> | SwarmReconcileSnapshot = new Map(),
): void {
  const { groups: prevGroups, sizes: prevSizes } = resolveSwarmReconcilePrev(prev);
  const eligible = state.enemies.filter(swarmEligible);
  const components = findConnectedComponents(eligible);
  const splitMemberIds = new Set<string>();

  for (const prevIds of prevGroups.values()) {
    const remaining = prevIds.filter((id) => {
      const e = state.enemies.find((en) => en.id === id);
      if (!e) return false;
      const max = getEnemyMaxHp(e);
      return (e.hp ?? max) > 0;
    });
    if (remaining.length < 2) continue;
    const subs = findConnectedComponents(
      remaining.map((id) => state.enemies.find((e) => e.id === id)!).filter(Boolean),
    );
    if (subs.length <= 1) continue;
    const sharedHp = state.enemies.find((e) => e.id === remaining[0])?.hp ?? 0;
    const sizes = subs.map((s) => effectiveSwarmSize(state, s));
    const split = splitHp(sharedHp, sizes);
    for (let i = 0; i < subs.length; i++) {
      for (const id of subs[i]!) {
        const enemy = state.enemies.find((e) => e.id === id);
        if (enemy) enemy.hp = split[i]!;
        splitMemberIds.add(id);
      }
    }
  }

  for (const ids of components) {
    const size = effectiveSwarmSize(state, ids);
    if (size < 2) {
      for (const id of ids) {
        if (splitMemberIds.has(id)) continue;
        const enemy = state.enemies.find((e) => e.id === id);
        if (!enemy) continue;
        const max = getEnemyMaxHp(enemy);
        enemy.hp = clampHp(enemy.hp ?? max, max);
      }
      continue;
    }

    const members = ids.map((id) => state.enemies.find((e) => e.id === id)!).filter(Boolean);
    const maxHp = getSwarmMaxHp(size);
    const prevIds = groupForEnemyId(prevGroups, ids[0]!);
    const unchanged =
      prevIds &&
      prevIds.length === ids.length &&
      ids.every((id) => prevIds.includes(id));

    if (unchanged) {
      const prevSize = prevSizes.get(swarmMemberKey(ids)) ?? size;
      const prevMax = getSwarmMaxHp(prevSize);
      let hp = members[0]!.hp ?? prevMax;
      hp += maxHp - prevMax;
      applyPooledHpToMembers(members, clampHp(hp, maxHp));
      continue;
    }

    if (ids.every((id) => splitMemberIds.has(id))) {
      const hp = clampHp(members[0]!.hp ?? maxHp, maxHp);
      applyPooledHpToMembers(members, hp);
      continue;
    }

    let merged = mergeHp(members, prevGroups);
    const flowerCount = size - ids.length;
    let prevFlowerSlots = 0;
    const seenPrev = new Set<string>();
    for (const member of members) {
      const memberPrevIds = groupForEnemyId(prevGroups, member.id);
      if (!memberPrevIds) continue;
      const key = swarmMemberKey(memberPrevIds);
      if (seenPrev.has(key)) continue;
      seenPrev.add(key);
      const prevEff = prevSizes.get(key) ?? memberPrevIds.length;
      prevFlowerSlots += Math.max(0, prevEff - memberPrevIds.length);
    }
    const newFlowers = Math.max(0, flowerCount - prevFlowerSlots);
    if (newFlowers > 0) merged += getSwarmMaxHp(newFlowers);
    const currentHp = clampHp(Math.min(maxHp, merged), maxHp);
    applyPooledHpToMembers(members, currentHp);
  }

  reconcileSwarmMovement(state);
}

function swarmMembers(state: GameState, memberIds: string[]): Enemy[] {
  return memberIds.map((id) => state.enemies.find((e) => e.id === id)).filter(Boolean) as Enemy[];
}

export function getSwarmMovementRemaining(state: GameState, memberIds: string[]): number {
  const members = swarmMembers(state, memberIds);
  if (!members.length) return 0;
  let min = Infinity;
  for (const member of members) {
    ensureEnemyMovement(member);
    min = Math.min(min, member.movementRemaining ?? getEnemySpeed(member));
  }
  return min === Infinity ? 0 : min;
}

export function reconcileSwarmMovement(state: GameState): void {
  for (const memberIds of buildSwarmGroups(state).values()) {
    const members = swarmMembers(state, memberIds);
    if (members.length < 2) continue;
    const speed = getEnemySpeed(members[0]!);
    let minRemaining = speed;
    for (const member of members) {
      ensureEnemyMovement(member);
      minRemaining = Math.min(minRemaining, member.movementRemaining ?? speed);
    }
    for (const member of members) {
      member.speed = speed;
      member.movementRemaining = minRemaining;
    }
  }
}

export function spendSwarmMovement(state: GameState, memberIds: string[], cost: number): boolean {
  const members = swarmMembers(state, memberIds);
  if (!members.length) return false;
  reconcileSwarmMovement(state);
  const remaining = members[0]!.movementRemaining ?? 0;
  if (remaining < cost) return false;
  const next = remaining - cost;
  for (const member of members) {
    member.movementRemaining = next;
  }
  return true;
}

function swarmMemberPositions(state: GameState, memberIds: string[]): { x: number; y: number; id: string }[] {
  return memberIds
    .map((id) => {
      const e = state.enemies.find((en) => en.id === id);
      return e ? { x: e.x, y: e.y, id: e.id } : null;
    })
    .filter(Boolean) as { x: number; y: number; id: string }[];
}

export function swarmTilePositions(
  state: GameState,
  memberIds: string[],
): { x: number; y: number; id: string }[] {
  const flowerIds = linkedStainFlowerIds(state, memberIds);
  return [...swarmMemberPositions(state, memberIds), ...swarmMemberPositions(state, flowerIds)];
}

function isSwarmConnected(positions: { x: number; y: number }[]): boolean {
  if (positions.length <= 1) return true;
  const visited = new Set<string>();
  const stack = [positions[0]!];
  visited.add(coordKey(positions[0]!.x, positions[0]!.y));
  while (stack.length) {
    const cur = stack.pop()!;
    for (const other of positions) {
      const key = coordKey(other.x, other.y);
      if (visited.has(key)) continue;
      if (tilesAdjacent(cur, other)) {
        visited.add(key);
        stack.push(other);
      }
    }
  }
  return visited.size === positions.length;
}

export function swarmFringeTiles(
  state: GameState,
  memberIds: string[],
  occupancy?: BoardOccupancy,
): { x: number; y: number }[] {
  const occ = occupancy ?? buildBoardOccupancy(state);
  const positions = swarmMemberPositions(state, memberIds);
  const first = memberIds.length > 0 ? state.enemies.find((e) => e.id === memberIds[0]) : undefined;
  const flying = first != null && enemyHasFlyingTag(first);
  const fringe: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  const deltas = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  for (const pos of positions) {
    for (const { dx, dy } of deltas) {
      const x = pos.x + dx;
      const y = pos.y + dy;
      const key = coordKey(x, y);
      if (seen.has(key)) continue;
      if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
      if (occupancyBlockedByEnemy(occ, x, y) || occ.playerByKey.has(key)) continue;
      const tile = tileAt(state.tiles, x, y);
      if (!flying && (!tile || !isWalkable(tile))) continue;
      seen.add(key);
      fringe.push({ x, y });
    }
  }
  return fringe;
}

export function pickSwarmMoveMember(
  state: GameState,
  memberIds: string[],
  destX: number,
  destY: number,
): string | null {
  const positions = swarmMemberPositions(state, memberIds);
  let best: { id: string; dist: number } | null = null;
  for (const pos of positions) {
    const remaining = positions.filter((p) => p.id !== pos.id);
    const afterMove = [...remaining.map((p) => ({ x: p.x, y: p.y })), { x: destX, y: destY }];
    if (!isSwarmConnected(afterMove)) continue;
    const dist = manhattan(pos, { x: destX, y: destY });
    if (!best || dist > best.dist) best = { id: pos.id, dist };
  }
  return best?.id ?? null;
}

export function canSwarmMemberReachDest(
  state: GameState,
  memberId: string,
  destX: number,
  destY: number,
  occupancy?: BoardOccupancy,
): boolean {
  const group = swarmGroupForEnemy(state, memberId);
  if (!group) return false;
  const member = state.enemies.find((e) => e.id === memberId);
  if (!member) return false;
  if (validateEnemyFootprint(state, destX, destY, getEnemyScale(member), memberId, occupancy, member) !== null) {
    return false;
  }
  const remaining = group.memberIds.filter((id) => id !== memberId);
  const afterMove = [
    ...swarmMemberPositions(state, remaining).map((p) => ({ x: p.x, y: p.y })),
    { x: destX, y: destY },
  ];
  if (remaining.length === 0) return true;
  if (isSwarmConnected(afterMove)) return true;
  return isOrthogonallyAdjacent({ x: member.x, y: member.y }, { x: destX, y: destY });
}

export function validateSwarmMemberMove(
  state: GameState,
  memberId: string,
  destX: number,
  destY: number,
  occupancy?: BoardOccupancy,
): string | null {
  const group = swarmGroupForEnemy(state, memberId);
  if (!group) return "Not in a swarm";

  if (!canGmMoveEnemies(state)) return "Not GM turn";

  const member = state.enemies.find((e) => e.id === memberId);
  if (!member) return "Unknown enemy";
  if (!isSandboxMode(state) && member.exhausted) return "Enemy has ended turn";

  const chipErr = requireSwarmChipResolved(state, memberId);
  if (chipErr) return chipErr;

  if (!canSwarmMemberReachDest(state, memberId, destX, destY, occupancy)) {
    return "Invalid destination";
  }

  if (!isSandboxMode(state)) {
    const cost = enemyMoveStepCost(state, member, member.x, member.y, destX, destY, { swarm: true });
    if (getSwarmMovementRemaining(state, group.memberIds) < cost) return "Not enough movement";
  }

  return null;
}

function markSilentHpEnemyIds(state: GameState, enemyIds: string[]): void {
  if (!enemyIds.length) return;
  if (!state.silentHpEnemyIds) state.silentHpEnemyIds = [];
  for (const id of enemyIds) {
    if (!state.silentHpEnemyIds.includes(id)) state.silentHpEnemyIds.push(id);
  }
}

export function applySwarmMemberMove(
  state: GameState,
  memberId: string,
  destX: number,
  destY: number,
): void {
  const member = state.enemies.find((e) => e.id === memberId);
  const group = swarmGroupForEnemy(state, memberId);
  const cost =
    member && group
      ? enemyMoveStepCost(state, member, member.x, member.y, destX, destY, { swarm: true })
      : 1;
  applySwarmMemberForcedMove(state, memberId, destX, destY);
  if (group && !isSandboxMode(state)) spendSwarmMovement(state, group.memberIds, cost);
}

export function applySwarmMemberForcedMove(
  state: GameState,
  memberId: string,
  destX: number,
  destY: number,
): void {
  const prev = snapshotSwarmGroups(state);
  const group = swarmGroupForEnemy(state, memberId);
  if (!group) return;
  const member = state.enemies.find((e) => e.id === memberId);
  if (!member) return;
  const prevMemberIds = [...group.memberIds];
  member.x = destX;
  member.y = destY;
  syncUnitElevationOnTile(state, member, destX, destY);
  reconcileSwarmHp(state, prev);
  markSilentHpEnemyIds(state, prevMemberIds);
}

export function validateSwarmMove(
  state: GameState,
  anchorEnemyId: string,
  destX: number,
  destY: number,
): string | null {
  const group = swarmGroupForEnemy(state, anchorEnemyId);
  if (!group) return "Not in a swarm";

  if (!canGmMoveEnemies(state)) return "Not GM turn";

  const anchor = state.enemies.find((e) => e.id === anchorEnemyId);
  if (!anchor) return "Unknown enemy";
  if (!isSandboxMode(state) && anchor.exhausted) return "Enemy has ended turn";

  const fringe = swarmFringeTiles(state, group.memberIds);
  if (!fringe.some((t) => t.x === destX && t.y === destY)) {
    return "Destination must be adjacent to the swarm";
  }

  const moverId = pickSwarmMoveMember(state, group.memberIds, destX, destY);
  if (!moverId) return "No valid swarm limb can reach that tile";

  const mover = state.enemies.find((e) => e.id === moverId)!;
  if (!isSandboxMode(state)) {
    const cost = enemyMoveStepCost(state, mover, mover.x, mover.y, destX, destY, { swarm: true });
    if (getSwarmMovementRemaining(state, group.memberIds) < cost) return "Not enough movement";
  }

  return validateEnemyFootprint(state, destX, destY, getEnemyScale(mover), moverId, undefined, mover);
}

export function applySwarmMove(
  state: GameState,
  anchorEnemyId: string,
  destX: number,
  destY: number,
): string | null {
  const prev = snapshotSwarmGroups(state);
  const group = swarmGroupForEnemy(state, anchorEnemyId);
  if (!group) return null;

  const moverId = pickSwarmMoveMember(state, group.memberIds, destX, destY);
  if (!moverId) return null;

  const mover = state.enemies.find((e) => e.id === moverId)!;
  if (!isSandboxMode(state)) {
    const cost = enemyMoveStepCost(state, mover, mover.x, mover.y, destX, destY, { swarm: true });
    spendSwarmMovement(state, group.memberIds, cost);
  }
  mover.x = destX;
  mover.y = destY;
  reconcileSwarmHp(state, prev);
  return moverId;
}

export function swarmCanonicalDisplayId(state: GameState, memberIds: string[]): string {
  const members = memberIds
    .map((id) => state.enemies.find((e) => e.id === id))
    .filter(Boolean) as Enemy[];
  members.sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
  return members[0]?.id ?? memberIds[0]!;
}

export function exhaustSwarmMembers(state: GameState, enemyId: string): void {
  const group = swarmGroupForEnemy(state, enemyId);
  const ids = group?.memberIds ?? [enemyId];
  for (const id of ids) {
    const enemy = state.enemies.find((e) => e.id === id);
    if (enemy) enemy.exhausted = true;
  }
}

function abilityTextToString(text: unknown): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  if (typeof text === "object" && text !== null) {
    const obj = text as { intro?: string; bullets?: string[] };
    return [obj.intro ?? "", ...(obj.bullets ?? [])].join(" ");
  }
  return String(text);
}

export function weaponHasBreakerTag(
  player: Pick<Player, "weapon" | "counters">,
  weaponName?: string,
  attackHasBreaker?: boolean,
): boolean {
  if (attackHasBreaker) return true;
  const name = weaponName ?? player.weapon;
  if (!name) return false;
  const weapon = getWeaponByName(name);
  if (!weapon) return false;
  const text = abilityTextToString(weapon.passiveAbility);
  if (text.includes("Breaker tag")) return true;
  const activeText = abilityTextToString(weapon.activeAbility);
  return activeText.includes("Breaker tag");
}

export type SwarmChipTarget = { kind: "player"; id: string; label: string };

export function swarmChipEligibleTargets(state: GameState, enemyId: string): SwarmChipTarget[] {
  const group = swarmGroupForEnemy(state, enemyId);
  const positions = group
    ? swarmTilePositions(state, group.memberIds)
    : swarmMemberPositions(state, [enemyId]);
  const occ = buildBoardOccupancy(state);
  const seen = new Set<string>();
  const targets: SwarmChipTarget[] = [];
  const deltas = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];

  for (const pos of positions) {
    for (const { dx, dy } of deltas) {
      const x = pos.x + dx;
      const y = pos.y + dy;
      const key = coordKey(x, y);
      if (seen.has(key)) continue;
      const player = occ.playerByKey.get(key);
      if (!player) continue;
      seen.add(key);
      targets.push({ kind: "player", id: player.id, label: player.nickname ?? player.id });
    }
  }
  return targets;
}

export function swarmChipResolved(state: GameState, enemyId: string): boolean {
  const group = swarmGroupForEnemy(state, enemyId);
  if (!group) return true;
  return state.combat?.swarmChipResolvedIds?.includes(group.canonicalId) ?? false;
}

function swarmHasMovedOrActedThisPhase(state: GameState, group: SwarmGroup): boolean {
  const members = swarmMembers(state, group.memberIds);
  if (!members.length) return false;
  if (members.some((m) => m.exhausted)) return true;
  const speed = getEnemySpeed(members[0]!);
  return getSwarmMovementRemaining(state, group.memberIds) < speed;
}

export function swarmChipPromptRequired(state: GameState, enemyId: string): boolean {
  const group = swarmGroupForEnemy(state, enemyId);
  if (!group || group.size < 2) return false;
  if (swarmChipResolved(state, enemyId)) return false;
  if (swarmHasMovedOrActedThisPhase(state, group)) return false;
  return swarmChipEligibleTargets(state, enemyId).length > 0;
}

export function requireSwarmChipResolved(state: GameState, enemyId: string): string | null {
  if (!swarmChipPromptRequired(state, enemyId)) return null;
  return "Apply swarm chip damage first";
}

export function validateSwarmChip(
  state: GameState,
  enemyId: string,
  targetPlayerIds: string[],
): string | null {
  if (!canGmMoveEnemies(state)) return "Not GM turn";
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy) return "Unknown enemy";
  const group = swarmGroupForEnemy(state, enemyId);
  if (!group) return "Not a swarm";
  if (!isSandboxMode(state) && enemy.exhausted) return "Enemy has ended turn";

  const eligiblePlayers = new Set(swarmChipEligibleTargets(state, enemyId).map((t) => t.id));
  for (const id of targetPlayerIds) {
    if (!eligiblePlayers.has(id)) return "Invalid chip target";
  }
  return null;
}

export function markSwarmChipResolved(state: GameState, enemyId: string): void {
  const group = swarmGroupForEnemy(state, enemyId);
  if (!group || !state.combat) return;
  if (!state.combat.swarmChipResolvedIds) state.combat.swarmChipResolvedIds = [];
  if (!state.combat.swarmChipResolvedIds.includes(group.canonicalId)) {
    state.combat.swarmChipResolvedIds.push(group.canonicalId);
  }
}

export function countSwarmTilesAdjacentTo(
  state: GameState,
  memberIds: string[],
  target: { x: number; y: number },
): number {
  let count = 0;
  for (const pos of swarmTilePositions(state, memberIds)) {
    if (isOrthogonallyAdjacent(pos, target)) count += 1;
  }
  return count;
}

export function swarmEnemyStrikeCap(targetScale: number): number {
  return targetScale >= 2 ? 12 : 4;
}

export function maxSwarmStrikesAgainstTarget(
  state: GameState,
  enemyId: string,
  target: { x: number; y: number },
  targetScale = 1,
): number {
  const group = swarmGroupForEnemy(state, enemyId);
  const memberIds = group?.memberIds ?? [enemyId];
  const adjacent = countSwarmTilesAdjacentTo(state, memberIds, target);
  return Math.min(adjacent, swarmEnemyStrikeCap(targetScale));
}

export function attackTargetsSwarm(
  state: GameState,
  tiles: { x: number; y: number }[],
): boolean {
  const occ = buildBoardOccupancy(state);
  for (const tile of tiles) {
    for (const enemy of occ.enemiesByKey.get(coordKey(tile.x, tile.y)) ?? []) {
      if (swarmGroupForEnemy(state, enemy.id)) return true;
    }
  }
  return false;
}

export function dedupeSwarmTargetIds(state: GameState, enemyIds: string[]): string[] {
  const seenGroups = new Set<string>();
  const result: string[] = [];
  for (const id of enemyIds) {
    const group = swarmGroupForEnemy(state, id);
    if (group) {
      const key = [...group.memberIds].sort().join(",");
      if (seenGroups.has(key)) continue;
      seenGroups.add(key);
      result.push(group.canonicalId);
    } else {
      result.push(id);
    }
  }
  return result;
}

export function swarmMembersHitByTiles(
  state: GameState,
  tiles: { x: number; y: number }[],
): { enemyId: string; x: number; y: number }[] {
  const occ = buildBoardOccupancy(state);
  const hits: { enemyId: string; x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const tile of tiles) {
    for (const enemy of occ.enemiesByKey.get(coordKey(tile.x, tile.y)) ?? []) {
      if (seen.has(enemy.id)) continue;
      if (!swarmGroupForEnemy(state, enemy.id)) continue;
      seen.add(enemy.id);
      hits.push({ enemyId: enemy.id, x: tile.x, y: tile.y });
    }
  }
  return hits;
}
