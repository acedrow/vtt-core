import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the recurring "backend parity" blind spot: the local server and the
// production cf-worker Durable Object each dispatch WebSocket client messages,
// and history shows they drift (a handler added to one but not the other).
// These tests read the actual source so a divergence fails CI, not production.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

const read = (p: string) => readFileSync(p, "utf8");
const unique = (xs: string[]) => [...new Set(xs)].sort();
const matchAll = (src: string, re: RegExp) => [...src.matchAll(re)].map((m) => m[1]!);

// The canonical set of client → server message types.
function clientMessageTypes(): string[] {
  const src = read(resolve(here, "types.ts"));
  const start = src.indexOf("export type ClientMessage =");
  const block = src.slice(start, src.indexOf("\n\n", start));
  return unique(matchAll(block, /type:\s*"(\w+)"/g));
}

// Message types the shared combat handler owns (both backends delegate to it).
function sharedHandledTypes(): string[] {
  const src = read(resolve(here, "combat/messages.ts"));
  const start = src.indexOf("export function handleCombatMessage");
  const block = src.slice(start, src.indexOf("default:", start));
  return unique(matchAll(block, /case "(\w+)":/g));
}

// Message types a backend handles inline before/instead of the shared handler.
function inlineHandledTypes(file: string): string[] {
  return unique(matchAll(read(file), /parsed\.type === "(\w+)"/g));
}

const serverFile = resolve(repoRoot, "packages/server/src/index.ts");
const cfWorkerFile = resolve(repoRoot, "packages/cf-worker/src/game-room.ts");

describe("WebSocket dispatch parity (server vs cf-worker)", () => {
  it("both backends handle the same inline message types", () => {
    expect(inlineHandledTypes(serverFile)).toEqual(inlineHandledTypes(cfWorkerFile));
  });

  it("every ClientMessage type is handled by a backend or the shared handler", () => {
    const covered = unique([...inlineHandledTypes(serverFile), ...sharedHandledTypes()]);
    expect(covered).toEqual(clientMessageTypes());
  });

  it("the shared handler contains no dead cases outside the ClientMessage union", () => {
    const union = new Set(clientMessageTypes());
    for (const t of sharedHandledTypes()) expect(union.has(t)).toBe(true);
  });
});
