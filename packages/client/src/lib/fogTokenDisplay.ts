export type FogTokenDisplay = "visible" | "unknown" | "hidden";

export function fogTokenDisplay(opts: {
  enforceSightlines: boolean;
  currentlyVisible: boolean;
  previouslySeen: boolean;
  rangeFromViewer: number;
  maxUnknownRange?: number;
  linkedVisibleToken?: boolean;
}): FogTokenDisplay {
  if (!opts.enforceSightlines || opts.currentlyVisible) return "visible";
  if (!opts.previouslySeen) return "hidden";
  if (opts.linkedVisibleToken) return "unknown";
  if (opts.rangeFromViewer <= (opts.maxUnknownRange ?? 3)) return "unknown";
  return "hidden";
}
