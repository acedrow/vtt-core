import { randomUUID } from "node:crypto";

import type { CharacterSheet, ConsoleActor } from "@vtt-core/shared";
import {
  applySheetDataKeys,
  collectSheetDataFromBody,
  ensureCharacterSheet,
  logSheetFieldChanges,
  replaceSheetDataBag,
  sheetDataKeyUpdatesFromBody,
  stampContentPackMeta,
  validateCharacterSheetRefs,
} from "@vtt-core/shared";
import type { Request, Response } from "express";

import type { AuthContext } from "./auth.js";
import { authHasGmCapabilities } from "./auth.js";

export const characterSheets = new Map<string, CharacterSheet>();
export const portraits = new Map<string, { body: Buffer; contentType: string }>();

const PORTRAIT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function portraitObjectKey(sheetId: string, ext: string): string {
  return `portraits/${sheetId}/${randomUUID()}.${ext}`;
}

function portraitExt(contentType: string): string | null {
  return PORTRAIT_TYPES[contentType] ?? null;
}

function canViewSheet(auth: AuthContext): boolean {
  return auth.role === "gm" || auth.role === "player";
}

function canEditSheet(auth: AuthContext, sheet: CharacterSheet): boolean {
  if (auth.role === "gm") return true;
  return sheet.player === auth.playerKey;
}

function canAccessSheet(auth: AuthContext, _sheet: CharacterSheet): boolean {
  return canViewSheet(auth);
}

function canCreateForPlayer(auth: AuthContext, playerId: string): boolean {
  if (auth.role === "gm") return true;
  return auth.playerKey === playerId;
}

function deletePortrait(portraitKey: string | null): void {
  if (portraitKey) portraits.delete(portraitKey);
}

function loadSheet(sheet: CharacterSheet): CharacterSheet | { error: string; status: number } {
  const ensured = ensureCharacterSheet(sheet);
  if (!ensured.ok) return { error: ensured.error, status: 409 };
  return ensured.sheet;
}

export function listSheetsHandler(_auth: AuthContext, res: Response): void {
  const sheets: CharacterSheet[] = [];
  for (const sheet of characterSheets.values()) {
    const loaded = loadSheet(sheet);
    if ("error" in loaded) continue;
    sheets.push(loaded);
  }
  res.json({ sheets });
}

export function createSheetHandler(
  auth: AuthContext,
  req: Request,
  res: Response,
  hasProfile: (id: string) => boolean,
  constructedIds: readonly string[] = [],
): void {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const player = typeof body.player === "string" ? body.player.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const className = typeof body.class === "string" ? body.class.trim() : "";
  const armor = typeof body.armor === "string" ? body.armor.trim() : "";
  const weapon = typeof body.weapon === "string" ? body.weapon.trim() : "";
  const data = collectSheetDataFromBody(body);

  if (!player || !name || !className || !armor || !weapon) {
    res.status(400).json({ error: "player, name, class, armor, and weapon are required" });
    return;
  }
  if (!canCreateForPlayer(auth, player)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!hasProfile(player)) {
    res.status(400).json({ error: "Player profile not found" });
    return;
  }

  const refError = validateCharacterSheetRefs(
    { class: className, armor, weapon, data },
    constructedIds,
  );
  if (refError) {
    res.status(400).json({ error: refError });
    return;
  }

  const now = new Date().toISOString();
  const sheet: CharacterSheet = {
    id: randomUUID(),
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
  characterSheets.set(sheet.id, sheet);
  res.status(201).json({ sheet });
}

export function getSheetHandler(auth: AuthContext, id: string, res: Response): void {
  const sheet = characterSheets.get(id);
  if (!sheet) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canAccessSheet(auth, sheet)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const loaded = loadSheet(sheet);
  if ("error" in loaded) {
    res.status(loaded.status).json({ error: loaded.error });
    return;
  }
  res.json({ sheet: loaded });
}

export function patchSheetHandler(
  auth: AuthContext,
  id: string,
  req: Request,
  res: Response,
  hasProfile: (id: string) => boolean,
  opts?: {
    actor: ConsoleActor;
    sheetOnBoard: boolean;
    logConsole: (actor: ConsoleActor, message: string) => void;
    constructedIds?: readonly string[];
  },
): void {
  const sheet = characterSheets.get(id);
  if (!sheet) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canAccessSheet(auth, sheet)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!canEditSheet(auth, sheet)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const loaded = loadSheet(sheet);
  if ("error" in loaded) {
    res.status(loaded.status).json({ error: loaded.error });
    return;
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

  const body = (req.body ?? {}) as Record<string, unknown>;

  if (body.player !== undefined) {
    if (!authHasGmCapabilities(auth)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const player = typeof body.player === "string" ? body.player.trim() : "";
    if (!player || !hasProfile(player)) {
      res.status(400).json({ error: "Invalid player" });
      return;
    }
    sheet.player = player;
  }

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "Invalid name" });
      return;
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

  const constructedIds = opts?.constructedIds ?? [];
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
    res.status(400).json({ error: refError });
    return;
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
      res.status(400).json({ error: "Invalid data" });
      return;
    }
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) {
      res.status(400).json({ error: "Invalid tags" });
      return;
    }
    const tags = body.tags
      .filter((t: unknown): t is string => typeof t === "string")
      .map((t: string) => t.trim())
      .filter(Boolean);
    sheet.tags = tags.length ? tags : undefined;
  }

  sheet.updatedAt = new Date().toISOString();
  stampContentPackMeta(sheet);
  characterSheets.set(sheet.id, sheet);
  if (opts) {
    const label = sheet.name || "Character";
    logSheetFieldChanges(
      opts.logConsole,
      opts.actor,
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
      opts.sheetOnBoard,
    );
  }
  res.json({ sheet });
}

export function deleteSheetHandler(
  auth: AuthContext,
  id: string,
  res: Response,
  onDeleted?: (sheetId: string) => void,
): void {
  const sheet = characterSheets.get(id);
  if (!sheet) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canAccessSheet(auth, sheet)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!canEditSheet(auth, sheet)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  deletePortrait(sheet.portraitKey);
  characterSheets.delete(id);
  onDeleted?.(id);
  res.json({ ok: true });
}

export function putPortraitHandler(
  auth: AuthContext,
  id: string,
  req: Request,
  res: Response
): void {
  const sheet = characterSheets.get(id);
  if (!sheet) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canAccessSheet(auth, sheet)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!canEditSheet(auth, sheet)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const contentType = req.headers["content-type"] ?? "";
  const ext = portraitExt(contentType);
  if (!ext) {
    res.status(400).json({
      error: "Content-Type must be image/jpeg, image/png, or image/webp",
    });
    return;
  }

  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).json({ error: "Empty body" });
    return;
  }

  const newKey = portraitObjectKey(id, ext);
  portraits.set(newKey, { body, contentType });
  deletePortrait(sheet.portraitKey);
  sheet.portraitKey = newKey;
  sheet.updatedAt = new Date().toISOString();
  stampContentPackMeta(sheet);
  characterSheets.set(sheet.id, sheet);
  res.json({ sheet });
}

export function getPortraitHandler(auth: AuthContext, id: string, res: Response): void {
  const sheet = characterSheets.get(id);
  if (!sheet) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canAccessSheet(auth, sheet)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!sheet.portraitKey) {
    res.status(404).json({ error: "No portrait" });
    return;
  }

  const portrait = portraits.get(sheet.portraitKey);
  if (!portrait) {
    res.status(404).json({ error: "Portrait not found" });
    return;
  }

  res.setHeader("Content-Type", portrait.contentType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(portrait.body);
}
