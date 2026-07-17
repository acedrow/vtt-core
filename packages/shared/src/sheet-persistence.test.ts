import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { getCampaignHooks, replaceCampaignHooks } from "./campaign-hooks.js";
import {
  createFixtureContentPack,
  FIXTURE_CONTENT_PACK_ID,
  FIXTURE_CONTENT_PACK_VERSION,
} from "./fixture-content-pack.js";
import { registerContentPack, resetContentPackForTests } from "./content-pack.js";
import {
  collectSheetDataFromBody,
  getSheetDataKeys,
  liftSheetDataKeys,
} from "./player-data.js";
import {
  contentPackMismatchError,
  ensureCharacterSheet,
  ensureGameStateContentPack,
  stampContentPackMeta,
} from "./sheet-persistence.js";
import type { CharacterSheet, GameState } from "./types.js";

function bareSheet(overrides: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    id: "s1",
    player: "p1",
    name: "Test",
    portraitKey: null,
    class: "Test Class",
    armor: "Test Armor",
    weapon: "Test Weapon",
    createdAt: "t0",
    updatedAt: "t0",
    ...overrides,
  };
}

describe("sheet data keys", () => {
  beforeEach(() => {
    resetContentPackForTests();
    registerContentPack(createFixtureContentPack());
  });

  afterEach(() => {
    resetContentPackForTests();
  });

  it("defaults to empty sheetDataKeys on fixture pack", () => {
    expect(getSheetDataKeys()).toEqual([]);
  });

  it("collects pack sheetDataKeys from body top-level into data", () => {
    const hooks = getCampaignHooks();
    expect(hooks).toBeTruthy();
    replaceCampaignHooks({
      ...hooks!,
      sheetDataKeys: ["extraKey"],
    });
    const data = collectSheetDataFromBody({ extraKey: "  hello  ", data: { other: 1 } });
    expect(data).toEqual({ other: 1, extraKey: "hello" });
  });

  it("lifts legacy top-level keys into data", () => {
    const hooks = getCampaignHooks();
    replaceCampaignHooks({
      ...hooks!,
      sheetDataKeys: ["extraKey"],
    });
    const sheet = bareSheet({ extraKey: "legacy" } as CharacterSheet & { extraKey: string });
    liftSheetDataKeys(sheet);
    expect(sheet.data?.extraKey).toBe("legacy");
    expect((sheet as { extraKey?: string }).extraKey).toBeUndefined();
  });
});

describe("content pack stamps and ensureSheet", () => {
  beforeEach(() => {
    resetContentPackForTests();
    registerContentPack(createFixtureContentPack());
  });

  afterEach(() => {
    resetContentPackForTests();
  });

  it("stamps current pack meta", () => {
    const sheet = bareSheet();
    stampContentPackMeta(sheet);
    expect(sheet.contentPack).toEqual({
      id: FIXTURE_CONTENT_PACK_ID,
      version: FIXTURE_CONTENT_PACK_VERSION,
    });
  });

  it("rejects different pack id", () => {
    expect(
      contentPackMismatchError({ id: "other", version: "1.0.0" }),
    ).toMatch(/Content pack mismatch/);
  });

  it("allows missing stamp and same-id version change", () => {
    expect(contentPackMismatchError(undefined)).toBeNull();
    expect(
      contentPackMismatchError({ id: FIXTURE_CONTENT_PACK_ID, version: "0.0.0" }),
    ).toBeNull();
  });

  it("ensureCharacterSheet migrates data and stamps version", () => {
    const hooks = getCampaignHooks();
    replaceCampaignHooks({
      ...hooks!,
      sheetDataKeys: ["legacyKey"],
      ensureSheet(sheet, from) {
        if (from?.version === "0.0.0" && typeof sheet.data?.legacyKey === "string") {
          sheet.data.renamedKey = sheet.data.legacyKey;
          delete sheet.data.legacyKey;
        }
      },
    });
    const sheet = bareSheet({
      contentPack: { id: FIXTURE_CONTENT_PACK_ID, version: "0.0.0" },
      data: { legacyKey: "v" },
    });
    const result = ensureCharacterSheet(sheet);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dirty).toBe(true);
    expect(sheet.data?.renamedKey).toBe("v");
    expect(sheet.data?.legacyKey).toBeUndefined();
    expect(sheet.contentPack).toEqual({
      id: FIXTURE_CONTENT_PACK_ID,
      version: FIXTURE_CONTENT_PACK_VERSION,
    });
  });

  it("ensureCharacterSheet rejects foreign pack id", () => {
    const sheet = bareSheet({ contentPack: { id: "hellpiercers", version: "1.0.0" } });
    const result = ensureCharacterSheet(sheet);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Content pack mismatch/);
  });

  it("ensureGameStateContentPack stamps missing meta", () => {
    const state = { contentPack: undefined } as GameState;
    const result = ensureGameStateContentPack(state);
    expect(result).toEqual({ ok: true, dirty: true });
    expect(state.contentPack).toEqual({
      id: FIXTURE_CONTENT_PACK_ID,
      version: FIXTURE_CONTENT_PACK_VERSION,
    });
  });
});
