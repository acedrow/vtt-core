import type { MapTile } from "@vtt-core/shared";
import { tileAt } from "@vtt-core/shared";

export type ElevationContourEdges = { east: boolean; south: boolean };

export function elevationContourEdges(
  elevation: number,
  eastElevation: number | undefined,
  southElevation: number | undefined,
): ElevationContourEdges {
  return {
    east: eastElevation != null && eastElevation !== elevation,
    south: southElevation != null && southElevation !== elevation,
  };
}

export type BoardCellMetrics = {
  width: number;
  height: number;
  cellW: number;
  cellH: number;
  gap: number;
};

export function boardCellMetrics(
  mapWidth: number,
  mapHeight: number,
  boardWidthPx: number,
  gap = 3,
): BoardCellMetrics {
  const boardHeightPx = boardWidthPx * (mapHeight / mapWidth);
  const cellW = (boardWidthPx - (mapWidth - 1) * gap) / mapWidth;
  const cellH = (boardHeightPx - (mapHeight - 1) * gap) / mapHeight;
  return { width: mapWidth, height: mapHeight, cellW, cellH, gap };
}

// Positive step n nests n rings into the high side; negative step -n nests n rings into the low side.
export function contourInsetIndex(step: number): number {
  return step >= 0 ? step : -step;
}

function snapCoord(v: number): number {
  // Nudge by a sub-milli-pixel epsilon so two float computations of the same
  // coordinate that land on a rounding tie always round the same way.
  return Math.round(v * 1000 + 1e-6) / 1000;
}

function boundaryX(x: number, cellW: number, gap: number): number {
  return (x + 1) * cellW + x * gap + gap / 2;
}

function boundaryY(y: number, cellH: number, gap: number): number {
  return (y + 1) * cellH + y * gap + gap / 2;
}

function verticalSpan(y: number, height: number, cellH: number, gap: number): { start: number; end: number } {
  const y0 = y * (cellH + gap) - (y > 0 ? gap / 2 : 0);
  const y1 = y0 + cellH + (y < height - 1 ? gap : gap / 2);
  return { start: y0, end: y1 };
}

function horizontalSpan(x: number, width: number, cellW: number, gap: number): { start: number; end: number } {
  const x0 = x * (cellW + gap) - (x > 0 ? gap / 2 : 0);
  const x1 = x0 + cellW + (x < width - 1 ? gap : gap / 2);
  return { start: x0, end: x1 };
}

export function elevationStepsBetween(a: number, b: number): number[] {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const steps: number[] = [];
  for (let s = lo; s < hi; s++) steps.push(s);
  return steps;
}

export function contourStepInsetPx(metrics: BoardCellMetrics): number {
  const cell = Math.min(metrics.cellW, metrics.cellH);
  return Math.min(cell * 0.1, cell / 12);
}

// +1 points from the "here" tile toward the neighbor; contours nest toward the
// high side for positive steps and toward the low side for negative steps.
function perpendicularInsetDirection(elevHere: number, elevNeigh: number, step: number): number {
  const towardNeigh = elevNeigh > elevHere ? 1 : -1;
  return step >= 0 ? towardNeigh : -towardNeigh;
}

type Point = [number, number];
type Graph = { adj: Map<string, Set<string>>; coord: Map<string, Point> };
type RoleNode = { id: string; xy: Point };

function graphAddEdge(g: Graph, aId: string, aXY: Point, bId: string, bXY: Point): void {
  if (aId === bId) return;
  if (!g.coord.has(aId)) g.coord.set(aId, aXY);
  if (!g.coord.has(bId)) g.coord.set(bId, bXY);
  if (!g.adj.has(aId)) g.adj.set(aId, new Set());
  if (!g.adj.has(bId)) g.adj.set(bId, new Set());
  g.adj.get(aId)!.add(bId);
  g.adj.get(bId)!.add(aId);
}

function edgeTerminalId(xy: Point): string {
  return `e:${snapCoord(xy[0])},${snapCoord(xy[1])}`;
}

// Build the contour graph for a single elevation level `s` (the boundary
// between elevation s and s+1). Nodes live on the grid-corner lattice; each
// corner vertex is placed at the intersection of the two offset lines meeting
// there, which handles convex, concave, and saddle corners uniformly.
function buildLevelGraph(tiles: MapTile[], metrics: BoardCellMetrics, s: number, stepInset: number): Graph {
  const { width, height, cellW, cellH, gap } = metrics;
  const inset = contourInsetIndex(s) * stepInset;

  const elevAt = (x: number, y: number): number | undefined => tileAt(tiles, x, y)?.elevation;
  const straddle = (a: number | undefined, b: number | undefined): boolean =>
    a != null && b != null && Math.min(a, b) <= s && s < Math.max(a, b);
  const vFixed = (i: number, eL: number, eR: number): number =>
    boundaryX(i, cellW, gap) + perpendicularInsetDirection(eL, eR, s) * inset;
  const hFixed = (j: number, eT: number, eB: number): number =>
    boundaryY(j, cellH, gap) + perpendicularInsetDirection(eT, eB, s) * inset;

  const cornerCache = new Map<string, Map<string, RoleNode>>();
  const resolveCorner = (i: number, j: number): Map<string, RoleNode> => {
    const key = `${i},${j}`;
    const cached = cornerCache.get(key);
    if (cached) return cached;

    const eTL = elevAt(i, j);
    const eTR = elevAt(i + 1, j);
    const eBL = elevAt(i, j + 1);
    const eBR = elevAt(i + 1, j + 1);
    const topV = straddle(eTL, eTR);
    const botV = straddle(eBL, eBR);
    const leftH = straddle(eTL, eBL);
    const rightH = straddle(eTR, eBR);
    const bx = boundaryX(i, cellW, gap);
    const by = boundaryY(j, cellH, gap);
    const vfTop = topV ? vFixed(i, eTL!, eTR!) : 0;
    const vfBot = botV ? vFixed(i, eBL!, eBR!) : 0;
    const hfLeft = leftH ? hFixed(j, eTL!, eBL!) : 0;
    const hfRight = rightH ? hFixed(j, eTR!, eBR!) : 0;
    const count = (topV ? 1 : 0) + (botV ? 1 : 0) + (leftH ? 1 : 0) + (rightH ? 1 : 0);

    const roles = new Map<string, RoleNode>();
    if (count === 4) {
      // Saddle: two same-elevation diagonals meet at a corner. Pinch one
      // diagonal (each of its tiles gets its own corner) and let the other pass
      // through. When the contour sits on the tile boundary (inset 0) the two
      // pinch vertices coincide at the corner, so pinching the background weaves
      // the feature into one connected ridge without crossing. When the contour
      // is inset, the background pairing would self-cross, so pinch the feature
      // diagonal instead: its tiles stay as separate loops kissing at the corner.
      const mainAbs = Math.abs(eTL!); // diagonal {TL, BR}
      const antiAbs = Math.abs(eTR!); // diagonal {TR, BL}
      const pinchMain = inset === 0 ? mainAbs <= antiAbs : mainAbs >= antiAbs;
      if (pinchMain) {
        const nTL: RoleNode = { id: `${key}#0`, xy: [vfTop, hfLeft] };
        const nBR: RoleNode = { id: `${key}#1`, xy: [vfBot, hfRight] };
        roles.set("topV", nTL);
        roles.set("leftH", nTL);
        roles.set("botV", nBR);
        roles.set("rightH", nBR);
      } else {
        const nTR: RoleNode = { id: `${key}#0`, xy: [vfTop, hfRight] };
        const nBL: RoleNode = { id: `${key}#1`, xy: [vfBot, hfLeft] };
        roles.set("topV", nTR);
        roles.set("rightH", nTR);
        roles.set("botV", nBL);
        roles.set("leftH", nBL);
      }
    } else if (count === 2 && topV && botV) {
      const n: RoleNode = { id: key, xy: [vfTop, by] };
      roles.set("topV", n);
      roles.set("botV", n);
    } else if (count === 2 && leftH && rightH) {
      const n: RoleNode = { id: key, xy: [bx, hfLeft] };
      roles.set("leftH", n);
      roles.set("rightH", n);
    } else if (count === 2) {
      const n: RoleNode = { id: key, xy: [topV ? vfTop : vfBot, leftH ? hfLeft : hfRight] };
      if (topV) roles.set("topV", n);
      if (botV) roles.set("botV", n);
      if (leftH) roles.set("leftH", n);
      if (rightH) roles.set("rightH", n);
    } else {
      // Irregular fan-out (map holes): terminate each edge on its boundary line.
      if (topV) roles.set("topV", { id: `${key}#topV`, xy: [vfTop, by] });
      if (botV) roles.set("botV", { id: `${key}#botV`, xy: [vfBot, by] });
      if (leftH) roles.set("leftH", { id: `${key}#leftH`, xy: [bx, hfLeft] });
      if (rightH) roles.set("rightH", { id: `${key}#rightH`, xy: [bx, hfRight] });
    }
    cornerCache.set(key, roles);
    return roles;
  };

  const g: Graph = { adj: new Map(), coord: new Map() };

  for (let i = 0; i < width - 1; i++) {
    for (let y = 0; y < height; y++) {
      const eL = elevAt(i, y);
      const eR = elevAt(i + 1, y);
      if (!straddle(eL, eR)) continue;
      const f = vFixed(i, eL!, eR!);
      let top: RoleNode;
      if (y >= 1) top = resolveCorner(i, y - 1).get("botV")!;
      else top = { id: "", xy: [f, verticalSpan(0, height, cellH, gap).start] };
      let bot: RoleNode;
      if (y <= height - 2) bot = resolveCorner(i, y).get("topV")!;
      else bot = { id: "", xy: [f, verticalSpan(height - 1, height, cellH, gap).end] };
      const topId = top.id || edgeTerminalId(top.xy);
      const botId = bot.id || edgeTerminalId(bot.xy);
      graphAddEdge(g, topId, top.xy, botId, bot.xy);
    }
  }

  for (let j = 0; j < height - 1; j++) {
    for (let x = 0; x < width; x++) {
      const eT = elevAt(x, j);
      const eB = elevAt(x, j + 1);
      if (!straddle(eT, eB)) continue;
      const f = hFixed(j, eT!, eB!);
      let left: RoleNode;
      if (x >= 1) left = resolveCorner(x - 1, j).get("rightH")!;
      else left = { id: "", xy: [horizontalSpan(0, width, cellW, gap).start, f] };
      let right: RoleNode;
      if (x <= width - 2) right = resolveCorner(x, j).get("leftH")!;
      else right = { id: "", xy: [horizontalSpan(width - 1, width, cellW, gap).end, f] };
      const leftId = left.id || edgeTerminalId(left.xy);
      const rightId = right.id || edgeTerminalId(right.xy);
      graphAddEdge(g, leftId, left.xy, rightId, right.xy);
    }
  }

  return g;
}

function filletCorner(
  a: Point,
  b: Point,
  c: Point,
  maxRadius: number,
  fullAb = false,
  fullCb = false,
): { p1: Point; p2: Point } | null {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const cbx = c[0] - b[0];
  const cby = c[1] - b[1];
  const lenAb = Math.hypot(abx, aby);
  const lenCb = Math.hypot(cbx, cby);
  if (lenAb < 1e-6 || lenCb < 1e-6) return null;
  const dot = (abx * cbx + aby * cby) / (lenAb * lenCb);
  if (dot > 0.999) return null;
  // Open-path stubs beside a gap only host one fillet, so they may use the full edge.
  const r = Math.min(maxRadius, fullAb ? lenAb : lenAb / 2, fullCb ? lenCb : lenCb / 2);
  return {
    p1: [b[0] - (abx / lenAb) * r, b[1] - (aby / lenAb) * r],
    p2: [b[0] + (cbx / lenCb) * r, b[1] + (cby / lenCb) * r],
  };
}

function simplifyCollinear(pts: Point[]): Point[] {
  if (pts.length < 3) return pts;
  const out: Point[] = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1]!;
    const cur = pts[i]!;
    const next = pts[i + 1]!;
    if (isCollinear(prev, cur, next)) continue;
    out.push(cur);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

function simplifyCollinearClosed(pts: Point[]): Point[] {
  if (pts.length < 4) return pts;
  let ring = [...pts];
  let changed = true;
  while (changed && ring.length >= 4) {
    changed = false;
    const next: Point[] = [];
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const prev = ring[(i - 1 + n) % n]!;
      const cur = ring[i]!;
      const nxt = ring[(i + 1) % n]!;
      if (isCollinear(prev, cur, nxt)) {
        changed = true;
        continue;
      }
      next.push(cur);
    }
    ring = next;
  }
  return ring;
}

function isCollinear(a: Point, b: Point, c: Point): boolean {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const cbx = c[0] - b[0];
  const cby = c[1] - b[1];
  const lenAb = Math.hypot(abx, aby);
  const lenCb = Math.hypot(cbx, cby);
  if (lenAb < 1e-6 || lenCb < 1e-6) return true;
  const dot = (abx * cbx + aby * cby) / (lenAb * lenCb);
  return dot > 0.999;
}

function appendLine(d: string, x: number, y: number): string {
  const tokens = d.trim().split(/\s+/);
  const lastY = Number(tokens[tokens.length - 1]);
  const lastX = Number(tokens[tokens.length - 2]);
  if (Number.isFinite(lastX) && Number.isFinite(lastY) && Math.hypot(x - lastX, y - lastY) < 1e-3) {
    return d;
  }
  return `${d} L ${x} ${y}`;
}

function chainToClosedPath(pts: Point[], cornerRadius: number): string {
  const ring = simplifyCollinearClosed(pts);
  const n = ring.length;
  if (n < 3) return chainToOpenPath(ring, cornerRadius);

  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]!;
    const cur = ring[i]!;
    const next = ring[(i + 1) % n]!;
    const fillet = filletCorner(prev, cur, next, cornerRadius);
    if (fillet) {
      if (i === 0) d = `M ${fillet.p1[0]} ${fillet.p1[1]}`;
      else d = appendLine(d, fillet.p1[0], fillet.p1[1]);
      d += ` Q ${cur[0]} ${cur[1]} ${fillet.p2[0]} ${fillet.p2[1]}`;
    } else if (i === 0) {
      d = `M ${cur[0]} ${cur[1]}`;
    } else {
      d = appendLine(d, cur[0], cur[1]);
    }
  }
  return `${d} Z`;
}

function chainToOpenPath(pts: Point[], cornerRadius: number): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M ${pts[0]![0]} ${pts[0]![1]} L ${pts[1]![0]} ${pts[1]![1]}`;
  }

  const last = pts.length - 1;
  let d = `M ${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 1; i < last; i++) {
    const fillet = filletCorner(
      pts[i - 1]!,
      pts[i]!,
      pts[i + 1]!,
      cornerRadius,
      i === 1,
      i === last - 1,
    );
    if (fillet) {
      d = appendLine(d, fillet.p1[0], fillet.p1[1]);
      d += ` Q ${pts[i]![0]} ${pts[i]![1]} ${fillet.p2[0]} ${fillet.p2[1]}`;
    } else {
      d = appendLine(d, pts[i]![0], pts[i]![1]);
    }
  }
  const end = pts[last]!;
  d = appendLine(d, end[0], end[1]);
  return d;
}

function chainToPath(chain: string[], coord: Map<string, Point>, cornerRadius: number, closed: boolean): string {
  let pts = chain.map((id) => coord.get(id)!);
  if (
    pts.length >= 2 &&
    Math.hypot(pts[0]![0] - pts[pts.length - 1]![0], pts[0]![1] - pts[pts.length - 1]![1]) < 1e-3
  ) {
    pts = pts.slice(0, -1);
  }
  if (closed && pts.length >= 3) return chainToClosedPath(pts, cornerRadius);
  return chainToOpenPath(simplifyCollinear(pts), cornerRadius);
}

function isClosedChain(chain: string[], adj: Map<string, Set<string>>): boolean {
  if (chain.length < 3) return false;
  const first = chain[0]!;
  const last = chain[chain.length - 1]!;
  if (first === last) return true;
  return adj.get(first)?.has(last) ?? false;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function tracePaths(g: Graph, cornerRadius: number): string[] {
  const { adj, coord } = g;
  const visitedEdges = new Set<string>();
  const paths: string[] = [];

  const walkFrom = (start: string, next: string): string[] => {
    visitedEdges.add(edgeKey(start, next));
    const chain = [start, next];
    let prev = start;
    let current = next;

    while (true) {
      const neighbors = adj.get(current);
      if (!neighbors) break;

      let found: string | null = null;
      for (const n of neighbors) {
        if (n === prev) continue;
        const ek = edgeKey(current, n);
        if (visitedEdges.has(ek)) continue;
        visitedEdges.add(ek);
        found = n;
        break;
      }
      if (!found) break;

      chain.push(found);
      prev = current;
      current = found;
    }

    return chain;
  };

  for (const [node, neighbors] of adj) {
    if (neighbors.size === 1) {
      const n = [...neighbors][0]!;
      if (visitedEdges.has(edgeKey(node, n))) continue;
      const chain = walkFrom(node, n);
      if (chain.length >= 2) paths.push(chainToPath(chain, coord, cornerRadius, isClosedChain(chain, adj)));
    }
  }

  for (const [node, neighbors] of adj) {
    for (const n of neighbors) {
      if (visitedEdges.has(edgeKey(node, n))) continue;
      const chain = walkFrom(node, n);
      if (chain.length >= 2) paths.push(chainToPath(chain, coord, cornerRadius, isClosedChain(chain, adj)));
    }
  }

  return paths;
}

export function buildElevationContourPaths(tiles: MapTile[], metrics: BoardCellMetrics): string[] {
  if (tiles.length === 0) return [];
  let minElev = Infinity;
  let maxElev = -Infinity;
  for (const t of tiles) {
    if (t.elevation < minElev) minElev = t.elevation;
    if (t.elevation > maxElev) maxElev = t.elevation;
  }
  if (!Number.isFinite(minElev) || maxElev <= minElev) return [];

  const stepInsetPx = contourStepInsetPx(metrics);
  const cornerRadius = Math.min(25, metrics.gap * 8.5);
  const paths: string[] = [];
  for (let s = Math.floor(minElev); s < Math.ceil(maxElev); s++) {
    const g = buildLevelGraph(tiles, metrics, s, stepInsetPx);
    if (g.adj.size === 0) continue;
    paths.push(...tracePaths(g, cornerRadius));
  }
  return paths;
}

export function parsePathCommands(d: string): { cmd: string; x: number; y: number }[] {
  const tokens = d.trim().split(/\s+/);
  const points: { cmd: string; x: number; y: number }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const cmd = tokens[i]!;
    if (cmd !== "M" && cmd !== "L" && cmd !== "Q") continue;
    if (cmd === "Q") {
      const cx = Number(tokens[++i]);
      const cy = Number(tokens[++i]);
      const x = Number(tokens[++i]);
      const y = Number(tokens[++i]);
      points.push({ cmd, x, y });
      void cx;
      void cy;
      continue;
    }
    const x = Number(tokens[++i]);
    const y = Number(tokens[++i]);
    points.push({ cmd, x, y });
  }
  return points;
}
