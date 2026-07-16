import "@gaem/hellpiercers-content/register";
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";

import type {
  ClientMessage,
  ConsoleActor,
  ConsoleLogEntry,
  GaemRole,
  GameState,
  ServerMessage,
} from "@gaem/shared";
import {
  addEnemy,
  applyEnemyMove,
  applyGmForceMove,
  applyMove,
  applyPhaseAction,
  applyActivateMap,
  applyBaseCampaignAction,
  applyOverworldCampaignAction,
  applyOverworldConvoyAction,
  applyOverworldLocationAction,
  applySetSandboxMode,
  applySetOverworldRegionImage,
  applyFactionCampaignAction,
  canSetPlayerHp,
  characterTargetLabel,
  CONSOLE_MSG_CONNECTED,
  CONSOLE_MSG_DISCONNECTED,
  constantTimeEqual,
  createAuthToken,
  createInitialStateFromMap,
  DEFAULT_MAP_ID,
  enemyLabel,
  handleCombatMessage,
  logSyncPlayerLoadoutChanges,
  normalizeGameState,
  playerLabel,
  removeEnemy,
  removePlayer,
  setPlayerHp,
  spawnPlayerFromSheet,
  syncCharacterSheetWeaponsFromPlayer,
  syncPlayerSheet,
  validateEnemyMove,
  validateGmForceMove,
  validateMove,
  validatePhaseAction,
  validateBaseCampaignAction,
  validateOverworldCampaignAction,
  validateOverworldConvoyAction,
  validateOverworldLocationAction,
  validateSetOverworldRegionImage,
  validateFactionCampaignAction,
  persistMapTileAt,
  persistMapTilesAt,
  applySaveStartingState,
  applyResetToStartingState,
  validateResetToStartingState,
  validateActivateMap,
  verifyAuthToken,
} from "@gaem/shared";
import express from "express";
import { WebSocketServer, type WebSocket } from "ws";

import {
  appendConsole,
  getConsoleEntries,
  registerConsoleBroadcaster,
} from "./console-log.js";
import {
  createSheetHandler,
  deleteSheetHandler,
  getPortraitHandler,
  getSheetHandler,
  listSheetsHandler,
  patchSheetHandler,
  putPortraitHandler,
  characterSheets,
} from "./character-sheets.js";
import { getEnemyPortraitHandler, loadEnemyPortraits } from "./enemy-portraits.js";
import { parseAuth, authHasGmCapabilities } from "./auth.js";
import {
  getTileAppearanceHandler,
  putTileAppearanceHandler,
} from "./tile-appearances.js";
import {
  getRegionImageHandler,
  putRegionImageHandler,
} from "./region-images.js";
import {
  deleteTilePresetHandler,
  listTilePresetsHandler,
  putTilePresetHandler,
  seedTilePresetsFromMap,
} from "./tile-presets.js";
import {
  createMapHandler,
  deleteMapHandler,
  getMapHandler,
  listMapsHandler,
  mapsDirPath,
  savedMaps,
  seedMapsFromDisk,
} from "./maps.js";
import {
  createProfileHandler,
  deleteProfileHandler,
  hasProfile,
  listProfilesHandler,
  patchProfileHandler,
  playerProfiles,
  profileGmPermissions,
} from "./player-profiles.js";
import { randomIntegersHandler, rollDiceHandler } from "./random-integers.js";

const PORT = Number(process.env.PORT) || 3001;
const GM_PASSWORD = process.env.GM_PASSWORD ?? "";
const PLAYER_PASSWORD = process.env.PLAYER_PASSWORD ?? "";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "";

const app = express();
app.use(express.json());
app.use((_, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Gaem-Role, X-Gaem-Player-Key"
  );
  next();
});
app.options("*", (_req, res) => {
  res.sendStatus(204);
});

app.post("/api/login", (req, res) => {
  if (!AUTH_SECRET || !GM_PASSWORD || !PLAYER_PASSWORD) {
    res.status(500).json({ error: "Auth not configured" });
    return;
  }
  const role = req.body?.role;
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (role !== "gm" && role !== "player") {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const expected = role === "gm" ? GM_PASSWORD : PLAYER_PASSWORD;
  if (!constantTimeEqual(password, expected)) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  void createAuthToken(role, AUTH_SECRET).then((token) => res.json({ token }));
});

app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  if (req.method === "OPTIONS") return next();
  if (req.path === "/api/login") return next();
  if (req.path.startsWith("/api/enemy-portraits")) return next();
  const header = req.headers.authorization;
  const token =
    typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
  void verifyAuthToken(token ?? "", AUTH_SECRET).then((payload) => {
    if (!payload) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    req.authRole = payload.role;
    next();
  });
});

function persistWeaponSwapToSheet(playerId: string | null | undefined) {
  if (!playerId) return;
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player?.characterSheetId) return;
  const sheet = characterSheets.get(player.characterSheetId);
  if (!sheet) return;
  if (syncCharacterSheetWeaponsFromPlayer(sheet, player)) {
    characterSheets.set(sheet.id, sheet);
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/random-integers", (req, res) => {
  void randomIntegersHandler(req, res);
});

app.post("/api/random-integers", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  void rollDiceHandler(req, res, (message) => {
    broadcastConsole(actorForAuth(auth), message);
  });
});

app.get("/api/player-profiles", (_req, res) => {
  const active = new Set(
    [...socketProfile.entries()]
      .filter(([ws, profileId]) => !!profileId && socketRole.get(ws) === "player")
      .map(([, profileId]) => profileId as string)
  );
  listProfilesHandler(res, active);
});

app.post("/api/player-profiles", (req, res) => {
  createProfileHandler(req, res);
});

app.patch("/api/player-profiles/:id", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  patchProfileHandler(req.params.id, req, res, { allowGmPermissions: auth.role === "gm" });
});

app.delete("/api/player-profiles/:id", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  deleteProfileHandler(req.params.id, res);
});

const portraitParser = express.raw({
  type: ["image/jpeg", "image/png", "image/webp"],
  limit: "5mb",
});

const tileAppearanceParser = express.raw({
  type: ["image/png"],
  limit: "2mb",
});

const regionImageParser = express.raw({
  type: ["image/png", "image/jpeg", "image/webp"],
  limit: "8mb",
});

function resolveSheetForJoin(
  playerKey: string,
  characterSheetId?: string
): {
  className?: string;
  characterSheetId?: string;
  armor?: string;
  weapon?: string;
  equipment?: string;
  gear?: string;
  weapon2?: string;
  data?: Record<string, unknown>;
} {
  if (characterSheetId) {
    const sheet = characterSheets.get(characterSheetId);
    if (sheet?.player === playerKey) {
      return {
        className: sheet.class,
        characterSheetId: sheet.id,
        armor: sheet.armor,
        weapon: sheet.weapon,
        equipment: sheet.equipment,
        gear: sheet.gear,
        weapon2: sheet.weapon2,
        data: sheet.data,
      };
    }
  }
  const sheet = [...characterSheets.values()].find((s) => s.player === playerKey);
  return sheet
    ? {
        className: sheet.class,
        characterSheetId: sheet.id,
        armor: sheet.armor,
        weapon: sheet.weapon,
        equipment: sheet.equipment,
        gear: sheet.gear,
        weapon2: sheet.weapon2,
        data: sheet.data,
      }
    : {};
}

function canSyncPlayerSheet(
  role: GaemRole | null | undefined,
  playerKey: string | null | undefined,
  characterSheetId: string
): boolean {
  if (role === "gm") return true;
  const sheet = characterSheets.get(characterSheetId);
  return role === "player" && !!playerKey && sheet?.player === playerKey;
}

app.get("/api/character-sheets", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  listSheetsHandler(auth, res);
});

app.post("/api/character-sheets", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  createSheetHandler(auth, req, res, hasProfile, gameState.campaign?.constructedBaseUpgrades ?? []);
});

app.get("/api/character-sheets/:id", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  getSheetHandler(auth, req.params.id, res);
});

app.patch("/api/character-sheets/:id", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  patchSheetHandler(auth, req.params.id, req, res, hasProfile, {
    actor: actorForAuth(auth),
    sheetOnBoard: gameState.players.some((p) => p.characterSheetId === req.params.id),
    logConsole: appendConsole,
    constructedIds: gameState.campaign?.constructedBaseUpgrades ?? [],
  });
});

app.delete("/api/character-sheets/:id", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  deleteSheetHandler(auth, req.params.id, res, (sheetId) => {
    const token = gameState.players.find((p) => p.characterSheetId === sheetId);
    if (token) {
      removePlayer(gameState, token.id);
      broadcastState();
    }
  });
});

app.put("/api/character-sheets/:id/portrait", portraitParser, (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  putPortraitHandler(auth, req.params.id, req, res);
});

app.get("/api/character-sheets/:id/portrait", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  getPortraitHandler(auth, req.params.id, res);
});

app.get("/api/enemy-portraits/paracletus/:slug", (req, res) => {
  getEnemyPortraitHandler(req, res);
});

app.put("/api/tile-appearances", tileAppearanceParser, (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  putTileAppearanceHandler(auth, req, res);
});

app.get("/api/tile-appearances/:segment/:file", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  getTileAppearanceHandler(`${req.params.segment}/${req.params.file}`, res);
});

app.put("/api/region-images", regionImageParser, (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  putRegionImageHandler(auth, req, res);
});

app.get("/api/region-images/:segment/:file", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  getRegionImageHandler(`${req.params.segment}/${req.params.file}`, res);
});

app.get("/api/maps", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  listMapsHandler(auth, res);
});

app.post("/api/maps", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  createMapHandler(auth, req, res);
});

app.get("/api/maps/:mapId", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  getMapHandler(auth, req.params.mapId, res);
});

const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });

let gameState: GameState;

app.delete("/api/maps/:mapId", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  deleteMapHandler(auth, req.params.mapId, gameState.mapId, res);
});

app.get("/api/maps/:mapId/tile-presets", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  if (req.params.mapId !== gameState.mapId) {
    res.status(404).json({ error: "Map not found" });
    return;
  }
  listTilePresetsHandler(auth, gameState.mapId, savedMaps.get(gameState.mapId)?.tilePresets, res);
});

app.put("/api/maps/:mapId/tile-presets/:name", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  if (req.params.mapId !== gameState.mapId) {
    res.status(404).json({ error: "Map not found" });
    return;
  }
  putTilePresetHandler(auth, gameState.mapId, req.params.name, req.body, res);
});

app.delete("/api/maps/:mapId/tile-presets/:name", (req, res) => {
  const auth = parseAuth(req, res);
  if (!auth) return;
  if (req.params.mapId !== gameState.mapId) {
    res.status(404).json({ error: "Map not found" });
    return;
  }
  deleteTilePresetHandler(auth, gameState.mapId, req.params.name, res);
});

/** socket -> selected characterSheetId when joined as player, else null */
const socketSheet = new Map<WebSocket, string | null>();
/** socket -> player profile id when joined as player */
const socketProfile = new Map<WebSocket, string | null>();
const socketGmPermissions = new Map<WebSocket, boolean>();
/** socket -> role after join */
const socketRole = new Map<WebSocket, GaemRole | null>();
/** sockets currently holding an active map ping */
const socketMapPingActive = new Map<WebSocket, true>();

/** The board token controlled by a socket, derived from its bound character sheet. */
function playerIdForSocket(ws: WebSocket): string | null {
  const sheetId = socketSheet.get(ws);
  if (!sheetId) return null;
  return gameState.players.find((p) => p.characterSheetId === sheetId)?.id ?? null;
}

function socketGmPermissionsFor(ws: WebSocket): boolean {
  return socketGmPermissions.get(ws) === true;
}

function socketHasGmCapabilities(ws: WebSocket): boolean {
  const role = socketRole.get(ws);
  return role === "gm" || socketGmPermissionsFor(ws);
}

function combatCtxForSocket(ws: WebSocket) {
  const role = socketRole.get(ws) ?? "player";
  return {
    role,
    playerId: playerIdForSocket(ws),
    gmPermissions: role === "player" ? socketGmPermissionsFor(ws) : undefined,
  };
}

function cloneState() {
  return structuredClone(gameState);
}

function broadcastState(): void {
  const snapshot = cloneState();
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) continue;
    const yourId = playerIdForSocket(ws);
    const msg: ServerMessage = {
      type: "state",
      state: snapshot,
      yourPlayerId: yourId,
    };
    ws.send(JSON.stringify(msg));
  }
  delete gameState.damageEvents;
  delete gameState.silentHpEnemyIds;
}

function actorForAuth(auth: { role: GaemRole; playerKey: string | null }): ConsoleActor {
  if (auth.role === "gm") return { name: "GM", role: "gm" };
  const profile = auth.playerKey ? playerProfiles.get(auth.playerKey) : undefined;
  return { name: profile?.name ?? "Player", role: "player" };
}

function actorForSocket(ws: WebSocket): ConsoleActor {
  const role = socketRole.get(ws);
  if (role === "gm") return { name: "GM", role: "gm" };
  const profileId = socketProfile.get(ws);
  const profile = profileId ? playerProfiles.get(profileId) : undefined;
  const playerId = playerIdForSocket(ws);
  const player = playerId
    ? gameState.players.find((p) => p.id === playerId)
    : undefined;
  return { name: profile?.name ?? player?.nickname ?? "Player", role: "player" };
}

function targetLabelForPlayer(playerId: string): string {
  const player = gameState.players.find((p) => p.id === playerId);
  const sheet = player?.characterSheetId
    ? characterSheets.get(player.characterSheetId)
    : undefined;
  return characterTargetLabel(player, sheet?.name);
}

function broadcastConsoleEntry(entry: ConsoleLogEntry): void {
  const msg: ServerMessage = { type: "console", entry };
  const payload = JSON.stringify(msg);
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

function mapPingFromId(ws: WebSocket): string {
  const role = socketRole.get(ws);
  if (role === "gm") return "gm";
  return socketProfile.get(ws) ?? "player";
}

function broadcastMapPing(msg: Extract<ServerMessage, { type: "mapPing" }>): void {
  const payload = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

function clearMapPingForSocket(ws: WebSocket): void {
  if (!socketMapPingActive.has(ws)) return;
  socketMapPingActive.delete(ws);
  const actor = actorForSocket(ws);
  broadcastMapPing({
    type: "mapPing",
    fromId: mapPingFromId(ws),
    fromName: actor.name,
    role: actor.role,
    surface: "taccom",
    x: 0,
    y: 0,
    active: false,
  });
}

function broadcastConsole(actor: ConsoleActor, message: string): void {
  appendConsole(actor, message);
}

registerConsoleBroadcaster(broadcastConsoleEntry);

function sendConsoleSync(ws: WebSocket): void {
  const msg: ServerMessage = { type: "consoleSync", entries: getConsoleEntries() };
  ws.send(JSON.stringify(msg));
}

function sendError(ws: WebSocket, message: string): void {
  const msg: ServerMessage = { type: "error", message };
  ws.send(JSON.stringify(msg));
}

httpServer.on("upgrade", (request, socket, head) => {
  const host = request.headers.host ?? "localhost";
  try {
    const url = new URL(request.url ?? "/", `http://${host}`);
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
  } catch {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

wss.on("connection", (ws: WebSocket) => {
  socketSheet.set(ws, null);
  socketProfile.set(ws, null);
  socketGmPermissions.set(ws, false);
  socketRole.set(ws, null);
  sendConsoleSync(ws);
  broadcastState();

  ws.on("message", (raw) => {
    void (async () => {
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(String(raw)) as ClientMessage;
    } catch {
      sendError(ws, "Invalid JSON");
      return;
    }

    if (parsed.type === "join") {
      const verified = await verifyAuthToken(parsed.token ?? "", AUTH_SECRET);
      if (!verified) {
        sendError(ws, "Authentication required");
        ws.close();
        return;
      }
      const role = verified.role;
      const currentProfileId = socketProfile.get(ws) ?? null;

      if (role === "gm") {
        socketSheet.set(ws, null);
        socketProfile.set(ws, null);
        socketGmPermissions.set(ws, false);
        socketRole.set(ws, "gm");
        broadcastConsole(actorForSocket(ws), CONSOLE_MSG_CONNECTED);
        broadcastState();
        return;
      }

      const playerKey = parsed.playerKey ?? currentProfileId ?? randomUUID();

      const profileInUse = [...socketProfile.entries()].some(
        ([otherWs, otherProfileId]) =>
          otherWs !== ws &&
          otherProfileId === playerKey &&
          socketRole.get(otherWs) === "player"
      );
      if (profileInUse) {
        sendError(ws, "That player profile is already in use");
        return;
      }

      socketSheet.set(ws, resolveSheetForJoin(playerKey, parsed.characterSheetId).characterSheetId ?? null);
      socketProfile.set(ws, playerKey);
      socketGmPermissions.set(ws, profileGmPermissions(playerKey));
      socketRole.set(ws, "player");
      broadcastConsole(actorForSocket(ws), CONSOLE_MSG_CONNECTED);
      broadcastState();
      return;
    }

    const role = socketRole.get(ws);
    if (parsed.type === "mapPing") {
      if (!role) {
        sendError(ws, "Not joined");
        return;
      }
      if (parsed.surface !== "taccom" && parsed.surface !== "overworld") {
        sendError(ws, "Invalid map ping");
        return;
      }
      if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) {
        sendError(ws, "Invalid map ping");
        return;
      }
      const actor = actorForSocket(ws);
      if (parsed.active) {
        socketMapPingActive.set(ws, true);
      } else {
        socketMapPingActive.delete(ws);
      }
      broadcastMapPing({
        type: "mapPing",
        fromId: mapPingFromId(ws),
        fromName: actor.name,
        role: actor.role,
        surface: parsed.surface,
        x: Math.trunc(parsed.x),
        y: Math.trunc(parsed.y),
        active: parsed.active === true,
      });
      return;
    }
    if (parsed.type === "moveEnemy" || parsed.type === "addEnemy" || parsed.type === "removeEnemy") {
      if (parsed.type === "removeEnemy") {
        const enemy = gameState.enemies.find((e) => e.id === parsed.enemyId);
        if (!enemy) return;
        if (!socketHasGmCapabilities(ws) && (enemy.hp ?? 0) > 0) {
          sendError(ws, "Only the game master can manage enemies");
          return;
        }
        removeEnemy(gameState, parsed.enemyId, { entireSwarm: parsed.entireSwarm ?? false });
        if ((enemy.hp ?? 0) > 0) {
          broadcastConsole(actorForSocket(ws), `removed ${enemyLabel(enemy)}`);
        }
      } else {
        if (!socketHasGmCapabilities(ws)) {
          sendError(ws, "Only the game master can manage enemies");
          return;
        }
        if (parsed.type === "moveEnemy") {
          const enemy = gameState.enemies.find((e) => e.id === parsed.enemyId);
          const err = validateEnemyMove(gameState, parsed.enemyId, parsed.x, parsed.y, {
            soloSwarmMember: parsed.soloSwarmMember,
          });
          if (err) {
            sendError(ws, err);
            return;
          }
          const provokeMsg = applyEnemyMove(gameState, parsed.enemyId, parsed.x, parsed.y, {
            soloSwarmMember: parsed.soloSwarmMember,
          });
          if (enemy) {
            let msg = `moved ${enemyLabel(enemy)} to (${parsed.x}, ${parsed.y})`;
            if (provokeMsg) msg = `${provokeMsg}; ${msg}`;
            broadcastConsole(actorForSocket(ws), msg);
          }
        } else {
          const id = randomUUID();
          const err = addEnemy(gameState, {
            id,
            x: parsed.x,
            y: parsed.y,
            ...(parsed.name !== undefined ? { name: parsed.name } : {}),
          });
          if (err) {
            sendError(ws, err);
            return;
          }
          const enemy = gameState.enemies.find((e) => e.id === id);
          if (enemy) {
            broadcastConsole(actorForSocket(ws), `spawned ${enemyLabel(enemy)} at (${parsed.x}, ${parsed.y})`);
          }
        }
      }
      broadcastState();
      return;
    }

    if (parsed.type === "gmForceMove") {
      if (!socketHasGmCapabilities(ws)) {
        sendError(ws, "Only the game master can force-move tokens");
        return;
      }
      const err = validateGmForceMove(gameState, parsed.target, parsed.x, parsed.y, {
        soloSwarmMember: parsed.soloSwarmMember,
      });
      if (err) {
        sendError(ws, err);
        return;
      }
      applyGmForceMove(gameState, parsed.target, parsed.x, parsed.y, {
        soloSwarmMember: parsed.soloSwarmMember,
      });
      if (parsed.target.kind === "player") {
        const player = gameState.players.find((p) => p.id === parsed.target.id);
        if (player) {
          broadcastConsole(
            actorForSocket(ws),
            `force-moved ${playerLabel(player)} to (${parsed.x}, ${parsed.y})`,
          );
        }
      } else {
        const enemy = gameState.enemies.find((e) => e.id === parsed.target.id);
        if (enemy) {
          broadcastConsole(
            actorForSocket(ws),
            `force-moved ${enemyLabel(enemy)} to (${parsed.x}, ${parsed.y})`,
          );
        }
      }
      broadcastState();
      return;
    }

    if (parsed.type === "setPlayerHp") {
      const role = socketRole.get(ws);
      const playerId = playerIdForSocket(ws);
      if (!canSetPlayerHp(role, playerId, parsed.playerId, socketGmPermissionsFor(ws))) {
        sendError(ws, "Forbidden");
        return;
      }
      if (!Number.isFinite(parsed.hp)) {
        sendError(ws, "Invalid HP");
        return;
      }
      const err = setPlayerHp(gameState, parsed.playerId, Math.trunc(parsed.hp));
      if (err) {
        sendError(ws, err);
        return;
      }
      broadcastConsole(
        actorForSocket(ws),
        `set ${targetLabelForPlayer(parsed.playerId)} HP to ${Math.trunc(parsed.hp)}`,
      );
      broadcastState();
      return;
    }

    if (parsed.type === "syncPlayerSheet") {
      const role = socketRole.get(ws);
      const playerKey = socketProfile.get(ws);
      if (!canSyncPlayerSheet(role, playerKey, parsed.characterSheetId)) {
        sendError(ws, "Forbidden");
        return;
      }
      const sheet = characterSheets.get(parsed.characterSheetId);
      const player = gameState.players.find(
        (p) => p.characterSheetId === parsed.characterSheetId,
      );
      if (!player) {
        sendError(ws, "Player not on board");
        return;
      }
      const prevLoadout = {
        class: player.class ?? "",
        armor: player.armor ?? "",
        weapon: player.weapon ?? "",
        equipment: player.equipment,
        gear: player.gear,
        weapon2: player.weapon2,
        data: player.data,
      };
      const err = syncPlayerSheet(
        gameState,
        parsed.characterSheetId,
        parsed.class,
        parsed.armor,
        parsed.weapon,
        parsed.equipment,
        parsed.gear,
        parsed.weapon2,
        parsed.data,
        parsed.gearArmor,
      );
      if (err) {
        sendError(ws, err);
        return;
      }
      const actor = actorForSocket(ws);
      const label = sheet?.name ?? "Character";
      logSyncPlayerLoadoutChanges(
        (a, message) => broadcastConsole(a, message),
        actor,
        label,
        prevLoadout,
        {
          class: player.class ?? "",
          armor: player.armor ?? "",
          weapon: player.weapon ?? "",
          equipment: player.equipment,
          gear: player.gear,
          weapon2: player.weapon2,
          data: player.data,
        },
      );
      broadcastState();
      return;
    }

    if (parsed.type === "spawnPlayerToken") {
      const role = socketRole.get(ws);
      const playerKey = socketProfile.get(ws);
      const sheet = characterSheets.get(parsed.characterSheetId);
      if (!sheet) {
        sendError(ws, "Unknown character sheet");
        return;
      }
      if (role !== "gm" && !(role === "player" && !!playerKey && sheet.player === playerKey)) {
        sendError(ws, "Forbidden");
        return;
      }
      const result = spawnPlayerFromSheet(gameState, {
        id: randomUUID(),
        characterSheetId: sheet.id,
        playerKey: sheet.player,
        nickname: playerProfiles.get(sheet.player)?.name,
        className: sheet.class,
        armor: sheet.armor,
        weapon: sheet.weapon,
        equipment: sheet.equipment,
        gear: sheet.gear,
        gearArmor: sheet.gearArmor,
        weapon2: sheet.weapon2,
        data: sheet.data,
      });
      if ("error" in result) {
        sendError(ws, result.error === "board_full" ? "Board full" : "Token already on board");
        return;
      }
      broadcastConsole(actorForSocket(ws), `spawned ${sheet.name || "token"}`);
      broadcastState();
      return;
    }

    if (parsed.type === "removePlayerToken") {
      const token = gameState.players.find((p) => p.id === parsed.playerId);
      if (!token) {
        sendError(ws, "Unknown token");
        return;
      }
      const role = socketRole.get(ws);
      const playerKey = socketProfile.get(ws);
      const sheet = token.characterSheetId ? characterSheets.get(token.characterSheetId) : undefined;
      const isOwner = role === "player" && !!playerKey && sheet?.player === playerKey;
      if (!socketHasGmCapabilities(ws) && !isOwner) {
        sendError(ws, "Forbidden");
        return;
      }
      const label = targetLabelForPlayer(parsed.playerId);
      removePlayer(gameState, parsed.playerId);
      broadcastConsole(actorForSocket(ws), `removed ${label}`);
      broadcastState();
      return;
    }

    if (parsed.type === "activateMap") {
      if (!socketHasGmCapabilities(ws)) {
        sendError(ws, "Only the game master can do that");
        return;
      }
      const map = savedMaps.get(parsed.mapId);
      const err = validateActivateMap(parsed.mapId, map);
      if (err) {
        sendError(ws, err);
        return;
      }
      const message = applyActivateMap(gameState, map!);
      seedTilePresetsFromMap(map!.id, map!.tilePresets);
      broadcastConsole(actorForSocket(ws), message);
      broadcastState();
      return;
    }

    if (parsed.type === "saveStartingState") {
      if (!socketHasGmCapabilities(ws)) {
        sendError(ws, "Only the game master can do that");
        return;
      }
      const map = savedMaps.get(gameState.mapId);
      if (!map) {
        sendError(ws, "Map not found");
        return;
      }
      broadcastConsole(actorForSocket(ws), applySaveStartingState(gameState, map));
      broadcastState();
      return;
    }

    if (parsed.type === "resetToStartingState") {
      if (!socketHasGmCapabilities(ws)) {
        sendError(ws, "Only the game master can do that");
        return;
      }
      const map = savedMaps.get(gameState.mapId);
      const err = validateResetToStartingState(map);
      if (err) {
        sendError(ws, err);
        return;
      }
      broadcastConsole(actorForSocket(ws), applyResetToStartingState(gameState, map!));
      broadcastState();
      return;
    }

    if (parsed.type === "setSandboxMode") {
      if (!socketHasGmCapabilities(ws)) {
        sendError(ws, "Only the game master can do that");
        return;
      }
      const message = applySetSandboxMode(gameState, parsed.sandboxMode);
      broadcastConsole(actorForSocket(ws), message);
      broadcastState();
      return;
    }

    const combatCtx = combatCtxForSocket(ws);

    const combatResult = handleCombatMessage(gameState, parsed, combatCtx);
    if (combatResult.handled) {
      if ("error" in combatResult) {
        sendError(ws, combatResult.error);
        return;
      }
      if (parsed.type === "playerAction" && parsed.action.action === "weaponSwap") {
        persistWeaponSwapToSheet(combatCtx.playerId);
      }
      if (parsed.type === "gmPaintTile") {
        const map = savedMaps.get(gameState.mapId);
        if (map) persistMapTilesAt(gameState, map, parsed.coords);
      }
      if (
        parsed.type === "confirmPending" &&
        "persistCoords" in combatResult &&
        combatResult.persistCoords
      ) {
        const map = savedMaps.get(gameState.mapId);
        if (map) persistMapTilesAt(gameState, map, combatResult.persistCoords);
      }
      if (parsed.type === "setTileTerrain") {
        const map = savedMaps.get(gameState.mapId);
        if (map) persistMapTileAt(gameState, map, parsed.x, parsed.y);
      }
      if (!combatResult.silent) {
        broadcastConsole(actorForSocket(ws), combatResult.message);
      }
      broadcastState();
      return;
    }

    if (parsed.type === "phaseAction") {
      if (!role) {
        sendError(ws, "Not joined");
        return;
      }
      const ctx = combatCtxForSocket(ws);
      const err = validatePhaseAction(gameState, parsed.action, ctx);
      if (err) {
        sendError(ws, err);
        return;
      }
      const map = parsed.action === "resetCombat" ? savedMaps.get(gameState.mapId) : undefined;
      const message = applyPhaseAction(gameState, parsed.action, ctx, map);
      broadcastConsole(actorForSocket(ws), message);
      broadcastState();
      return;
    }

    if (parsed.type === "baseCampaignAction") {
      if (!role) {
        sendError(ws, "Not joined");
        return;
      }
      const err = validateBaseCampaignAction(gameState, parsed.action);
      if (err) {
        sendError(ws, err);
        return;
      }
      const message = applyBaseCampaignAction(gameState, parsed.action);
      broadcastConsole(actorForSocket(ws), message);
      broadcastState();
      return;
    }

    if (parsed.type === "overworldCampaignAction") {
      if (!role) {
        sendError(ws, "Not joined");
        return;
      }
      const err = validateOverworldCampaignAction(gameState, parsed.action);
      if (err) {
        sendError(ws, err);
        return;
      }
      const message = applyOverworldCampaignAction(gameState, parsed.action);
      broadcastConsole(actorForSocket(ws), message);
      broadcastState();
      return;
    }

    if (parsed.type === "setOverworldRegionImage") {
      if (!socketHasGmCapabilities(ws)) {
        sendError(ws, "Only the game master can do that");
        return;
      }
      const err = validateSetOverworldRegionImage(
        gameState,
        parsed.regionId,
        parsed.imageKey,
      );
      if (err) {
        sendError(ws, err);
        return;
      }
      const message = applySetOverworldRegionImage(
        gameState,
        parsed.regionId,
        parsed.imageKey,
      );
      broadcastConsole(actorForSocket(ws), message);
      broadcastState();
      return;
    }

    if (parsed.type === "factionCampaignAction") {
      if (!socketHasGmCapabilities(ws)) {
        sendError(ws, "Only the game master can do that");
        return;
      }
      const err = validateFactionCampaignAction(gameState, parsed.action);
      if (err) {
        sendError(ws, err);
        return;
      }
      const message = applyFactionCampaignAction(gameState, parsed.action);
      broadcastConsole(actorForSocket(ws), message);
      broadcastState();
      return;
    }

    if (parsed.type === "overworldLocationAction") {
      if (!socketHasGmCapabilities(ws)) {
        sendError(ws, "Only the game master can do that");
        return;
      }
      const err = validateOverworldLocationAction(gameState, parsed.action);
      if (err) {
        sendError(ws, err);
        return;
      }
      const message = applyOverworldLocationAction(gameState, parsed.action);
      broadcastConsole(actorForSocket(ws), message);
      broadcastState();
      return;
    }

    if (parsed.type === "overworldConvoyAction") {
      if (!socketHasGmCapabilities(ws)) {
        sendError(ws, "Only the game master can do that");
        return;
      }
      const err = validateOverworldConvoyAction(gameState, parsed.action);
      if (err) {
        sendError(ws, err);
        return;
      }
      const message = applyOverworldConvoyAction(gameState, parsed.action);
      broadcastConsole(actorForSocket(ws), message);
      broadcastState();
      return;
    }

    if (parsed.type === "move") {
      const id = playerIdForSocket(ws);
      if (!id) {
        sendError(ws, "Only players can move");
        return;
      }
      if (gameState.roundPhase !== "deployment") {
        const result = handleCombatMessage(
          gameState,
          { type: "movePath", path: [{ x: parsed.x, y: parsed.y }] },
          { ...combatCtxForSocket(ws), playerId: id },
        );
        if (result.handled && "error" in result) {
          sendError(ws, result.error);
          return;
        }
        if (result.handled && "message" in result) {
          broadcastConsole(actorForSocket(ws), result.message);
          broadcastState();
        }
        return;
      }
      const err = validateMove(gameState, id, parsed.x, parsed.y);
      if (err) {
        sendError(ws, err);
        return;
      }
      applyMove(gameState, id, parsed.x, parsed.y);
      broadcastConsole(actorForSocket(ws), `moved to (${parsed.x}, ${parsed.y})`);
      broadcastState();
    }
    })();
  });

  ws.on("close", () => {
    const actor = actorForSocket(ws);
    clearMapPingForSocket(ws);
    if (socketRole.get(ws)) {
      broadcastConsole(actor, CONSOLE_MSG_DISCONNECTED);
    }
    socketSheet.delete(ws);
    socketProfile.delete(ws);
    socketGmPermissions.delete(ws);
    socketRole.delete(ws);
  });
});

async function loadMap(): Promise<void> {
  await seedMapsFromDisk(mapsDirPath());
  const map = savedMaps.get(DEFAULT_MAP_ID);
  if (!map) {
    throw new Error(`Map not found: ${DEFAULT_MAP_ID}`);
  }
  seedTilePresetsFromMap(map.id, map.tilePresets);
  gameState = normalizeGameState(createInitialStateFromMap(map), map);
}

loadMap()
  .then(() => loadEnemyPortraits())
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to load map:", err);
    process.exit(1);
  });
