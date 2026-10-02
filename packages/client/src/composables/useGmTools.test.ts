import type { ClientMessage, GameState } from "@vtt-core/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as appearances from "../lib/bundledTileAppearances.js";
import * as features from "../lib/bundledTileFeatures.js";
import * as overlays from "../lib/bundledTileOverlays.js";

import { DEFAULT_GM_TOOLS } from "./uiPersist.js";
import { useGameState } from "./useGameState.js";
import { applyPersistedGmTools, useGmTools } from "./useGmTools.js";

function makeTestGameState(): GameState {
  return {
    mapId: "test",
    mapName: "Test",
    width: 2,
    height: 1,
    tiles: [
      { x: 0, y: 0, terrain: ["standard"], elevation: 0 },
      { x: 1, y: 0, terrain: ["standard"], elevation: 0, deploymentZone: true },
    ],
    players: [],
    enemies: [],
    round: 1,
    roundPhase: "taccomNotStarted",
    turn: { role: "gm" },
    actedPlayerIds: [],
    turnLog: [],
    campaign: {
      partyResources: { scrap: 0 },
      unlockedUpgrades: [],
    },
  };
}

describe("useGmTools deployment zone paintbrush", () => {
  beforeEach(() => {
    applyPersistedGmTools({
      ...DEFAULT_GM_TOOLS,
      paintbrushEnableDeploymentZone: true,
    });
    useGmTools().disableAllPaintbrushOptions();
    useGameState().setGameState(makeTestGameState(), null);
  });

  afterEach(() => {
    useGmTools().clearBulkSelection();
    useGameState().clearGameState();
  });

  it("toggles each selected tile's deployment zone independently", () => {
    const sent: ClientMessage[] = [];
    useGameState().registerSend((message) => sent.push(message));
    const tools = useGmTools();
    tools.paintbrushEnableDeploymentZone.value = true;
    tools.setBulkSelection({
      kind: "tiles",
      coords: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    });

    tools.applyPaintbrushToTile(0, 0);

    expect(sent).toEqual([
      {
        type: "gmPaintTile",
        coords: [{ x: 0, y: 0 }],
        deploymentZone: true,
      },
      {
        type: "gmPaintTile",
        coords: [{ x: 1, y: 0 }],
        deploymentZone: false,
      },
    ]);
  });

  it("includes deployment zones in enable and disable all", () => {
    const tools = useGmTools();

    tools.enableAllPaintbrushOptions();
    expect(tools.paintbrushEnableDeploymentZone.value).toBe(true);

    tools.disableAllPaintbrushOptions();
    expect(tools.paintbrushEnableDeploymentZone.value).toBe(false);
  });

  it("re-enables the default paintbrush layers when reset after disable all", () => {
    const tools = useGmTools();

    tools.disableAllPaintbrushOptions();
    tools.resetPaintbrushSettings();

    expect(tools.paintbrushEnableElevation.value).toBe(true);
    expect(tools.paintbrushEnableTerrain.value).toBe(true);
    expect(tools.paintbrushEnableEffect.value).toBe(true);
    expect(tools.paintbrushEnableName.value).toBe(true);
    expect(tools.paintbrushEnableColor.value).toBe(true);
    expect(tools.paintbrushEnableAppearance.value).toBe(true);
    expect(tools.paintbrushEnableOverlay.value).toBe(true);
    expect(tools.paintbrushEnableFeature.value).toBe(true);
    expect(tools.paintbrushEnableDeploymentZone.value).toBe(false);
  });
});

describe("useGmTools eyedropper", () => {
  const appearanceGroup = "tiles/fixture/variants";
  const overlayGroup = "tiles/overlays/fixture/variants";
  const featureGroup = "tiles/features/fixture/variants";

  beforeEach(() => {
    applyPersistedGmTools({ ...DEFAULT_GM_TOOLS });
    useGmTools().disableAllPaintbrushOptions();
    useGameState().setGameState(makeTestGameState(), null);

    vi.spyOn(appearances, "isAppearanceGroupKey").mockImplementation((key) => key === appearanceGroup);
    vi.spyOn(overlays, "isOverlayGroupKey").mockImplementation((key) => key === overlayGroup);
    vi.spyOn(features, "isFeatureGroupKey").mockImplementation((key) => key === featureGroup);

    function resolveFixtureKey(key: string | null): string | null {
      if (!key) return null;
      if (![appearanceGroup, overlayGroup, featureGroup].includes(key)) return key;
      const extension = key === appearanceGroup ? "jpg" : "png";
      return `${key}/${Math.random() < 0.5 ? "1" : "2"}.${extension}`;
    }
    vi.spyOn(appearances, "resolveAppearanceKeyForPaint").mockImplementation(resolveFixtureKey);
    vi.spyOn(overlays, "resolveOverlayKeyForPaint").mockImplementation(resolveFixtureKey);
    vi.spyOn(features, "resolveFeatureKeyForPaint").mockImplementation(resolveFixtureKey);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useGmTools().clearBulkSelection();
    useGameState().clearGameState();
  });

  it.each(["single", "bulk", "drag"])("restores sampled groups and randomizes %s painting per tile", (mode) => {
    const state = makeTestGameState();
    Object.assign(state.tiles[0]!, {
      appearanceKey: `${appearanceGroup}/1.jpg`,
      overlayKey: `${overlayGroup}/1.png`,
      featureKey: `${featureGroup}/1.png`,
    });
    useGameState().setGameState(state, null);
    const sent: ClientMessage[] = [];
    useGameState().registerSend((message) => sent.push(message));
    const tools = useGmTools();

    tools.samplePaintbrushFromTile(0, 0);

    expect(tools.paintbrushAppearanceKey.value).toBe(appearanceGroup);
    expect(tools.paintbrushOverlayKey.value).toBe(overlayGroup);
    expect(tools.paintbrushFeatureKey.value).toBe(featureGroup);
    if (mode === "bulk") {
      tools.setBulkSelection({ kind: "tiles", coords: [{ x: 0, y: 0 }, { x: 1, y: 0 }] });
    }
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99).mockReturnValueOnce(0.99).mockReturnValueOnce(0.99);

    const preview = tools.peekPaintbrushPlacement(0, 0);
    if (mode === "drag") {
      tools.queuePaintbrushDragTile(0, 0);
      tools.queuePaintbrushDragTile(1, 0);
      tools.endPaintbrushDrag();
    } else {
      tools.applyPaintbrushToTile(0, 0);
      if (mode === "single") tools.applyPaintbrushToTile(1, 0);
    }

    expect(sent).toEqual([
      {
        type: "gmPaintTile", coords: [{ x: 0, y: 0 }],
        appearanceKey: `${appearanceGroup}/1.jpg`,
        overlayKey: `${overlayGroup}/1.png`,
        featureKey: `${featureGroup}/1.png`,
      },
      {
        type: "gmPaintTile", coords: [{ x: 1, y: 0 }],
        appearanceKey: `${appearanceGroup}/2.jpg`,
        overlayKey: `${overlayGroup}/2.png`,
        featureKey: `${featureGroup}/2.png`,
      },
    ]);
    expect(preview.appearanceKey).toBe(`${appearanceGroup}/1.jpg`);
    expect(preview.overlayKey).toBe(`${overlayGroup}/1.png`);
    expect(preview.featureKey).toBe(`${featureGroup}/1.png`);
  });

  it("keeps standalone image keys and clears missing layers when sampling", () => {
    const state = makeTestGameState();
    Object.assign(state.tiles[0]!, {
      appearanceKey: "tiles/fixture/single.jpg",
      overlayKey: "tiles/overlays/fixture/single.png",
      featureKey: "tiles/features/fixture/single.png",
    });
    useGameState().setGameState(state, null);
    const tools = useGmTools();

    tools.samplePaintbrushFromTile(0, 0);

    expect(tools.paintbrushAppearanceKey.value).toBe(state.tiles[0]!.appearanceKey);
    expect(tools.paintbrushOverlayKey.value).toBe(state.tiles[0]!.overlayKey);
    expect(tools.paintbrushFeatureKey.value).toBe(state.tiles[0]!.featureKey);

    tools.samplePaintbrushFromTile(1, 0);

    expect(tools.paintbrushAppearanceKey.value).toBeNull();
    expect(tools.paintbrushOverlayKey.value).toBeNull();
    expect(tools.paintbrushFeatureKey.value).toBeNull();
  });
});
