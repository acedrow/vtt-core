import type { VttRole } from "@vtt-core/shared";
import { hasGmCapabilities } from "@vtt-core/shared";
import type { Request, Response } from "express";

import { profileGmPermissions } from "./player-profiles.js";

declare module "express-serve-static-core" {
  interface Request {
    authRole?: VttRole;
  }
}

export type AuthContext = {
  role: VttRole;
  playerKey: string | null;
};

export function parseAuth(req: Request, res: Response): AuthContext | null {
  const role = req.authRole;
  if (role !== "gm" && role !== "player") {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const playerKey =
    typeof req.headers["x-vtt-player-key"] === "string"
      ? req.headers["x-vtt-player-key"]
      : null;
  if (role === "player" && !playerKey) {
    res.status(401).json({ error: "X-Vtt-Player-Key required for player role" });
    return null;
  }
  return { role, playerKey };
}

export function authHasGmCapabilities(auth: AuthContext): boolean {
  return hasGmCapabilities({
    role: auth.role,
    gmPermissions: auth.role === "player" ? profileGmPermissions(auth.playerKey) : undefined,
  });
}

export function requireAuth(
  req: Request,
  res: Response,
  next: () => void
): void {
  if (!parseAuth(req, res)) return;
  next();
}
