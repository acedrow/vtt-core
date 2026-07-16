import "@gaem/hellpiercers-content/register";

import { handleGetEnemyPortrait } from "./enemy-portraits.js";
import type { Env } from "./env.js";
import { GameRoom } from "./game-room.js";
import {
  handleCreateCharacterSheet,
  handleDeleteCharacterSheet,
  handleGetCharacterSheet,
  handleGetPortrait,
  handleListCharacterSheets,
  handlePatchCharacterSheet,
  handlePutPortrait,
  listCharacterSheets,
} from "./character-sheets.js";
import { constantTimeEqual, createAuthToken } from "@gaem/shared";

import { verifyAuth, authHasGmCapabilities } from "./auth.js";
import {
  createPlayerProfile,
  deletePlayerProfile,
  getPlayerProfile,
  listPlayerProfiles,
  savePlayerProfile,
} from "./player-profiles.js";
import { handleRandomIntegersGet, handleRollDicePost } from "./random-integers.js";
import {
  handleGetTileAppearance,
  handlePutTileAppearance,
} from "./tile-appearances.js";
import {
  handleGetRegionImage,
  handlePutRegionImage,
} from "./region-images.js";
import {
  handleDeleteTilePreset,
  handleListTilePresets,
  handlePutTilePreset,
} from "./tile-presets.js";
import {
  handleCreateMap,
  handleDeleteMap,
  handleGetMap,
  handleListMaps,
} from "./maps-api.js";

export { GameRoom };

const SHEET_ID_RE = /^\/api\/character-sheets\/([^/]+)$/;
const PORTRAIT_RE = /^\/api\/character-sheets\/([^/]+)\/portrait$/;
const PROFILE_ID_RE = /^\/api\/player-profiles\/([^/]+)$/;
const TILE_APPEARANCE_RE = /^\/api\/tile-appearances\/([^/]+\/[^/]+)$/;
const REGION_IMAGE_RE = /^\/api\/region-images\/([^/]+\/[^/]+)$/;
const MAPS_RE = /^\/api\/maps$/;
const MAP_ID_RE = /^\/api\/maps\/([^/]+)$/;
const TILE_PRESETS_RE = /^\/api\/maps\/([^/]+)\/tile-presets$/;
const TILE_PRESET_RE = /^\/api\/maps\/([^/]+)\/tile-presets\/([^/]+)$/;

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (url.pathname === "/api/login" && request.method === "POST") {
      if (!env.AUTH_SECRET || !env.GM_PASSWORD || !env.PLAYER_PASSWORD) {
        return Response.json({ error: "Auth not configured" }, { status: 500 });
      }
      const body = (await request.json().catch(() => null)) as
        | { role?: unknown; password?: unknown }
        | null;
      const role = body?.role;
      const password = typeof body?.password === "string" ? body.password : "";
      if (role !== "gm" && role !== "player") {
        return Response.json({ error: "Invalid role" }, { status: 400 });
      }
      const expected = role === "gm" ? env.GM_PASSWORD : env.PLAYER_PASSWORD;
      if (!constantTimeEqual(password, expected)) {
        return Response.json({ error: "Incorrect password" }, { status: 401 });
      }
      const token = await createAuthToken(role, env.AUTH_SECRET);
      return Response.json({ token });
    }

    if (url.pathname === "/ws") {
      const id = env.GAME_ROOM.idFromName("default");
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    if (url.pathname === "/api/player-profiles" && request.method === "GET") {
      const auth = await verifyAuth(request, env, { requirePlayerKey: false });
      if (auth instanceof Response) return auth;
      const profiles = await listPlayerProfiles(env);
      const id = env.GAME_ROOM.idFromName("default");
      const stub = env.GAME_ROOM.get(id);
      const activeRes = await stub.fetch("http://internal/internal/active-profiles");
      const activeData = (await activeRes.json()) as { activeProfileIds: string[] };
      const active = new Set(activeData.activeProfileIds);
      return Response.json({
        profiles: profiles.map((p) => ({ ...p, isActive: active.has(p.id) })),
      });
    }

    if (url.pathname === "/api/player-profiles" && request.method === "POST") {
      const auth = await verifyAuth(request, env, { requirePlayerKey: false });
      if (auth instanceof Response) return auth;
      const body = (await request.json().catch(() => null)) as
        | { name?: unknown }
        | null;
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name) {
        return Response.json({ error: "Name is required" }, { status: 400 });
      }
      const profile = await createPlayerProfile(env, name);
      return Response.json({ profile }, { status: 201 });
    }

    const profileMatch = url.pathname.match(PROFILE_ID_RE);
    if (profileMatch) {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      if (!(await authHasGmCapabilities(auth, env))) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      const profileId = profileMatch[1];

      if (request.method === "PATCH") {
        const profile = await getPlayerProfile(env, profileId);
        if (!profile) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        const body = (await request.json().catch(() => null)) as
          | { name?: unknown; gmPermissions?: unknown }
          | null;
        const hasName = typeof body?.name === "string";
        const hasGmPermissions = typeof body?.gmPermissions === "boolean";
        if (!hasName && !hasGmPermissions) {
          return Response.json({ error: "Nothing to update" }, { status: 400 });
        }
        if (hasName) {
          const name = body!.name as string;
          const trimmed = name.trim();
          if (!trimmed) {
            return Response.json({ error: "Name is required" }, { status: 400 });
          }
          profile.name = trimmed;
        }
        if (hasGmPermissions) {
          if (auth.role !== "gm") {
            return Response.json({ error: "Forbidden" }, { status: 403 });
          }
          profile.gmPermissions = body!.gmPermissions as boolean;
        }
        profile.updatedAt = new Date().toISOString();
        await savePlayerProfile(env, profile);
        return Response.json({ profile });
      }

      if (request.method === "DELETE") {
        const profile = await getPlayerProfile(env, profileId);
        if (!profile) {
          return Response.json({ error: "Not found" }, { status: 404 });
        }
        const sheets = await listCharacterSheets(env);
        if (sheets.some((s) => s.player === profileId)) {
          return Response.json(
            { error: "Player has linked character sheets" },
            { status: 409 }
          );
        }
        await deletePlayerProfile(env, profileId);
        return Response.json({ ok: true });
      }
    }

    if (url.pathname === "/api/random-integers") {
      if (request.method === "GET") {
        const auth = await verifyAuth(request, env);
        if (auth instanceof Response) return auth;
        return handleRandomIntegersGet(env, request);
      }
      if (request.method === "POST") {
        const auth = await verifyAuth(request, env);
        if (auth instanceof Response) return auth;
        return handleRollDicePost(env, auth, request);
      }
      return new Response(null, { status: 405 });
    }

    const enemyPortraitRes = await handleGetEnemyPortrait(env, request);
    if (enemyPortraitRes) return enemyPortraitRes;

    if (url.pathname === "/api/tile-appearances" && request.method === "PUT") {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      return handlePutTileAppearance(env, auth, request);
    }

    const tileAppearanceMatch = url.pathname.match(TILE_APPEARANCE_RE);
    if (tileAppearanceMatch && request.method === "GET") {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      return handleGetTileAppearance(env, tileAppearanceMatch[1]);
    }

    if (url.pathname === "/api/region-images" && request.method === "PUT") {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      return handlePutRegionImage(env, auth, request);
    }

    const regionImageMatch = url.pathname.match(REGION_IMAGE_RE);
    if (regionImageMatch && request.method === "GET") {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      return handleGetRegionImage(env, regionImageMatch[1]);
    }

    if (url.pathname.match(MAPS_RE)) {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      if (request.method === "GET") {
        return handleListMaps(env, auth);
      }
      if (request.method === "POST") {
        return handleCreateMap(env, auth, request);
      }
    }

    const mapIdMatch = url.pathname.match(MAP_ID_RE);
    if (mapIdMatch && request.method === "GET") {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      return handleGetMap(env, auth, mapIdMatch[1]);
    }

    if (mapIdMatch && request.method === "DELETE") {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      const roomId = env.GAME_ROOM.idFromName("default");
      const stub = env.GAME_ROOM.get(roomId);
      const activeRes = await stub.fetch("http://internal/internal/active-map-id");
      const activeData = (await activeRes.json()) as { mapId: string };
      return handleDeleteMap(env, auth, mapIdMatch[1], activeData.mapId);
    }

    const tilePresetsMatch = url.pathname.match(TILE_PRESETS_RE);
    if (tilePresetsMatch && request.method === "GET") {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      return handleListTilePresets(env, auth, tilePresetsMatch[1]);
    }

    const tilePresetMatch = url.pathname.match(TILE_PRESET_RE);
    if (tilePresetMatch) {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      const mapId = tilePresetMatch[1];
      const presetName = decodeURIComponent(tilePresetMatch[2]);
      if (request.method === "PUT") {
        return handlePutTilePreset(env, auth, mapId, presetName, request);
      }
      if (request.method === "DELETE") {
        return handleDeleteTilePreset(env, auth, mapId, presetName);
      }
    }

    if (url.pathname === "/api/character-sheets") {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;

      if (request.method === "GET") {
        return handleListCharacterSheets(env, auth);
      }
      if (request.method === "POST") {
        return handleCreateCharacterSheet(env, auth, request);
      }
    }

    const portraitMatch = url.pathname.match(PORTRAIT_RE);
    if (portraitMatch) {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      const sheetId = portraitMatch[1];

      if (request.method === "GET") {
        return handleGetPortrait(env, auth, sheetId);
      }
      if (request.method === "PUT") {
        return handlePutPortrait(env, auth, sheetId, request);
      }
    }

    const sheetMatch = url.pathname.match(SHEET_ID_RE);
    if (sheetMatch) {
      const auth = await verifyAuth(request, env);
      if (auth instanceof Response) return auth;
      const sheetId = sheetMatch[1];

      if (request.method === "GET") {
        return handleGetCharacterSheet(env, auth, sheetId);
      }
      if (request.method === "PATCH") {
        return handlePatchCharacterSheet(env, auth, sheetId, request);
      }
      if (request.method === "DELETE") {
        return handleDeleteCharacterSheet(env, auth, sheetId);
      }
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
