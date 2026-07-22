import { afterEach, describe, expect, it } from "vitest";
import { defineComponent } from "vue";

import {
  getClientBranding,
  getClientContentPack,
  getDefaultThemeId,
  getDocumentTitle,
  getTileSetLabel,
  listClientMainSections,
  listClientSheetChrome,
  listClientSheetFields,
  listClientThemes,
  registerClientContentPack,
  requireClientContentPack,
  resetClientContentPackForTests,
  sheetFieldMatches,
  sheetFieldsExtrasValid,
  type ClientContribution,
} from "./client-content-pack.js";
import { createFixtureClientContribution } from "./test/fixture-client-content.js";

const OtherPanel = defineComponent({ name: "OtherPanel", template: "<div />" });
const ExtraField = defineComponent({ name: "ExtraField", template: "<div />" });

function createOtherClientContribution(): ClientContribution {
  return {
    id: "other-client",
    version: "1",
    documentTitle: "Other VTT",
    branding: {
      landingPrefix: "welcome to ",
      landingAccent: "other",
      faviconHref: "/favicon.svg",
    },
    defaultThemeId: "other-theme",
    themes: [
      {
        id: "other-theme",
        label: "Other",
        swatch: ["#000000", "#111111", "#222222", "#333333", "#444444"],
      },
    ],
    tileSetLabels: {
      appearances: { basic: "Other Basic" },
      features: { base: "Other Base" },
      overlays: { stain: "Other Stain" },
    },
    mainSections: [{ id: "other-section", label: "Other Section", component: OtherPanel }],
    sheetFields: [
      {
        id: "extra",
        dataKey: "extraKey",
        when: { armor: "SPECIAL" },
        component: ExtraField,
        clearWhenHidden: true,
      },
    ],
    sheetChrome: [
      {
        id: "class-passive",
        slot: "classActions",
        whenClass: "HERO",
        label: "Passive",
        action: "heroPassive",
      },
    ],
  };
}

describe("client content pack registry", () => {
  afterEach(() => {
    resetClientContentPackForTests();
    registerClientContentPack(createFixtureClientContribution());
  });

  it("defaults to fixture client pack in engine setup", () => {
    expect(requireClientContentPack().id).toBe("fixture-client");
    expect(getDocumentTitle()).toBe("Fixture VTT");
    expect(getClientBranding()).toEqual({
      landingPrefix: "welcome to ",
      landingAccent: "fixture",
      faviconHref: "/favicon.svg",
    });
    expect(getDefaultThemeId()).toBe("fixture-theme");
    expect(listClientThemes().map((t) => t.id)).toEqual(["fixture-theme"]);
    expect(getTileSetLabel("appearances", "basic")).toBe("Fixture Basic");
    expect(listClientMainSections().map((s) => s.id)).toEqual(["fixture-section"]);
    expect(listClientSheetFields()).toEqual([]);
    expect(listClientSheetChrome()).toEqual([]);
  });

  it("treats same id and version as idempotent", () => {
    const pack = createFixtureClientContribution();
    resetClientContentPackForTests();
    registerClientContentPack(pack);
    registerClientContentPack(pack);
    expect(getClientContentPack()?.id).toBe("fixture-client");
  });

  it("throws when registering a different pack", () => {
    resetClientContentPackForTests();
    registerClientContentPack(createFixtureClientContribution());
    expect(() => registerClientContentPack(createOtherClientContribution())).toThrow(
      /already registered/,
    );
  });

  it("throws from getters when unregistered", () => {
    resetClientContentPackForTests();
    expect(() => listClientThemes()).toThrow(/not registered/);
    expect(() => requireClientContentPack()).toThrow(/not registered/);
  });

  it("restores fixture client pack via afterEach", () => {
    expect(getClientContentPack()?.id).toBe("fixture-client");
    expect(getDefaultThemeId()).toBe("fixture-theme");
    expect(listClientMainSections().map((s) => s.id)).toEqual(["fixture-section"]);
  });

  it("matches sheetFields and validates required extras", () => {
    resetClientContentPackForTests();
    registerClientContentPack(createOtherClientContribution());
    const field = listClientSheetFields()[0]!;
    expect(sheetFieldMatches(field, { armor: "SPECIAL" })).toBe(true);
    expect(sheetFieldMatches(field, { armor: "OTHER" })).toBe(false);
    expect(sheetFieldsExtrasValid({ armor: "SPECIAL" }, {})).toBe(false);
    expect(sheetFieldsExtrasValid({ armor: "SPECIAL" }, { extraKey: "pick" })).toBe(true);
    expect(sheetFieldsExtrasValid({ armor: "OTHER" }, {})).toBe(true);
    expect(listClientSheetChrome().map((p) => p.id)).toEqual(["class-passive"]);
  });
});
