import type { ActionTier } from "@vtt-core/shared";

export type SheetTierMenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
  tooltip?: string;
};

export type SheetTierActionCandidate = {
  id: string;
  label: string;
  tier: ActionTier;
  include: boolean;
  disabled?: boolean;
  tooltip?: string;
};

export function sheetTierMenuItems(
  actions: SheetTierActionCandidate[],
): Record<ActionTier, SheetTierMenuItem[]> {
  const out: Record<ActionTier, SheetTierMenuItem[]> = { main: [], support: [], aux: [] };
  for (const action of actions) {
    if (!action.include) continue;
    out[action.tier].push({
      id: action.id,
      label: action.label,
      ...(action.disabled ? { disabled: true } : {}),
      ...(action.tooltip ? { tooltip: action.tooltip } : {}),
    });
  }
  return out;
}
