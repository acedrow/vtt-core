<script setup lang="ts">
import { YADATHAN_ARMOR_NAME } from "@vtt-core/hellpiercers-content/combat-ui";
import type { CharacterSheet, FactionId, GameMapSummary, PlayerProfile, ReconTableId } from "@vtt-core/shared";
import { BOARD_HEIGHT, BOARD_WIDTH, FACTIONS, getFactionById, listEnemyFactionIds, listReconTables } from "@vtt-core/shared";
import { computed, ref, watch } from "vue";

import { useApi } from "../composables/useApi.js";
import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useCharacterSheetSelection } from "../composables/useCharacterSheetSelection.js";
import { useFactionSelection } from "../composables/useFactionSelection.js";
import { activeTab } from "../composables/useGameConsole.js";
import type { DataCategory } from "../composables/useInfoDataSelection.js";
import { useInfoDataSelection } from "../composables/useInfoDataSelection.js";
import { useMapSelection } from "../composables/useMapSelection.js";
import { useSession } from "../composables/useSession.js";
import { useTableSelection } from "../composables/useTableSelection.js";
import CharacterSheetFormFields from "./CharacterSheetFormFields.vue";
import ModalDialog from "./ModalDialog.vue";

type PlayerProfileOption = PlayerProfile & { isActive?: boolean };

const { apiFetch, fetchPlayerProfiles, fetchMaps, createMap } = useApi();
const { role, playerProfile, hasGmCapabilities } = useSession();
const { selectedSheetId, sheetsExpanded, sheetsVersion, selectSheet } =
  useCharacterSheetSelection();
const { selectedMapId, mapsExpanded, mapsVersion, selectMap, notifyMapsChanged } =
  useMapSelection();
const { selectedFactionId, factionsExpanded, selectFaction } = useFactionSelection();
const { selectedTableId, tablesExpanded, selectTable } = useTableSelection();
const { clearBoardSelection, selectSheetFromNav } = useBoardSelection();
const { dataCategory, dataExpanded, selectDataCategory } = useInfoDataSelection();

const reconTables = listReconTables();
const enemyFactionIds = listEnemyFactionIds();

function enemyFactionNavLabel(factionId: string): string {
  return getFactionById(factionId)?.name ?? factionId.charAt(0).toUpperCase() + factionId.slice(1);
}

const sheets = ref<CharacterSheet[]>([]);
const maps = ref<GameMapSummary[]>([]);
const mapSearch = ref("");
const profiles = ref<PlayerProfileOption[]>([]);
const loading = ref(false);
const mapsLoading = ref(false);
const loadError = ref<string | null>(null);
const mapsLoadError = ref<string | null>(null);
const showCreate = ref(false);
const showCreateMap = ref(false);
const creating = ref(false);
const creatingMap = ref(false);
const createError = ref<string | null>(null);
const createMapError = ref<string | null>(null);

const createForm = ref({
  player: "",
  name: "",
  class: "",
  armor: "",
  weapon: "",
  yadathanTower: "",
});

const createMapForm = ref({
  id: "",
  name: "",
  width: BOARD_WIDTH,
  height: BOARD_HEIGHT,
});

const createMapFormValid = computed(() => {
  const f = createMapForm.value;
  return f.id.trim().length > 0 && f.name.trim().length > 0 && f.width > 0 && f.height > 0;
});

const filteredMaps = computed(() => {
  const q = mapSearch.value.trim().toLowerCase();
  if (!q) return maps.value;
  return maps.value.filter(
    (map) => map.name.toLowerCase().includes(q) || map.id.toLowerCase().includes(q),
  );
});

const createFormValid = computed(() => {
  const f = createForm.value;
  if (!f.player || !f.name || !f.class || !f.armor || !f.weapon) return false;
  if (f.armor === YADATHAN_ARMOR_NAME && !f.yadathanTower) return false;
  return true;
});

const profileNameById = computed(() => {
  const map = new Map<string, string>();
  for (const p of profiles.value) map.set(p.id, p.name);
  return map;
});

const sortedSheets = computed(() => {
  const ownProfileId = role.value === "player" ? playerProfile.value?.id : null;
  if (!ownProfileId) return sheets.value;
  return [...sheets.value].sort((a, b) => {
    const aOwn = a.player === ownProfileId;
    const bOwn = b.player === ownProfileId;
    if (aOwn !== bOwn) return aOwn ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
});

async function loadSheets() {
  loading.value = true;
  loadError.value = null;
  try {
    const [sheetsRes, profilesList] = await Promise.all([
      apiFetch("/api/character-sheets"),
      fetchPlayerProfiles(),
    ]);
    if (!sheetsRes.ok) throw new Error("Failed to load character sheets");
    const sheetsData = (await sheetsRes.json()) as { sheets: CharacterSheet[] };
    sheets.value = sheetsData.sheets;
    profiles.value = profilesList;
  } catch {
    loadError.value = "Unable to load sheets";
  } finally {
    loading.value = false;
  }
}

async function loadMaps() {
  mapsLoading.value = true;
  mapsLoadError.value = null;
  try {
    maps.value = await fetchMaps();
  } catch {
    mapsLoadError.value = "Unable to load maps";
  } finally {
    mapsLoading.value = false;
  }
}

function toggleMaps() {
  mapsExpanded.value = !mapsExpanded.value;
}

function toggleSheets() {
  sheetsExpanded.value = !sheetsExpanded.value;
}

function toggleData() {
  dataExpanded.value = !dataExpanded.value;
}

function toggleFactions() {
  factionsExpanded.value = !factionsExpanded.value;
}

function toggleTables() {
  tablesExpanded.value = !tablesExpanded.value;
}

const openDropdownCount = computed(() => {
  let count = 0;
  if (hasGmCapabilities.value && mapsExpanded.value) count += 1;
  if (sheetsExpanded.value) count += 1;
  if (dataExpanded.value) count += 1;
  if (factionsExpanded.value) count += 1;
  if (tablesExpanded.value) count += 1;
  return count;
});

const showCollapseAll = computed(() => openDropdownCount.value >= 2);

function collapseAll() {
  if (hasGmCapabilities.value) mapsExpanded.value = false;
  sheetsExpanded.value = false;
  dataExpanded.value = false;
  factionsExpanded.value = false;
  tablesExpanded.value = false;
}

function onSelectSheet(sheetId: string) {
  selectSheetFromNav(sheetId);
}

function onSelectData(category: DataCategory) {
  clearBoardSelection();
  selectSheet(null);
  selectMap(null);
  selectDataCategory(category);
  activeTab.value = "info";
}

function onSelectFaction(factionId: FactionId) {
  selectFaction(factionId);
}

function onSelectTable(tableId: ReconTableId) {
  selectTable(tableId);
}

function onSelectMap(mapId: string) {
  selectMap(mapId);
}

function openCreateMap() {
  createMapForm.value = {
    id: "",
    name: "",
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
  };
  createMapError.value = null;
  showCreateMap.value = true;
}

async function submitCreateMap() {
  creatingMap.value = true;
  createMapError.value = null;
  try {
    const f = createMapForm.value;
    const map = await createMap({
      id: f.id.trim(),
      name: f.name.trim(),
      width: f.width,
      height: f.height,
    });
    showCreateMap.value = false;
    await loadMaps();
    notifyMapsChanged();
    selectMap(map.id);
  } catch (e) {
    createMapError.value = e instanceof Error ? e.message : "Unable to create map";
  } finally {
    creatingMap.value = false;
  }
}

function openCreate() {
  createForm.value = {
    player: role.value === "player" ? (playerProfile.value?.id ?? "") : "",
    name: "",
    class: "",
    armor: "",
    weapon: "",
    yadathanTower: "",
  };
  createError.value = null;
  showCreate.value = true;
}

async function createSheet() {
  creating.value = true;
  createError.value = null;
  try {
    const res = await apiFetch("/api/character-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createForm.value),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Failed to create sheet");
    }
    const data = (await res.json()) as { sheet: CharacterSheet };
    showCreate.value = false;
    await loadSheets();
    selectSheetFromNav(data.sheet.id);
  } catch (e) {
    createError.value = e instanceof Error ? e.message : "Unable to create sheet";
  } finally {
    creating.value = false;
  }
}

watch(mapsExpanded, (expanded) => {
  if (expanded && maps.value.length === 0 && !mapsLoading.value) loadMaps();
}, { immediate: true });

watch(mapsVersion, () => {
  if (mapsExpanded.value) loadMaps();
});

watch(sheetsExpanded, (expanded) => {
  if (expanded && sheets.value.length === 0 && !loading.value) loadSheets();
}, { immediate: true });

watch(sheetsVersion, () => {
  if (sheetsExpanded.value) loadSheets();
});
</script>

<template>
  <nav class="side-nav">
    <button
      v-if="showCollapseAll"
      class="collapse-all-btn"
      type="button"
      @click="collapseAll"
    >
      Collapse all
    </button>

    <template v-if="hasGmCapabilities">
      <button class="nav-link nav-toggle" :class="{ expanded: mapsExpanded }" type="button" @click="toggleMaps">
        Maps
        <span class="chevron" aria-hidden="true">{{ mapsExpanded ? "▾" : "▸" }}</span>
      </button>

      <div v-if="mapsExpanded" class="sheet-sublist">
        <input
          v-model="mapSearch"
          class="nav-search-input"
          type="search"
          placeholder="Search maps…"
          aria-label="Search maps"
        />
        <button class="new-sheet-btn" type="button" @click="openCreateMap">+ New map</button>
        <p v-if="mapsLoading" class="sublist-muted">Loading…</p>
        <p v-else-if="mapsLoadError" class="sublist-error">{{ mapsLoadError }}</p>
        <template v-else>
          <button
            v-for="map in filteredMaps"
            :key="map.id"
            class="sheet-item"
            :class="{ selected: selectedMapId === map.id }"
            type="button"
            @click="onSelectMap(map.id)"
          >
            <span class="sheet-name">{{ map.name }}</span>
          </button>
          <p v-if="maps.length === 0" class="sublist-muted">No maps yet.</p>
          <p v-else-if="filteredMaps.length === 0" class="sublist-muted">No matches.</p>
        </template>
      </div>
    </template>

    <button class="nav-link nav-toggle" :class="{ expanded: sheetsExpanded }" type="button" @click="toggleSheets">
      Character Sheets
      <span class="chevron" aria-hidden="true">{{ sheetsExpanded ? "▾" : "▸" }}</span>
    </button>

    <div v-if="sheetsExpanded" class="sheet-sublist">
      <p v-if="loading" class="sublist-muted">Loading…</p>
      <p v-else-if="loadError" class="sublist-error">{{ loadError }}</p>
      <template v-else>
        <button v-for="sheet in sortedSheets" :key="sheet.id" class="sheet-item"
          :class="{ selected: selectedSheetId === sheet.id }" type="button" @click="onSelectSheet(sheet.id)">
          <span class="sheet-name">{{ sheet.name }}</span>
          <span class="sheet-meta">
            {{ profileNameById.get(sheet.player) ?? sheet.player }}
          </span>
        </button>
        <p v-if="sheets.length === 0" class="sublist-muted">No sheets yet.</p>
      </template>
      <button class="new-sheet-btn" type="button" @click="openCreate">+ New sheet</button>
    </div>

    <button class="nav-link nav-toggle" :class="{ expanded: dataExpanded }" type="button" @click="toggleData">
      Data
      <span class="chevron" aria-hidden="true">{{ dataExpanded ? "▾" : "▸" }}</span>
    </button>

    <div v-if="dataExpanded" class="sheet-sublist">
      <button
        class="sheet-item"
        :class="{ selected: dataCategory === 'armor' }"
        type="button"
        @click="onSelectData('armor')"
      >
        <span class="sheet-name">Armor</span>
      </button>
      <button
        class="sheet-item"
        :class="{ selected: dataCategory === 'classes' }"
        type="button"
        @click="onSelectData('classes')"
      >
        <span class="sheet-name">Classes</span>
      </button>
      <button
        class="sheet-item"
        :class="{ selected: dataCategory === 'weapons' }"
        type="button"
        @click="onSelectData('weapons')"
      >
        <span class="sheet-name">Weapons</span>
      </button>
      <button
        class="sheet-item"
        :class="{ selected: dataCategory === 'equipment' }"
        type="button"
        @click="onSelectData('equipment')"
      >
        <span class="sheet-name">Equipment</span>
      </button>
      <button
        class="sheet-item"
        :class="{ selected: dataCategory === 'gear' }"
        type="button"
        @click="onSelectData('gear')"
      >
        <span class="sheet-name">Gear</span>
      </button>
      <button
        class="sheet-item"
        :class="{ selected: dataCategory === 'resources' }"
        type="button"
        @click="onSelectData('resources')"
      >
        <span class="sheet-name">Resources</span>
      </button>
      <button
        class="sheet-item"
        :class="{ selected: dataCategory === 'effects' }"
        type="button"
        @click="onSelectData('effects')"
      >
        <span class="sheet-name">Effects</span>
      </button>
      <button
        class="sheet-item"
        :class="{ selected: dataCategory === 'terrain' }"
        type="button"
        @click="onSelectData('terrain')"
      >
        <span class="sheet-name">Terrain</span>
      </button>
      <button
        class="sheet-item"
        :class="{ selected: dataCategory === 'patterns' }"
        type="button"
        @click="onSelectData('patterns')"
      >
        <span class="sheet-name">Patterns</span>
      </button>
      <button
        v-for="factionId in enemyFactionIds"
        :key="factionId"
        class="sheet-item"
        :class="{ selected: dataCategory === factionId }"
        type="button"
        @click="onSelectData(factionId)"
      >
        <span class="sheet-name">Enemies — {{ enemyFactionNavLabel(factionId) }}</span>
      </button>
    </div>

    <button
      class="nav-link nav-toggle"
      :class="{ expanded: factionsExpanded }"
      type="button"
      @click="toggleFactions"
    >
      Factions
      <span class="chevron" aria-hidden="true">{{ factionsExpanded ? "▾" : "▸" }}</span>
    </button>

    <div v-if="factionsExpanded" class="sheet-sublist">
      <button
        v-for="faction in FACTIONS"
        :key="faction.id"
        class="sheet-item"
        :class="{ selected: selectedFactionId === faction.id }"
        type="button"
        @click="onSelectFaction(faction.id)"
      >
        <span class="sheet-name">{{ faction.name }}</span>
      </button>
    </div>

    <button
      class="nav-link nav-toggle"
      :class="{ expanded: tablesExpanded }"
      type="button"
      @click="toggleTables"
    >
      Tables
      <span class="chevron" aria-hidden="true">{{ tablesExpanded ? "▾" : "▸" }}</span>
    </button>

    <div v-if="tablesExpanded" class="sheet-sublist">
      <button
        v-for="table in reconTables"
        :key="table.id"
        class="sheet-item"
        :class="{ selected: selectedTableId === table.id }"
        type="button"
        @click="onSelectTable(table.id)"
      >
        <span class="sheet-name">{{ table.name }}</span>
      </button>
    </div>

    <ModalDialog
      :open="showCreate"
      title="New character sheet"
      wide
      :ok-label="creating ? 'Creating…' : 'Create'"
      :ok-disabled="creating || !createFormValid"
      @close="showCreate = false"
      @confirm="createSheet"
    >
      <CharacterSheetFormFields
        v-model="createForm"
        :profiles="profiles"
        :show-player="hasGmCapabilities"
      />

      <p v-if="createError" class="sublist-error">{{ createError }}</p>
    </ModalDialog>

    <ModalDialog
      :open="showCreateMap"
      title="New map"
      :ok-label="creatingMap ? 'Creating…' : 'Create'"
      :ok-disabled="creatingMap || !createMapFormValid"
      @close="showCreateMap = false"
      @confirm="submitCreateMap"
    >
      <div class="create-map-fields">
        <label class="field">
          <span class="field-label">Id</span>
          <input v-model="createMapForm.id" class="field-input" type="text" placeholder="my-map" />
        </label>
        <label class="field">
          <span class="field-label">Name</span>
          <input v-model="createMapForm.name" class="field-input" type="text" placeholder="My Map" />
        </label>
        <label class="field">
          <span class="field-label">Width</span>
          <input v-model.number="createMapForm.width" class="field-input" type="number" min="1" />
        </label>
        <label class="field">
          <span class="field-label">Height</span>
          <input v-model.number="createMapForm.height" class="field-input" type="number" min="1" />
        </label>
      </div>

      <p v-if="createMapError" class="sublist-error">{{ createMapError }}</p>
    </ModalDialog>
  </nav>
</template>

<style scoped>
.side-nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 10rem;
  padding: 0 0.75rem 1rem;
}

.collapse-all-btn {
  align-self: flex-end;
  margin: 0.15rem 0 0.1rem;
  padding: 0.15rem 0.35rem;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--color-muted);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.collapse-all-btn:hover {
  color: var(--color-text);
}

.nav-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.65rem;
  border-radius: 0;
  color: var(--color-muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  border: 1px solid transparent;
}

.nav-link.active {
  color: var(--color-text);
  background: var(--color-surface);
  border-color: var(--color-border);
}

.nav-toggle {
  width: 100%;
  text-align: left;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
}

.nav-toggle:hover,
.nav-toggle.expanded {
  color: var(--color-text);
  background: var(--color-surface);
}

.chevron {
  font-size: 1.5rem;
  color: var(--color-muted);
}

.sheet-sublist {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-left: 0.5rem;
  margin-bottom: 0.25rem;
}

.sheet-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--color-muted);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.85rem;
}

.sheet-item:hover {
  color: var(--color-text);
  background: var(--color-surface);
}

.sheet-item.selected {
  color: var(--color-text);
  background: var(--color-surface);
  border-color: var(--color-border);
}

.sheet-name {
  font-weight: 600;
}

.sheet-meta {
  font-size: 0.75rem;
  color: var(--color-muted-subtle);
}

.sublist-muted {
  margin: 0;
  padding: 0.25rem 0.55rem;
  font-size: 0.8rem;
  color: var(--color-muted-subtle);
}

.sublist-error {
  margin: 0;
  padding: 0.25rem 0.55rem;
  font-size: 0.8rem;
  color: var(--color-danger);
}

.new-sheet-btn {
  margin-top: 0.25rem;
  padding: 0.35rem 0.55rem;
  border: 1px dashed var(--color-border);
  border-radius: 0;
  background: transparent;
  color: var(--color-muted);
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.new-sheet-btn:hover {
  color: var(--color-text);
  border-color: var(--color-accent);
}

.nav-search-input {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 0.25rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: 0;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.8rem;
}

.nav-search-input::placeholder {
  color: var(--color-muted-subtle);
}

.create-map-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-muted);
}

.field-input {
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: 0;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.85rem;
}
</style>
