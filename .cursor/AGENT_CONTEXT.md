# Agent context handoff (from gaem → vtt-core)

Migrated from the Hellpiercers monolith conversation that planned the engine/content split.

## Sibling repos

| Path | Role |
|------|------|
| `/Users/lindenholt/code/vtt-core` | **Active** — engine / product shell |
| `/Users/lindenholt/code/hellpiercers-content` | Private content package (git: `acedrow/hellpiercers-content`) |
| `/Users/lindenholt/code/gaem` | Historical copy — do not continue structural work |

## Locked product decisions

1. Content pack = private **git** dependency (`#semver:^0.0.6`), consumed at **build/boot**.
2. Named ability TypeScript lives in content via **plugin/registry API** (`CombatHookContribution.modules` + hooks).
3. ContentPack is a **facade of sub-registries**.

## Content-pack tracks (see `plans/content_pack_contract_ca112cb6.plan.md`)

| Track | Focus | Status |
|-------|--------|--------|
| **A–E** | Catalogs, combat, campaign, client, package wire | **Done** |
| Area **#5** | Topology + private git cutover + CI install auth | **Done** |

**Next:** parent **#7** done in engine (sheetDataKeys peel, pack stamps, ensureSheet policy, sheet KV index). Publish `@gaem/hellpiercers-content@0.0.6` (sheetDataKeys) and refresh installs. `CONTENT_GIT_TOKEN` is set in GitHub Actions + Workers Builds.

## Boot (current)

- Product: `@gaem/hellpiercers-content/register` (+ client `./register-client`)
- Never `@gaem/shared/register-hellpiercers`
- Shared/client Vitest: fixture pack (not HP register)
- CI install: `bash scripts/ci-install.sh` + secret `CONTENT_GIT_TOKEN`
