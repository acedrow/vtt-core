import type { GaemRole } from "@gaem/shared";
import { hasGmCapabilities } from "@gaem/shared";
import type { Request, Response } from "express";

import { profileGmPermissions } from "./player-profiles.js";

declare module "express-serve-static-core" {
  interface Request {
    authRole?: GaemRole;
  }
}

export type AuthContext = {
  role: GaemRole;
  playerKey: string | null;
};

export function parseAuth(req: Request, res: Response): AuthContext | null {
  const role = req.authRole;
  if (role !== "gm" && role !== "player") {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  const playerKey =
    typeof req.headers["x-gaem-player-key"] === "string"
      ? req.headers["x-gaem-player-key"]
      : null;
  if (role === "player" && !playerKey) {
    res.status(401).json({ error: "X-Gaem-Player-Key required for player role" });
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
