# kan.bn integration

Ticket tracking for **vtt-core** lives on [kan.bn](https://kan.bn) (open-source Trello alternative). Agents and humans use the REST API plus `npm run kan`.

## Auth

- Base URL: `https://kan.bn/api/v1`
- Header: `Authorization: Bearer <KAN_API_KEY>`
- Create a key at [kan.bn settings](https://kan.bn/settings). Put it in gitignored root `.env` (see [`.env.example`](../.env.example)).
- Specs: [OpenAPI](https://kan.bn/api/v1/openapi.json), [docs index](https://docs.kan.bn/llms.txt), [introduction](https://docs.kan.bn/api-reference/introduction)

Never commit `KAN_API_KEY`.

## vtt defaults

Checked-in config: [`config/kan-vtt.json`](../config/kan-vtt.json). Optional env overrides: `KAN_WORKSPACE_PUBLIC_ID`, `KAN_BOARD_PUBLIC_ID`.

| Resource | Value |
|----------|--------|
| Workspace | **vtt** (`3aumi48oalwf`), card prefix **VTT** |
| Board | [vtt](https://kan.bn/boards/y0t45eyjddnf) (`y0t45eyjddnf`) |
| Ticket id | `VTT-<cardNumber>` (e.g. `VTT-42`) |
| Lists | `backlog` → `in-progress` → `done` |

| List slug | `listPublicId` |
|-----------|----------------|
| `backlog` | `775cv19ruwhp` |
| `in-progress` | `wpbzi1nltlxd` |
| `done` | `n6otxn6nnf3p` |

## Endpoints (agent-relevant)

| Method | Path | Use |
|--------|------|-----|
| `GET` | `/workspaces` | List workspaces for the authenticated user |
| `GET` | `/boards/{boardPublicId}` | Full board with nested lists and cards |
| `GET` | `/cards/{cardPublicId}` | Card detail (description, checklists, comments) |
| `PUT` | `/cards/{cardPublicId}` | Update `{ title?, description?, listPublicId?, index?, dueDate? }` — move lists via `listPublicId` |
| `POST` | `/cards` | Create card — body requires `title`, `description`, `listPublicId`, `labelPublicIds`, `memberPublicIds`, `position` (`start` \| `end`) |
| `DELETE` | `/cards/{cardPublicId}` | Delete a card |
| `GET` | `/workspaces/{workspacePublicId}/search?query=` | Search boards/cards by title |

Example move:

```bash
curl -sS -X PUT "https://kan.bn/api/v1/cards/<cardPublicId>" \
  -H "Authorization: Bearer $KAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"listPublicId":"wpbzi1nltlxd"}'
```

## CLI

```bash
# requires KAN_API_KEY in .env
npm run kan -- board
npm run kan -- card VTT-42
npm run kan -- move VTT-42 in-progress
npm run kan -- set-description VTT-42 --file /tmp/desc.md
npm run kan -- create --title "…" --description "…" --list backlog
npm run kan -- search "animation"
npm run kan -- delete VTT-42
```

Pass `--json` for machine-readable output. Ticket refs may be `VTT-<n>` or a card `publicId`.

Agent workflow and ticket authoring rules: [AGENTS.md](../AGENTS.md) (Kan tickets section).
