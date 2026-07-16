<script setup lang="ts">
import type { GaemRole, PlayerProfile } from "@gaem/shared";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

import { getClientBranding } from "../client-content-pack.js";
import { useApi } from "../composables/useApi.js";
import { useSession } from "../composables/useSession.js";
import ModalDialog from "../components/ModalDialog.vue";

const branding = getClientBranding();
const brandLetters = branding.landingAccent.split("");

type PlayerProfileOption = PlayerProfile & { isActive?: boolean };

const router = useRouter();
const { startSession, token } = useSession();
const { apiFetch } = useApi();

const password = ref("");
const joinLoading = ref<GaemRole | null>(null);
const joinError = ref<string | null>(null);

const showProfileModal = ref(false);
const profiles = ref<PlayerProfileOption[]>([]);
const selectedProfileId = ref<string | null>(null);
const newProfileName = ref("");
const loadingProfiles = ref(false);
const creatingProfile = ref(false);
const profileError = ref<string | null>(null);

const selectedProfile = computed(() => {
  if (!selectedProfileId.value) return null;
  return profiles.value.find((p) => p.id === selectedProfileId.value) ?? null;
});

async function login(role: GaemRole, loginPassword: string): Promise<string | null> {
  const res = await apiFetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, password: loginPassword }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { token: string };
  return data.token;
}

async function loadProfiles() {
  loadingProfiles.value = true;
  profileError.value = null;
  try {
    const res = await apiFetch("/api/player-profiles");
    if (!res.ok) throw new Error("Failed to load profiles");
    const data = (await res.json()) as { profiles: PlayerProfileOption[] };
    profiles.value = data.profiles;
    if (!selectedProfileId.value && profiles.value.length > 0) {
      const firstAvailable = profiles.value.find((p) => !p.isActive);
      selectedProfileId.value = firstAvailable?.id ?? null;
    }
  } catch {
    profileError.value = "Unable to load player profiles";
  } finally {
    loadingProfiles.value = false;
  }
}

async function joinAsGm() {
  const loginPassword = password.value;
  if (!loginPassword) return;
  joinLoading.value = "gm";
  joinError.value = null;
  try {
    const authToken = await login("gm", loginPassword);
    if (!authToken) {
      joinError.value = "Incorrect password";
      return;
    }
    startSession("gm", null, authToken);
    router.push("/game");
  } finally {
    joinLoading.value = null;
  }
}

async function joinAsPlayer() {
  const loginPassword = password.value;
  if (!loginPassword) return;
  joinLoading.value = "player";
  joinError.value = null;
  try {
    const authToken = await login("player", loginPassword);
    if (!authToken) {
      joinError.value = "Incorrect password";
      return;
    }
    startSession("player", null, authToken);
    showProfileModal.value = true;
    await loadProfiles();
  } finally {
    joinLoading.value = null;
  }
}

async function createProfile() {
  const name = newProfileName.value.trim();
  if (!name) return;
  creatingProfile.value = true;
  profileError.value = null;
  try {
    const res = await apiFetch("/api/player-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("Failed to create profile");
    const data = (await res.json()) as { profile: PlayerProfile };
    profiles.value = [...profiles.value, { ...data.profile, isActive: false }];
    selectedProfileId.value = data.profile.id;
    newProfileName.value = "";
  } catch {
    profileError.value = "Unable to create player profile";
  } finally {
    creatingProfile.value = false;
  }
}

function joinAsSelectedPlayer() {
  if (!selectedProfile.value || selectedProfile.value.isActive) return;
  if (!token.value) return;
  showProfileModal.value = false;
  startSession("player", selectedProfile.value, token.value);
  router.push("/game");
}
</script>

<template>
  <div class="landing">
    <div class="landing-card">
      <h1 class="title">
        <span class="title-prefix">{{ branding.landingPrefix }}</span>
        <span class="hell" :aria-label="branding.landingAccent">
          <span
            v-for="(letter, index) in brandLetters"
            :key="`${letter}-${index}`"
            class="hell-letter"
          >{{ letter }}</span>
        </span>
      </h1>

      <input
        v-model="password"
        class="name-input"
        type="password"
        placeholder="Password"
        autocomplete="current-password"
        :disabled="joinLoading !== null"
        @keydown.enter.prevent="joinAsPlayer"
      />

      <div class="role-actions">
        <button
          class="cta"
          :disabled="joinLoading !== null || !password"
          @click="joinAsPlayer"
        >
          {{ joinLoading === "player" ? "Joining..." : "Join as Player" }}
        </button>
        <button
          class="cta"
          :disabled="joinLoading !== null || !password"
          @click="joinAsGm"
        >
          {{ joinLoading === "gm" ? "Joining..." : "Join as GM" }}
        </button>
      </div>
      <p v-if="joinError" class="error">{{ joinError }}</p>
    </div>
  </div>

  <ModalDialog
    :open="showProfileModal"
    title="Select player profile"
    wide
    ok-label="Join game as player"
    :ok-disabled="loadingProfiles || !selectedProfile || !!selectedProfile?.isActive"
    @close="showProfileModal = false"
    @confirm="joinAsSelectedPlayer"
  >
    <p class="subtitle">Choose an existing profile or create a new one.</p>

    <p v-if="loadingProfiles" class="loading-row">
      <span class="spinner" aria-hidden="true" />
      <span class="muted">Loading profiles…</span>
    </p>
    <p v-else-if="profiles.length === 0" class="muted">No profiles yet.</p>

    <div v-if="profiles.length > 0" class="profile-list">
      <button
        v-for="p in profiles"
        :key="p.id"
        type="button"
        class="profile-item"
        :disabled="loadingProfiles"
        :class="{ active: selectedProfileId === p.id, inactive: p.isActive }"
        @click="!p.isActive && (selectedProfileId = p.id)"
      >
        {{ p.name }}
        <span v-if="p.isActive" class="tag">In game</span>
      </button>
    </div>

    <p v-if="profileError" class="error">{{ profileError }}</p>

    <div class="create-row">
      <input
        v-model="newProfileName"
        class="name-input"
        type="text"
        placeholder="New player name"
        :disabled="loadingProfiles || creatingProfile"
      />
      <button
        class="cta"
        :disabled="loadingProfiles || creatingProfile || !newProfileName.trim()"
        @click="createProfile"
      >
        {{ creatingProfile ? "Adding..." : "Add new player profile" }}
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.landing-card {
  width: 100%;
  max-width: 420px;
  padding: 2rem 1.75rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  text-align: center;
}

.title {
  margin: 0 0 1.75rem;
  font-size: 1.75rem;
  font-weight: 500;
  letter-spacing: 0.04rem;
  line-height: 1.2;
}

.title-prefix {
  font-family: var(--font-heading);
}

.hell {
  font-family: var(--font-heading);
  color: var(--color-danger);
}

.hell-letter {
  display: inline-block;
  animation-duration: 1.1s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

.hell-letter:nth-child(odd) {
  animation-name: hell-wiggle-up;
}

.hell-letter:nth-child(even) {
  animation-name: hell-wiggle-down;
}

.hell-letter:nth-child(1) { animation-delay: 0s; }
.hell-letter:nth-child(2) { animation-delay: 0.12s; }
.hell-letter:nth-child(3) { animation-delay: 0.24s; }
.hell-letter:nth-child(4) { animation-delay: 0.36s; }

@keyframes hell-wiggle-up {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

@keyframes hell-wiggle-down {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(2px); }
}

.role-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.role-actions .cta {
  flex: 1 1 0;
}

.subtitle { color: var(--color-muted); margin-bottom: 1.25rem; }
.name-input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 0;
  background: var(--color-bg);
  color: var(--color-text);
  padding: 0.55rem 0.65rem;
}
.cta {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0.65rem 1rem;
  cursor: pointer;
  font-weight: 600;
}
.cta:hover { background: var(--color-surface-alt); }
.cta:disabled { opacity: 0.6; cursor: not-allowed; }

.profile-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0 0 1rem;
  max-height: 220px;
  overflow: auto;
}

.profile-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 0;
  padding: 0.5rem 0.65rem;
  cursor: pointer;
}

.profile-item.active {
  border-color: var(--color-accent);
}

.profile-item.inactive {
  opacity: 0.6;
}

.tag {
  font-size: 0.72rem;
  color: var(--color-warning);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
}

.create-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.create-row .name-input {
  flex: 1 1 220px;
  width: auto;
}

.error { color: var(--color-danger); margin: 0.75rem 0 0; }

.loading-row {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-success);
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
