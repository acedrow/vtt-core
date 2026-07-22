import type { Component } from "vue";

export type ClientThemeOption = {
  id: string;
  label: string;
  swatch: [string, string, string, string, string];
};

export type ClientMainSection = {
  id: string;
  label: string;
  component: Component;
};

export type ClientTileSetLabels = {
  appearances: Record<string, string>;
  features: Record<string, string>;
  overlays: Record<string, string>;
};

export type ClientDetailPanels = {
  factionInfo?: Component;
  factionEnemies?: Component;
  overworldLocationVisibility?: Component;
};

export type ClientCombatBoard = {
  overlays?: Component;
  host?: Component;
  towerTokenIcon?: Component;
  towerPicker?: Component;
  towerModal?: Component;
};

export type ClientBoardModePlugin = {
  id: string;
  activateForClass?: string;
  activateForArmor?: string;
  activateForEquipment?: (equipmentName: string) => boolean;
  hint?: string;
};

export type ClientBranding = {
  landingPrefix: string;
  landingAccent: string;
  faviconHref: string;
};

export type ClientContribution = {
  id: string;
  version: string;
  documentTitle: string;
  branding: ClientBranding;
  defaultThemeId: string;
  themes: ClientThemeOption[];
  legacyThemeIds?: Record<string, string>;
  tileSetLabels: ClientTileSetLabels;
  mainSections: ClientMainSection[];
  detailPanels?: ClientDetailPanels;
  combatBoard?: ClientCombatBoard;
  boardModes?: ClientBoardModePlugin[];
};

let registered: ClientContribution | null = null;
let themes: ClientThemeOption[] = [];
let legacyThemeIds: Record<string, string> = {};
let defaultThemeId = "";
let documentTitle = "";
let branding: ClientBranding = {
  landingPrefix: "",
  landingAccent: "",
  faviconHref: "",
};
let tileSetLabels: ClientTileSetLabels = {
  appearances: {},
  features: {},
  overlays: {},
};
let mainSections: ClientMainSection[] = [];
let detailPanels: ClientDetailPanels = {};
let combatBoard: ClientCombatBoard = {};
let boardModes: ClientBoardModePlugin[] = [];

function applyContribution(pack: ClientContribution): void {
  themes = pack.themes.slice();
  legacyThemeIds = { ...(pack.legacyThemeIds ?? {}) };
  defaultThemeId = pack.defaultThemeId;
  documentTitle = pack.documentTitle;
  branding = { ...pack.branding };
  tileSetLabels = {
    appearances: { ...pack.tileSetLabels.appearances },
    features: { ...pack.tileSetLabels.features },
    overlays: { ...pack.tileSetLabels.overlays },
  };
  mainSections = pack.mainSections.slice();
  detailPanels = { ...(pack.detailPanels ?? {}) };
  combatBoard = { ...(pack.combatBoard ?? {}) };
  boardModes = (pack.boardModes ?? []).slice();
}

function clearContribution(): void {
  themes = [];
  legacyThemeIds = {};
  defaultThemeId = "";
  documentTitle = "";
  branding = { landingPrefix: "", landingAccent: "", faviconHref: "" };
  tileSetLabels = { appearances: {}, features: {}, overlays: {} };
  mainSections = [];
  detailPanels = {};
  combatBoard = {};
  boardModes = [];
}

export function registerClientContentPack(pack: ClientContribution): void {
  if (registered) {
    if (registered.id === pack.id && registered.version === pack.version) return;
    throw new Error(
      `Client content pack already registered (${registered.id}@${registered.version}); cannot register ${pack.id}@${pack.version}`,
    );
  }
  applyContribution(pack);
  registered = pack;
}

export function getClientContentPack(): ClientContribution | null {
  return registered;
}

export function requireClientContentPack(): ClientContribution {
  if (!registered) {
    throw new Error("Client content pack is not registered");
  }
  return registered;
}

export function resetClientContentPackForTests(): void {
  registered = null;
  clearContribution();
}

export function listClientThemes(): ClientThemeOption[] {
  requireClientContentPack();
  return themes;
}

export function getDefaultThemeId(): string {
  requireClientContentPack();
  return defaultThemeId;
}

export function getLegacyThemeIds(): Record<string, string> {
  requireClientContentPack();
  return legacyThemeIds;
}

export function getDocumentTitle(): string {
  requireClientContentPack();
  return documentTitle;
}

export function getClientBranding(): ClientBranding {
  requireClientContentPack();
  return branding;
}

export function getTileSetLabel(
  kind: "appearances" | "features" | "overlays",
  setId: string,
): string {
  const labels = tileSetLabels[kind];
  return labels[setId] ?? setId.charAt(0).toUpperCase() + setId.slice(1);
}

export function listClientMainSections(): ClientMainSection[] {
  requireClientContentPack();
  return mainSections;
}

export function isClientMainSectionId(id: string): boolean {
  if (!registered) return false;
  return mainSections.some((section) => section.id === id);
}

export function isMainSectionTab(id: string): boolean {
  if (id === "taccom") return true;
  // Persist may be read while panel SFCs load before registerClientContentPack runs.
  if (!registered) return id.length > 0;
  return isClientMainSectionId(id);
}

export function getClientDetailPanels(): ClientDetailPanels {
  requireClientContentPack();
  return detailPanels;
}

export function getClientCombatBoard(): ClientCombatBoard {
  if (!registered) return {};
  return combatBoard;
}

export function listClientBoardModes(): ClientBoardModePlugin[] {
  if (!registered) return [];
  return boardModes;
}

export function boardModeForClass(className: string | undefined): string | null {
  if (!className) return null;
  const plugin = boardModes.find((m) => m.activateForClass === className);
  return plugin?.id ?? null;
}

export function boardModeForEquipment(equipmentName: string): string | null {
  const plugin = boardModes.find((m) => m.activateForEquipment?.(equipmentName));
  return plugin?.id ?? null;
}
