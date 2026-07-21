import type { MapTile } from "@vtt-core/shared";
import { describe, expect, it } from "vitest";

import {
  boardCellMetrics,
  buildElevationContourPaths,
  contourInsetIndex,
  contourStepInsetPx,
  elevationContourEdges,
  elevationStepsBetween,
  parsePathCommands,
} from "./elevationContours.js";

function tile(x: number, y: number, elevation: number): MapTile {
  return { x, y, terrain: ["standard"], elevation };
}

function flatGrid(width: number, height: number, elevation = 0): MapTile[] {
  const tiles: MapTile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push(tile(x, y, elevation));
    }
  }
  return tiles;
}

const metrics2x2 = boardCellMetrics(2, 2, 100, 3);

describe("elevationContourEdges", () => {
  it("returns no edges for flat neighbors", () => {
    expect(elevationContourEdges(0, 0, 0)).toEqual({ east: false, south: false });
  });

  it("returns east edge when east neighbor differs", () => {
    expect(elevationContourEdges(0, 1, 0)).toEqual({ east: true, south: false });
    expect(elevationContourEdges(0, 1, undefined)).toEqual({ east: true, south: false });
  });

  it("returns south edge when south neighbor differs", () => {
    expect(elevationContourEdges(0, 0, 1)).toEqual({ east: false, south: true });
    expect(elevationContourEdges(0, 0, -1)).toEqual({ east: false, south: true });
  });

  it("returns both edges when both neighbors differ", () => {
    expect(elevationContourEdges(0, 1, -1)).toEqual({ east: true, south: true });
  });

  it("returns no edges when neighbors are missing", () => {
    expect(elevationContourEdges(0, undefined, undefined)).toEqual({ east: false, south: false });
    expect(elevationContourEdges(2, undefined, 1)).toEqual({ east: false, south: true });
    expect(elevationContourEdges(2, 1, undefined)).toEqual({ east: true, south: false });
  });
});

function countPathQs(path: string): number {
  return (path.match(/\sQ\s/g) ?? []).length;
}

function elevatedBlockGrid(
  blockX: number,
  blockY: number,
  blockW: number,
  blockH: number,
  mapW: number,
  mapH: number,
  blockElev = 1,
): MapTile[] {
  const tiles: MapTile[] = [];
  for (let y = 0; y < mapH; y++) {
    for (let x = 0; x < mapW; x++) {
      const inBlock = x >= blockX && x < blockX + blockW && y >= blockY && y < blockY + blockH;
      tiles.push(tile(x, y, inBlock ? blockElev : 0));
    }
  }
  return tiles;
}

function singleTileGrid(x: number, y: number, elevation: number, mapW: number, mapH: number): MapTile[] {
  const tiles: MapTile[] = [];
  for (let ty = 0; ty < mapH; ty++) {
    for (let tx = 0; tx < mapW; tx++) {
      tiles.push(tile(tx, ty, tx === x && ty === y ? elevation : 0));
    }
  }
  return tiles;
}

function pathBounds(path: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const points = parsePathCommands(path);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// Reconstruct the sharp corner polygon from the rounded path (each fillet's Q
// control point is a true corner) and report any proper (interior) crossing of
// two non-adjacent edges. A pinch where two corners coincide shares an endpoint,
// not an interior point, so it is not reported as a crossing.
function pathSelfCrosses(path: string): boolean {
  const tokens = path.trim().split(/\s+/);
  const corners: [number, number][] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === "Q") {
      corners.push([Number(tokens[i + 1]), Number(tokens[i + 2])]);
      i += 4;
    }
  }
  const closed = path.includes(" Z");
  const n = corners.length;
  if (n < 4) return false;
  const edges: [[number, number], [number, number]][] = [];
  const limit = closed ? n : n - 1;
  for (let i = 0; i < limit; i++) edges.push([corners[i]!, corners[(i + 1) % n]!]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const proper = (p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]) => {
    const d1 = cross(p3, p4, p1);
    const d2 = cross(p3, p4, p2);
    const d3 = cross(p1, p2, p3);
    const d4 = cross(p1, p2, p4);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) &&
      d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0;
  };
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 2; j < edges.length; j++) {
      if (closed && i === 0 && j === edges.length - 1) continue;
      if (proper(edges[i]![0], edges[i]![1], edges[j]![0], edges[j]![1])) return true;
    }
  }
  return false;
}

describe("elevationStepsBetween", () => {
  it("returns one step for adjacent elevations", () => {
    expect(elevationStepsBetween(0, 1)).toEqual([0]);
    expect(elevationStepsBetween(1, 0)).toEqual([0]);
  });

  it("returns all intermediate steps for larger gaps", () => {
    expect(elevationStepsBetween(0, 2)).toEqual([0, 1]);
    expect(elevationStepsBetween(0, -2)).toEqual([-2, -1]);
    expect(elevationStepsBetween(-3, 3)).toEqual([-3, -2, -1, 0, 1, 2]);
  });
});

describe("contourInsetIndex", () => {
  it("places each elevation ring at a fixed depth from the boundary", () => {
    expect(contourInsetIndex(0)).toBe(0);
    expect(contourInsetIndex(1)).toBe(1);
    expect(contourInsetIndex(2)).toBe(2);
    expect(contourInsetIndex(-1)).toBe(1);
    expect(contourInsetIndex(-2)).toBe(2);
    expect(contourInsetIndex(-3)).toBe(3);
  });
});

describe("buildElevationContourPaths", () => {
  it("returns no paths for a flat map", () => {
    expect(buildElevationContourPaths(flatGrid(3, 3), boardCellMetrics(3, 3, 120, 3))).toEqual([]);
  });

  it("returns one path for a single elevation step (0 vs 1)", () => {
    const tiles = [tile(0, 0, 0), tile(1, 0, 1)];
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(2, 1, 100, 3));
    expect(paths).toHaveLength(1);
  });

  it("returns two vertical paths for a two-step east edge (0 vs 2)", () => {
    const tiles = [tile(0, 0, 0), tile(1, 0, 2)];
    const m = boardCellMetrics(2, 1, 100, 3);
    const paths = buildElevationContourPaths(tiles, m);
    expect(paths).toHaveLength(2);
    const xs = paths.map((p) => pathBounds(p).minX);
    expect(new Set(xs.map((x) => Math.round(x * 100))).size).toBe(2);
    expect(Math.abs(xs[1]! - xs[0]!)).toBeCloseTo(contourStepInsetPx(m), 3);
  });

  it("returns nested closed paths for a single elevation-2 tile", () => {
    const tiles = singleTileGrid(2, 2, 2, 5, 5);
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(5, 5, 200, 3));
    expect(paths).toHaveLength(2);
    const byArea = [...paths].sort(
      (a, b) =>
        (pathBounds(b).maxX - pathBounds(b).minX) * (pathBounds(b).maxY - pathBounds(b).minY) -
        (pathBounds(a).maxX - pathBounds(a).minX) * (pathBounds(a).maxY - pathBounds(a).minY),
    );
    const outer = pathBounds(byArea[0]!);
    const inner = pathBounds(byArea[1]!);
    expect(inner.minX).toBeGreaterThan(outer.minX);
    expect(inner.maxX).toBeLessThan(outer.maxX);
    expect(inner.minY).toBeGreaterThan(outer.minY);
    expect(inner.maxY).toBeLessThan(outer.maxY);
  });

  it("returns nested closed paths for a single elevation -2 pit tile", () => {
    const tiles = singleTileGrid(2, 2, -2, 5, 5);
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(5, 5, 200, 3));
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(path).toContain(" Z");
    }
  });

  it("returns six nested rings for elev 3 inside elev -3", () => {
    const tiles = flatGrid(5, 5, -3);
    const peak = tiles.find((t) => t.x === 2 && t.y === 2)!;
    peak.elevation = 3;
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(5, 5, 200, 3));
    expect(paths).toHaveLength(6);
    for (const path of paths) {
      expect(path).toContain(" Z");
    }
    const byArea = [...paths].sort(
      (a, b) =>
        (pathBounds(b).maxX - pathBounds(b).minX) * (pathBounds(b).maxY - pathBounds(b).minY) -
        (pathBounds(a).maxX - pathBounds(a).minX) * (pathBounds(a).maxY - pathBounds(a).minY),
    );
    for (let i = 1; i < byArea.length; i++) {
      const outer = pathBounds(byArea[i - 1]!);
      const inner = pathBounds(byArea[i]!);
      expect(inner.minX).toBeGreaterThan(outer.minX);
      expect(inner.maxX).toBeLessThan(outer.maxX);
      expect(inner.minY).toBeGreaterThan(outer.minY);
      expect(inner.maxY).toBeLessThan(outer.maxY);
    }
  });

  it("closes and rounds all six rings when cells are non-square (rounding-tie corners)", () => {
    // Non-square cells (cellW != cellH) put the outermost ring's corners on a
    // milli-pixel rounding tie; the vertical and horizontal segments must still
    // agree on the shared corner vertex so the ring stays closed and rounded.
    const tiles = flatGrid(10, 12, -3);
    const peak = tiles.find((t) => t.x === 5 && t.y === 6)!;
    peak.elevation = 3;
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(10, 12, 500, 3));
    expect(paths).toHaveLength(6);
    for (const path of paths) {
      expect(path).toContain(" Z");
      expect(countPathQs(path)).toBe(4);
    }
  });

  it("closes the pit ring with a notch around an interior edge peak", () => {
    // An interior peak carving into the bottom edge of a pit does not break the
    // ring open: the -3 region is simply connected, so each ring stays closed
    // and detours around the peak notch (8 corners: 4 outer + 4 notch).
    const tiles = elevatedBlockGrid(2, 1, 3, 4, 7, 7, -3);
    const peak = tiles.find((t) => t.x === 3 && t.y === 4)!;
    peak.elevation = 3;
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(7, 7, 420, 3));
    expect(paths).toHaveLength(6);
    for (const path of paths) expect(path).toContain(" Z");
    const notched = paths.filter((p) => countPathQs(p) === 8);
    const peakRings = paths.filter((p) => countPathQs(p) === 4);
    expect(notched).toHaveLength(3);
    expect(peakRings).toHaveLength(3);
  });

  it("keeps full corner radius on stubs of rings left open by the board edge", () => {
    // A pit reaching the board's bottom edge, breached by an edge peak, splits
    // each ring into open stubs; the stub corners beside the open gap must use
    // the full corner radius rather than a half-edge radius.
    const tiles = elevatedBlockGrid(2, 3, 3, 4, 7, 7, -3);
    const peak = tiles.find((t) => t.x === 3 && t.y === 6)!;
    peak.elevation = 3;
    const m = boardCellMetrics(7, 7, 420, 3);
    const cornerR = Math.min(25, m.gap * 8.5);
    const paths = buildElevationContourPaths(tiles, m);
    const open = paths.filter((p) => !p.includes(" Z"));
    expect(open.length).toBeGreaterThan(0);
    // The outer (largest) open stubs run the full cell height, so their corners
    // reach full radius; assert at least one open stub is entirely full-radius.
    const fullRadiusStub = open.some((p) => {
      const tokens = p.trim().split(/\s+/);
      const radii: number[] = [];
      let x = 0;
      let y = 0;
      for (let i = 0; i < tokens.length; i++) {
        const cmd = tokens[i]!;
        if (cmd === "M" || cmd === "L") {
          x = Number(tokens[++i]);
          y = Number(tokens[++i]);
        } else if (cmd === "Q") {
          const qx = Number(tokens[++i]);
          const qy = Number(tokens[++i]);
          const nx = Number(tokens[++i]);
          const ny = Number(tokens[++i]);
          radii.push(Math.hypot(qx - x, qy - y));
          x = nx;
          y = ny;
        }
      }
      return radii.length > 0 && radii.every((r) => Math.abs(r - cornerR) < 0.5);
    });
    expect(fullRadiusStub).toBe(true);
  });

  it("returns one continuous vertical path for a 2x1 elevation step", () => {
    const tiles = [tile(0, 0, 0), tile(1, 0, 1)];
    const m = boardCellMetrics(2, 1, 100, 3);
    const paths = buildElevationContourPaths(tiles, m);
    expect(paths).toHaveLength(1);
    const points = parsePathCommands(paths[0]!);
    expect(points).toHaveLength(2);
    expect(points[0]!.x).toBeCloseTo(points[1]!.x, 5);
    expect(points[0]!.y).toBe(0);
    expect(points[1]!.y).toBeCloseTo(m.cellH + m.gap / 2, 5);
  });

  it("returns one connected path with a corner for an L-shaped region", () => {
    const tiles = [
      tile(0, 0, 1),
      tile(1, 0, 1),
      tile(0, 1, 1),
      tile(1, 1, 0),
    ];
    const paths = buildElevationContourPaths(tiles, metrics2x2);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain(" Q ");
    const points = parsePathCommands(paths[0]!);
    expect(points.length).toBeGreaterThanOrEqual(3);
    const xs = new Set(points.map((p) => Math.round(p.x * 100)));
    const ys = new Set(points.map((p) => Math.round(p.y * 100)));
    expect(xs.size).toBeGreaterThan(1);
    expect(ys.size).toBeGreaterThan(1);
  });

  it("rounds all four corners of a rectangular contour loop", () => {
    const tiles = elevatedBlockGrid(1, 1, 2, 2, 4, 4);
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(4, 4, 160, 3));
    expect(paths).toHaveLength(1);
    expect(countPathQs(paths[0]!)).toBe(4);
    expect(paths[0]).toContain(" Z");
  });

  it("returns separate paths for disconnected elevation islands", () => {
    const tiles = [
      tile(0, 0, 0),
      tile(1, 0, 1),
      tile(0, 1, 1),
      tile(1, 1, 0),
    ];
    const paths = buildElevationContourPaths(tiles, metrics2x2);
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(parsePathCommands(path).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("encloses a single elev-2 tile inside an elev-1 block without joining the outer ring", () => {
    const tiles = elevatedBlockGrid(1, 1, 2, 2, 4, 4, 1);
    const peak = tiles.find((t) => t.x === 2 && t.y === 1)!;
    peak.elevation = 2;
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(4, 4, 160, 3));
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(path).toContain(" Z");
      expect(countPathQs(path)).toBe(4);
    }
    const byArea = [...paths].sort(
      (a, b) =>
        (pathBounds(b).maxX - pathBounds(b).minX) * (pathBounds(b).maxY - pathBounds(b).minY) -
        (pathBounds(a).maxX - pathBounds(a).minX) * (pathBounds(a).maxY - pathBounds(a).minY),
    );
    const outer = pathBounds(byArea[0]!);
    const inner = pathBounds(byArea[1]!);
    expect(inner.minX).toBeGreaterThan(outer.minX);
    expect(inner.maxX).toBeLessThan(outer.maxX);
    expect(inner.minY).toBeGreaterThan(outer.minY);
    expect(inner.maxY).toBeLessThan(outer.maxY);
  });

  it("draws a contiguous elev-2 rectangle inside an elev-1 block", () => {
    const tiles = elevatedBlockGrid(1, 1, 2, 2, 4, 4, 1);
    for (const t of tiles) {
      if (t.x === 2 && (t.y === 1 || t.y === 2)) t.elevation = 2;
    }
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(4, 4, 160, 3));
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(path).toContain(" Z");
      expect(countPathQs(path)).toBe(4);
    }
    const byArea = [...paths].sort(
      (a, b) =>
        (pathBounds(b).maxX - pathBounds(b).minX) * (pathBounds(b).maxY - pathBounds(b).minY) -
        (pathBounds(a).maxX - pathBounds(a).minX) * (pathBounds(a).maxY - pathBounds(a).minY),
    );
    const outer = pathBounds(byArea[0]!);
    const inner = pathBounds(byArea[1]!);
    expect(inner.minX).toBeGreaterThan(outer.minX);
    expect(inner.maxX).toBeLessThan(outer.maxX);
    expect(inner.maxY - inner.minY).toBeGreaterThan((outer.maxY - outer.minY) * 0.6);
  });

  it("keeps nested elev-2 block contours fully connected across tile borders", () => {
    const tiles = elevatedBlockGrid(1, 1, 2, 2, 4, 4, 2);
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(4, 4, 160, 3));
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(path).toContain(" Z");
      expect(countPathQs(path)).toBe(4);
    }
    const byArea = [...paths].sort(
      (a, b) =>
        (pathBounds(b).maxX - pathBounds(b).minX) * (pathBounds(b).maxY - pathBounds(b).minY) -
        (pathBounds(a).maxX - pathBounds(a).minX) * (pathBounds(a).maxY - pathBounds(a).minY),
    );
    const outer = pathBounds(byArea[0]!);
    const inner = pathBounds(byArea[1]!);
    expect(inner.minX).toBeGreaterThan(outer.minX);
    expect(inner.maxX).toBeLessThan(outer.maxX);
    expect(inner.minY).toBeGreaterThan(outer.minY);
    expect(inner.maxY).toBeLessThan(outer.maxY);
  });

  it("pinches two diagonally-touching +1 tiles into one ridge without crossing", () => {
    const tiles = flatGrid(5, 5, 0);
    for (const t of tiles) if ((t.x === 1 && t.y === 1) || (t.x === 2 && t.y === 2)) t.elevation = 1;
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(5, 5, 250, 3));
    // One closed loop enclosing both tiles, pinched at the shared corner: the
    // buggy self-crossing "infinity" version had 6 corners, the pinch has 8.
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain(" Z");
    expect(countPathQs(paths[0]!)).toBe(8);
    expect(pathSelfCrosses(paths[0]!)).toBe(false);
  });

  it("draws two diagonally-touching -1 tiles as separate rings without crossing", () => {
    // Inset (pit) contours cannot merge diagonally without self-crossing, so
    // each -1 tile keeps its own ring; they must not cross like the peak case.
    const tiles = flatGrid(5, 5, 0);
    for (const t of tiles) if ((t.x === 1 && t.y === 1) || (t.x === 2 && t.y === 2)) t.elevation = -1;
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(5, 5, 250, 3));
    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(path).toContain(" Z");
      expect(pathSelfCrosses(path)).toBe(false);
    }
  });

  it("closes a negative-elevation region with a diagonal (concave) edge", () => {
    const tiles = flatGrid(5, 5, 0);
    for (const t of tiles) {
      if ((t.x === 1 && t.y === 1) || (t.x === 2 && t.y === 1) || (t.x === 2 && t.y === 2)) t.elevation = -1;
    }
    const paths = buildElevationContourPaths(tiles, boardCellMetrics(5, 5, 250, 3));
    expect(paths).toHaveLength(1);
    expect(paths[0]).toContain(" Z");
  });
});
