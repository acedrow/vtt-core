import "@vtt-core/hellpiercers-content/register";
import type { ClientMessage, ConsoleActor, ConsoleLogEntry, VttRole, GameState, ServerMessage } from "@vtt-core/shared";
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
  createInitialStateFromMap,
  DEFAULT_MAP_ID,
  enemyLabel,
  handleCombatMessage,
  logSyncPlayerLoadoutChanges,
  normalizeGameState,
  persistMapTileAt,
  persistMapTilesAt,
  applySaveStartingState,
  applyResetToStartingState,
  validateResetToStartingState,
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
  validateActivateMap,
  verifyAuthToken,
} from "@vtt-core/shared";

import type { Env } from "./env.js";
import { appendConsole, loadConsoleEntries } from "./console-log.js";
import { getCharacterSheet, listCharacterSheets, saveCharacterSheet } from "./character-sheets.js";
import { getMap, putMap } from "./maps.js";
import { getPlayerProfile, savePlayerProfile } from "./player-profiles.js";

type Attachment = {
  characterSheetId: string | null;
  playerKey: string | null;
  role: VttRole | null;
  gmPermissions?: boolean;
};

const GAME_STATE_KEY = "gameState";

async function resolveSheetForJoin(
  env: Env,
  playerKey: string,
  characterSheetId?: string
): Promise<{
  className?: string;
  characterSheetId?: string;
  armor?: string;
  weapon?: string;
  equipment?: string;
  gear?: string;
  weapon2?: string;
  data?: Record<string, unknown>;
}> {
  if (characterSheetId) {
    const sheet = await getCharacterSheet(env, characterSheetId);
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
  const sheets = await listCharacterSheets(env);
  const sheet = sheets.find((s) => s.player === playerKey);
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

async function canSyncPlayerSheet(
  env: Env,
  role: VttRole | null | undefined,
  playerKey: string | null | undefined,
  characterSheetId: string
): Promise<boolean> {
  if (role === "gm") return true;
  const sheet = await getCharacterSheet(env, characterSheetId);
  return role === "player" && !!playerKey && sheet?.player === playerKey;
}

export class GameRoom {
  private gameState!: GameState;
  private readonly env: Env;
  // Tile edits do an independent KV get+put; without serializing them, overlapping
  // get-then-put cycles (e.g. rapid setTileTerrain calls) would clobber each
  // other's writes. Chain them so each waits for the previous put to land before
  // reading the map again.
  private mapPersistChain: Promise<void> = Promise.resolve();
  private readonly mapPingActiveSockets = new Set<WebSocket>();

  constructor(
    private readonly ctx: DurableObjectState,
    env: Env
  ) {
    this.env = env;
    void this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<GameState>(GAME_STATE_KEY);
      const map = await getMap(this.env, stored?.mapId ?? DEFAULT_MAP_ID);
      if (stored) {
        this.gameState = normalizeGameState(stored, map);
        if (stored.mapName !== this.gameState.mapName) {
          await this.ctx.storage.put(GAME_STATE_KEY, this.gameState);
        }
      } else {
        this.gameState = normalizeGameState(createInitialStateFromMap(map), map);
        await this.ctx.storage.put(GAME_STATE_KEY, this.gameState);
      }
    });
  }

  /** The board token controlled by a socket, derived from its bound character sheet. */
  private playerIdForAtt(att: Attachment | null): string | null {
    const sheetId = att?.characterSheetId;
    if (!sheetId) return null;
    return this.gameState.players.find((p) => p.characterSheetId === sheetId)?.id ?? null;
  }

  private attHasGmCapabilities(att: Attachment | null): boolean {
    return att?.role === "gm" || att?.gmPermissions === true;
  }

  private combatCtxForAtt(att: Attachment | null) {
    const role = att?.role ?? "player";
    return {
      role,
      playerId: this.playerIdForAtt(att),
      gmPermissions: role === "player" ? att?.gmPermissions === true : undefined,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/internal/active-profiles") {
      return Response.json({ activeProfileIds: this.activeProfileIds() });
    }
    if (url.pathname === "/internal/broadcast-console" && request.method === "POST") {
      const body = (await request.json()) as { entry: ConsoleLogEntry };
      this.sendConsoleEntry(body.entry);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/internal/sheet-on-board") {
      const sheetId = url.searchParams.get("sheetId");
      const onBoard = !!sheetId && this.gameState.players.some((p) => p.characterSheetId === sheetId);
      return Response.json({ onBoard });
    }
    if (url.pathname === "/internal/remove-sheet-token" && request.method === "POST") {
      const body = (await request.json()) as { sheetId: string };
      const token = this.gameState.players.find((p) => p.characterSheetId === body.sheetId);
      if (token) {
        removePlayer(this.gameState, token.id);
        await this.broadcastState();
      }
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/internal/campaign-unlocks") {
      return Response.json({
        constructedBaseUpgrades: this.gameState.campaign?.constructedBaseUpgrades ?? [],
      });
    }

    if (url.pathname === "/internal/active-map-id") {
      return Response.json({ mapId: this.gameState.mapId });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      characterSheetId: null,
      playerKey: null,
      role: null,
    } satisfies Attachment);

    await this.sendConsoleSync(server);
    await this.broadcastState();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const text =
      typeof message === "string"
        ? message
        : new TextDecoder().decode(message);

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(text) as ClientMessage;
    } catch {
      this.sendError(ws, "Invalid JSON");
      return;
    }

    const att = ws.deserializeAttachment() as Attachment | null;
    if (parsed.type === "join") {
      const verified = await verifyAuthToken(parsed.token ?? "", this.env.AUTH_SECRET);
      if (!verified) {
        this.sendError(ws, "Authentication required");
        ws.close();
        return;
      }
      const role = verified.role;
      const currentKey = att?.playerKey ?? null;

      if (role === "gm") {
        ws.serializeAttachment({
          characterSheetId: null,
          playerKey: null,
          role: "gm",
          gmPermissions: false,
        } satisfies Attachment);
        await this.broadcastConsole(await this.actorForSocket(ws), CONSOLE_MSG_CONNECTED);
        await this.broadcastState();
        return;
      }

      const playerKey = parsed.playerKey ?? currentKey ?? crypto.randomUUID();
      if (this.profileInUseByAnotherSocket(playerKey, ws)) {
        this.sendError(ws, "That player profile is already in use");
        return;
      }
      const sheetJoin = await resolveSheetForJoin(
        this.env,
        playerKey,
        parsed.characterSheetId
      );
      const profile = await getPlayerProfile(this.env, playerKey);
      ws.serializeAttachment({
        characterSheetId: sheetJoin.characterSheetId ?? null,
        playerKey,
        role: "player",
        gmPermissions: profile?.gmPermissions === true,
      } satisfies Attachment);
      await this.broadcastConsole(await this.actorForSocket(ws), CONSOLE_MSG_CONNECTED);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "mapPing") {
      if (!att?.role) {
        this.sendError(ws, "Not joined");
        return;
      }
      if (parsed.surface !== "taccom" && parsed.surface !== "overworld") {
        this.sendError(ws, "Invalid map ping");
        return;
      }
      if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) {
        this.sendError(ws, "Invalid map ping");
        return;
      }
      const actor = await this.actorForSocket(ws);
      if (parsed.active) {
        this.mapPingActiveSockets.add(ws);
      } else {
        this.mapPingActiveSockets.delete(ws);
      }
      this.broadcastMapPing({
        type: "mapPing",
        fromId: this.mapPingFromId(att),
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
        const enemy = this.gameState.enemies.find((e) => e.id === parsed.enemyId);
        if (!enemy) return;
        if (!this.attHasGmCapabilities(att) && (enemy.hp ?? 0) > 0) {
          this.sendError(ws, "Only the game master can manage enemies");
          return;
        }
        removeEnemy(this.gameState, parsed.enemyId, { entireSwarm: parsed.entireSwarm ?? false });
        if ((enemy.hp ?? 0) > 0) {
          const actor = await this.actorForSocket(ws);
          await this.broadcastConsole(actor, `removed ${enemyLabel(enemy)}`);
        }
      } else {
        if (!this.attHasGmCapabilities(att)) {
          this.sendError(ws, "Only the game master can manage enemies");
          return;
        }
        if (parsed.type === "moveEnemy") {
          const enemy = this.gameState.enemies.find((e) => e.id === parsed.enemyId);
          const err = validateEnemyMove(this.gameState, parsed.enemyId, parsed.x, parsed.y, {
            soloSwarmMember: parsed.soloSwarmMember,
          });
          if (err) {
            this.sendError(ws, err);
            return;
          }
          const provokeMsg = applyEnemyMove(this.gameState, parsed.enemyId, parsed.x, parsed.y, {
            soloSwarmMember: parsed.soloSwarmMember,
          });
          if (enemy) {
            const actor = await this.actorForSocket(ws);
            let msg = `moved ${enemyLabel(enemy)} to (${parsed.x}, ${parsed.y})`;
            if (provokeMsg) msg = `${provokeMsg}; ${msg}`;
            await this.broadcastConsole(actor, msg);
          }
        } else {
          const id = crypto.randomUUID();
          const err = addEnemy(this.gameState, {
            id,
            x: parsed.x,
            y: parsed.y,
            ...(parsed.name !== undefined ? { name: parsed.name } : {}),
          });
          if (err) {
            this.sendError(ws, err);
            return;
          }
          const enemy = this.gameState.enemies.find((e) => e.id === id);
          if (enemy) {
            const actor = await this.actorForSocket(ws);
            await this.broadcastConsole(actor, `spawned ${enemyLabel(enemy)} at (${parsed.x}, ${parsed.y})`);
          }
        }
      }
      await this.broadcastState();
      return;
    }

    if (parsed.type === "gmForceMove") {
      if (!this.attHasGmCapabilities(att)) {
        this.sendError(ws, "Only the game master can force-move tokens");
        return;
      }
      const err = validateGmForceMove(this.gameState, parsed.target, parsed.x, parsed.y, {
        soloSwarmMember: parsed.soloSwarmMember,
      });
      if (err) {
        this.sendError(ws, err);
        return;
      }
      applyGmForceMove(this.gameState, parsed.target, parsed.x, parsed.y, {
        soloSwarmMember: parsed.soloSwarmMember,
      });
      if (parsed.target.kind === "player") {
        const player = this.gameState.players.find((p) => p.id === parsed.target.id);
        if (player) {
          const actor = await this.actorForSocket(ws);
          await this.broadcastConsole(
            actor,
            `force-moved ${playerLabel(player)} to (${parsed.x}, ${parsed.y})`,
          );
        }
      } else {
        const enemy = this.gameState.enemies.find((e) => e.id === parsed.target.id);
        if (enemy) {
          const actor = await this.actorForSocket(ws);
          await this.broadcastConsole(
            actor,
            `force-moved ${enemyLabel(enemy)} to (${parsed.x}, ${parsed.y})`,
          );
        }
      }
      await this.broadcastState();
      return;
    }

    if (parsed.type === "setPlayerHp") {
      if (!canSetPlayerHp(att?.role, this.playerIdForAtt(att), parsed.playerId, att?.gmPermissions)) {
        this.sendError(ws, "Forbidden");
        return;
      }
      if (!Number.isFinite(parsed.hp)) {
        this.sendError(ws, "Invalid HP");
        return;
      }
      const err = setPlayerHp(this.gameState, parsed.playerId, Math.trunc(parsed.hp));
      if (err) {
        this.sendError(ws, err);
        return;
      }
      const actor = await this.actorForSocket(ws);
      const target = await this.targetLabelForPlayer(parsed.playerId);
      await this.broadcastConsole(actor, `set ${target} HP to ${Math.trunc(parsed.hp)}`);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "syncPlayerSheet") {
      if (!(await canSyncPlayerSheet(this.env, att?.role, att?.playerKey, parsed.characterSheetId))) {
        this.sendError(ws, "Forbidden");
        return;
      }
      const sheet = await getCharacterSheet(this.env, parsed.characterSheetId);
      const player = this.gameState.players.find(
        (p) => p.characterSheetId === parsed.characterSheetId,
      );
      if (!player) {
        this.sendError(ws, "Player not on board");
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
        this.gameState,
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
        this.sendError(ws, err);
        return;
      }
      const actor = await this.actorForSocket(ws);
      const label = sheet?.name ?? "Character";
      logSyncPlayerLoadoutChanges(
        // Best-effort logging: the shared emit callback is synchronous, so this
        // KV-backed broadcast cannot be awaited here without changing shared.
        (a, message) => {
          void this.broadcastConsole(a, message);
        },
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
      await this.broadcastState();
      return;
    }

    if (parsed.type === "spawnPlayerToken") {
      const sheet = await getCharacterSheet(this.env, parsed.characterSheetId);
      if (!sheet) {
        this.sendError(ws, "Unknown character sheet");
        return;
      }
      if (!this.attHasGmCapabilities(att) && !(att?.role === "player" && !!att?.playerKey && sheet.player === att.playerKey)) {
        this.sendError(ws, "Forbidden");
        return;
      }
      const profile = await getPlayerProfile(this.env, sheet.player);
      const result = spawnPlayerFromSheet(this.gameState, {
        id: crypto.randomUUID(),
        characterSheetId: sheet.id,
        playerKey: sheet.player,
        nickname: profile?.name,
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
        this.sendError(ws, result.error === "board_full" ? "Board full" : "Token already on board");
        return;
      }
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, `spawned ${sheet.name || "token"}`);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "removePlayerToken") {
      const token = this.gameState.players.find((p) => p.id === parsed.playerId);
      if (!token) {
        this.sendError(ws, "Unknown token");
        return;
      }
      const sheet = token.characterSheetId
        ? await getCharacterSheet(this.env, token.characterSheetId)
        : null;
      const isOwner = att?.role === "player" && !!att?.playerKey && sheet?.player === att.playerKey;
      if (!this.attHasGmCapabilities(att) && !isOwner) {
        this.sendError(ws, "Forbidden");
        return;
      }
      const label = await this.targetLabelForPlayer(parsed.playerId);
      removePlayer(this.gameState, parsed.playerId);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, `removed ${label}`);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "activateMap") {
      if (!this.attHasGmCapabilities(att)) {
        this.sendError(ws, "Only the game master can do that");
        return;
      }
      let map;
      try {
        map = await getMap(this.env, parsed.mapId);
      } catch {
        map = undefined;
      }
      const err = validateActivateMap(parsed.mapId, map);
      if (err) {
        this.sendError(ws, err);
        return;
      }
      const message = applyActivateMap(this.gameState, map!);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, message);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "saveStartingState") {
      if (!this.attHasGmCapabilities(att)) {
        this.sendError(ws, "Only the game master can do that");
        return;
      }
      await this.queueMapPersist((map) => {
        applySaveStartingState(this.gameState, map);
      });
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, "Starting state saved");
      await this.broadcastState();
      return;
    }

    if (parsed.type === "resetToStartingState") {
      if (!this.attHasGmCapabilities(att)) {
        this.sendError(ws, "Only the game master can do that");
        return;
      }
      let map;
      try {
        map = await getMap(this.env, this.gameState.mapId);
      } catch {
        map = undefined;
      }
      const err = validateResetToStartingState(map);
      if (err) {
        this.sendError(ws, err);
        return;
      }
      const message = applyResetToStartingState(this.gameState, map!);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, message);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "setSandboxMode") {
      if (!this.attHasGmCapabilities(att)) {
        this.sendError(ws, "Only the game master can do that");
        return;
      }
      const message = applySetSandboxMode(this.gameState, parsed.sandboxMode);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, message);
      await this.broadcastState();
      return;
    }

    const combatCtx = this.combatCtxForAtt(att);
    const combatResult = handleCombatMessage(this.gameState, parsed, combatCtx);
    if (combatResult.handled) {
      if ("error" in combatResult) {
        this.sendError(ws, combatResult.error);
        return;
      }
      if (parsed.type === "playerAction" && parsed.action.action === "weaponSwap") {
        await this.persistWeaponSwapToSheet(combatCtx.playerId);
      }
      if (parsed.type === "gmPaintTile") {
        await this.persistActiveMapTiles(parsed.coords);
      }
      if (
        parsed.type === "confirmPending" &&
        "persistCoords" in combatResult &&
        combatResult.persistCoords
      ) {
        await this.persistActiveMapTiles(combatResult.persistCoords);
      }
      if (parsed.type === "setTileTerrain") {
        await this.persistActiveMapTile(parsed.x, parsed.y);
      }
      const actor = await this.actorForSocket(ws);
      if (!combatResult.silent) {
        await this.broadcastConsole(actor, combatResult.message);
      }
      await this.broadcastState();
      return;
    }

    if (parsed.type === "phaseAction") {
      if (!att?.role) {
        this.sendError(ws, "Not joined");
        return;
      }
      const ctx = this.combatCtxForAtt(att);
      const err = validatePhaseAction(this.gameState, parsed.action, ctx);
      if (err) {
        this.sendError(ws, err);
        return;
      }
      const map =
        parsed.action === "resetCombat"
          ? await getMap(this.env, this.gameState.mapId).catch(() => undefined)
          : undefined;
      const message = applyPhaseAction(this.gameState, parsed.action, ctx, map);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, message);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "baseCampaignAction") {
      if (!att?.role) {
        this.sendError(ws, "Not joined");
        return;
      }
      const err = validateBaseCampaignAction(this.gameState, parsed.action);
      if (err) {
        this.sendError(ws, err);
        return;
      }
      const message = applyBaseCampaignAction(this.gameState, parsed.action);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, message);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "overworldCampaignAction") {
      if (!att?.role) {
        this.sendError(ws, "Not joined");
        return;
      }
      const err = validateOverworldCampaignAction(this.gameState, parsed.action);
      if (err) {
        this.sendError(ws, err);
        return;
      }
      const message = applyOverworldCampaignAction(this.gameState, parsed.action);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, message);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "setOverworldRegionImage") {
      if (!this.attHasGmCapabilities(att)) {
        this.sendError(ws, "Only the game master can do that");
        return;
      }
      const err = validateSetOverworldRegionImage(
        this.gameState,
        parsed.regionId,
        parsed.imageKey,
      );
      if (err) {
        this.sendError(ws, err);
        return;
      }
      const message = applySetOverworldRegionImage(
        this.gameState,
        parsed.regionId,
        parsed.imageKey,
      );
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, message);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "factionCampaignAction") {
      if (!this.attHasGmCapabilities(att)) {
        this.sendError(ws, "Only the game master can do that");
        return;
      }
      const err = validateFactionCampaignAction(this.gameState, parsed.action);
      if (err) {
        this.sendError(ws, err);
        return;
      }
      const message = applyFactionCampaignAction(this.gameState, parsed.action);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, message);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "overworldLocationAction") {
      if (!this.attHasGmCapabilities(att)) {
        this.sendError(ws, "Only the game master can do that");
        return;
      }
      const err = validateOverworldLocationAction(this.gameState, parsed.action);
      if (err) {
        this.sendError(ws, err);
        return;
      }
      const message = applyOverworldLocationAction(this.gameState, parsed.action);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, message);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "overworldConvoyAction") {
      if (!this.attHasGmCapabilities(att)) {
        this.sendError(ws, "Only the game master can do that");
        return;
      }
      const err = validateOverworldConvoyAction(this.gameState, parsed.action);
      if (err) {
        this.sendError(ws, err);
        return;
      }
      const message = applyOverworldConvoyAction(this.gameState, parsed.action);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, message);
      await this.broadcastState();
      return;
    }

    if (parsed.type === "move") {
      const id = this.playerIdForAtt(att);
      if (!id) {
        this.sendError(ws, "Only players can move");
        return;
      }
      if (this.gameState.roundPhase !== "deployment") {
        const result = handleCombatMessage(
          this.gameState,
          { type: "movePath", path: [{ x: parsed.x, y: parsed.y }] },
          { ...this.combatCtxForAtt(att), playerId: id },
        );
        if (result.handled && "error" in result) {
          this.sendError(ws, result.error);
          return;
        }
        if (result.handled && "message" in result) {
          const actor = await this.actorForSocket(ws);
          await this.broadcastConsole(actor, result.message);
          await this.broadcastState();
        }
        return;
      }
      const err = validateMove(this.gameState, id, parsed.x, parsed.y);
      if (err) {
        this.sendError(ws, err);
        return;
      }
      applyMove(this.gameState, id, parsed.x, parsed.y);
      const actor = await this.actorForSocket(ws);
      await this.broadcastConsole(actor, `moved to (${parsed.x}, ${parsed.y})`);
      const key = att?.playerKey;
      if (key) {
        const profile = await getPlayerProfile(this.env, key);
        if (profile) {
          const moveCount = Number(profile.data.moveCount ?? 0) + 1;
          await savePlayerProfile(this.env, {
            ...profile,
            updatedAt: new Date().toISOString(),
            data: {
              ...profile.data,
              moveCount,
              lastSeenAt: new Date().toISOString(),
            },
          });
        }
      }
      await this.broadcastState();
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    await this.clearMapPingForSocket(ws, att);
    if (att?.role) {
      await this.broadcastConsole(await this.actorForSocket(ws), CONSOLE_MSG_DISCONNECTED);
    }
    const playerId = this.playerIdForAtt(att);
    const playerKey = att?.playerKey;
    if (playerKey) {
      const player = playerId
        ? this.gameState.players.find((pl) => pl.id === playerId)
        : undefined;
      const profile = await getPlayerProfile(this.env, playerKey);
      if (profile) {
        await savePlayerProfile(this.env, {
          ...profile,
          name: player?.nickname ?? profile.name,
          updatedAt: new Date().toISOString(),
          data: {
            ...profile.data,
            lastSeenAt: new Date().toISOString(),
          },
        });
      }
    }
    ws.serializeAttachment({
      characterSheetId: att?.characterSheetId ?? null,
      playerKey: att?.playerKey ?? null,
      role: att?.role ?? null,
    } satisfies Attachment);
  }

  private sendError(ws: WebSocket, message: string): void {
    const msg: ServerMessage = { type: "error", message };
    ws.send(JSON.stringify(msg));
  }

  private async actorForSocket(ws: WebSocket): Promise<ConsoleActor> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att?.role === "gm") return { name: "GM", role: "gm" };
    if (att?.playerKey) {
      const profile = await getPlayerProfile(this.env, att.playerKey);
      if (profile?.name) return { name: profile.name, role: "player" };
    }
    const playerId = this.playerIdForAtt(att);
    const player = playerId
      ? this.gameState.players.find((p) => p.id === playerId)
      : undefined;
    return { name: player?.nickname ?? "Player", role: "player" };
  }

  private async targetLabelForPlayer(playerId: string): Promise<string> {
    const player = this.gameState.players.find((p) => p.id === playerId);
    const sheet = player?.characterSheetId
      ? await getCharacterSheet(this.env, player.characterSheetId)
      : undefined;
    return characterTargetLabel(player, sheet?.name);
  }

  private async persistWeaponSwapToSheet(playerId: string | null | undefined): Promise<void> {
    if (!playerId) return;
    const player = this.gameState.players.find((p) => p.id === playerId);
    if (!player?.characterSheetId) return;
    const sheet = await getCharacterSheet(this.env, player.characterSheetId);
    if (!sheet) return;
    if (syncCharacterSheetWeaponsFromPlayer(sheet, player)) {
      await saveCharacterSheet(this.env, sheet);
    }
  }

  private async persistActiveMapTile(x: number, y: number): Promise<void> {
    return this.queueMapPersist((map) => persistMapTileAt(this.gameState, map, x, y));
  }

  private async persistActiveMapTiles(coords: { x: number; y: number }[]): Promise<void> {
    return this.queueMapPersist((map) => persistMapTilesAt(this.gameState, map, coords));
  }

  private async queueMapPersist(mutate: (map: Awaited<ReturnType<typeof getMap>>) => void): Promise<void> {
    const mapId = this.gameState.mapId;
    const task = this.mapPersistChain.then(async () => {
      const map = await getMap(this.env, mapId);
      mutate(map);
      await putMap(this.env, map);
    });
    this.mapPersistChain = task.catch(() => {});
    await task;
  }

  private sendConsoleEntry(entry: ConsoleLogEntry): void {
    const msg: ServerMessage = { type: "console", entry };
    const payload = JSON.stringify(msg);
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(payload);
    }
  }

  private mapPingFromId(att: Attachment | null): string {
    if (att?.role === "gm") return "gm";
    return att?.playerKey ?? "player";
  }

  private broadcastMapPing(msg: Extract<ServerMessage, { type: "mapPing" }>): void {
    const payload = JSON.stringify(msg);
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(payload);
    }
  }

  private async clearMapPingForSocket(ws: WebSocket, att: Attachment | null): Promise<void> {
    if (!this.mapPingActiveSockets.has(ws)) return;
    this.mapPingActiveSockets.delete(ws);
    const actor = await this.actorForSocket(ws);
    this.broadcastMapPing({
      type: "mapPing",
      fromId: this.mapPingFromId(att),
      fromName: actor.name,
      role: actor.role,
      surface: "taccom",
      x: 0,
      y: 0,
      active: false,
    });
  }

  private async sendConsoleSync(ws: WebSocket): Promise<void> {
    const entries = await loadConsoleEntries(this.env);
    const msg: ServerMessage = { type: "consoleSync", entries };
    ws.send(JSON.stringify(msg));
  }

  private async broadcastConsole(actor: ConsoleActor, message: string): Promise<void> {
    const entry = await appendConsole(this.env, actor, message);
    this.sendConsoleEntry(entry);
  }

  private async broadcastState(): Promise<void> {
    const stored = structuredClone(this.gameState);
    delete stored.damageEvents;
    delete stored.silentHpEnemyIds;
    await this.ctx.storage.put(GAME_STATE_KEY, stored);
    const snapshot = structuredClone(this.gameState);
    for (const socket of this.ctx.getWebSockets()) {
      const att = socket.deserializeAttachment() as Attachment | null;
      const yourId = this.playerIdForAtt(att);
      const msg: ServerMessage = {
        type: "state",
        state: snapshot,
        yourPlayerId: yourId,
      };
      socket.send(JSON.stringify(msg));
    }
    delete this.gameState.damageEvents;
    delete this.gameState.silentHpEnemyIds;
  }

  private activeProfileIds(): string[] {
    const ids = new Set<string>();
    for (const socket of this.ctx.getWebSockets()) {
      const att = socket.deserializeAttachment() as Attachment | null;
      if (att?.role === "player" && att.playerKey) {
        ids.add(att.playerKey);
      }
    }
    return [...ids];
  }

  private profileInUseByAnotherSocket(profileId: string, socket: WebSocket): boolean {
    for (const s of this.ctx.getWebSockets()) {
      if (s === socket) continue;
      const att = s.deserializeAttachment() as Attachment | null;
      if (att?.role === "player" && att.playerKey === profileId) return true;
    }
    return false;
  }
}
