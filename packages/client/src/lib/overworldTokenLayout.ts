export type OverworldTokenKind = "location" | "convoy" | "party";

export type OverworldStackOccupant =
  | { kind: "location"; id: string }
  | { kind: "convoy"; id: string }
  | { kind: "party" };

export type StackSlotFraction = { fx: number; fy: number };

export const OVERWORLD_TOKEN_KIND_ORDER: readonly OverworldTokenKind[] = [
  "location",
  "convoy",
  "party",
] as const;

const LAYOUTS: Record<number, StackSlotFraction[]> = {
  1: [{ fx: 0.5, fy: 0.5 }],
  2: [
    { fx: 0.25, fy: 0.25 },
    { fx: 0.75, fy: 0.75 },
  ],
  3: [
    { fx: 0.5, fy: 0.25 },
    { fx: 0.25, fy: 0.75 },
    { fx: 0.75, fy: 0.75 },
  ],
  4: [
    { fx: 0.25, fy: 0.25 },
    { fx: 0.75, fy: 0.25 },
    { fx: 0.25, fy: 0.75 },
    { fx: 0.75, fy: 0.75 },
  ],
};

export function stackSlotFractions(count: number): StackSlotFraction[] {
  if (count <= 0) return [];
  if (count <= 4) return LAYOUTS[count]!.map((s) => ({ ...s }));
  const base = LAYOUTS[4]!.map((s) => ({ ...s }));
  for (let i = 4; i < count; i++) {
    base.push({ fx: 0.5, fy: 0.5 });
  }
  return base;
}

export function orderOccupants(occupants: Iterable<OverworldStackOccupant>): OverworldStackOccupant[] {
  const list = [...occupants];
  const kindRank = (kind: OverworldTokenKind) => OVERWORLD_TOKEN_KIND_ORDER.indexOf(kind);
  list.sort((a, b) => {
    const kindDelta = kindRank(a.kind) - kindRank(b.kind);
    if (kindDelta !== 0) return kindDelta;
    if (a.kind === "party" || b.kind === "party") return 0;
    return a.id.localeCompare(b.id);
  });
  return list;
}

/** Pull slots toward/away from cell center. spread>1 = more separation. */
export function applyStackSpread(slot: StackSlotFraction, spread: number): StackSlotFraction {
  const s = Number.isFinite(spread) && spread > 0 ? spread : 1;
  return {
    fx: 0.5 + (slot.fx - 0.5) * s,
    fy: 0.5 + (slot.fy - 0.5) * s,
  };
}

// Match useBoardViewport zoom bounds.
const ZOOM_OUT_MIN_FACTOR = 0.65;
const ZOOM_MAX_FACTOR = 4;
const SPREAD_AT_FIT = 1.2;
const SPREAD_AT_MAX_IN = 1.3;
const SPREAD_AT_MAX_OUT = 2.0;

export function stackSpreadFromZoom(fitScale: number, scale: number): number {
  if (!(fitScale > 0) || !(scale > 0)) return SPREAD_AT_FIT;
  const r = scale / fitScale;
  if (r >= 1) {
    const t = Math.min(1, (r - 1) / (ZOOM_MAX_FACTOR - 1));
    return SPREAD_AT_FIT + t * (SPREAD_AT_MAX_IN - SPREAD_AT_FIT);
  }
  const t = Math.min(1, (1 - r) / (1 - ZOOM_OUT_MIN_FACTOR));
  return SPREAD_AT_FIT + t * (SPREAD_AT_MAX_OUT - SPREAD_AT_FIT);
}

function occupantKey(o: OverworldStackOccupant): string {
  return o.kind === "party" ? "party" : `${o.kind}:${o.id}`;
}

export function slotForOccupant(
  occupants: Iterable<OverworldStackOccupant>,
  occupant: OverworldStackOccupant,
  spread = 1,
): StackSlotFraction {
  const ordered = orderOccupants(occupants);
  const key = occupantKey(occupant);
  const index = ordered.findIndex((o) => occupantKey(o) === key);
  const slots = stackSlotFractions(ordered.length);
  if (index < 0 || slots.length === 0) return applyStackSpread({ fx: 0.5, fy: 0.5 }, spread);
  return applyStackSpread(slots[Math.min(index, slots.length - 1)]!, spread);
}
