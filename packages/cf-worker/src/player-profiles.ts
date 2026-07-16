import type { PlayerProfile } from "@gaem/shared";

import type { Env } from "./env.js";

const PREFIX = "profile:";
const INDEX_KEY = "profile-index";

function key(id: string): string {
  return `${PREFIX}${id}`;
}

async function readProfileIds(env: Env): Promise<string[]> {
  const raw = await env.PLAYER_KV.get<string[]>(INDEX_KEY, "json");
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
}

async function writeProfileIds(env: Env, ids: string[]): Promise<void> {
  await env.PLAYER_KV.put(INDEX_KEY, JSON.stringify(ids));
}

async function addProfileId(env: Env, id: string): Promise<void> {
  const ids = await readProfileIds(env);
  if (ids.includes(id)) return;
  await writeProfileIds(env, [...ids, id]);
}

async function removeProfileId(env: Env, id: string): Promise<void> {
  const ids = await readProfileIds(env);
  if (!ids.includes(id)) return;
  await writeProfileIds(
    env,
    ids.filter((existingId) => existingId !== id),
  );
}

async function listProfilesFromPrefix(env: Env): Promise<PlayerProfile[]> {
  const profiles: PlayerProfile[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.PLAYER_KV.list({ prefix: PREFIX, cursor });
    const batch = await Promise.all(
      page.keys.map(({ name }) => env.PLAYER_KV.get<PlayerProfile>(name, "json")),
    );
    profiles.push(...batch.filter((p): p is PlayerProfile => !!p));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return profiles;
}

async function syncProfileIndex(env: Env, profiles: PlayerProfile[]): Promise<void> {
  await writeProfileIds(
    env,
    profiles.map((profile) => profile.id),
  );
}

export async function listPlayerProfiles(env: Env): Promise<PlayerProfile[]> {
  const ids = await readProfileIds(env);
  if (ids.length > 0) {
    const profiles = await Promise.all(ids.map((id) => getPlayerProfile(env, id)));
    const indexed = profiles.filter((p): p is PlayerProfile => !!p);
    if (indexed.length > 0) return indexed;
  }

  const listed = await listProfilesFromPrefix(env);
  if (listed.length > 0) {
    await syncProfileIndex(env, listed);
  }
  return listed;
}

export async function getPlayerProfile(
  env: Env,
  id: string
): Promise<PlayerProfile | null> {
  return env.PLAYER_KV.get<PlayerProfile>(key(id), "json");
}

export async function createPlayerProfile(
  env: Env,
  name: string
): Promise<PlayerProfile> {
  const now = new Date().toISOString();
  const profile: PlayerProfile = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    gmPermissions: false,
    data: {},
  };
  await env.PLAYER_KV.put(key(profile.id), JSON.stringify(profile));
  await addProfileId(env, profile.id);
  return profile;
}

export async function savePlayerProfile(
  env: Env,
  profile: PlayerProfile
): Promise<void> {
  await env.PLAYER_KV.put(key(profile.id), JSON.stringify(profile));
  await addProfileId(env, profile.id);
}

export async function deletePlayerProfile(env: Env, id: string): Promise<void> {
  await env.PLAYER_KV.delete(key(id));
  await removeProfileId(env, id);
}
