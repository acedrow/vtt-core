# Agent context handoff

Active repos for the Hellpiercers product built on the VTT engine.

## Repos

| Path | Role |
|------|------|
| `/Users/lindenholt/code/vtt-core` | **Active** — engine / product shell |
| `/Users/lindenholt/code/hellpiercers-content` | Private content package (git: `acedrow/hellpiercers-content`) |

## Locked product decisions

1. Content pack = private **git** dependency (`#semver:^0.0.8`), consumed at **build/boot**.
2. Named ability TypeScript lives in content via **plugin/registry API** (`CombatHookContribution.modules` + hooks).
3. ContentPack is a **facade of sub-registries**.
4. npm scope is **`@vtt-core/*`** (ADR 008).

## Boot (current)

- Product: `@vtt-core/hellpiercers-content/register` (+ client `./register-client`)
- Shared/client Vitest: fixture pack (not HP register)
- CI install: `bash scripts/ci-install.sh` + secret `CONTENT_GIT_TOKEN`
- Content CI: `ENGINE_GIT_TOKEN` + `npm run link:shared`
