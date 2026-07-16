import type { ActionBudget, ActionTier } from "./types.js";
import type { Player } from "../types.js";
import { removeEffectStacks } from "./effects.js";

export function hasteStacks(player: Pick<Player, "effects">): number {
  return player.effects?.Haste ?? 0;
}

export function actionTierLabel(tier: ActionTier): string {
  if (tier === "main") return "Main";
  if (tier === "support") return "Support";
  return "Aux";
}

export function actionTierTooltip(tier: ActionTier): string {
  if (tier === "main") return "Attack, Rez, and weapon active abilities.";
  if (tier === "support") return "Use, class active ability, armor ability, and equipment.";
  return "Shove, weapon swap, and Sprint.";
}

export function spendActionTier(budget: ActionBudget | undefined, tier: ActionTier): boolean {
  if (!budget) return false;
  if (tier === "main" && !budget.main) return false;
  if (tier === "support" && !budget.support) return false;
  if (tier === "aux" && !budget.aux) return false;
  if (tier === "main") budget.main = false;
  if (tier === "support") budget.support = false;
  if (tier === "aux") budget.aux = false;
  return true;
}

export function canSpendActionTier(budget: ActionBudget | undefined, tier: ActionTier): boolean {
  if (!budget) return false;
  if (tier === "main") return budget.main;
  if (tier === "support") return budget.support;
  return budget.aux;
}

export function spendMovement(budget: ActionBudget | undefined, cost: number): boolean {
  if (!budget || budget.movementRemaining < cost) return false;
  budget.movementRemaining -= cost;
  return true;
}

// Shock treats an action as one tier higher: Aux spends the Support slot, Support spends
// the Main slot, and Main is impossible (there is no tier above it).
function shockShiftedTier(shock: number, tier: ActionTier): ActionTier | null {
  if (shock <= 0) return tier;
  if (tier === "aux") return "support";
  if (tier === "support") return "main";
  return null;
}

export function effectiveActionBlocked(player: Player, tier: ActionTier): boolean {
  const shock = player.effects?.Shock ?? 0;
  return shockShiftedTier(shock, tier) === null;
}

export function canUseActionTier(player: Player, tier: ActionTier): boolean {
  const shock = player.effects?.Shock ?? 0;
  const shifted = shockShiftedTier(shock, tier);
  if (!shifted) return false;
  if (canSpendActionTier(player.actionBudget, shifted)) return true;
  return player.hasteActionTier === tier && hasteStacks(player) > 0;
}

export function canCommitHasteForTier(player: Player, tier: ActionTier): boolean {
  if (hasteStacks(player) <= 0) return false;
  if (player.hasteActionTier) return false;
  const shock = player.effects?.Shock ?? 0;
  const shifted = shockShiftedTier(shock, tier);
  if (!shifted) return false;
  if (canSpendActionTier(player.actionBudget, shifted)) return false;
  return true;
}

export function actionTierBlockedReason(player: Player, tier: ActionTier): string | null {
  const shock = player.effects?.Shock ?? 0;
  const shifted = shockShiftedTier(shock, tier);
  if (!shifted) return "Shock — cannot use Main";
  if (canSpendActionTier(player.actionBudget, shifted)) return null;
  if (player.hasteActionTier === tier && hasteStacks(player) > 0) return null;
  const prefix = shock > 0 ? "Shock — " : "";
  if (shifted === "main") return `${prefix}Main action spent`;
  if (shifted === "support") return `${prefix}Support action spent`;
  return "Aux action spent";
}

export function validateCommitHaste(player: Player, tier: ActionTier): string | null {
  if (canCommitHasteForTier(player, tier)) return null;
  if (hasteStacks(player) <= 0) return "No Haste";
  if (player.hasteActionTier) return "Haste already committed";
  const shock = player.effects?.Shock ?? 0;
  const shifted = shockShiftedTier(shock, tier);
  if (!shifted) return "Shock — cannot use Main";
  if (canSpendActionTier(player.actionBudget, shifted)) return "Action not spent";
  return "Cannot commit Haste";
}

export function applyCommitHaste(player: Player, tier: ActionTier): string {
  player.hasteActionTier = tier;
  return `committed Haste for an additional ${actionTierLabel(tier)} action`;
}

export function spendActionTierOrHaste(player: Player, tier: ActionTier): boolean {
  const shock = player.effects?.Shock ?? 0;
  const shifted = shockShiftedTier(shock, tier);
  if (shifted && spendActionTier(player.actionBudget, shifted)) return true;
  if (player.hasteActionTier !== tier || hasteStacks(player) <= 0) return false;
  removeEffectStacks(player, ["Haste:1"]);
  delete player.hasteActionTier;
  return true;
}

export function restoreActionTier(budget: ActionBudget | undefined, tier: ActionTier): boolean {
  if (!budget) return false;
  if (canSpendActionTier(budget, tier)) return false;
  if (tier === "main") budget.main = true;
  else if (tier === "support") budget.support = true;
  else budget.aux = true;
  return true;
}
