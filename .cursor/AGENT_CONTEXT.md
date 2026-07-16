# Agent context handoff (from gaem → vtt-core)

Migrated from the Hellpiercers monolith conversation that planned the engine/content split.

## Sibling repos

| Path | Role |
|------|------|
| `/Users/lindenholt/code/vtt-core` | **Active** — engine + in-repo `@gaem/hellpiercers-content` strangler |
| `/Users/lindenholt/code/gaem` | Historical copy — do not continue structural work |

## Locked product decisions

1. Content pack = private npm/git dependency eventually; in-repo workspace package today. Consumed at **build/boot** time.
2. Named ability TypeScript moves to content via **plugin/registry API** (`CombatHookContribution.modules` + hooks).
3. ContentPack is a **facade of sub-registries** — do not implement the whole API in one plan.

## Content-pack tracks (see `plans/content_pack_contract_ca112cb6.plan.md`)

| Track | Focus | Status |
|-------|--------|--------|
| **A** | Catalog registry + boot lifecycle + fixture pack | **Done** |
| **B** | Combat hook registry API + proof migrations | **Done** (Open B remainders closed) |
| **C** | Campaign / sheet extension contract | **Done** (config + nesting + hooks; see parent #2) |
| **D** | Client contribution registry (UI/assets) | **Done** (API + AppShell + SFC/glob/theme peel + landing branding) |
| **E** | Content package wire + CI | **In-repo + boots + fixture CI done**; private remote open |

Close-gaps Phases 0–4 and Area #1 Open B exit are **done**. Parent **#2** types untangle is **done**.

**Next:** private cutover ([cutover doc](../docs/content-package-private-cutover.md)). Parent **#7** (sheet/pack-version KV) stays deferred.

## Boot (current)

- Product: `@gaem/hellpiercers-content/register` (+ client `./register-client`)
- Never `@gaem/shared/register-hellpiercers`
- Shared/client Vitest: fixture pack (not HP register)

## Open Track B remainders

**Closed** (Area #1 gap-close): Gorgenaut → `confirmPending` + content; Kopis retaliation hook; nested WS only; facade/`ContentCombatKey` retirement; landing branding; `"HELLPIERCERS"` out of shared `rule-text.ts`.

## Private cutover notes

- Content peerDepends on `@gaem/client` (Vue panels) — keep or invert before remote split
- Exports: `./register` (dist), `./register-client` + `./tiles` (source today)
- Grep: also watch `"HELLPIERCERS"` in `shared/rule-text.ts` before public engine tree

## Prior conversation (gaem Cursor project)

Planning discussion lived under the `gaem` Cursor project agent transcripts. Prefer this file + `plans/` + `AGENTS.md` over re-deriving from transcripts.
