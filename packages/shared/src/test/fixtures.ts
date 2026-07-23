import type { Enemy, GameState, MapTile, Player } from "../types.js";
import { createDefaultActionBudget } from "../combat/types.js";
import { defaultPartyResourcesFromPack } from "../campaign-registry.js";
import { coordKey } from "../map.js";
import { defaultOverworldParty, defaultOverworldRegions } from "../campaign-hooks.js";

export function makeTiles(
  width: number,
  height: number,
  blocked: Set<string> = new Set(),
): MapTile[] {
  const tiles: MapTile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({
        x,
        y,
        terrain: blocked.has(coordKey(x, y)) ? ["impassable"] : ["standard"],
        elevation: 0,
      });
    }
  }
  return tiles;
}

export function makeGameState(overrides: Partial<GameState> = {}): GameState {
  const width = overrides.width ?? 8;
  const height = overrides.height ?? 8;
  const campaign = {
    partyResources: defaultPartyResourcesFromPack(),
    unlockedUpgrades: [] as string[],
    mapRegions: defaultOverworldRegions(),
    mapParty: defaultOverworldParty(),
    ...overrides.campaign,
  };
  return {
    mapId: "test",
    mapName: "Test",
    width,
    height,
    tiles: overrides.tiles ?? makeTiles(width, height),
    players: [],
    enemies: [],
    round: 1,
    roundPhase: "taccomNotStarted",
    turn: { role: "gm" },
    actedPlayerIds: [],
    turnLog: [],
    sandboxMode: false,
    ...overrides,
    campaign,
  };
}

export function addTestPlayer(
  state: GameState,
  id: string,
  opts: {
    x?: number;
    y?: number;
    speed?: number;
    hp?: number;
    armor?: string;
    class?: string;
    weapon?: string;
    weapon2?: string;
    gear?: string;
    gearArmor?: string;
    equipmentUses?: number;
    actionBudget?: boolean;
    effects?: Player["effects"];
  } = {},
): Player {
  const player: Player = {
    id,
    x: opts.x ?? 2,
    y: opts.y ?? 2,
    speed: opts.speed ?? 5,
    hp: opts.hp ?? 10,
    ...(opts.armor !== undefined ? { armor: opts.armor } : {}),
    ...(opts.class !== undefined ? { class: opts.class } : {}),
    ...(opts.weapon !== undefined ? { weapon: opts.weapon } : {}),
    ...(opts.weapon2 !== undefined ? { weapon2: opts.weapon2 } : {}),
    ...(opts.gear !== undefined ? { gear: opts.gear } : {}),
    ...(opts.gearArmor !== undefined ? { gearArmor: opts.gearArmor } : {}),
    ...(opts.equipmentUses !== undefined ? { equipmentUses: opts.equipmentUses } : {}),
    ...(opts.effects !== undefined ? { effects: opts.effects } : {}),
  };
  if (opts.actionBudget !== false) {
    player.actionBudget = createDefaultActionBudget(player.speed!);
    player.turnStartX = player.x;
    player.turnStartY = player.y;
  }
  state.players.push(player);
  return player;
}

export function addTestEnemy(
  state: GameState,
  id: string,
  x: number,
  y: number,
  opts: { name?: string; scale?: number; hp?: number; effects?: Enemy["effects"] } = {},
): Enemy {
  const enemy: Enemy = {
    id,
    x,
    y,
    ...(opts.name !== undefined ? { name: opts.name } : {}),
    ...(opts.scale !== undefined ? { scale: opts.scale } : {}),
    ...(opts.hp !== undefined ? { hp: opts.hp } : {}),
    ...(opts.effects !== undefined ? { effects: opts.effects } : {}),
  };
  state.enemies.push(enemy);
  return enemy;
}

export function gmCtx() {
  return { role: "gm" as const, playerId: null };
}

export function playerCtx(playerId: string) {
  return { role: "player" as const, playerId };
}
