import { getPlayerDataString, liftLegacyTopLevelIntoData, setPlayerDataString } from "@gaem/shared";

const YADATHAN_TOWER_DATA_KEY = "yadathanTower";
import { randomUUID } from "node:crypto";

import type { CharacterSheet, ConsoleActor } from "@gaem/shared";
import { logSheetFieldChanges, validateCharacterSheetRefs } from "@gaem/shared";
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

export function listSheetsHandler(_auth: AuthContext, res: Response): void {
  res.json({ sheets: [...characterSheets.values()] });
}

export function createSheetHandler(
  auth: AuthContext,
  req: Request,
  res: Response,
  hasProfile: (id: string) => boolean,
  constructedIds: readonly string[] = [],
): void {
  const player = typeof req.body?.player === "string" ? req.body.player.trim() : "";
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const className = typeof req.body?.class === "string" ? req.body.class.trim() : "";
  const armor = typeof req.body?.armor === "string" ? req.body.armor.trim() : "";
  const weapon = typeof req.body?.weapon === "string" ? req.body.weapon.trim() : "";
  const yadathanTower =
    typeof req.body?.yadathanTower === "string" ? req.body.yadathanTower.trim() : undefined;
  const data =
    req.body?.data != null && typeof req.body.data === "object" && !Array.isArray(req.body.data)
      ? (req.body.data as Record<string, unknown>)
      : undefined;

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
    { class: className, armor, weapon, data: yadathanTower ? { yadathanTower } : data },
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
  const towerFromData =
    data && typeof data.yadathanTower === "string" ? data.yadathanTower.trim() : undefined;
  setPlayerDataString(sheet, YADATHAN_TOWER_DATA_KEY, yadathanTower || towerFromData || undefined);
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
  liftLegacyTopLevelIntoData(sheet, YADATHAN_TOWER_DATA_KEY);
  res.json({ sheet });
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

  liftLegacyTopLevelIntoData(sheet, YADATHAN_TOWER_DATA_KEY);
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

  if (req.body?.player !== undefined) {
    if (!authHasGmCapabilities(auth)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const player = typeof req.body.player === "string" ? req.body.player.trim() : "";
    if (!player || !hasProfile(player)) {
      res.status(400).json({ error: "Invalid player" });
      return;
    }
    sheet.player = player;
  }

  if (req.body?.name !== undefined) {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
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
  let towerUpdate: string | undefined;
  if (req.body?.class !== undefined) {
    refFields.class = typeof req.body.class === "string" ? req.body.class.trim() : "";
  }
  if (req.body?.armor !== undefined) {
    refFields.armor = typeof req.body.armor === "string" ? req.body.armor.trim() : "";
  }
  if (req.body?.weapon !== undefined) {
    refFields.weapon = typeof req.body.weapon === "string" ? req.body.weapon.trim() : "";
  }
  if (req.body?.equipment !== undefined) {
    refFields.equipment = typeof req.body.equipment === "string" ? req.body.equipment.trim() : "";
  }
  if (req.body?.gear !== undefined) {
    refFields.gear = typeof req.body.gear === "string" ? req.body.gear.trim() : "";
  }
  if (req.body?.gearArmor !== undefined) {
    refFields.gearArmor = typeof req.body.gearArmor === "string" ? req.body.gearArmor.trim() : "";
  }
  if (req.body?.weapon2 !== undefined) {
    refFields.weapon2 = typeof req.body.weapon2 === "string" ? req.body.weapon2.trim() : "";
  }
  if (req.body?.yadathanTower !== undefined) {
    towerUpdate = typeof req.body.yadathanTower === "string" ? req.body.yadathanTower.trim() : "";
    refFields.data = { [YADATHAN_TOWER_DATA_KEY]: towerUpdate };
  } else if (
    req.body?.data != null &&
    typeof req.body.data === "object" &&
    !Array.isArray(req.body.data) &&
    (req.body.data as Record<string, unknown>).yadathanTower !== undefined
  ) {
    const raw = (req.body.data as Record<string, unknown>).yadathanTower;
    towerUpdate = typeof raw === "string" ? raw.trim() : "";
    refFields.data = { [YADATHAN_TOWER_DATA_KEY]: towerUpdate };
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
  if (towerUpdate !== undefined) {
    setPlayerDataString(sheet, YADATHAN_TOWER_DATA_KEY, towerUpdate || undefined);
  }

  if (req.body?.data !== undefined) {
    if (req.body.data === null) {
      const tower = getPlayerDataString(sheet, YADATHAN_TOWER_DATA_KEY);
      delete sheet.data;
      if (tower) setPlayerDataString(sheet, YADATHAN_TOWER_DATA_KEY, tower);
    } else if (typeof req.body.data === "object" && !Array.isArray(req.body.data)) {
      const nextData = { ...(req.body.data as Record<string, unknown>) };
      const towerFromData =
        typeof nextData.yadathanTower === "string" ? nextData.yadathanTower.trim() : undefined;
      sheet.data = nextData;
      if (towerUpdate === undefined && towerFromData !== undefined) {
        setPlayerDataString(sheet, YADATHAN_TOWER_DATA_KEY, towerFromData || undefined);
      } else if (towerUpdate !== undefined) {
        setPlayerDataString(sheet, YADATHAN_TOWER_DATA_KEY, towerUpdate || undefined);
      }
    } else {
      res.status(400).json({ error: "Invalid data" });
      return;
    }
  }

  if (req.body?.tags !== undefined) {
    if (!Array.isArray(req.body.tags)) {
      res.status(400).json({ error: "Invalid tags" });
      return;
    }
    const tags = req.body.tags
      .filter((t: unknown): t is string => typeof t === "string")
      .map((t: string) => t.trim())
      .filter(Boolean);
    sheet.tags = tags.length ? tags : undefined;
  }

  sheet.updatedAt = new Date().toISOString();
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
