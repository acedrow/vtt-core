import { computed, ref, watch } from "vue";

import {
  getDefaultThemeId,
  getLegacyThemeIds,
  listClientThemes,
  type ClientThemeOption,
} from "../client-content-pack.js";
import { useSession } from "./useSession.js";

export type ThemeId = string;

export type ThemeOption = ClientThemeOption;

const LEGACY_STORAGE_KEY = "vtt-core-theme";

function themeKey(role: "gm" | "player" | null, playerId: string | null): string | null {
  if (role === "gm") return "vtt-core-theme:gm";
  if (role === "player" && playerId) return `vtt-core-theme:player:${playerId}`;
  return null;
}

function isThemeId(value: string): boolean {
  return listClientThemes().some((theme) => theme.id === value);
}

function normalizeThemeId(value: string): ThemeId | null {
  if (isThemeId(value)) return value;
  return getLegacyThemeIds()[value] ?? null;
}

function readStoredTheme(key: string | null): ThemeId {
  const defaultTheme = getDefaultThemeId();
  if (!key) return defaultTheme;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const theme = normalizeThemeId(raw);
      if (theme) {
        if (theme !== raw) localStorage.setItem(key, theme);
        return theme;
      }
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const theme = normalizeThemeId(legacy);
      if (theme) {
        localStorage.setItem(key, theme);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return theme;
      }
    }
  } catch {
    // ignore private browsing
  }
  return defaultTheme;
}

export function applyTheme(theme: ThemeId) {
  if (theme === getDefaultThemeId()) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

function writeStoredTheme(key: string | null, theme: ThemeId) {
  if (!key) return;
  try {
    localStorage.setItem(key, theme);
  } catch {
    // ignore quota / private browsing
  }
}

const { role, playerProfile } = useSession();
let currentKey = themeKey(role.value, playerProfile.value?.id ?? null);

const theme = ref<ThemeId>(readStoredTheme(currentKey));

watch(theme, (next) => {
  applyTheme(next);
  writeStoredTheme(currentKey, next);
});

watch(
  [role, playerProfile],
  () => {
    const key = themeKey(role.value, playerProfile.value?.id ?? null);
    if (key === currentKey) return;
    currentKey = key;
    const next = readStoredTheme(key);
    theme.value = next;
    applyTheme(next);
  },
  { deep: true },
);

export function initTheme() {
  applyTheme(theme.value);
}

export function useTheme() {
  const themes = computed(() => listClientThemes());
  return { theme, themes };
}
