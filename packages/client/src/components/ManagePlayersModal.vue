<script setup lang="ts">
import type { CharacterSheet, PlayerProfile } from "@gaem/shared";
import { computed, ref, watch } from "vue";

import { useApi } from "../composables/useApi.js";
import { useSession } from "../composables/useSession.js";
import ModalDialog from "./ModalDialog.vue";

type PlayerProfileOption = PlayerProfile & { isActive?: boolean };

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { apiFetch } = useApi();
const { isGm } = useSession();

const profiles = ref<PlayerProfileOption[]>([]);
const sheets = ref<CharacterSheet[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const newName = ref("");
const creating = ref(false);

const editingId = ref<string | null>(null);
const editName = ref("");
const savingId = ref<string | null>(null);

const sheetsByPlayer = computed(() => {
  const map = new Map<string, CharacterSheet[]>();
  for (const sheet of sheets.value) {
    const list = map.get(sheet.player) ?? [];
    list.push(sheet);
    map.set(sheet.player, list);
  }
  return map;
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [profilesRes, sheetsRes] = await Promise.all([
      apiFetch("/api/player-profiles"),
      apiFetch("/api/character-sheets"),
    ]);
    if (!profilesRes.ok || !sheetsRes.ok) throw new Error("load failed");
    const profilesData = (await profilesRes.json()) as { profiles: PlayerProfileOption[] };
    const sheetsData = (await sheetsRes.json()) as { sheets: CharacterSheet[] };
    profiles.value = profilesData.profiles;
    sheets.value = sheetsData.sheets;
  } catch {
    error.value = "Unable to load players";
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      editingId.value = null;
      newName.value = "";
      void load();
    }
  },
);

async function addPlayer() {
  const name = newName.value.trim();
  if (!name) return;
  creating.value = true;
  error.value = null;
  try {
    const res = await apiFetch("/api/player-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("create failed");
    const data = (await res.json()) as { profile: PlayerProfileOption };
    newName.value = "";
    await load();
    if (!profiles.value.some((p) => p.id === data.profile.id)) {
      profiles.value = [...profiles.value, { ...data.profile, isActive: false }];
    }
  } catch {
    error.value = "Unable to add player";
  } finally {
    creating.value = false;
  }
}

function startRename(profile: PlayerProfileOption) {
  editingId.value = profile.id;
  editName.value = profile.name;
}

async function saveRename(id: string) {
  const name = editName.value.trim();
  if (!name) return;
  savingId.value = id;
  error.value = null;
  try {
    const res = await apiFetch(`/api/player-profiles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("rename failed");
    editingId.value = null;
    await load();
  } catch {
    error.value = "Unable to rename player";
  } finally {
    savingId.value = null;
  }
}

async function removePlayer(profile: PlayerProfileOption) {
  const linked = sheetsByPlayer.value.get(profile.id)?.length ?? 0;
  if (linked > 0) return;
  savingId.value = profile.id;
  error.value = null;
  try {
    const res = await apiFetch(`/api/player-profiles/${profile.id}`, {
      method: "DELETE",
    });
    if (res.status === 409) {
      error.value = "Player still has linked character sheets";
      await load();
      return;
    }
    if (!res.ok) throw new Error("delete failed");
    await load();
  } catch {
    error.value = "Unable to remove player";
  } finally {
    savingId.value = null;
  }
}

async function toggleGmPermissions(profile: PlayerProfileOption) {
  savingId.value = profile.id;
  error.value = null;
  try {
    const res = await apiFetch(`/api/player-profiles/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmPermissions: !profile.gmPermissions }),
    });
    if (!res.ok) throw new Error("update failed");
    await load();
  } catch {
    error.value = "Unable to update GM permissions";
  } finally {
    savingId.value = null;
  }
}

async function linkSheet(profileId: string, event: Event) {
  const select = event.target as HTMLSelectElement;
  const sheetId = select.value;
  select.value = "";
  if (!sheetId) return;
  savingId.value = profileId;
  error.value = null;
  try {
    const res = await apiFetch(`/api/character-sheets/${sheetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player: profileId }),
    });
    if (!res.ok) throw new Error("link failed");
    await load();
  } catch {
    error.value = "Unable to link character sheet";
  } finally {
    savingId.value = null;
  }
}

function playerName(id: string): string {
  return profiles.value.find((p) => p.id === id)?.name ?? "Unassigned";
}
</script>

<template>
  <ModalDialog :open="open" title="Manage players" wide @close="emit('close')">
    <p v-if="loading" class="loading-row">
      <span class="spinner" aria-hidden="true" />
      <span class="muted">Loading players…</span>
    </p>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="!loading && profiles.length === 0" class="muted">No players yet.</div>

    <table v-if="!loading && profiles.length > 0" class="players-table">
      <thead>
        <tr>
          <th>Player</th>
          <th>Character sheets</th>
          <th v-if="isGm" class="gm-perms-col">GM permissions</th>
          <th class="actions-col">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="profile in profiles" :key="profile.id">
          <td class="name-cell">
            <template v-if="editingId === profile.id">
              <input
                v-model="editName"
                class="name-input"
                type="text"
                :disabled="savingId === profile.id"
                @keydown.enter="saveRename(profile.id)"
              />
            </template>
            <template v-else>
              <span class="player-name">{{ profile.name }}</span>
              <span v-if="profile.isActive" class="tag">In game</span>
            </template>
          </td>

          <td class="sheets-cell">
            <ul v-if="sheetsByPlayer.get(profile.id)?.length" class="sheet-list">
              <li v-for="sheet in sheetsByPlayer.get(profile.id)" :key="sheet.id">
                {{ sheet.name }}
              </li>
            </ul>
            <span v-else class="muted">None</span>
            <select
              class="link-select"
              :disabled="savingId === profile.id"
              @change="linkSheet(profile.id, $event)"
            >
              <option value="">Link a sheet…</option>
              <option
                v-for="sheet in sheets.filter((s) => s.player !== profile.id)"
                :key="sheet.id"
                :value="sheet.id"
              >
                {{ sheet.name }} — {{ playerName(sheet.player) }}
              </option>
            </select>
          </td>

          <td v-if="isGm" class="gm-perms-cell">
            <label class="gm-perms-toggle">
              <button
                type="button"
                role="switch"
                class="toggle"
                :class="{ on: profile.gmPermissions }"
                :aria-checked="profile.gmPermissions === true"
                :disabled="savingId === profile.id"
                @click="toggleGmPermissions(profile)"
              >
                <span class="toggle-thumb" />
              </button>
            </label>
          </td>

          <td class="actions-cell">
            <template v-if="editingId === profile.id">
              <button
                type="button"
                class="btn-primary btn-sm"
                :disabled="savingId === profile.id || !editName.trim()"
                @click="saveRename(profile.id)"
              >
                Save
              </button>
              <button
                type="button"
                class="btn-secondary btn-sm"
                :disabled="savingId === profile.id"
                @click="editingId = null"
              >
                Cancel
              </button>
            </template>
            <template v-else>
              <button
                type="button"
                class="btn-secondary btn-sm"
                :disabled="savingId === profile.id"
                @click="startRename(profile)"
              >
                Rename
              </button>
              <button
                type="button"
                class="btn-danger btn-sm"
                :disabled="savingId === profile.id || (sheetsByPlayer.get(profile.id)?.length ?? 0) > 0"
                :title="(sheetsByPlayer.get(profile.id)?.length ?? 0) > 0 ? 'Unlink character sheets before removing' : undefined"
                @click="removePlayer(profile)"
              >
                Remove
              </button>
            </template>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="create-row">
      <input
        v-model="newName"
        class="name-input"
        type="text"
        placeholder="New player name"
        :disabled="creating"
        @keydown.enter="addPlayer"
      />
      <button
        type="button"
        class="btn-primary"
        :disabled="creating || !newName.trim()"
        @click="addPlayer"
      >
        {{ creating ? "Adding…" : "Add player" }}
      </button>
    </div>

    <template #actions>
      <button type="button" class="btn-secondary" @click="emit('close')">Close</button>
    </template>
  </ModalDialog>
</template>

<style scoped>
.players-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

.players-table th,
.players-table td {
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

.players-table th {
  font-size: 0.72rem;
  text-transform: uppercase;
  color: var(--color-muted);
  font-weight: 600;
}

.gm-perms-col {
  width: 1%;
  white-space: nowrap;
}

.gm-perms-cell {
  vertical-align: middle;
}

.gm-perms-toggle {
  display: inline-flex;
  align-items: center;
}

.toggle {
  position: relative;
  flex-shrink: 0;
  width: 2.25rem;
  height: 1.25rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface-raised);
  padding: 0;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.toggle.on {
  background: var(--color-success-dark);
  border-color: var(--color-success-bright);
}

.toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-thumb {
  position: absolute;
  top: 1px;
  left: 1px;
  width: calc(1.25rem - 4px);
  height: calc(1.25rem - 4px);
  border-radius: 50%;
  background: var(--color-text);
  transition: transform 0.15s;
}

.toggle.on .toggle-thumb {
  transform: translateX(1rem);
}

.actions-col {
  width: 1%;
  white-space: nowrap;
}

.name-cell {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.player-name {
  font-weight: 600;
}

.sheet-list {
  margin: 0 0 0.4rem;
  padding-left: 1.1rem;
}

.link-select {
  width: 100%;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  padding: 0.35rem 0.4rem;
}

.actions-cell {
  display: flex;
  gap: 0.4rem;
  white-space: nowrap;
}

.btn-sm {
  padding: 0.3rem 0.55rem;
  font-size: 0.8rem;
}

.create-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.name-input {
  flex: 1 1 200px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  padding: 0.5rem 0.6rem;
}

.tag {
  font-size: 0.72rem;
  color: var(--color-warning);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
}

.error {
  color: var(--color-danger);
  margin: 0.5rem 0;
}

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
  to {
    transform: rotate(360deg);
  }
}
</style>
