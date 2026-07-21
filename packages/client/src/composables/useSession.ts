import type { VttRole, PlayerProfile } from "@vtt-core/shared";
import { computed, ref } from "vue";

const STORAGE_KEY = "vtt-core-session";

type StoredPlayerProfile = {
  id: string;
  name: string;
  gmPermissions?: boolean;
};

type StoredSession = {
  role: VttRole;
  playerProfile: StoredPlayerProfile | null;
  token: string;
};

function loadStored(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed.role !== "gm" && parsed.role !== "player") return null;
    if (typeof parsed.token !== "string" || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

const stored = loadStored();
const role = ref<VttRole | null>(stored?.role ?? null);
const playerProfile = ref<StoredPlayerProfile | null>(stored?.playerProfile ?? null);
const token = ref<string | null>(stored?.token ?? null);

function persist() {
  if (!role.value || !token.value) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      role: role.value,
      playerProfile: playerProfile.value,
      token: token.value,
    } satisfies StoredSession)
  );
}

export function useSession() {
  const isActive = computed(() => role.value !== null);
  const isGm = computed(() => role.value === "gm");
  const hasGmCapabilities = computed(
    () => role.value === "gm" || playerProfile.value?.gmPermissions === true,
  );

  function startSession(r: VttRole, profile: PlayerProfile | null, authToken: string) {
    role.value = r;
    playerProfile.value =
      r === "player" && profile
        ? {
            id: profile.id,
            name: profile.name,
            gmPermissions: profile.gmPermissions === true,
          }
        : null;
    token.value = authToken;
    persist();
  }

  function clearSession() {
    role.value = null;
    playerProfile.value = null;
    token.value = null;
    persist();
  }

  function apiHeaders(): Record<string, string> {
    if (!role.value) return {};
    const headers: Record<string, string> = { "X-Vtt-Role": role.value };
    if (token.value) {
      headers["Authorization"] = `Bearer ${token.value}`;
    }
    if (role.value === "player" && playerProfile.value) {
      headers["X-Vtt-Player-Key"] = playerProfile.value.id;
    }
    return headers;
  }

  return {
    role,
    playerProfile,
    token,
    isActive,
    isGm,
    hasGmCapabilities,
    startSession,
    clearSession,
    apiHeaders,
  };
}
