import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  createBlankGameMap,
  toMapSummary,
} from "@gaem/shared";

import type { AuthContext } from "./auth.js";
import { authHasGmCapabilities } from "./auth.js";
import type { Env } from "./env.js";
import { getMap, listMaps, putMap, deleteMap } from "./maps.js";

const MAP_ID_RE = /^[a-z0-9-]+$/;

export async function handleListMaps(env: Env, auth: AuthContext): Promise<Response> {
  if (!(await authHasGmCapabilities(auth, env))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const maps = await listMaps(env);
  return Response.json({ maps });
}

export async function handleGetMap(
  env: Env,
  auth: AuthContext,
  mapId: string,
): Promise<Response> {
  if (!(await authHasGmCapabilities(auth, env))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const map = await getMap(env, mapId);
    return Response.json({ map });
  } catch {
    return Response.json({ error: "Map not found" }, { status: 404 });
  }
}

export async function handleCreateMap(
  env: Env,
  auth: AuthContext,
  request: Request,
): Promise<Response> {
  if (!(await authHasGmCapabilities(auth, env))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const widthRaw = body?.width;
  const heightRaw = body?.height;

  if (!id || !name) {
    return Response.json({ error: "id and name are required" }, { status: 400 });
  }
  if (!MAP_ID_RE.test(id)) {
    return Response.json(
      { error: "id must be lowercase letters, numbers, and hyphens only" },
      { status: 400 },
    );
  }

  try {
    await getMap(env, id);
    return Response.json({ error: "Map id already exists" }, { status: 409 });
  } catch {
    // not found — ok to create
  }

  const width =
    Number.isInteger(widthRaw) && (widthRaw as number) > 0
      ? (widthRaw as number)
      : BOARD_WIDTH;
  const height =
    Number.isInteger(heightRaw) && (heightRaw as number) > 0
      ? (heightRaw as number)
      : BOARD_HEIGHT;

  const map = createBlankGameMap(id, name, width, height);
  await putMap(env, map);
  return Response.json({ map: toMapSummary(map) }, { status: 201 });
}

export async function handleDeleteMap(
  env: Env,
  auth: AuthContext,
  mapId: string,
  activeMapId: string,
): Promise<Response> {
  if (!(await authHasGmCapabilities(auth, env))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await getMap(env, mapId);
  } catch {
    return Response.json({ error: "Map not found" }, { status: 404 });
  }

  if (mapId === activeMapId) {
    return Response.json({ error: "Cannot delete the active map" }, { status: 400 });
  }

  const maps = await listMaps(env);
  if (maps.length <= 1) {
    return Response.json({ error: "Cannot delete the last map" }, { status: 400 });
  }

  await deleteMap(env, mapId);
  return new Response(null, { status: 204 });
}
