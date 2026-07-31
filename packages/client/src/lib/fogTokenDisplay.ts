export type FogTokenDisplay = "visible" | "unknown" | "hidden";

export function fogTokenDisplay(opts: {
  enforceSightlines: boolean;
  currentlyVisible: boolean;
  previouslySeen: boolean;
  rangeFromViewer: number;
  maxUnknownRange?: number;
  linkedVisibleToken?: boolean;
  isSwarmMember?: boolean;
}): FogTokenDisplay {
  if (!opts.enforceSightlines || opts.currentlyVisible) return "visible";
  if (!opts.previouslySeen) return "hidden";
  if (opts.linkedVisibleToken) return "unknown";
  // Swarm members are always shown as "?" on previously seen tiles, regardless
  // of range from the viewer — the swarm's presence is known even if its exact
  // makeup/position isn't.
  if (opts.isSwarmMember) return "unknown";
  if (opts.rangeFromViewer <= (opts.maxUnknownRange ?? 3)) return "unknown";
  return "hidden";
}
