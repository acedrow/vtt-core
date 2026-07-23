import { defineComponent } from "vue";

import type { ClientContribution } from "../client-content-pack.js";

const FixturePanel = defineComponent({
  name: "FixturePanel",
  template: "<div />",
});

export function createFixtureClientContribution(): ClientContribution {
  return {
    id: "fixture-client",
    version: "1",
    documentTitle: "Fixture VTT",
    branding: {
      landingPrefix: "welcome to ",
      landingAccent: "fixture",
      faviconHref: "/favicon.svg",
    },
    defaultThemeId: "fixture-theme",
    themes: [
      {
        id: "fixture-theme",
        label: "Fixture",
        swatch: ["#000000", "#111111", "#222222", "#333333", "#444444"],
      },
    ],
    tileSetLabels: {
      appearances: { basic: "Fixture Basic" },
      features: { base: "Fixture Base" },
      overlays: { stain: "Fixture Stain" },
    },
    mainSections: [
      { id: "fixture-section", label: "Fixture Section", component: FixturePanel },
    ],
    combatBoard: {
      cellOverlays: [],
      pieceDecorations: [],
    },
    boardModes: [
      { id: "kopisMark", hint: "Fixture kopis hint" },
      { id: "chrysaorBrand", hint: "Fixture brand hint" },
      { id: "varunastraBorrow", hint: "Fixture borrow hint" },
      { id: "harpeTrap" },
      { id: "sharurAttractor" },
      { id: "hephaestusSynesis" },
      { id: "hephaestusRestore" },
    ],
    sheetFields: [],
    sheetChrome: [],
  };
}
