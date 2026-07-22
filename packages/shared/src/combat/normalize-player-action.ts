import type { PatternDirection } from "../pattern-data.js";
import type { ActionTier, ClassActiveKind, PlayerAction } from "./types.js";

const ENGINE_ACTIONS = new Set([
  "attack",
  "shove",
  "sprint",
  "sprintMove",
  "sprintCancel",
  "weaponSwap",
  "selectWeaponVariant",
  "rez",
  "resolveClassReaction",
  "useEquipment",
  "interact",
  "commitHaste",
  "pack",
]);

type LegacyAssistedLaunch = { action: "assistedLaunch"; anchorX: number; anchorY: number };
type LegacyArmorAction = {
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
};
type LegacyClassActive = {
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
};
type LegacyClassPassive = {
  action: "classPassive";
  kind: "baseline_communism";
  targetPlayerId: string;
};
type LegacyWeaponActive = {
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePlayerAction(raw: unknown): PlayerAction | { error: string } {
  if (!isRecord(raw) || typeof raw.action !== "string") {
    return { error: "Invalid player action" };
  }

  const action = raw.action;

  if (action === "assistedLaunch") {
    const a = raw as LegacyAssistedLaunch;
    return {
      action: "pack",
      kind: "assistedLaunch",
      detail: { anchorX: a.anchorX, anchorY: a.anchorY },
    };
  }

  if (action === "armorAction") {
    const a = raw as LegacyArmorAction;
    const detail: Record<string, unknown> = {};
    if (a.kind !== undefined) detail.kind = a.kind;
    if (a.targetEnemyId !== undefined) detail.targetEnemyId = a.targetEnemyId;
    if (a.targetPlayerId !== undefined) detail.targetPlayerId = a.targetPlayerId;
    if (a.landingX !== undefined) detail.landingX = a.landingX;
    if (a.landingY !== undefined) detail.landingY = a.landingY;
    if (a.push !== undefined) detail.push = a.push;
    if (a.x !== undefined) detail.x = a.x;
    if (a.y !== undefined) detail.y = a.y;
    if (a.keraunoTargetEnemyId !== undefined) detail.keraunoTargetEnemyId = a.keraunoTargetEnemyId;
    if (a.targetEnemyIds !== undefined) detail.targetEnemyIds = a.targetEnemyIds;
    return { action: "pack", kind: "armorAction", detail };
  }

  if (action === "classActive") {
    const a = raw as LegacyClassActive;
    const detail: Record<string, unknown> = {};
    if (a.kind !== undefined) detail.kind = a.kind;
    if (a.harpeRecall !== undefined) detail.harpeRecall = a.harpeRecall;
    if (a.harpeEquipWeapon !== undefined) detail.harpeEquipWeapon = a.harpeEquipWeapon;
    if (a.targetEnemyIds !== undefined) detail.targetEnemyIds = a.targetEnemyIds;
    if (a.targetPlayerIds !== undefined) detail.targetPlayerIds = a.targetPlayerIds;
    if (a.x !== undefined) detail.x = a.x;
    if (a.y !== undefined) detail.y = a.y;
    if (a.allyPlayerId !== undefined) detail.allyPlayerId = a.allyPlayerId;
    if (a.direction !== undefined) detail.direction = a.direction;
    if (a.anchorX !== undefined) detail.anchorX = a.anchorX;
    if (a.anchorY !== undefined) detail.anchorY = a.anchorY;
    if (a.followUpMaxDamage !== undefined) detail.followUpMaxDamage = a.followUpMaxDamage;
    if (a.gearSlot !== undefined) detail.gearSlot = a.gearSlot;
    if (a.gearName !== undefined) detail.gearName = a.gearName;
    return { action: "pack", kind: "classActive", detail };
  }

  if (action === "classPassive") {
    const a = raw as LegacyClassPassive;
    return {
      action: "pack",
      kind: "classPassive",
      detail: { kind: a.kind, targetPlayerId: a.targetPlayerId },
    };
  }

  if (action === "weaponActive") {
    const a = raw as LegacyWeaponActive;
    const detail: Record<string, unknown> = {};
    if (a.detail !== undefined) detail.detail = a.detail;
    if (a.targetEnemyIds !== undefined) detail.targetEnemyIds = a.targetEnemyIds;
    if (a.targetPlayerIds !== undefined) detail.targetPlayerIds = a.targetPlayerIds;
    if (a.direction !== undefined) detail.direction = a.direction;
    if (a.omnistrike !== undefined) detail.omnistrike = a.omnistrike;
    if (a.warhook !== undefined) detail.warhook = a.warhook;
    return { action: "pack", kind: "weaponActive", detail };
  }

  if (!ENGINE_ACTIONS.has(action)) {
    return { error: `Unknown player action: ${action}` };
  }

  if (action === "pack") {
    if (typeof raw.kind !== "string" || !raw.kind) {
      return { error: "Invalid pack action" };
    }
    const detail = raw.detail;
    if (detail !== undefined && !isRecord(detail)) {
      return { error: "Invalid pack action detail" };
    }
    return {
      action: "pack",
      kind: raw.kind,
      ...(detail !== undefined ? { detail } : {}),
    };
  }

  // Engine-owned actions: trust structural shape from typed ClientMessage callers;
  // runtime ingress still receives JSON so cast after action discriminant check.
  if (action === "commitHaste") {
    const tier = raw.tier;
    if (tier !== "main" && tier !== "support" && tier !== "aux") {
      return { error: "Invalid haste tier" };
    }
    return { action: "commitHaste", tier: tier as ActionTier };
  }

  return raw as PlayerAction;
}
