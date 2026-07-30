import { ref, watch } from "vue";

import { useSession } from "./useSession.js";

export const ELEVATION_CONTOUR_COLORS = [
  "#ffffff",
  "#000000",
  "#ffd700",
  "#79c0ff",
  "#7ee787",
  "#ffa657",
  "#ff7b72",
  "#d2a8ff",
] as const;

export type ElevationContourColor = (typeof ELEVATION_CONTOUR_COLORS)[number];

export const TOKEN_PULSE_COLORS = [
  "#ff3b30",
  "#3fb950",
  "#79c0ff",
  "#ffa657",
  "#ffd700",
  "#d2a8ff",
  "#ff7b72",
  "#ffffff",
] as const;

export type TokenPulseColor = (typeof TOKEN_PULSE_COLORS)[number];

type PlayerSettings = {
  showHealthBars: boolean;
  showTokenBackgrounds: boolean;
  showConnectionsInConsole: boolean;
  showLineOfSightIndicator: boolean;
  showElevationContours: boolean;
  elevationContourColor: ElevationContourColor;
  legacyFont: boolean;
  enemyPulseColor: TokenPulseColor;
  playerPulseColor: TokenPulseColor;
};

const DEFAULT_SETTINGS: PlayerSettings = {
  showHealthBars: true,
  showTokenBackgrounds: true,
  showConnectionsInConsole: true,
  showLineOfSightIndicator: false,
  showElevationContours: true,
  elevationContourColor: "#ffffff",
  legacyFont: false,
  enemyPulseColor: "#ff3b30",
  playerPulseColor: "#3fb950",
};

function isElevationContourColor(value: unknown): value is ElevationContourColor {
  return typeof value === "string" && (ELEVATION_CONTOUR_COLORS as readonly string[]).includes(value);
}

function isTokenPulseColor(value: unknown): value is TokenPulseColor {
  return typeof value === "string" && (TOKEN_PULSE_COLORS as readonly string[]).includes(value);
}

function settingsKey(role: "gm" | "player" | null, playerId: string | null): string | null {
  if (role === "gm") return "vtt-core-settings:gm";
  if (role === "player" && playerId) return `vtt-core-settings:player:${playerId}`;
  return null;
}

function parseSettings(raw: string): PlayerSettings {
  try {
    const parsed = JSON.parse(raw) as Partial<PlayerSettings>;
    return {
      showHealthBars: parsed.showHealthBars !== false,
      showTokenBackgrounds: parsed.showTokenBackgrounds !== false,
      showConnectionsInConsole: parsed.showConnectionsInConsole !== false,
      showLineOfSightIndicator: parsed.showLineOfSightIndicator === true,
      showElevationContours: parsed.showElevationContours !== false,
      elevationContourColor: isElevationContourColor(parsed.elevationContourColor)
        ? parsed.elevationContourColor
        : DEFAULT_SETTINGS.elevationContourColor,
      legacyFont: parsed.legacyFont === true,
      enemyPulseColor: isTokenPulseColor(parsed.enemyPulseColor)
        ? parsed.enemyPulseColor
        : DEFAULT_SETTINGS.enemyPulseColor,
      playerPulseColor: isTokenPulseColor(parsed.playerPulseColor)
        ? parsed.playerPulseColor
        : DEFAULT_SETTINGS.playerPulseColor,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function readSettings(key: string | null): PlayerSettings {
  if (!key) return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseSettings(raw) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(key: string | null, settings: PlayerSettings) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(settings));
  } catch {
    // ignore quota / private browsing
  }
}

const { role, playerProfile } = useSession();
let currentKey = settingsKey(role.value, playerProfile.value?.id ?? null);

const showHealthBars = ref(readSettings(currentKey).showHealthBars);
const showTokenBackgrounds = ref(readSettings(currentKey).showTokenBackgrounds);
const showConnectionsInConsole = ref(readSettings(currentKey).showConnectionsInConsole);
const showLineOfSightIndicator = ref(readSettings(currentKey).showLineOfSightIndicator);
const showElevationContours = ref(readSettings(currentKey).showElevationContours);
const elevationContourColor = ref(readSettings(currentKey).elevationContourColor);
const legacyFont = ref(readSettings(currentKey).legacyFont);
const enemyPulseColor = ref(readSettings(currentKey).enemyPulseColor);
const playerPulseColor = ref(readSettings(currentKey).playerPulseColor);

function applyLegacyFont(value: boolean) {
  if (typeof document === "undefined") return;
  if (value) {
    document.documentElement.setAttribute("data-legacy-font", "true");
  } else {
    document.documentElement.removeAttribute("data-legacy-font");
  }
}
applyLegacyFont(legacyFont.value);

function applyTokenPulseColors(enemy: string, player: string) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--color-token-pulse-enemy", enemy);
  document.documentElement.style.setProperty("--color-token-pulse-player", player);
}
applyTokenPulseColors(enemyPulseColor.value, playerPulseColor.value);

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    writeSettings(currentKey, {
      showHealthBars: showHealthBars.value,
      showTokenBackgrounds: showTokenBackgrounds.value,
      showConnectionsInConsole: showConnectionsInConsole.value,
      showLineOfSightIndicator: showLineOfSightIndicator.value,
      showElevationContours: showElevationContours.value,
      elevationContourColor: elevationContourColor.value,
      legacyFont: legacyFont.value,
      enemyPulseColor: enemyPulseColor.value,
      playerPulseColor: playerPulseColor.value,
    });
  }, 150);
}

watch(
  [
    showHealthBars,
    showTokenBackgrounds,
    showConnectionsInConsole,
    showLineOfSightIndicator,
    showElevationContours,
    elevationContourColor,
    legacyFont,
    enemyPulseColor,
    playerPulseColor,
  ],
  schedulePersist,
);

watch(legacyFont, applyLegacyFont);
watch([enemyPulseColor, playerPulseColor], ([enemy, player]) => applyTokenPulseColors(enemy, player));

watch(
  [role, playerProfile],
  () => {
    const key = settingsKey(role.value, playerProfile.value?.id ?? null);
    if (key === currentKey) return;
    currentKey = key;
    const next = readSettings(key);
    showHealthBars.value = next.showHealthBars;
    showTokenBackgrounds.value = next.showTokenBackgrounds;
    showConnectionsInConsole.value = next.showConnectionsInConsole;
    showLineOfSightIndicator.value = next.showLineOfSightIndicator;
    showElevationContours.value = next.showElevationContours;
    elevationContourColor.value = next.elevationContourColor;
    legacyFont.value = next.legacyFont;
    enemyPulseColor.value = next.enemyPulseColor;
    playerPulseColor.value = next.playerPulseColor;
  },
  { deep: true },
);

export function usePlayerSettings() {
  return {
    showHealthBars,
    showTokenBackgrounds,
    showConnectionsInConsole,
    showLineOfSightIndicator,
    showElevationContours,
    elevationContourColor,
    legacyFont,
    enemyPulseColor,
    playerPulseColor,
  };
}
