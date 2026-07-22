export type PackCombatMessage = {
  type: "packCombat";
  kind: string;
  detail?: Record<string, unknown>;
};

type LegacyTriggerReversal = {
  type: "triggerReversal";
  extraLines?: { allyId: string; anchor?: "tower" }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePackCombatMessage(
  raw: unknown,
): PackCombatMessage | { error: string } {
  if (!isRecord(raw) || typeof raw.type !== "string") {
    return { error: "Invalid pack combat message" };
  }

  if (raw.type === "triggerReversal") {
    const a = raw as LegacyTriggerReversal;
    const detail: Record<string, unknown> = {};
    if (a.extraLines !== undefined) detail.extraLines = a.extraLines;
    return {
      type: "packCombat",
      kind: "triggerReversal",
      ...(Object.keys(detail).length ? { detail } : {}),
    };
  }

  if (raw.type === "declineReversal") {
    return { type: "packCombat", kind: "declineReversal" };
  }

  if (raw.type === "packCombat") {
    if (typeof raw.kind !== "string" || !raw.kind) {
      return { error: "Invalid pack combat kind" };
    }
    const detail = raw.detail;
    if (detail !== undefined && !isRecord(detail)) {
      return { error: "Invalid pack combat detail" };
    }
    return {
      type: "packCombat",
      kind: raw.kind,
      ...(detail !== undefined ? { detail } : {}),
    };
  }

  return { error: `Unknown pack combat message: ${raw.type}` };
}
