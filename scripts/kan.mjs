#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://kan.bn/api/v1";
const CONFIG_PATH = join(ROOT, "config", "kan-vtt.json");
const ENV_PATH = join(ROOT, ".env");

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function loadDotEnv() {
  if (!existsSync(ENV_PATH)) return;
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

function usage() {
  console.log(`Usage: npm run kan -- <command> [args] [--json]

Commands:
  board
  card <VTT-n|publicId>
  move <VTT-n|publicId> <backlog|in-progress|done>
  set-description <VTT-n|publicId> --file <path>
  create --title <title> --description <text> [--list backlog]
  search <query>
  delete <VTT-n|publicId>

Requires KAN_API_KEY in .env (see .env.example).`);
}

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) die(`Missing config: ${CONFIG_PATH}`);
  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  return {
    ...raw,
    workspacePublicId: process.env.KAN_WORKSPACE_PUBLIC_ID || raw.workspacePublicId,
    boardPublicId: process.env.KAN_BOARD_PUBLIC_ID || raw.boardPublicId,
  };
}

function requireApiKey() {
  const key = process.env.KAN_API_KEY;
  if (!key) {
    die(
      "KAN_API_KEY is missing. Copy .env.example to .env and set KAN_API_KEY (https://kan.bn/settings).",
    );
  }
  return key;
}

async function kanFetch(path, { method = "GET", body } = {}) {
  const key = requireApiKey();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const detail = typeof data === "object" && data?.message ? data.message : text || res.statusText;
    die(`kan.bn ${method} ${path} → ${res.status}: ${detail}`);
  }
  return data;
}

function parseArgs(argv) {
  const flags = new Set();
  const named = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") {
      flags.add("json");
      continue;
    }
    if (a.startsWith("--") && a.length > 2) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) die(`Missing value for --${key}`);
      named[key] = next;
      i++;
      continue;
    }
    positional.push(a);
  }
  return { flags, named, positional };
}

function ticketLabel(prefix, cardNumber) {
  return cardNumber == null ? null : `${prefix}-${cardNumber}`;
}

async function getBoard(config) {
  return kanFetch(`/boards/${config.boardPublicId}`);
}

function findCardOnBoard(board, ref, prefix) {
  const upper = ref.toUpperCase();
  const m = upper.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
  const wantNumber = m ? Number(m[1]) : null;

  for (const list of board.lists ?? []) {
    for (const card of list.cards ?? []) {
      if (wantNumber != null && card.cardNumber === wantNumber) {
        return { card, list };
      }
      if (card.publicId === ref) {
        return { card, list };
      }
    }
  }
  return null;
}

async function resolveCard(config, ref) {
  const board = await getBoard(config);
  const hit = findCardOnBoard(board, ref, config.cardPrefix);
  if (!hit) die(`Card not found on board: ${ref}`);
  return { board, ...hit };
}

function listId(config, slug) {
  const id = config.lists?.[slug];
  if (!id) {
    die(`Unknown list "${slug}". Expected one of: ${Object.keys(config.lists ?? {}).join(", ")}`);
  }
  return id;
}

function printBoard(board, config) {
  console.log(`${board.name} (${board.publicId}) — ${config.boardUrl}`);
  for (const list of board.lists ?? []) {
    const cards = list.cards ?? [];
    console.log(`\n## ${list.name} (${cards.length})`);
    if (cards.length === 0) {
      console.log("  (empty)");
      continue;
    }
    for (const card of cards) {
      const id = ticketLabel(config.cardPrefix, card.cardNumber) ?? card.publicId;
      console.log(`  - ${id}: ${card.title}`);
    }
  }
}

function printCard(card, listName, config) {
  const id = ticketLabel(config.cardPrefix, card.cardNumber) ?? card.publicId;
  console.log(`${id}: ${card.title}`);
  console.log(`publicId: ${card.publicId}`);
  if (listName) console.log(`list: ${listName}`);
  if (card.dueDate) console.log(`due: ${card.dueDate}`);
  console.log("---");
  console.log(card.description ?? "(no description)");
}

async function cmdBoard(config, asJson) {
  const board = await getBoard(config);
  if (asJson) {
    console.log(JSON.stringify(board, null, 2));
    return;
  }
  printBoard(board, config);
}

async function cmdCard(config, ref, asJson) {
  const { card, list } = await resolveCard(config, ref);
  const full = await kanFetch(`/cards/${card.publicId}`);
  if (asJson) {
    console.log(JSON.stringify({ ...full, listName: list.name }, null, 2));
    return;
  }
  printCard(full, list.name, config);
}

async function cmdMove(config, ref, listSlug, asJson) {
  const { card } = await resolveCard(config, ref);
  const updated = await kanFetch(`/cards/${card.publicId}`, {
    method: "PUT",
    body: { listPublicId: listId(config, listSlug) },
  });
  if (asJson) {
    console.log(JSON.stringify(updated, null, 2));
    return;
  }
  const id = ticketLabel(config.cardPrefix, card.cardNumber) ?? card.publicId;
  console.log(`Moved ${id} → ${listSlug}`);
}

async function cmdSetDescription(config, ref, filePath, asJson) {
  if (!filePath) die("set-description requires --file <path>");
  const abs = resolve(filePath);
  if (!existsSync(abs)) die(`File not found: ${abs}`);
  const description = readFileSync(abs, "utf8");
  const { card } = await resolveCard(config, ref);
  const updated = await kanFetch(`/cards/${card.publicId}`, {
    method: "PUT",
    body: { description },
  });
  if (asJson) {
    console.log(JSON.stringify(updated, null, 2));
    return;
  }
  const id = ticketLabel(config.cardPrefix, card.cardNumber) ?? card.publicId;
  console.log(`Updated description for ${id}`);
}

async function cmdCreate(config, named, asJson) {
  const title = named.title;
  const description = named.description ?? "";
  const listSlug = named.list ?? "backlog";
  if (!title) die("create requires --title");
  if (named.description === undefined) die("create requires --description");
  const created = await kanFetch("/cards", {
    method: "POST",
    body: {
      title,
      description,
      listPublicId: listId(config, listSlug),
      labelPublicIds: [],
      memberPublicIds: [],
      position: "end",
    },
  });
  // Re-fetch board to print VTT-n
  const board = await getBoard(config);
  const hit = findCardOnBoard(board, created.publicId, config.cardPrefix);
  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ...created,
          cardNumber: hit?.card.cardNumber ?? null,
          ticket: ticketLabel(config.cardPrefix, hit?.card.cardNumber) ?? null,
          list: listSlug,
        },
        null,
        2,
      ),
    );
    return;
  }
  const id = ticketLabel(config.cardPrefix, hit?.card.cardNumber) ?? created.publicId;
  console.log(`Created ${id} in ${listSlug} (${created.publicId})`);
}

async function cmdSearch(config, query, asJson) {
  if (!query) die("search requires a query");
  const results = await kanFetch(
    `/workspaces/${config.workspacePublicId}/search?query=${encodeURIComponent(query)}`,
  );
  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  if (!Array.isArray(results) || results.length === 0) {
    console.log("(no results)");
    return;
  }
  for (const item of results) {
    if (item.type === "card") {
      const id = ticketLabel(config.cardPrefix, item.cardNumber) ?? item.publicId;
      console.log(`card  ${id}: ${item.title} [${item.listName} / ${item.boardName}]`);
    } else {
      console.log(`board ${item.publicId}: ${item.title}`);
    }
  }
}

async function cmdDelete(config, ref, asJson) {
  const { card } = await resolveCard(config, ref);
  const id = ticketLabel(config.cardPrefix, card.cardNumber) ?? card.publicId;
  await kanFetch(`/cards/${card.publicId}`, { method: "DELETE" });
  if (asJson) {
    console.log(JSON.stringify({ deleted: card.publicId, ticket: id }, null, 2));
    return;
  }
  console.log(`Deleted ${id}`);
}

async function main() {
  const { flags, named, positional } = parseArgs(process.argv.slice(2));
  const asJson = flags.has("json");
  const [cmd, ...rest] = positional;

  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    usage();
    process.exit(cmd ? 0 : 1);
  }

  const config = loadConfig();

  switch (cmd) {
    case "board":
      await cmdBoard(config, asJson);
      break;
    case "card":
      if (!rest[0]) die("card requires <VTT-n|publicId>");
      await cmdCard(config, rest[0], asJson);
      break;
    case "move":
      if (!rest[0] || !rest[1]) die("move requires <VTT-n|publicId> <list>");
      await cmdMove(config, rest[0], rest[1], asJson);
      break;
    case "set-description":
      if (!rest[0]) die("set-description requires <VTT-n|publicId>");
      await cmdSetDescription(config, rest[0], named.file, asJson);
      break;
    case "create":
      await cmdCreate(config, named, asJson);
      break;
    case "search":
      await cmdSearch(config, rest.join(" ") || named.query, asJson);
      break;
    case "delete":
      if (!rest[0]) die("delete requires <VTT-n|publicId>");
      await cmdDelete(config, rest[0], asJson);
      break;
    default:
      die(`Unknown command: ${cmd}\n`);
  }
}

main().catch((err) => {
  die(err?.stack || String(err));
});
