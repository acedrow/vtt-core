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

export type ClientSheetFieldWhen = {
  armor?: string;
  class?: string;
  weapon?: string;
};

export type ClientSheetFieldPlugin = {
  id: string;
  dataKey: string;
  when?: ClientSheetFieldWhen;
  component: Component;
  clearWhenHidden?: boolean;
  /** When visible, extras[dataKey] must be non-empty for create/save validity. Default true. */
  required?: boolean;
  /** Where to mount in the create/edit form shell. Default "armor". */
  after?: "class" | "armor" | "weapon";
  label?: string;
};

export type ClientSheetLoadout = {
  class?: string;
  armor?: string;
  weapon?: string;
};

export type ClientSheetChromeSlot =
  | "classActions"
  | "weaponActions"
  | "weaponSubline"
  | "gearActions"
  | "gearArmorActions";

export type ClientSheetChromePlugin = {
  id: string;
  slot: ClientSheetChromeSlot;
  whenClass?: string;
  whenWeapon?: (weaponName: string) => boolean;
  label?: string;
  modeId?: string;
  action?: string;
  sublineKind?: "sabaothCharges" | "heavenBurningLevel";
  /** When true, replace the generic weapon Active button with this action. */
  replacesWeaponActive?: boolean;
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
  sheetFields?: ClientSheetFieldPlugin[];
  sheetChrome?: ClientSheetChromePlugin[];
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
let sheetFields: ClientSheetFieldPlugin[] = [];
let sheetChrome: ClientSheetChromePlugin[] = [];

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
  sheetFields = (pack.sheetFields ?? []).slice();
  sheetChrome = (pack.sheetChrome ?? []).slice();
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
  sheetFields = [];
  sheetChrome = [];
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

export function listClientSheetFields(): ClientSheetFieldPlugin[] {
  if (!registered) return [];
  return sheetFields;
}

export function sheetFieldMatches(
  field: ClientSheetFieldPlugin,
  loadout: ClientSheetLoadout,
): boolean {
  const when = field.when;
  if (!when) return true;
  if (when.class != null && when.class !== loadout.class) return false;
  if (when.armor != null && when.armor !== loadout.armor) return false;
  if (when.weapon != null && when.weapon !== loadout.weapon) return false;
  return true;
}

export function visibleSheetFields(loadout: ClientSheetLoadout): ClientSheetFieldPlugin[] {
  return sheetFields.filter((field) => sheetFieldMatches(field, loadout));
}

export function sheetFieldsAfter(
  after: "class" | "armor" | "weapon",
  loadout: ClientSheetLoadout,
): ClientSheetFieldPlugin[] {
  return visibleSheetFields(loadout).filter((field) => (field.after ?? "armor") === after);
}

export function sheetFieldsExtrasValid(
  loadout: ClientSheetLoadout,
  extras: Record<string, string>,
): boolean {
  for (const field of visibleSheetFields(loadout)) {
    if (field.required === false) continue;
    if (!(extras[field.dataKey] ?? "").trim()) return false;
  }
  return true;
}

export function clearHiddenSheetExtras(
  loadout: ClientSheetLoadout,
  extras: Record<string, string>,
): Record<string, string> {
  const next = { ...extras };
  for (const field of sheetFields) {
    if (!field.clearWhenHidden) continue;
    if (sheetFieldMatches(field, loadout)) continue;
    delete next[field.dataKey];
  }
  return next;
}

export function sheetFieldForArmor(armorName: string): ClientSheetFieldPlugin | undefined {
  return sheetFields.find((field) => field.when?.armor === armorName);
}

export function extrasFromSheetData(
  data: Record<string, unknown> | undefined | null,
): Record<string, string> {
  const extras: Record<string, string> = {};
  for (const field of sheetFields) {
    const value = data?.[field.dataKey];
    if (typeof value === "string") extras[field.dataKey] = value;
  }
  return extras;
}

export function extrasPayload(
  extras: Record<string, string>,
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(extras)) {
    if (value) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function listClientSheetChrome(): ClientSheetChromePlugin[] {
  if (!registered) return [];
  return sheetChrome;
}

export function sheetChromeForSlot(
  slot: ClientSheetChromeSlot,
  ctx: { className?: string; weaponName?: string },
): ClientSheetChromePlugin[] {
  return sheetChrome.filter((plugin) => {
    if (plugin.slot !== slot) return false;
    if (plugin.whenClass != null && plugin.whenClass !== ctx.className) return false;
    if (plugin.whenWeapon && !plugin.whenWeapon(ctx.weaponName ?? "")) return false;
    return true;
  });
}
