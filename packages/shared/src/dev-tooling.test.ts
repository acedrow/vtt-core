import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the `dev:cf` hot-reload setup. It relies on several files agreeing:
// the client is served by the Vite dev server (HMR) and API/WS are proxied to
// the wrangler Worker, so the wrangler build must NOT rebuild the client in dev.
// History shows build tooling drifts silently; these read the real files so a
// regression that kills HMR fails CI instead of only being noticed by hand.

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

describe("dev:cf hot-reload wiring", () => {
  it("cf-wrangler-build.sh does not rebuild the client under `wrangler dev`", () => {
    const src = read("scripts/cf-wrangler-build.sh");
    const devBranch = src.slice(
      src.indexOf('= "dev" ]; then'),
      src.indexOf("else"),
    );
    expect(devBranch).not.toContain("@gaem/client");
    // deploy path (else branch) still builds the client
    expect(src.slice(src.indexOf("else"))).toContain("build -w @gaem/client");
  });

  it("wrangler watch_dir is relative to wrangler.toml (not build.cwd)", () => {
    // Wrangler joins watch_dir to dirname(configPath). Repo-root paths like
    // packages/cf-worker/src resolve to non-existent dirs and hot-reload dies.
    const toml = read("packages/cf-worker/wrangler.toml");
    const watchLine = toml
      .split("\n")
      .find((l) => l.trimStart().startsWith("watch_dir"));
    expect(watchLine).toBeDefined();
    expect(watchLine).toContain('"src"');
    expect(watchLine).toContain('"../shared/src"');
    expect(watchLine).not.toContain("client/src");
    expect(watchLine).not.toContain("packages/cf-worker");
    expect(watchLine).not.toContain("packages/shared");
  });

  it("dev:cf runs the Vite dev server with VITE_CF_DEV alongside wrangler dev", () => {
    const devCf = (
      JSON.parse(read("package.json")) as { scripts: Record<string, string> }
    ).scripts["dev:cf"]!;
    expect(devCf).toContain("VITE_CF_DEV=1");
    expect(devCf).toContain("npm run dev -w @gaem/client");
    expect(devCf).toContain("npm run dev -w @gaem/cf-worker");
  });

  it("vite proxies /api and /ws to the worker when VITE_CF_DEV is set", () => {
    const config = read("packages/client/vite.config.ts");
    expect(config).toContain("VITE_CF_DEV");
    expect(config).toMatch(/"\/api"/);
    expect(config).toMatch(/"\/ws"[\s\S]*ws:\s*true/);
  });

  it("client backend URLs honor VITE_CF_DEV for same-origin proxying", () => {
    expect(read("packages/client/src/composables/useApi.ts")).toContain(
      "VITE_CF_DEV",
    );
    expect(read("packages/client/src/composables/useGameSocket.ts")).toContain(
      "VITE_CF_DEV",
    );
  });

  it("client asset sync mirrors without rm -rf public/tiles wipe", () => {
    // A full wipe races Vite :5173 during e2e/build while dev:cf is up.
    // Node sync-dir.mjs is used instead of rsync (missing on CF Workers Builds).
    const scripts = (
      JSON.parse(read("packages/client/package.json")) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    expect(scripts["sync-tile-assets"]).toContain("scripts/sync-dir.mjs");
    expect(scripts["sync-tile-assets"]).not.toContain("rm -rf");
    expect(scripts["sync-enemy-portraits"]).toContain("scripts/sync-dir.mjs");
    expect(read("packages/client/scripts/sync-dir.mjs")).toContain("syncMirror");
  });

  it("e2e webServer skips forced shared rebuild when dist is fresh", () => {
    const config = read("packages/e2e/playwright.config.ts");
    expect(config).toContain("ensure-shared-built.mjs");
    expect(config).not.toMatch(
      /webServer:[\s\S]*command:\s*`npm run build -w @gaem\/shared/,
    );
  });

  it("game WebSocket auto-reconnects after unexpected close", () => {
    const src = read("packages/client/src/composables/useGameSocket.ts");
    expect(src).toContain("scheduleReconnect");
    expect(src).toContain("intentionalClose");
  });
});
