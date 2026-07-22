import type { GmEnemyAction } from "./types.js";

const ENGINE_ACTIONS = new Set(["move", "attack", "assisted", "exhaust", "pack"]);

type LegacySwarmChip = {
  action: "swarmChip";
  enemyId: string;
  targetPlayerIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeGmEnemyAction(raw: unknown): GmEnemyAction | { error: string } {
  if (!isRecord(raw) || typeof raw.action !== "string") {
    return { error: "Invalid GM enemy action" };
  }

  const action = raw.action;

  if (action === "swarmChip") {
    const a = raw as LegacySwarmChip;
    if (typeof a.enemyId !== "string" || !a.enemyId) {
      return { error: "Invalid swarm chip action" };
    }
    if (!Array.isArray(a.targetPlayerIds) || !a.targetPlayerIds.every((id) => typeof id === "string")) {
      return { error: "Invalid swarm chip targets" };
    }
    return {
      action: "pack",
      kind: "swarmChip",
      enemyId: a.enemyId,
      detail: { targetPlayerIds: a.targetPlayerIds },
    };
  }

  if (!ENGINE_ACTIONS.has(action)) {
    return { error: `Unknown GM enemy action: ${action}` };
  }

  if (action === "pack") {
    if (typeof raw.kind !== "string" || !raw.kind) {
      return { error: "Invalid pack action" };
    }
    if (typeof raw.enemyId !== "string" || !raw.enemyId) {
      return { error: "Invalid pack action enemy" };
    }
    const detail = raw.detail;
    if (detail !== undefined && !isRecord(detail)) {
      return { error: "Invalid pack action detail" };
    }
    return {
      action: "pack",
      kind: raw.kind,
      enemyId: raw.enemyId,
      ...(detail !== undefined ? { detail } : {}),
    };
  }

  return raw as GmEnemyAction;
}
