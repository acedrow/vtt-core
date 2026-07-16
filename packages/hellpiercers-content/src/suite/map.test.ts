import { describe, expect, it } from "vitest";
import {
  buildTileIndex,
  computeWalkable,
  createBlankGameMap,
  createInitialStateFromMap,
  isFootprintInBounds,
  isInBounds,
  isWalkable,
  parseGameMap,
  tileAt,
  toMapSummary,
  validateActivateMap,
  persistMapTileAt,
  applySaveStartingState,
  applyResetToStartingState,
  validateResetToStartingState,
} from "@gaem/shared";
import { applyGmPaintTile } from "@gaem/shared";
import { applyActivateMap } from "@gaem/shared";
import type { GameMap, MapTile } from "@gaem/shared";
import { makeTiles } from "./fixtures.js";

describe("map", () => {
  it("isInBounds and isFootprintInBounds", () => {
    expect(isInBounds(0, 0, 5, 5)).toBe(true);
    expect(isInBounds(4, 4, 5, 5)).toBe(true);
    expect(isInBounds(5, 0, 5, 5)).toBe(false);
    expect(isInBounds(-1, 0, 5, 5)).toBe(false);

    expect(isFootprintInBounds(0, 0, 1, 5, 5)).toBe(true);
    expect(isFootprintInBounds(4, 4, 1, 5, 5)).toBe(true);
    expect(isFootprintInBounds(4, 0, 2, 5, 5)).toBe(false);
    expect(isFootprintInBounds(0, 4, 2, 5, 5)).toBe(false);
  });

  it("isWalkable respects terrain and walkable override", () => {
    const standard: MapTile = { x: 0, y: 0, terrain: ["standard"], elevation: 0 };
    const impassable: MapTile = { x: 0, y: 0, terrain: ["impassable"], elevation: 0 };
    const voidTile: MapTile = { x: 0, y: 0, terrain: ["void"], elevation: 0 };
    const obstacle: MapTile = { x: 0, y: 0, terrain: ["obstacle"], elevation: 0 };
    const advantageous: MapTile = { x: 0, y: 0, terrain: ["advantageous"], elevation: 0 };
    const override: MapTile = { x: 0, y: 0, terrain: ["impassable"], elevation: 0, walkable: true };

    expect(isWalkable(standard)).toBe(true);
    expect(computeWalkable(standard)).toBe(true);
    expect(isWalkable(advantageous)).toBe(true);
    expect(isWalkable(impassable)).toBe(false);
    expect(isWalkable(voidTile)).toBe(false);
    expect(isWalkable(obstacle)).toBe(false);
    expect(isWalkable(override)).toBe(true);
    expect(isWalkable(undefined)).toBe(false);
  });

  it("tileAt and buildTileIndex", () => {
    const tiles = makeTiles(3, 3);
    const index = buildTileIndex(tiles);
    expect(tileAt(tiles, 1, 1)?.terrain).toEqual(["standard"]);
    expect(tileAt(index, 2, 0)?.x).toBe(2);
    expect(tileAt(tiles, 9, 9)).toBeUndefined();
  });

  it("createInitialStateFromMap", () => {
    const map: GameMap = {
      id: "arena",
      name: "Arena",
      width: 6,
      height: 6,
      tiles: makeTiles(6, 6),
      enemies: [{ id: "e1", x: 3, y: 3, name: "Stain Creep" }],
    };
    const state = createInitialStateFromMap(map);
    expect(state.mapId).toBe("arena");
    expect(state.mapName).toBe("Arena");
    expect(state.width).toBe(6);
    expect(state.height).toBe(6);
    expect(state.roundPhase).toBe("taccomNotStarted");
    expect(state.turn).toEqual({ role: "gm" });
    expect(state.players).toEqual([]);
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0]!.hp).toBe(1);
    expect(state.enemies[0]!.movementRemaining).toBeDefined();
  });

  it("createBlankGameMap and toMapSummary", () => {
    const map = createBlankGameMap("test-map", "Test Map", 4, 3);
    expect(map.tiles).toHaveLength(12);
    expect(map.tiles.every((t) => t.terrain[0] === "standard")).toBe(true);
    expect(parseGameMap(map).id).toBe("test-map");
    expect(toMapSummary(map)).toEqual({
      id: "test-map",
      name: "Test Map",
      width: 4,
      height: 3,
    });
    expect(toMapSummary({ ...map, name: undefined }).name).toBe("test-map");
  });

  it("validateActivateMap", () => {
    const map = createBlankGameMap("arena", "Arena", 4, 3);
    expect(validateActivateMap("arena", map)).toBeNull();
    expect(validateActivateMap("arena", undefined)).toBe("Map not found");
    expect(validateActivateMap("", map)).toBe("Map id is required");
    expect(validateActivateMap("other", map)).toBe("Map not found");
  });

  it("applyActivateMap resets board and preserves campaign fields", () => {
    const map = createBlankGameMap("arena", "Arena", 6, 6);
    map.enemies = [{ id: "e1", x: 2, y: 2, name: "Stain Creep" }];
    const state = createInitialStateFromMap(map);
    state.players = [{
      id: "p1",
      x: 1,
      y: 1,
      characterSheetId: "s1",
      class: "Test",
      armor: "Test Armor",
      weapon: "Test Weapon",
      hp: 1,
      maxHp: 1,
    }];
    state.round = 3;
    state.roundPhase = "playerTurn";
    state.campaign!.partyResources = { hellsteel: 5, soulfire: 2, brimstone: 1 };
    state.campaign!.constructedBaseUpgrades = ["upgrade-a"];
    state.campaign!.overworldRegions = [
      { id: "west", imageKey: "region-images/abc.png" },
      { id: "center" },
      { id: "east" },
    ];
    state.campaign!.overworldParty = {
      qx: 4,
      qy: 6,
      atDis: false,
      mapSpeed: 1.5,
      fuel: 5,
      revelations: 2,
    };
    state.campaign!.overworldLocations = [
      { id: "loc-1", qx: 2, qy: 3, name: "Test Site", factionId: "syncrasis" },
    ];
    state.campaign!.overworldConvoys = [
      {
        id: "convoy-1",
        qx: 5,
        qy: 7,
        type: "supply",
        factionId: "paracletus",
        infoVisibleToPlayers: false,
      },
    ];
    state.campaign!.factionStates = {
      syncrasis: {
        crown: 4,
        force: 3,
        subterfuge: 2,
        territory: 1,
        assets: 0,
        defeated: false,
        unlockedUpgrades: ["Fleet Deployment Orders"],
        unlockedUniqueLocations: [],
      },
      autophyes: {
        crown: 0,
        force: 0,
        subterfuge: 0,
        territory: 0,
        assets: 0,
        defeated: true,
        unlockedUpgrades: [],
        unlockedUniqueLocations: [],
      },
      paracletus: {
        crown: 5,
        force: 2,
        subterfuge: 2,
        territory: 5,
        assets: 2,
        defeated: false,
        unlockedUpgrades: [],
        unlockedUniqueLocations: ["The Teethlands"],
      },
    };
    state.sandboxMode = true;

    const message = applyActivateMap(state, map);
    expect(message).toBe('Activated map "Arena"');
    expect(state.mapId).toBe("arena");
    expect(state.width).toBe(6);
    expect(state.players).toEqual([]);
    expect(state.enemies).toHaveLength(1);
    expect(state.roundPhase).toBe("taccomNotStarted");
    expect(state.campaign!.partyResources).toEqual({ hellsteel: 5, soulfire: 2, brimstone: 1 });
    expect(state.campaign!.constructedBaseUpgrades).toEqual(["upgrade-a"]);
    expect(state.campaign!.overworldRegions).toEqual([
      { id: "west", imageKey: "region-images/abc.png" },
      { id: "center" },
      { id: "east" },
    ]);
    expect(state.campaign!.overworldParty).toEqual({
      qx: 4,
      qy: 6,
      atDis: false,
      mapSpeed: 1.5,
      fuel: 5,
      revelations: 2,
    });
    expect(state.campaign!.overworldLocations).toEqual([
      { id: "loc-1", qx: 2, qy: 3, name: "Test Site", factionId: "syncrasis" },
    ]);
    expect(state.campaign!.overworldConvoys).toEqual([
      {
        id: "convoy-1",
        qx: 5,
        qy: 7,
        type: "supply",
        factionId: "paracletus",
        infoVisibleToPlayers: false,
      },
    ]);
    expect(state.campaign!.factionStates).toEqual({
      syncrasis: {
        crown: 4,
        force: 3,
        subterfuge: 2,
        territory: 1,
        assets: 0,
        defeated: false,
        unlockedUpgrades: ["Fleet Deployment Orders"],
        unlockedUniqueLocations: [],
      },
      autophyes: {
        crown: 0,
        force: 0,
        subterfuge: 0,
        territory: 0,
        assets: 0,
        defeated: true,
        unlockedUpgrades: [],
        unlockedUniqueLocations: [],
      },
      paracletus: {
        crown: 5,
        force: 2,
        subterfuge: 2,
        territory: 5,
        assets: 2,
        defeated: false,
        unlockedUpgrades: [],
        unlockedUniqueLocations: ["The Teethlands"],
      },
    });
    expect(state.sandboxMode).toBe(true);
  });

  it("persistMapTileFromState copies terrain and cosmetics but not effects", () => {
    const map = createBlankGameMap("arena", "Arena", 3, 3);
    map.tiles[0]!.tileEffects = { Stained: 1 };
    const state = createInitialStateFromMap(map);
    applyGmPaintTile(state, 0, 0, {
      elevation: 2,
      terrain: "cover",
      tileEffects: ["Fortified:1"],
      tileName: "Rock",
      baseColor: "#112233",
      appearanceKey: "tile-appearances/x.png",
      featureKey: "tiles/features/base/rock.png",
      appearanceTint: { color: "#ff0000", opacity: 0.5 },
      featureTint: { color: "#00aaff", opacity: 0.25 },
      appearanceRotation: 90,
      appearanceFlip: true,
      featureRotation: 180,
      featureFlip: true,
    });
    persistMapTileAt(state, map, 0, 0);
    const saved = tileAt(map.tiles, 0, 0)!;
    expect(saved.elevation).toBe(2);
    expect(saved.terrain).toEqual(["cover"]);
    expect(saved.name).toBe("Rock");
    expect(saved.baseColor).toBe("#112233");
    expect(saved.appearanceKey).toBe("tile-appearances/x.png");
    expect(saved.featureKey).toBe("tiles/features/base/rock.png");
    expect(saved.appearanceTint).toEqual({ color: "#ff0000", opacity: 0.5 });
    expect(saved.featureTint).toEqual({ color: "#00aaff", opacity: 0.25 });
    expect(saved.appearanceRotation).toBe(90);
    expect(saved.appearanceFlip).toBe(true);
    expect(saved.featureRotation).toBe(180);
    expect(saved.featureFlip).toBe(true);
    expect(saved.tileEffects).toBeUndefined();
    expect(tileAt(state.tiles, 0, 0)!.tileEffects).toEqual({ Fortified: 1 });
  });

  it("parseGameMap reads optional tile cosmetics and presets", () => {
    const tiles = makeTiles(2, 2).map((tile, i) =>
      i === 0
        ? {
            ...tile,
            name: "Start",
            baseColor: "#abc",
            appearanceKey: "tile-appearances/test.png",
            featureKey: "tiles/features/base/rock.png",
            appearanceTint: { color: "#ff0000", opacity: 0.5 },
            featureTint: { color: "#00ff00", opacity: 0.2 },
            appearanceRotation: 180,
            appearanceFlip: true,
            featureRotation: 90,
            featureFlip: true,
          }
        : tile,
    );
    const map = parseGameMap({
      id: "test",
      width: 2,
      height: 2,
      tiles,
      tilePresets: {
        Forest: {
          elevation: 1,
          terrain: "cover",
          tileEffectId: "Stained",
          tileEffectStacks: 2,
          tileName: "Forest",
          baseColor: "#112233",
          featureKey: "tiles/features/base/tree.png",
          appearanceTint: { color: "#aabbcc", opacity: 0.7 },
          appearanceRotation: 90,
          appearanceFlip: true,
          featureRotation: 270,
          featureFlip: true,
        },
      },
    });
    expect(map.tiles[0]!.name).toBe("Start");
    expect(map.tiles[0]!.baseColor).toBe("#abc");
    expect(map.tiles[0]!.appearanceKey).toBe("tile-appearances/test.png");
    expect(map.tiles[0]!.featureKey).toBe("tiles/features/base/rock.png");
    expect(map.tiles[0]!.appearanceTint).toEqual({ color: "#ff0000", opacity: 0.5 });
    expect(map.tiles[0]!.featureTint).toEqual({ color: "#00ff00", opacity: 0.2 });
    expect(map.tiles[0]!.appearanceRotation).toBe(180);
    expect(map.tiles[0]!.appearanceFlip).toBe(true);
    expect(map.tiles[0]!.featureRotation).toBe(90);
    expect(map.tiles[0]!.featureFlip).toBe(true);
    expect(map.tilePresets?.Forest?.terrain).toBe("cover");
    expect(map.tilePresets?.Forest?.featureKey).toBe("tiles/features/base/tree.png");
    expect(map.tilePresets?.Forest?.appearanceTint).toEqual({
      color: "#aabbcc",
      opacity: 0.7,
    });
    expect(map.tilePresets?.Forest?.appearanceRotation).toBe(90);
    expect(map.tilePresets?.Forest?.appearanceFlip).toBe(true);
    expect(map.tilePresets?.Forest?.featureRotation).toBe(270);
    expect(map.tilePresets?.Forest?.featureFlip).toBe(true);
  });

  it("parseGameMap migrates legacy stain featureKey to overlayKey", () => {
    const tiles = makeTiles(1, 1).map((tile) => ({
      ...tile,
      featureKey: "tiles/features/stain/stain/3.png",
    }));
    const map = parseGameMap({ id: "stain-legacy", width: 1, height: 1, tiles });
    expect(map.tiles[0]!.overlayKey).toBe("tiles/overlays/stain/stain/3.png");
    expect(map.tiles[0]!.featureKey).toBeUndefined();
  });

  it("parseGameMap maps legacy imageRotation/imageFlip onto both layers", () => {
    const tiles = makeTiles(1, 1).map((tile) => ({
      ...tile,
      appearanceKey: "a.png",
      featureKey: "f.png",
      imageRotation: 90,
      imageFlip: true,
    }));
    const map = parseGameMap({ id: "legacy", width: 1, height: 1, tiles });
    expect(map.tiles[0]!.appearanceRotation).toBe(90);
    expect(map.tiles[0]!.featureRotation).toBe(90);
    expect(map.tiles[0]!.appearanceFlip).toBe(true);
    expect(map.tiles[0]!.featureFlip).toBe(true);
  });

  it("save and reset starting state restores tiles and enemies", () => {
    const map = createBlankGameMap("arena", "Arena", 4, 4);
    const state = createInitialStateFromMap(map);
    state.enemies = [{ id: "e1", x: 1, y: 1, name: "Stain Creep", hp: 1, scale: 1 }];
    const tile = tileAt(state.tiles, 2, 2)!;
    tile.terrain = ["obstacle"];
    tile.obstacleHp = 3;
    tile.tileEffects = { Stained: 1, Fortified: 2 };

    expect(validateResetToStartingState(map)).toBe("No starting state saved for this map");
    expect(applySaveStartingState(state, map)).toBe("Starting state saved");
    expect(map.startingState?.enemies).toHaveLength(1);
    expect(tileAt(map.startingState!.tiles, 2, 2)?.terrain).toEqual(["obstacle"]);
    expect(tileAt(map.startingState!.tiles, 2, 2)?.obstacleHp).toBe(3);
    expect(tileAt(map.startingState!.tiles, 2, 2)?.tileEffects).toEqual({
      Stained: 1,
      Fortified: 2,
    });

    state.enemies[0]!.x = 3;
    state.enemies[0]!.hp = 99;
    tileAt(state.tiles, 2, 2)!.terrain = ["standard"];
    delete tileAt(state.tiles, 2, 2)!.obstacleHp;
    delete tileAt(state.tiles, 2, 2)!.tileEffects;

    expect(validateResetToStartingState(map)).toBeNull();
    expect(applyResetToStartingState(state, map)).toBe("Board reset to starting state");
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0]!.x).toBe(1);
    expect(state.enemies[0]!.hp).toBe(1);
    expect(tileAt(state.tiles, 2, 2)!.terrain).toEqual(["obstacle"]);
    expect(tileAt(state.tiles, 2, 2)!.obstacleHp).toBe(3);
    expect(tileAt(state.tiles, 2, 2)!.tileEffects).toEqual({ Stained: 1, Fortified: 2 });
  });

  it("parseGameMap round-trips startingState", () => {
    const map = createBlankGameMap("arena", "Arena", 3, 3);
    const state = createInitialStateFromMap(map);
    state.enemies = [{ id: "e1", x: 1, y: 1, name: "Stain Creep", hp: 1, scale: 1 }];
    tileAt(state.tiles, 0, 0)!.tileEffects = { Stained: 1 };
    applySaveStartingState(state, map);

    const parsed = parseGameMap(JSON.parse(JSON.stringify(map)));
    expect(parsed.startingState).toBeDefined();
    expect(parsed.startingState!.enemies).toHaveLength(1);
    expect(parsed.startingState!.enemies[0]!.id).toBe("e1");
    expect(parsed.startingState!.enemies[0]!.hp).toBe(1);
    expect(parsed.startingState!.tiles).toHaveLength(9);
    expect(tileAt(parsed.startingState!.tiles, 0, 0)?.tileEffects).toEqual({ Stained: 1 });
  });
});
