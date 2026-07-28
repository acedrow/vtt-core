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

type PlayerSettings = {
  showHealthBars: boolean;
  showTokenBackgrounds: boolean;
  showConnectionsInConsole: boolean;
  showLineOfSightIndicator: boolean;
  showElevationContours: boolean;
  elevationContourColor: ElevationContourColor;
};

const DEFAULT_SETTINGS: PlayerSettings = {
  showHealthBars: true,
  showTokenBackgrounds: true,
  showConnectionsInConsole: true,
  showLineOfSightIndicator: false,
  showElevationContours: true,
  elevationContourColor: "#ffffff",
};

function isElevationContourColor(value: unknown): value is ElevationContourColor {
  return typeof value === "string" && (ELEVATION_CONTOUR_COLORS as readonly string[]).includes(value);
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
  ],
  schedulePersist,
);

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
  };
}
