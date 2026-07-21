import type { APIRequestContext } from "@playwright/test";

import { E2E_ENV } from "./env.js";

export type VttRole = "gm" | "player";

export type PlayerProfile = {
  id: string;
  name: string;
};

export type CharacterSheet = {
  id: string;
  name: string;
  player: string;
};

function authHeaders(role: VttRole, token: string, playerKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Vtt-Role": role,
    Authorization: `Bearer ${token}`,
  };
  if (role === "player" && playerKey) {
    headers["X-Vtt-Player-Key"] = playerKey;
  }
  return headers;
}

export async function login(
  request: APIRequestContext,
  role: VttRole,
  password: string,
): Promise<string> {
  const res = await request.post(`${E2E_ENV.apiBaseUrl}/api/login`, {
    data: { role, password },
  });
  if (!res.ok()) {
    throw new Error(`Login failed for ${role}: ${res.status()} ${await res.text()}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

export async function createPlayerProfile(
  request: APIRequestContext,
  gmToken: string,
  name: string,
): Promise<PlayerProfile> {
  const res = await request.post(`${E2E_ENV.apiBaseUrl}/api/player-profiles`, {
    headers: authHeaders("gm", gmToken),
    data: { name },
  });
  if (!res.ok()) {
    throw new Error(`Create profile failed: ${res.status()} ${await res.text()}`);
  }
  const data = (await res.json()) as { profile: PlayerProfile };
  return data.profile;
}

export async function createCharacterSheet(
  request: APIRequestContext,
  gmToken: string,
  opts: {
    player: string;
    name: string;
    class: string;
    armor: string;
    weapon: string;
  },
): Promise<CharacterSheet> {
  const res = await request.post(`${E2E_ENV.apiBaseUrl}/api/character-sheets`, {
    headers: authHeaders("gm", gmToken),
    data: opts,
  });
  if (!res.ok()) {
    throw new Error(`Create sheet failed: ${res.status()} ${await res.text()}`);
  }
  const data = (await res.json()) as { sheet: CharacterSheet };
  return data.sheet;
}

export async function deleteCharacterSheet(
  request: APIRequestContext,
  gmToken: string,
  sheetId: string,
): Promise<void> {
  await request.delete(`${E2E_ENV.apiBaseUrl}/api/character-sheets/${sheetId}`, {
    headers: authHeaders("gm", gmToken),
  });
}

export async function deletePlayerProfile(
  request: APIRequestContext,
  gmToken: string,
  profileId: string,
): Promise<void> {
  await request.delete(`${E2E_ENV.apiBaseUrl}/api/player-profiles/${profileId}`, {
    headers: authHeaders("gm", gmToken),
  });
}

export async function bootstrapCombatData(
  request: APIRequestContext,
  suffix: string,
): Promise<{
  gmToken: string;
  profile: PlayerProfile;
  sheet: CharacterSheet;
}> {
  const gmToken = await login(request, "gm", E2E_ENV.gmPassword);
  const profile = await createPlayerProfile(request, gmToken, `E2E Player ${suffix}`);
  const sheet = await createCharacterSheet(request, gmToken, {
    player: profile.id,
    name: `E2E Sheet ${suffix}`,
    class: "HARPE",
    armor: "MALAKBEL",
    weapon: "Sethian Externalized Annihilation Cannon",
  });
  return { gmToken, profile, sheet };
}
