import { defineAsyncComponent } from "vue";

import type { ClientContribution } from "@gaem/client/content-pack";

import faviconHref from "./assets/favicon.svg?url";

export function hellpiercersClientContent(): ClientContribution {
  return {
    id: "hellpiercers",
    version: "1",
    documentTitle: "Hellpiercers",
    branding: {
      landingPrefix: "welcome to ",
      landingAccent: "hell",
      faviconHref,
    },
    defaultThemeId: "hellpiercers",
    themes: [
      {
        id: "hellpiercers",
        label: "Hellpiercers",
        swatch: ["#0d1117", "#161b22", "#21262d", "#484f58", "#388bfd"],
      },
      {
        id: "infernum",
        label: "Infernum",
        swatch: ["#070a10", "#0f1520", "#1a2433", "#3a4a61", "#4d9fff"],
      },
      {
        id: "paracletus",
        label: "Paracletus",
        swatch: ["#12100e", "#1c1814", "#2a241e", "#52483d", "#e8956a"],
      },
      {
        id: "hades",
        label: "Hades",
        swatch: ["#120c0c", "#1c1414", "#2a1e1e", "#524040", "#e05a5a"],
      },
      {
        id: "divinity",
        label: "Divinity",
        swatch: ["#faf8f5", "#ffffff", "#ebe6de", "#b8b0a4", "#b8860b"],
      },
    ],
    legacyThemeIds: {
      default: "hellpiercers",
      midnight: "infernum",
      ember: "paracletus",
    },
    tileSetLabels: {
      appearances: {
        basic: "Basic",
        "black-tile": "Black Tile",
        "generic-stone": "Generic Stone",
        paracletus: "Paracletus",
        "paracletus-e-fields": "Paracletus E-Fields",
        "paracletus-stain-springs": "Paracletus Stain Springs",
        "paracletus-stygian-reef": "Paracletus Stygian Reef",
        "paracletus-teethlands": "Paracletus Teethlands",
        "paracletus-v-nimbus": "Paracletus V-Nimbus",
        "rose-quartz": "Rose Quartz",
        "salt-flats": "Salt Flats",
      },
      features: {
        base: "Base",
        "chaos-explosions": "Chaos Explosions",
        hellpiercers: "Hellpiercers",
        "paracletus-ruins": "Paracletus Ruins",
        "paracletus-teethlands": "Paracletus Teethlands",
      },
      overlays: {
        stain: "Stain",
      },
    },
    mainSections: [
      {
        id: "overworld",
        label: "Overworld",
        component: defineAsyncComponent(
          () => import("./components/OverworldPanel.vue"),
        ),
      },
      {
        id: "baseUpgrades",
        label: "Base Upgrades",
        component: defineAsyncComponent(
          () => import("./components/BaseUpgradesPanel.vue"),
        ),
      },
    ],
    detailPanels: {
      factionInfo: defineAsyncComponent(
        () => import("./components/FactionInfoPanel.vue"),
      ),
      factionEnemies: defineAsyncComponent(
        () => import("./components/FactionEnemiesPanel.vue"),
      ),
      overworldLocationVisibility: defineAsyncComponent(
        () => import("./components/OverworldLocationVisibilityPanel.vue"),
      ),
    },
  };
}
