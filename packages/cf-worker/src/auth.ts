import type { CharacterSheet, GaemRole } from "@gaem/shared";
import { hasGmCapabilities, verifyAuthToken } from "@gaem/shared";

import type { Env } from "./env.js";
import { getPlayerProfile } from "./player-profiles.js";

export type AuthContext = {
  role: GaemRole;
  playerKey: string | null;
};

export type VerifyAuthOptions = {
  requirePlayerKey?: boolean;
};

export async function verifyAuth(
  request: Request,
  env: Env,
  options: VerifyAuthOptions = {},
): Promise<AuthContext | Response> {
  const requirePlayerKey = options.requirePlayerKey ?? true;
  const header = request.headers.get("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = await verifyAuthToken(token, env.AUTH_SECRET);
  if (!payload) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  const playerKey = request.headers.get("X-Gaem-Player-Key");
  if (payload.role === "player" && requirePlayerKey && !playerKey) {
    return Response.json({ error: "X-Gaem-Player-Key required for player role" }, { status: 401 });
  }
  return { role: payload.role, playerKey };
}

export function canViewSheet(auth: AuthContext): boolean {
  return auth.role === "gm" || auth.role === "player";
}

export function canEditSheet(auth: AuthContext, sheet: CharacterSheet): boolean {
  if (auth.role === "gm") return true;
  return sheet.player === auth.playerKey;
}

export function canAccessSheet(auth: AuthContext, _sheet: CharacterSheet): boolean {
  return canViewSheet(auth);
}

export function canCreateForPlayer(auth: AuthContext, playerId: string): boolean {
  if (auth.role === "gm") return true;
  return auth.playerKey === playerId;
}

export async function authHasGmCapabilities(
  auth: AuthContext,
  env: Env,
): Promise<boolean> {
  if (auth.role === "gm") return true;
  if (!auth.playerKey) return false;
  const profile = await getPlayerProfile(env, auth.playerKey);
  return hasGmCapabilities({ role: auth.role, gmPermissions: profile?.gmPermissions });
}
