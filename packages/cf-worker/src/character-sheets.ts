import type { CharacterSheet } from "@gaem/shared";
import {
  actorForAuth,
  applySheetDataKeys,
  collectSheetDataFromBody,
  ensureCharacterSheet,
  logSheetFieldChanges,
  replaceSheetDataBag,
  sheetDataKeyUpdatesFromBody,
  stampContentPackMeta,
  validateCharacterSheetRefs,
} from "@gaem/shared";

import type { AuthContext } from "./auth.js";
import { authHasGmCapabilities, canAccessSheet, canCreateForPlayer, canEditSheet } from "./auth.js";
import { logConsole } from "./console-log.js";
import type { Env } from "./env.js";
import { getPlayerProfile } from "./player-profiles.js";

const PREFIX = "character-sheet:";
const INDEX_KEY = "character-sheet-index";

function key(id: string): string {
  return `${PREFIX}${id}`;
}

async function readSheetIds(env: Env): Promise<string[]> {
  const raw = await env.PLAYER_KV.get<string[]>(INDEX_KEY, "json");
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
}

async function writeSheetIds(env: Env, ids: string[]): Promise<void> {
  await env.PLAYER_KV.put(INDEX_KEY, JSON.stringify(ids));
}

async function addSheetId(env: Env, id: string): Promise<void> {
  const ids = await readSheetIds(env);
  if (ids.includes(id)) return;
  await writeSheetIds(env, [...ids, id]);
}

async function removeSheetId(env: Env, id: string): Promise<void> {
  const ids = await readSheetIds(env);
  if (!ids.includes(id)) return;
  await writeSheetIds(
    env,
    ids.filter((existingId) => existingId !== id),
  );
}

async function listSheetsFromPrefix(env: Env): Promise<CharacterSheet[]> {
  const sheets: CharacterSheet[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.PLAYER_KV.list({ prefix: PREFIX, cursor });
    const batch = await Promise.all(
      page.keys.map(({ name }) => env.PLAYER_KV.get<CharacterSheet>(name, "json")),
    );
    sheets.push(...batch.filter((s): s is CharacterSheet => !!s));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return sheets;
}

async function syncSheetIndex(env: Env, sheets: CharacterSheet[]): Promise<void> {
  await writeSheetIds(
    env,
    sheets.map((sheet) => sheet.id),
  );
}

export async function listCharacterSheets(env: Env): Promise<CharacterSheet[]> {
  const ids = await readSheetIds(env);
  if (ids.length > 0) {
    const sheets = await Promise.all(ids.map((id) => getCharacterSheet(env, id)));
    const indexed = sheets.filter((s): s is CharacterSheet => !!s);
    if (indexed.length > 0) return indexed;
  }

  const listed = await listSheetsFromPrefix(env);
  if (listed.length > 0) {
    await syncSheetIndex(env, listed);
  }
  return listed;
}

export async function getCharacterSheet(
  env: Env,
  id: string
): Promise<CharacterSheet | null> {
  return env.PLAYER_KV.get<CharacterSheet>(key(id), "json");
}

export async function saveCharacterSheet(
  env: Env,
  sheet: CharacterSheet
): Promise<void> {
  await env.PLAYER_KV.put(key(sheet.id), JSON.stringify(sheet));
  await addSheetId(env, sheet.id);
}

export async function deleteCharacterSheet(env: Env, id: string): Promise<void> {
  await env.PLAYER_KV.delete(key(id));
  await removeSheetId(env, id);
}

export async function deletePortrait(env: Env, portraitKey: string | null): Promise<void> {
  if (portraitKey) {
    await env.PORTRAIT_R2.delete(portraitKey);
  }
}

export function portraitObjectKey(sheetId: string, ext: string): string {
  return `portraits/${sheetId}/${crypto.randomUUID()}.${ext}`;
}

const PORTRAIT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function portraitExt(contentType: string): string | null {
  return PORTRAIT_TYPES[contentType] ?? null;
}

async function getConstructedBaseUpgrades(env: Env): Promise<string[]> {
  const roomId = env.GAME_ROOM.idFromName("default");
  const stub = env.GAME_ROOM.get(roomId);
  const res = await stub.fetch("http://internal/internal/campaign-unlocks");
  const data = (await res.json()) as { constructedBaseUpgrades: string[] };
  return data.constructedBaseUpgrades ?? [];
}

async function loadAndPersistSheet(
  env: Env,
  sheet: CharacterSheet,
): Promise<{ ok: true; sheet: CharacterSheet } | { ok: false; error: string; status: number }> {
  const ensured = ensureCharacterSheet(sheet);
  if (!ensured.ok) return { ok: false, error: ensured.error, status: 409 };
  if (ensured.dirty) {
    await saveCharacterSheet(env, ensured.sheet);
  }
  return { ok: true, sheet: ensured.sheet };
}

type CreateBody = {
  player?: unknown;
  name?: unknown;
  class?: unknown;
  armor?: unknown;
  weapon?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

export async function handleListCharacterSheets(
  env: Env,
  _auth: AuthContext
): Promise<Response> {
  const raw = await listCharacterSheets(env);
  const sheets: CharacterSheet[] = [];
  for (const sheet of raw) {
    const loaded = await loadAndPersistSheet(env, sheet);
    if (loaded.ok) sheets.push(loaded.sheet);
  }
  return Response.json({ sheets });
}

export async function handleCreateCharacterSheet(
  env: Env,
  auth: AuthContext,
  request: Request
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as CreateBody | null;
  const player = typeof body?.player === "string" ? body.player.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const className = typeof body?.class === "string" ? body.class.trim() : "";
  const armor = typeof body?.armor === "string" ? body.armor.trim() : "";
  const weapon = typeof body?.weapon === "string" ? body.weapon.trim() : "";
  const data = collectSheetDataFromBody(body ?? undefined);

  if (!player || !name || !className || !armor || !weapon) {
    return Response.json(
      { error: "player, name, class, armor, and weapon are required" },
      { status: 400 }
    );
  }

  if (!canCreateForPlayer(auth, player)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const profile = await getPlayerProfile(env, player);
  if (!profile) {
    return Response.json({ error: "Player profile not found" }, { status: 400 });
  }

  const constructedIds = await getConstructedBaseUpgrades(env);
  const refError = validateCharacterSheetRefs(
    {
      class: className,
      armor,
      weapon,
      data,
    },
    constructedIds,
  );
  if (refError) {
    return Response.json({ error: refError }, { status: 400 });
  }

  const now = new Date().toISOString();
  const sheet: CharacterSheet = {
    id: crypto.randomUUID(),
    player,
    name,
    portraitKey: null,
    class: className,
    armor,
    weapon,
    ...(data ? { data } : {}),
    createdAt: now,
    updatedAt: now,
  };
  applySheetDataKeys(sheet, data);
  stampContentPackMeta(sheet);
  await saveCharacterSheet(env, sheet);
  return Response.json({ sheet }, { status: 201 });
}

export async function handleGetCharacterSheet(
  env: Env,
  auth: AuthContext,
  id: string
): Promise<Response> {
  const sheet = await getCharacterSheet(env, id);
  if (!sheet) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccessSheet(auth, sheet)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const loaded = await loadAndPersistSheet(env, sheet);
  if (!loaded.ok) {
    return Response.json({ error: loaded.error }, { status: loaded.status });
  }
  return Response.json({ sheet: loaded.sheet });
}

type PatchBody = {
  name?: unknown;
  class?: unknown;
  armor?: unknown;
  weapon?: unknown;
  equipment?: unknown;
  gear?: unknown;
  gearArmor?: unknown;
  weapon2?: unknown;
  tags?: unknown;
  player?: unknown;
  data?: unknown;
  [key: string]: unknown;
};

export async function handlePatchCharacterSheet(
  env: Env,
  auth: AuthContext,
  id: string,
  request: Request
): Promise<Response> {
  const sheet = await getCharacterSheet(env, id);
  if (!sheet) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccessSheet(auth, sheet)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canEditSheet(auth, sheet)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const loaded = await loadAndPersistSheet(env, sheet);
  if (!loaded.ok) {
    return Response.json({ error: loaded.error }, { status: loaded.status });
  }

  const prev = {
    name: sheet.name,
    class: sheet.class,
    armor: sheet.armor,
    weapon: sheet.weapon,
    equipment: sheet.equipment,
    gear: sheet.gear,
    gearArmor: sheet.gearArmor,
    weapon2: sheet.weapon2,
    data: sheet.data,
    tags: sheet.tags,
  };

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.player !== undefined) {
    if (!(await authHasGmCapabilities(auth, env))) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const player = typeof body.player === "string" ? body.player.trim() : "";
    if (!player) {
      return Response.json({ error: "Invalid player" }, { status: 400 });
    }
    const profile = await getPlayerProfile(env, player);
    if (!profile) {
      return Response.json({ error: "Player profile not found" }, { status: 400 });
    }
    sheet.player = player;
  }

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json({ error: "Invalid name" }, { status: 400 });
    }
    sheet.name = name;
  }

  const refFields: {
    class?: string;
    armor?: string;
    weapon?: string;
    equipment?: string;
    gear?: string;
    gearArmor?: string;
    weapon2?: string;
    data?: Record<string, unknown>;
  } = {};
  if (body.class !== undefined) {
    refFields.class = typeof body.class === "string" ? body.class.trim() : "";
  }
  if (body.armor !== undefined) {
    refFields.armor = typeof body.armor === "string" ? body.armor.trim() : "";
  }
  if (body.weapon !== undefined) {
    refFields.weapon = typeof body.weapon === "string" ? body.weapon.trim() : "";
  }
  if (body.equipment !== undefined) {
    refFields.equipment = typeof body.equipment === "string" ? body.equipment.trim() : "";
  }
  if (body.gear !== undefined) {
    refFields.gear = typeof body.gear === "string" ? body.gear.trim() : "";
  }
  if (body.gearArmor !== undefined) {
    refFields.gearArmor = typeof body.gearArmor === "string" ? body.gearArmor.trim() : "";
  }
  if (body.weapon2 !== undefined) {
    refFields.weapon2 = typeof body.weapon2 === "string" ? body.weapon2.trim() : "";
  }
  const keyUpdates = sheetDataKeyUpdatesFromBody(body);
  if (keyUpdates) {
    refFields.data = { ...keyUpdates };
  }

  const constructedIds = await getConstructedBaseUpgrades(env);
  const refError = validateCharacterSheetRefs(refFields, constructedIds, {
    class: sheet.class,
    armor: sheet.armor,
    weapon: sheet.weapon,
    equipment: sheet.equipment,
    gear: sheet.gear,
    gearArmor: sheet.gearArmor,
    weapon2: sheet.weapon2,
    data: sheet.data,
  });
  if (refError) {
    return Response.json({ error: refError }, { status: 400 });
  }

  if (refFields.class !== undefined) sheet.class = refFields.class;
  if (refFields.armor !== undefined) sheet.armor = refFields.armor;
  if (refFields.weapon !== undefined) sheet.weapon = refFields.weapon;
  if (refFields.equipment !== undefined) sheet.equipment = refFields.equipment || undefined;
  if (refFields.gear !== undefined) sheet.gear = refFields.gear || undefined;
  if (refFields.gearArmor !== undefined) sheet.gearArmor = refFields.gearArmor || undefined;
  if (refFields.weapon2 !== undefined) sheet.weapon2 = refFields.weapon2 || undefined;
  if (keyUpdates) {
    applySheetDataKeys(sheet, keyUpdates);
  }

  if (body.data !== undefined) {
    if (body.data === null) {
      replaceSheetDataBag(sheet, null, keyUpdates);
    } else if (typeof body.data === "object" && !Array.isArray(body.data)) {
      replaceSheetDataBag(sheet, body.data as Record<string, unknown>, keyUpdates);
    } else {
      return Response.json({ error: "Invalid data" }, { status: 400 });
    }
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      return Response.json({ error: "Invalid tags" }, { status: 400 });
    }
    const tags = body.tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
    sheet.tags = tags.length ? tags : undefined;
  }

  sheet.updatedAt = new Date().toISOString();
  stampContentPackMeta(sheet);
  await saveCharacterSheet(env, sheet);

  const roomId = env.GAME_ROOM.idFromName("default");
  const stub = env.GAME_ROOM.get(roomId);
  const onBoardRes = await stub.fetch(`http://internal/internal/sheet-on-board?sheetId=${encodeURIComponent(id)}`);
  const onBoardData = (await onBoardRes.json()) as { onBoard: boolean };
  const profile = auth.playerKey ? await getPlayerProfile(env, auth.playerKey) : null;
  const actor = actorForAuth(auth.role, profile?.name);
  const label = sheet.name || "Character";
  logSheetFieldChanges(
    (a, message) => {
      void logConsole(env, a, message);
    },
    actor,
    label,
    prev,
    {
      name: sheet.name,
      class: sheet.class,
      armor: sheet.armor,
      weapon: sheet.weapon,
      equipment: sheet.equipment,
      gear: sheet.gear,
      weapon2: sheet.weapon2,
      data: sheet.data,
      tags: sheet.tags,
    },
    onBoardData.onBoard,
  );

  return Response.json({ sheet });
}

export async function handleDeleteCharacterSheet(
  env: Env,
  auth: AuthContext,
  id: string
): Promise<Response> {
  const sheet = await getCharacterSheet(env, id);
  if (!sheet) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccessSheet(auth, sheet)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canEditSheet(auth, sheet)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await deletePortrait(env, sheet.portraitKey);
  await deleteCharacterSheet(env, id);

  const roomId = env.GAME_ROOM.idFromName("default");
  const stub = env.GAME_ROOM.get(roomId);
  await stub.fetch("http://internal/internal/remove-sheet-token", {
    method: "POST",
    body: JSON.stringify({ sheetId: id }),
  });

  return Response.json({ ok: true });
}

export async function handlePutPortrait(
  env: Env,
  auth: AuthContext,
  id: string,
  request: Request
): Promise<Response> {
  const sheet = await getCharacterSheet(env, id);
  if (!sheet) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccessSheet(auth, sheet)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canEditSheet(auth, sheet)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  const ext = portraitExt(contentType);
  if (!ext) {
    return Response.json(
      { error: "Content-Type must be image/jpeg, image/png, or image/webp" },
      { status: 400 }
    );
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return Response.json({ error: "Empty body" }, { status: 400 });
  }

  const newKey = portraitObjectKey(id, ext);
  await env.PORTRAIT_R2.put(newKey, body, {
    httpMetadata: { contentType },
  });

  if (sheet.portraitKey) {
    await deletePortrait(env, sheet.portraitKey);
  }

  sheet.portraitKey = newKey;
  sheet.updatedAt = new Date().toISOString();
  stampContentPackMeta(sheet);
  await saveCharacterSheet(env, sheet);

  return Response.json({ sheet });
}

export async function handleGetPortrait(
  env: Env,
  auth: AuthContext,
  id: string
): Promise<Response> {
  const sheet = await getCharacterSheet(env, id);
  if (!sheet) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccessSheet(auth, sheet)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!sheet.portraitKey) {
    return Response.json({ error: "No portrait" }, { status: 404 });
  }

  const object = await env.PORTRAIT_R2.get(sheet.portraitKey);
  if (!object) {
    return Response.json({ error: "Portrait not found" }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
