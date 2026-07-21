import { randomUUID } from "node:crypto";

import type { PlayerProfile } from "@vtt-core/shared";
import type { Request, Response } from "express";

import { characterSheets } from "./character-sheets.js";

export const playerProfiles = new Map<string, PlayerProfile>();

export function hasProfile(id: string): boolean {
  return playerProfiles.has(id);
}

export function profileGmPermissions(profileId: string | null | undefined): boolean {
  if (!profileId) return false;
  return playerProfiles.get(profileId)?.gmPermissions === true;
}

export function listProfilesHandler(res: Response, activeProfileIds: Set<string>): void {
  res.json({
    profiles: [...playerProfiles.values()].map((p) => ({
      ...p,
      isActive: activeProfileIds.has(p.id),
    })),
  });
}

export function createProfileHandler(req: Request, res: Response): void {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const now = new Date().toISOString();
  const profile: PlayerProfile = {
    id: randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    gmPermissions: false,
    data: {},
  };
  playerProfiles.set(profile.id, profile);
  res.status(201).json({ profile });
}

export function patchProfileHandler(
  id: string,
  req: Request,
  res: Response,
  opts?: { allowGmPermissions?: boolean },
): void {
  const profile = playerProfiles.get(id);
  if (!profile) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const hasName = typeof req.body?.name === "string";
  const hasGmPermissions = typeof req.body?.gmPermissions === "boolean";
  if (!hasName && !hasGmPermissions) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  if (hasName) {
    const name = req.body.name.trim();
    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    profile.name = name;
  }
  if (hasGmPermissions) {
    if (!opts?.allowGmPermissions) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    profile.gmPermissions = req.body.gmPermissions;
  }
  profile.updatedAt = new Date().toISOString();
  playerProfiles.set(profile.id, profile);
  res.json({ profile });
}

export function deleteProfileHandler(id: string, res: Response): void {
  if (!playerProfiles.has(id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if ([...characterSheets.values()].some((s) => s.player === id)) {
    res.status(409).json({ error: "Player has linked character sheets" });
    return;
  }
  playerProfiles.delete(id);
  res.json({ ok: true });
}
