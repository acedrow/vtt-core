import type { PatternDirection } from "../pattern-data.js";
import type { Enemy, GameState, Player } from "../types.js";
import { combatMod } from "../combat-modules.js";
import type { PlayerAction, WeaponAttackSpec } from "./types.js";

type UseEquipmentAction = Extract<PlayerAction, { action: "useEquipment" }>;

type EquipmentModule = {
  isHylicAnnihilationCorridor: (name: string | undefined | null) => boolean;
  isHylicRejectionField: (name: string | undefined | null) => boolean;
  isThoughtGuidingRedirectionCircuits: (name: string | undefined | null) => boolean;
  isTransientForceProjection: (name: string | undefined | null) => boolean;
  equipmentRequiresBoardPlacement: (name: string | undefined | null) => boolean;
  getEquipmentAttackSpec: (equipmentName: string | undefined) => WeaponAttackSpec | null;
  collectEquipmentPatternTiles: (
    state: GameState,
    anchor: { x: number; y: number },
    equipmentName: string,
    direction: PatternDirection,
  ) => { x: number; y: number }[];
  clearEquipmentTerrainSnapshots: (state: GameState) => void;
  validateHylicCorridorAction: (
    state: GameState,
    player: Player,
    anchor: { x: number; y: number },
    direction: PatternDirection,
  ) => string | null;
  validateHylicRejectionField: (
    state: GameState,
    player: Player,
    coverTiles: { x: number; y: number }[],
  ) => string | null;
  validateRedirectionCircuits: (
    state: GameState,
    player: Player,
    action: UseEquipmentAction,
  ) => string | null;
  validateForceProjection: (
    state: GameState,
    player: Player,
    action: UseEquipmentAction,
  ) => string | null;
  applyHylicCorridor: (
    state: GameState,
    player: Player,
    anchor: { x: number; y: number },
    direction: PatternDirection,
  ) => string;
  applyHylicRejectionField: (
    state: GameState,
    coverTiles: { x: number; y: number }[],
  ) => string;
  applyRedirectionCircuits: (
    state: GameState,
    player: Player,
    action: UseEquipmentAction,
  ) => { message: string; hitEnemyIds: string[] };
  applyForceProjection: (
    state: GameState,
    player: Player,
    action: UseEquipmentAction,
  ) => {
    message: string;
    result: { damage: number; detail: string; targets: unknown[]; effects: string[] };
    hitEnemyIds: string[];
  };
  applyAnnihilationCorridorEndOfTurnDamage: (
    state: GameState,
    enemy: Enemy,
  ) => string | null;
  clearAnnihilationCorridorTileEffects: (state: GameState) => void;
};

function equipment(): EquipmentModule {
  return combatMod("equipment") as EquipmentModule;
}

export function isHylicAnnihilationCorridor(name: string | undefined | null): boolean {
  return equipment().isHylicAnnihilationCorridor(name);
}

export function isHylicRejectionField(name: string | undefined | null): boolean {
  return equipment().isHylicRejectionField(name);
}

export function isThoughtGuidingRedirectionCircuits(name: string | undefined | null): boolean {
  return equipment().isThoughtGuidingRedirectionCircuits(name);
}

export function isTransientForceProjection(name: string | undefined | null): boolean {
  return equipment().isTransientForceProjection(name);
}

export function equipmentRequiresBoardPlacement(name: string | undefined | null): boolean {
  return equipment().equipmentRequiresBoardPlacement(name);
}

export function getEquipmentAttackSpec(equipmentName: string | undefined): WeaponAttackSpec | null {
  return equipment().getEquipmentAttackSpec(equipmentName);
}

export function collectEquipmentPatternTiles(
  state: GameState,
  anchor: { x: number; y: number },
  equipmentName: string,
  direction: PatternDirection,
): { x: number; y: number }[] {
  return equipment().collectEquipmentPatternTiles(state, anchor, equipmentName, direction);
}

export function clearEquipmentTerrainSnapshots(state: GameState): void {
  equipment().clearEquipmentTerrainSnapshots(state);
}

export function validateHylicCorridorAction(
  state: GameState,
  player: Player,
  anchor: { x: number; y: number },
  direction: PatternDirection,
): string | null {
  return equipment().validateHylicCorridorAction(state, player, anchor, direction);
}

export function validateHylicRejectionField(
  state: GameState,
  player: Player,
  coverTiles: { x: number; y: number }[],
): string | null {
  return equipment().validateHylicRejectionField(state, player, coverTiles);
}

export function validateRedirectionCircuits(
  state: GameState,
  player: Player,
  action: UseEquipmentAction,
): string | null {
  return equipment().validateRedirectionCircuits(state, player, action);
}

export function validateForceProjection(
  state: GameState,
  player: Player,
  action: UseEquipmentAction,
): string | null {
  return equipment().validateForceProjection(state, player, action);
}

export function applyHylicCorridor(
  state: GameState,
  player: Player,
  anchor: { x: number; y: number },
  direction: PatternDirection,
): string {
  return equipment().applyHylicCorridor(state, player, anchor, direction);
}

export function applyHylicRejectionField(
  state: GameState,
  coverTiles: { x: number; y: number }[],
): string {
  return equipment().applyHylicRejectionField(state, coverTiles);
}

export function applyRedirectionCircuits(
  state: GameState,
  player: Player,
  action: UseEquipmentAction,
): { message: string; hitEnemyIds: string[] } {
  return equipment().applyRedirectionCircuits(state, player, action);
}

export function applyForceProjection(
  state: GameState,
  player: Player,
  action: UseEquipmentAction,
): {
  message: string;
  result: { damage: number; detail: string; targets: unknown[]; effects: string[] };
  hitEnemyIds: string[];
} {
  return equipment().applyForceProjection(state, player, action);
}

export function applyAnnihilationCorridorEndOfTurnDamage(
  state: GameState,
  enemy: Enemy,
): string | null {
  return equipment().applyAnnihilationCorridorEndOfTurnDamage(state, enemy);
}

export function clearAnnihilationCorridorTileEffects(state: GameState): void {
  equipment().clearAnnihilationCorridorTileEffects(state);
}
