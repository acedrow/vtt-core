<script setup lang="ts">
import {
  defaultOverworldParty,
  FACTION_QUALITY_KEYS,
  getConvoyTypeInfo,
  getFactionById,
  getFactionForRegion,
  isLocationInfoVisibleToPlayers,
  listOverworldConvoyDestinations,
  listOverworldDeployDestinations,
  listOverworldTravelDestinations,
  getRegionFactionId,
  getOverworldHeight,
  getOverworldQuarterWidth,
  getOverworldQuarterHeight,
  getOverworldTravelFuelCost,
  getOverworldWidth,
  type FactionLocation,
  type FactionQualityDots,
  type OverworldConvoy,
  type OverworldLocation,
  type OverworldRegion,
  type OverworldRegionId,
} from "@gaem/shared";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

import { useApi } from "@gaem/client/composables/useApi.js";
import { useBoardViewport } from "@gaem/client/composables/useBoardViewport.js";
import { useFactionSelection } from "@gaem/client/composables/useFactionSelection.js";
import { useGameState } from "@gaem/client/composables/useGameState.js";
import { activeMainTab } from "@gaem/client/composables/useMainSectionTab.js";
import {
  consumeSuppressMapPingClick,
  useMapPing,
} from "@gaem/client/composables/useMapPing.js";
import { useOverworldEntitySelection } from "@gaem/client/composables/useOverworldEntitySelection.js";
import { useSession } from "@gaem/client/composables/useSession.js";
import { showToast } from "@gaem/client/composables/useToasts.js";
import {
  orderOccupants,
  slotForOccupant,
  stackSpreadFromZoom,
  type OverworldStackOccupant,
} from "@gaem/client/lib/overworldTokenLayout.js";
import locationUrl from "@gaem/client/assets/location.svg";
import skullUrl from "@gaem/client/assets/skull.svg";
import BoardContextMenu, { type BoardContextMenuItem } from "@gaem/client/components/BoardContextMenu.vue";
import DeployOverworldConvoyModal from "./DeployOverworldConvoyModal.vue";
import ModalDialog from "@gaem/client/components/ModalDialog.vue";
import OverworldGmIchorOverlay from "./OverworldGmIchorOverlay.vue";
import OverworldReconOverlay from "./OverworldReconOverlay.vue";
import PlaceOverworldLocationModal from "./PlaceOverworldLocationModal.vue";

const CELL = 64;
const OVERWORLD_WIDTH = getOverworldWidth();
const OVERWORLD_HEIGHT = getOverworldHeight();
const OVERWORLD_QUARTER_WIDTH = getOverworldQuarterWidth();
const OVERWORLD_QUARTER_HEIGHT = getOverworldQuarterHeight();
const OVERWORLD_TRAVEL_FUEL_COST = getOverworldTravelFuelCost();
const QUARTER = CELL / 2;
const LOCATION_MARKER_Y_NUDGE = QUARTER / 6;
const DIS_NODE = 72;
const DIS_GAP = 56;
const boardWidthPx = OVERWORLD_WIDTH * CELL;
const boardHeightPx = OVERWORLD_HEIGHT * CELL;
const contentWidthPx = computed(() => boardWidthPx);
const contentHeightPx = computed(() => boardHeightPx + DIS_GAP + DIS_NODE);

const { gameState, send } = useGameState();
const { hasGmCapabilities, isGm } = useSession();
const { uploadRegionImage, fetchRegionImageUrl } = useApi();
const { selectedFactionId, selectFaction, revealFactionLocation } = useFactionSelection();
const {
  selectedOverworldConvoyId,
  selectedOverworldLocationId,
  selectOverworldConvoy,
  selectOverworldLocation,
  clearOverworldEntitySelection,
} = useOverworldEntitySelection();
const { overworldPings, beginMapPingHold } = useMapPing();

const viewportEl = ref<HTMLElement | null>(null);
const overworldBoardEl = ref<HTMLElement | null>(null);
const viewportKey = ref("overworld");
const isReady = ref(true);
const uploadingRegionId = ref<OverworldRegionId | null>(null);
const fileInputEl = ref<HTMLInputElement | null>(null);
const pendingUploadRegionId = ref<OverworldRegionId | null>(null);
const travelMode = ref(false);
const deployMode = ref(false);

const contextMenu = ref<{
  open: boolean;
  x: number;
  y: number;
  qx: number;
  qy: number;
  items: BoardContextMenuItem[];
}>({ open: false, x: 0, y: 0, qx: 0, qy: 0, items: [] });

const placeModal = ref<{ open: boolean; qx: number | null; qy: number | null }>({
  open: false,
  qx: null,
  qy: null,
});

const convoyModal = ref<{ open: boolean; qx: number | null; qy: number | null }>({
  open: false,
  qx: null,
  qy: null,
});

const removeModal = ref<{ open: boolean; location: OverworldLocation | null }>({
  open: false,
  location: null,
});

const removeConvoyModal = ref<{ open: boolean; convoy: OverworldConvoy | null }>({
  open: false,
  convoy: null,
});

const imageUrls = ref<Partial<Record<OverworldRegionId, string>>>({});
const loadedKeys = new Map<OverworldRegionId, string>();

const regions = computed((): OverworldRegion[] => {
  const list = gameState.value?.campaign?.overworldRegions;
  if (list && list.length === 3) return list;
  return [{ id: "west" }, { id: "center" }, { id: "east" }];
});

const party = computed(() => gameState.value?.campaign?.overworldParty ?? defaultOverworldParty());
const atDis = computed(() => party.value.atDis === true);
const locations = computed(() => gameState.value?.campaign?.overworldLocations ?? []);
const convoys = computed(() => gameState.value?.campaign?.overworldConvoys ?? []);
const locationByKey = computed(() => {
  const map = new Map<string, OverworldLocation>();
  for (const loc of locations.value) {
    map.set(`${loc.qx},${loc.qy}`, loc);
  }
  return map;
});
const convoyByKey = computed(() => {
  const map = new Map<string, OverworldConvoy[]>();
  for (const convoy of convoys.value) {
    const key = `${convoy.qx},${convoy.qy}`;
    const existing = map.get(key);
    if (existing) existing.push(convoy);
    else map.set(key, [convoy]);
  }
  return map;
});

const occupantsByCell = computed(() => {
  const map = new Map<string, OverworldStackOccupant[]>();
  function add(qx: number, qy: number, occupant: OverworldStackOccupant) {
    const key = `${qx},${qy}`;
    const existing = map.get(key);
    if (existing) existing.push(occupant);
    else map.set(key, [occupant]);
  }
  for (const loc of locations.value) add(loc.qx, loc.qy, { kind: "location", id: loc.id });
  for (const convoy of convoys.value) add(convoy.qx, convoy.qy, { kind: "convoy", id: convoy.id });
  if (!atDis.value) add(party.value.qx, party.value.qy, { kind: "party" });
  for (const [key, occupants] of map) {
    map.set(key, orderOccupants(occupants));
  }
  return map;
});

const selectedConvoy = computed(
  () => convoys.value.find((c) => c.id === selectedOverworldConvoyId.value) ?? null,
);

const convoyMoveMode = computed(
  () => hasGmCapabilities.value && selectedConvoy.value != null && !travelMode.value && !deployMode.value,
);

const travelDestKeys = computed(() => {
  if (!travelMode.value || atDis.value) return new Set<string>();
  return new Set(
    listOverworldTravelDestinations(party.value).map((d) => `${d.qx},${d.qy}`),
  );
});

const deployDestKeys = computed(() => {
  if (!deployMode.value || !atDis.value) return new Set<string>();
  return new Set(listOverworldDeployDestinations().map((d) => `${d.qx},${d.qy}`));
});

const convoyDestKeys = computed(() => {
  if (!convoyMoveMode.value || !selectedConvoy.value) return new Set<string>();
  return new Set(
    listOverworldConvoyDestinations(selectedConvoy.value, party.value.mapSpeed).map(
      (d) => `${d.qx},${d.qy}`,
    ),
  );
});

const quarterCells = computed(() =>
  Array.from({ length: OVERWORLD_QUARTER_WIDTH * OVERWORLD_QUARTER_HEIGHT }, (_, i) => {
    const qx = i % OVERWORLD_QUARTER_WIDTH;
    const qy = Math.floor(i / OVERWORLD_QUARTER_WIDTH);
    return { key: `${qx},${qy}`, qx, qy };
  }),
);

// Skip the first position apply so load/reconnect doesn't animate from DIS defaults.
const partyTransitionReady = ref(false);

const partyTokenStyle = computed(() => {
  if (atDis.value) {
    return {
      left: `${boardWidthPx / 2}px`,
      top: `${boardHeightPx + DIS_GAP + DIS_NODE * 0.58}px`,
      width: `${QUARTER}px`,
      height: `${QUARTER}px`,
    };
  }
  const occupant = { kind: "party" as const };
  const occupants = occupantsByCell.value.get(`${party.value.qx},${party.value.qy}`) ?? [occupant];
  const slot = slotForOccupant(occupants, occupant, stackSpread.value);
  return {
    left: `${(party.value.qx + slot.fx) * QUARTER}px`,
    top: `${(party.value.qy + slot.fy) * QUARTER}px`,
    width: `${QUARTER}px`,
    height: `${QUARTER}px`,
  };
});

const disLineEnds = computed(() => {
  const topY = 0;
  const bottomY = DIS_GAP + DIS_NODE / 2;
  const disX = boardWidthPx / 2;
  return [
    { x1: boardWidthPx / 6, y1: topY, x2: disX, y2: bottomY },
    { x1: boardWidthPx / 2, y1: topY, x2: disX, y2: bottomY },
    { x1: (boardWidthPx * 5) / 6, y1: topY, x2: disX, y2: bottomY },
  ];
});

function regionFactionName(regionId: OverworldRegionId): string {
  return getFactionForRegion(regionId).name;
}

function isRegionSelected(regionId: OverworldRegionId): boolean {
  return selectedFactionId.value === getFactionForRegion(regionId).id;
}

function isRegionDefeated(regionId: OverworldRegionId): boolean {
  const factionId = getRegionFactionId(regionId);
  if (!factionId) return false;
  return gameState.value?.campaign?.factionStates?.[factionId]?.defeated === true;
}

function onSelectRegion(regionId: OverworldRegionId) {
  if (consumeSuppressMapPingClick()) return;
  if (travelMode.value || deployMode.value || convoyMoveMode.value) return;
  selectOverworldLocation(null);
  selectFaction(getFactionForRegion(regionId).id);
}

function isTravelDest(qx: number, qy: number): boolean {
  return travelDestKeys.value.has(`${qx},${qy}`);
}

function isDeployDest(qx: number, qy: number): boolean {
  return deployDestKeys.value.has(`${qx},${qy}`);
}

function isConvoyDest(qx: number, qy: number): boolean {
  return convoyDestKeys.value.has(`${qx},${qy}`);
}

function isHitDest(qx: number, qy: number): boolean {
  return isTravelDest(qx, qy) || isDeployDest(qx, qy) || isConvoyDest(qx, qy);
}

function onQuarterClick(qx: number, qy: number) {
  if (deployMode.value) {
    if (!isDeployDest(qx, qy)) {
      deployMode.value = false;
      return;
    }
    send({ type: "overworldCampaignAction", action: { kind: "deployToHell", qx, qy } });
    deployMode.value = false;
    return;
  }
  if (travelMode.value) {
    if (!isTravelDest(qx, qy)) {
      travelMode.value = false;
      return;
    }
    if (party.value.fuel < OVERWORLD_TRAVEL_FUEL_COST) {
      showToast("Not enough fuel", "error");
      return;
    }
    send({ type: "overworldCampaignAction", action: { kind: "travel", qx, qy } });
    travelMode.value = false;
    return;
  }
  if (convoyMoveMode.value && selectedConvoy.value) {
    if (!isConvoyDest(qx, qy)) {
      selectOverworldConvoy(null);
      return;
    }
    send({
      type: "overworldConvoyAction",
      action: { kind: "move", convoyId: selectedConvoy.value.id, qx, qy },
    });
  }
}

function closeContextMenu() {
  contextMenu.value = { open: false, x: 0, y: 0, qx: 0, qy: 0, items: [] };
}

function onBoardContextMenu(e: MouseEvent) {
  if (!hasGmCapabilities.value || travelMode.value || deployMode.value) return;
  e.preventDefault();
  const board = e.currentTarget as HTMLElement;
  const rect = board.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    closeContextMenu();
    return;
  }
  const qx = Math.floor(((e.clientX - rect.left) / rect.width) * OVERWORLD_QUARTER_WIDTH);
  const qy = Math.floor(((e.clientY - rect.top) / rect.height) * OVERWORLD_QUARTER_HEIGHT);
  if (
    !Number.isInteger(qx) ||
    !Number.isInteger(qy) ||
    qx < 0 ||
    qy < 0 ||
    qx >= OVERWORLD_QUARTER_WIDTH ||
    qy >= OVERWORLD_QUARTER_HEIGHT
  ) {
    closeContextMenu();
    return;
  }
  const existingLoc = locationByKey.value.get(`${qx},${qy}`);
  const existingConvoys = convoyByKey.value.get(`${qx},${qy}`) ?? [];
  const items: BoardContextMenuItem[] = [];
  if (existingLoc) {
    items.push({ id: "remove-location", label: "Remove location", danger: true });
  } else {
    items.push({ id: "place-location", label: "Place location" });
  }
  items.push({ id: "deploy-convoy", label: "Deploy convoy" });
  if (existingConvoys.length > 0) {
    items.push({ id: "remove-convoy", label: "Remove convoy", danger: true });
  }
  contextMenu.value = {
    open: true,
    x: e.clientX,
    y: e.clientY,
    qx,
    qy,
    items,
  };
}

function onContextMenuSelect(id: string) {
  const { qx, qy } = contextMenu.value;
  closeContextMenu();
  if (id === "place-location") {
    placeModal.value = { open: true, qx, qy };
    return;
  }
  if (id === "deploy-convoy") {
    convoyModal.value = { open: true, qx, qy };
    return;
  }
  if (id === "remove-location") {
    const existing = locationByKey.value.get(`${qx},${qy}`);
    if (!existing) return;
    removeModal.value = { open: true, location: existing };
    return;
  }
  if (id === "remove-convoy") {
    const atCell = convoyByKey.value.get(`${qx},${qy}`) ?? [];
    const selectedId = selectedOverworldConvoyId.value;
    const existing =
      (selectedId ? atCell.find((c) => c.id === selectedId) : undefined) ??
      [...atCell].sort((a, b) => a.id.localeCompare(b.id))[0];
    if (!existing) return;
    removeConvoyModal.value = { open: true, convoy: existing };
  }
}

function closePlaceModal() {
  placeModal.value = { open: false, qx: null, qy: null };
}

function closeConvoyModal() {
  convoyModal.value = { open: false, qx: null, qy: null };
}

function closeRemoveModal() {
  removeModal.value = { open: false, location: null };
}

function closeRemoveConvoyModal() {
  removeConvoyModal.value = { open: false, convoy: null };
}

function confirmRemoveLocation() {
  const loc = removeModal.value.location;
  if (!loc) return;
  send({ type: "overworldLocationAction", action: { kind: "remove", locationId: loc.id } });
  closeRemoveModal();
}

function confirmRemoveConvoy() {
  const convoy = removeConvoyModal.value.convoy;
  if (!convoy) return;
  send({ type: "overworldConvoyAction", action: { kind: "remove", convoyId: convoy.id } });
  if (selectedOverworldConvoyId.value === convoy.id) selectOverworldConvoy(null);
  closeRemoveConvoyModal();
}

function locationMarkerStyle(loc: OverworldLocation) {
  const occupant = { kind: "location" as const, id: loc.id };
  const occupants = occupantsByCell.value.get(`${loc.qx},${loc.qy}`) ?? [occupant];
  const slot = slotForOccupant(occupants, occupant, stackSpread.value);
  return {
    left: `${(loc.qx + slot.fx) * QUARTER}px`,
    top: `${(loc.qy + slot.fy) * QUARTER - LOCATION_MARKER_Y_NUDGE}px`,
    width: `${QUARTER}px`,
    height: `${QUARTER}px`,
  };
}

function convoyMarkerStyle(convoy: OverworldConvoy) {
  const occupant = { kind: "convoy" as const, id: convoy.id };
  const occupants = occupantsByCell.value.get(`${convoy.qx},${convoy.qy}`) ?? [occupant];
  const slot = slotForOccupant(occupants, occupant, stackSpread.value);
  return {
    left: `${(convoy.qx + slot.fx) * QUARTER}px`,
    top: `${(convoy.qy + slot.fy) * QUARTER}px`,
    width: `${QUARTER}px`,
    height: `${QUARTER}px`,
  };
}

function catalogLocation(loc: OverworldLocation): FactionLocation | undefined {
  const faction = getFactionById(loc.factionId);
  if (!faction) return undefined;
  return [...faction.startingLocations, ...faction.uniqueLocations].find(
    (entry) => entry.name === loc.name,
  );
}

function formatLocationQuality(quality: Partial<FactionQualityDots> | undefined): string {
  if (!quality) return "";
  return FACTION_QUALITY_KEYS.filter((key) => quality[key] != null)
    .map((key) => `${key.charAt(0).toUpperCase() + key.slice(1)} ${quality[key]}`)
    .join(", ");
}

function locationHoverMeta(loc: FactionLocation): string {
  const parts: string[] = [];
  if (loc.type) parts.push(loc.type);
  const q = formatLocationQuality(loc.quality);
  if (q) parts.push(q);
  return parts.join(" · ");
}

const locationMarkers = computed(() =>
  locations.value.map((loc) => {
    const infoVisible = hasGmCapabilities.value || isLocationInfoVisibleToPlayers(loc);
    const catalog = infoVisible ? catalogLocation(loc) : undefined;
    return {
      loc,
      label: infoVisible ? loc.name : "Location",
      hoverMeta: catalog ? locationHoverMeta(catalog) : "",
      infoVisible,
    };
  }),
);

const convoyMarkers = computed(() =>
  convoys.value.map((convoy) => {
    const infoVisible = hasGmCapabilities.value || convoy.infoVisibleToPlayers;
    const typeInfo = infoVisible ? getConvoyTypeInfo(convoy.type) : undefined;
    return {
      convoy,
      label: typeInfo?.name ?? "Convoy",
      infoVisible,
    };
  }),
);

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (travelMode.value) travelMode.value = false;
    if (deployMode.value) deployMode.value = false;
    if (contextMenu.value.open) closeContextMenu();
    if (selectedOverworldConvoyId.value) selectOverworldConvoy(null);
    else if (selectedOverworldLocationId.value) selectOverworldLocation(null);
  }
}

const {
  scale,
  fitScale,
  stageStyle,
  isTransformed,
  fitToView,
  panToRect,
  restoreOrFit,
  onWheel,
  observeViewport,
  disconnect,
} = useBoardViewport(viewportEl, contentWidthPx, contentHeightPx, isReady, viewportKey);

const stackSpread = computed(() => stackSpreadFromZoom(fitScale.value, scale.value));

function onLocationClick(loc: OverworldLocation) {
  if (consumeSuppressMapPingClick()) return;
  if (travelMode.value || deployMode.value) return;
  if (convoyMoveMode.value) return;
  if (selectedOverworldLocationId.value === loc.id) {
    selectOverworldLocation(null);
    return;
  }
  selectOverworldLocation(loc.id);
  panToRect(loc.qx * QUARTER, loc.qy * QUARTER + QUARTER / 6, QUARTER, QUARTER);

  const infoVisible = hasGmCapabilities.value || isLocationInfoVisibleToPlayers(loc);
  if (!infoVisible) {
    selectFaction(loc.factionId);
    return;
  }

  const faction = getFactionById(loc.factionId);
  if (!faction) {
    selectFaction(loc.factionId);
    return;
  }
  if (faction.startingLocations.some((entry) => entry.name === loc.name)) {
    revealFactionLocation(loc.factionId, loc.name, "starting");
    return;
  }
  if (faction.uniqueLocations.some((entry) => entry.name === loc.name)) {
    revealFactionLocation(loc.factionId, loc.name, "unique");
    return;
  }
  selectFaction(loc.factionId);
}

function onConvoyClick(convoy: OverworldConvoy) {
  if (consumeSuppressMapPingClick()) return;
  if (travelMode.value || deployMode.value) return;
  if (selectedOverworldConvoyId.value === convoy.id) {
    selectOverworldConvoy(null);
    return;
  }
  selectFaction(null);
  selectOverworldConvoy(convoy.id);
  panToRect(convoy.qx * QUARTER, convoy.qy * QUARTER, QUARTER, QUARTER);
}

function clearBoardEntitySelection() {
  if (consumeSuppressMapPingClick()) return;
  clearOverworldEntitySelection();
}

function quarterFromClientPoint(clientX: number, clientY: number): { x: number; y: number } | null {
  const board = overworldBoardEl.value;
  if (!board) return null;
  const rect = board.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const qx = Math.floor(((clientX - rect.left) / rect.width) * OVERWORLD_QUARTER_WIDTH);
  const qy = Math.floor(((clientY - rect.top) / rect.height) * OVERWORLD_QUARTER_HEIGHT);
  if (
    !Number.isInteger(qx) ||
    !Number.isInteger(qy) ||
    qx < 0 ||
    qy < 0 ||
    qx >= OVERWORLD_QUARTER_WIDTH ||
    qy >= OVERWORLD_QUARTER_HEIGHT
  ) {
    return null;
  }
  return { x: qx, y: qy };
}

function canStartOverworldMapPing(): boolean {
  if (travelMode.value || deployMode.value || convoyMoveMode.value) return false;
  if (contextMenu.value.open) return false;
  if (
    placeModal.value.open ||
    convoyModal.value.open ||
    removeModal.value.open ||
    removeConvoyModal.value.open
  ) {
    return false;
  }
  return true;
}

function onOverworldPingPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement;
  if (target.closest(".region-edit-btn, .reset-zoom-btn")) return;
  beginMapPingHold({
    e,
    surface: "overworld",
    getCell: quarterFromClientPoint,
    canStart: canStartOverworldMapPing,
  });
}

function overworldPingStyle(qx: number, qy: number) {
  const size = QUARTER * 0.9;
  return {
    left: `${qx * QUARTER + QUARTER / 2}px`,
    top: `${qy * QUARTER + QUARTER / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
  };
}

function onViewportWheel(e: WheelEvent) {
  onWheel(e);
}

const showQuarters = computed(
  () =>
    travelMode.value ||
    deployMode.value ||
    convoyMoveMode.value ||
    (fitScale.value > 0 && scale.value / fitScale.value >= 2),
);

watch(viewportEl, (el, prev) => {
  observeViewport(el, prev);
});

watch(
  () => activeMainTab.value,
  (tab) => {
    if (tab === "overworld") nextTick(restoreOrFit);
    else {
      travelMode.value = false;
      deployMode.value = false;
      clearOverworldEntitySelection();
    }
  },
);

watch([travelMode, deployMode], ([travel, deploy]) => {
  if (travel || deploy) clearOverworldEntitySelection();
});

watch(locations, (list) => {
  if (
    selectedOverworldLocationId.value &&
    !list.some((loc) => loc.id === selectedOverworldLocationId.value)
  ) {
    selectOverworldLocation(null);
  }
});

watch(convoys, (list) => {
  if (
    selectedOverworldConvoyId.value &&
    !list.some((c) => c.id === selectedOverworldConvoyId.value)
  ) {
    selectOverworldConvoy(null);
  }
});

watch(atDis, (inDis) => {
  if (inDis) travelMode.value = false;
  else deployMode.value = false;
});

watch(
  () => gameState.value?.campaign?.overworldParty,
  (p) => {
    if (!p || partyTransitionReady.value) return;
    nextTick(() => {
      partyTransitionReady.value = true;
    });
  },
  { immediate: true },
);

async function syncRegionImages(list: OverworldRegion[]) {
  const nextUrls: Partial<Record<OverworldRegionId, string>> = { ...imageUrls.value };
  const keep = new Set<OverworldRegionId>();

  for (const region of list) {
    keep.add(region.id);
    const key = region.imageKey;
    if (!key) {
      const prev = nextUrls[region.id];
      if (prev) URL.revokeObjectURL(prev);
      delete nextUrls[region.id];
      loadedKeys.delete(region.id);
      continue;
    }
    if (loadedKeys.get(region.id) === key && nextUrls[region.id]) continue;
    const prev = nextUrls[region.id];
    if (prev) URL.revokeObjectURL(prev);
    const url = await fetchRegionImageUrl(key);
    if (url) {
      nextUrls[region.id] = url;
      loadedKeys.set(region.id, key);
    } else {
      delete nextUrls[region.id];
      loadedKeys.delete(region.id);
    }
  }

  for (const id of Object.keys(nextUrls) as OverworldRegionId[]) {
    if (!keep.has(id)) {
      const prev = nextUrls[id];
      if (prev) URL.revokeObjectURL(prev);
      delete nextUrls[id];
      loadedKeys.delete(id);
    }
  }

  imageUrls.value = nextUrls;
}

watch(
  regions,
  (list) => {
    void syncRegionImages(list);
  },
  { immediate: true, deep: true },
);

onMounted(() => {
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown);
  disconnect();
  for (const url of Object.values(imageUrls.value)) {
    if (url) URL.revokeObjectURL(url);
  }
});

function resetZoom() {
  clearOverworldEntitySelection();
  fitToView(true);
}

function openUpload(regionId: OverworldRegionId) {
  if (!hasGmCapabilities.value || uploadingRegionId.value) return;
  pendingUploadRegionId.value = regionId;
  fileInputEl.value?.click();
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const regionId = pendingUploadRegionId.value;
  input.value = "";
  pendingUploadRegionId.value = null;
  if (!file || !regionId) return;

  uploadingRegionId.value = regionId;
  try {
    const key = await uploadRegionImage(file);
    if (!key) {
      showToast("Failed to upload region image", "error");
      return;
    }
    send({ type: "setOverworldRegionImage", regionId, imageKey: key });
  } finally {
    uploadingRegionId.value = null;
  }
}

const gridCells = computed(() =>
  Array.from({ length: OVERWORLD_WIDTH * OVERWORLD_HEIGHT }, (_, i) => i),
);
</script>

<template>
  <div class="overworld-root">
    <div class="overworld-side-stack">
      <OverworldReconOverlay v-model:travel-mode="travelMode" v-model:deploy-mode="deployMode" />
      <OverworldGmIchorOverlay v-if="isGm" />
    </div>
    <input
      ref="fileInputEl"
      class="region-file-input"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      @change="onFileSelected"
    />
    <div
      ref="viewportEl"
      class="overworld-viewport"
      @wheel.prevent="onViewportWheel"
      @click="clearBoardEntitySelection"
    >
      <div
        class="overworld-stage"
        :style="[
          stageStyle,
          { width: `${contentWidthPx}px`, height: `${contentHeightPx}px` },
        ]"
      >
        <div
          ref="overworldBoardEl"
          class="overworld-board"
          :style="{ width: `${boardWidthPx}px`, height: `${boardHeightPx}px` }"
          @contextmenu="onBoardContextMenu"
          @pointerdown="onOverworldPingPointerDown"
        >
          <div class="regions">
            <div
              v-for="region in regions"
              :key="region.id"
              class="region"
              :class="{
                'region--empty': !imageUrls[region.id],
                'region--selected': isRegionSelected(region.id),
                'region--defeated': isRegionDefeated(region.id),
              }"
              role="button"
              tabindex="0"
              :aria-label="
                regionFactionName(region.id) +
                ' territory' +
                (isRegionDefeated(region.id) ? ', defeated' : '')
              "
              :aria-pressed="isRegionSelected(region.id)"
              @click="onSelectRegion(region.id)"
              @keydown.enter.prevent="onSelectRegion(region.id)"
              @keydown.space.prevent="onSelectRegion(region.id)"
            >
              <img
                v-if="imageUrls[region.id]"
                class="region-image"
                :src="imageUrls[region.id]"
                :alt="regionFactionName(region.id) + ' region'"
                draggable="false"
              />
              <div v-else class="region-placeholder">
                <span class="region-label">{{ regionFactionName(region.id) }}</span>
              </div>
              <div
                v-if="isRegionDefeated(region.id)"
                class="region-defeated-overlay"
                aria-hidden="true"
              >
                <img class="region-skull" :src="skullUrl" alt="" draggable="false" />
              </div>
              <button
                v-if="hasGmCapabilities"
                type="button"
                class="region-edit-btn"
                :class="{ uploading: uploadingRegionId === region.id }"
                :disabled="uploadingRegionId !== null"
                :aria-label="'Upload ' + regionFactionName(region.id) + ' region image'"
                @click.stop="openUpload(region.id)"
              >
                <svg class="region-edit-icon" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.387 8.387L2.5 14.5l1.126-3.666 8.387-8.387z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div
            class="grid-overlay"
            :class="{ 'grid-overlay--quarters': showQuarters }"
            :style="{
              gridTemplateColumns: `repeat(${OVERWORLD_WIDTH}, 1fr)`,
              gridTemplateRows: `repeat(${OVERWORLD_HEIGHT}, 1fr)`,
            }"
            aria-hidden="true"
          >
            <div
              v-for="cell in gridCells"
              :key="cell"
              class="grid-cell"
            />
          </div>
          <div
            v-if="travelMode || deployMode || convoyMoveMode"
            class="quarter-hit-layer"
            :style="{
              gridTemplateColumns: `repeat(${OVERWORLD_QUARTER_WIDTH}, 1fr)`,
              gridTemplateRows: `repeat(${OVERWORLD_QUARTER_HEIGHT}, 1fr)`,
            }"
          >
            <button
              v-for="cell in quarterCells"
              :key="cell.key"
              type="button"
              class="quarter-hit"
              :class="{ 'quarter-hit--dest': isHitDest(cell.qx, cell.qy) }"
              :aria-label="
                isTravelDest(cell.qx, cell.qy)
                  ? `Travel to ${cell.qx}, ${cell.qy}`
                  : isDeployDest(cell.qx, cell.qy)
                    ? `Deploy to ${cell.qx}, ${cell.qy}`
                    : isConvoyDest(cell.qx, cell.qy)
                      ? `Move convoy to ${cell.qx}, ${cell.qy}`
                      : undefined
              "
              :tabindex="isHitDest(cell.qx, cell.qy) ? 0 : -1"
              @click="onQuarterClick(cell.qx, cell.qy)"
            />
          </div>
          <div
            v-for="marker in locationMarkers"
            :key="marker.loc.id"
            class="location-marker"
            :class="{
              'location-marker--selected': selectedOverworldLocationId === marker.loc.id,
              'location-marker--inert': travelMode || deployMode || convoyMoveMode,
            }"
            :style="locationMarkerStyle(marker.loc)"
            role="button"
            tabindex="0"
            :aria-label="marker.label"
            :aria-pressed="selectedOverworldLocationId === marker.loc.id"
            @click.stop="onLocationClick(marker.loc)"
            @keydown.enter.prevent="onLocationClick(marker.loc)"
            @keydown.space.prevent="onLocationClick(marker.loc)"
          >
            <img class="location-marker-icon" :src="locationUrl" alt="" draggable="false" />
            <div class="location-tooltip popover-tooltip">
              <div class="location-tooltip-name">{{ marker.label }}</div>
              <div v-if="marker.hoverMeta" class="location-tooltip-meta">
                {{ marker.hoverMeta }}
              </div>
            </div>
          </div>
          <div
            v-for="marker in convoyMarkers"
            :key="marker.convoy.id"
            class="convoy-marker"
            :class="{
              'convoy-marker--selected': selectedOverworldConvoyId === marker.convoy.id,
              'convoy-marker--inert': travelMode || deployMode,
            }"
            :style="convoyMarkerStyle(marker.convoy)"
            role="button"
            tabindex="0"
            :aria-label="marker.label"
            :aria-pressed="selectedOverworldConvoyId === marker.convoy.id"
            @click.stop="onConvoyClick(marker.convoy)"
            @keydown.enter.prevent="onConvoyClick(marker.convoy)"
            @keydown.space.prevent="onConvoyClick(marker.convoy)"
          >
            <span class="convoy-marker-icon" aria-hidden="true" />
            <div class="location-tooltip popover-tooltip">
              <div class="location-tooltip-name">{{ marker.label }}</div>
            </div>
          </div>
          <div
            v-for="ping in overworldPings"
            :key="ping.fromId"
            class="map-ping"
            :style="overworldPingStyle(ping.x, ping.y)"
            :title="ping.fromName"
            aria-hidden="true"
          />
        </div>
        <div
          class="dis-spur"
          :style="{ width: `${boardWidthPx}px`, height: `${DIS_GAP + DIS_NODE}px` }"
        >
          <svg
            class="dis-lines"
            :viewBox="`0 0 ${boardWidthPx} ${DIS_GAP + DIS_NODE}`"
            aria-hidden="true"
          >
            <line
              v-for="line in disLineEnds"
              :key="`${line.x1},${line.y1}`"
              :x1="line.x1"
              :y1="line.y1"
              :x2="line.x2"
              :y2="line.y2"
            />
          </svg>
          <div
            class="dis-node"
            :style="{ width: `${DIS_NODE}px`, height: `${DIS_NODE}px` }"
            aria-label="DIS"
            title="DIS"
          >
            <span class="dis-node-label">DIS</span>
          </div>
        </div>
        <div
          class="party-token"
          :class="{ 'party-token--no-transition': !partyTransitionReady }"
          :style="partyTokenStyle"
          :aria-label="atDis ? 'Party in DIS' : 'Party'"
          :title="atDis ? 'Party in DIS' : 'Party'"
        >
          <span class="party-token-dot" />
        </div>
      </div>
      <button
        v-if="isTransformed"
        type="button"
        class="reset-zoom-btn"
        @click="resetZoom"
      >
        Reset zoom
      </button>
    </div>

    <BoardContextMenu
      :open="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @select="onContextMenuSelect"
      @close="closeContextMenu"
    />

    <PlaceOverworldLocationModal
      :open="placeModal.open"
      :qx="placeModal.qx"
      :qy="placeModal.qy"
      @close="closePlaceModal"
    />

    <DeployOverworldConvoyModal
      :open="convoyModal.open"
      :qx="convoyModal.qx"
      :qy="convoyModal.qy"
      @close="closeConvoyModal"
    />

    <ModalDialog
      title="Remove location?"
      :open="removeModal.open"
      ok-label="Remove"
      @close="closeRemoveModal"
      @confirm="confirmRemoveLocation"
    >
      <p class="remove-location-copy">
        Remove
        <strong>{{ removeModal.location?.name }}</strong>
        from the overworld map?
      </p>
    </ModalDialog>

    <ModalDialog
      title="Remove convoy?"
      :open="removeConvoyModal.open"
      ok-label="Remove"
      @close="closeRemoveConvoyModal"
      @confirm="confirmRemoveConvoy"
    >
      <p class="remove-location-copy">
        Remove this convoy from the overworld map?
      </p>
    </ModalDialog>
  </div>
</template>

<style scoped>
.overworld-root {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.overworld-side-stack {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.region-file-input {
  display: none;
}

.overworld-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.overworld-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  transform-origin: 0 0;
  will-change: transform;
}

.overworld-board {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  box-sizing: content-box;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  overflow: visible;
}

.map-ping {
  position: absolute;
  z-index: 8;
  pointer-events: none;
  border-radius: 50%;
  border: 2px solid var(--color-accent-bright);
  background: color-mix(in srgb, var(--color-accent) 22%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 35%, transparent);
  transform: translate(-50%, -50%);
  animation: map-ping-pulse 1s ease-out infinite;
}

@keyframes map-ping-pulse {
  0% {
    opacity: 0.95;
    transform: translate(-50%, -50%) scale(0.72);
  }
  70% {
    opacity: 0.35;
    transform: translate(-50%, -50%) scale(1.15);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.28);
  }
}

.dis-spur {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.dis-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}

.dis-lines line {
  stroke: var(--color-border);
  stroke-width: 2;
}

.dis-node {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-popover);
}

.dis-node-label {
  font-family: var(--font-heading);
  font-size: 1.35rem;
  letter-spacing: 0.08em;
  color: var(--color-text);
  pointer-events: none;
}

.regions {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  width: 100%;
  height: 100%;
}

.region {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg);
  cursor: pointer;
}

.region:last-child {
  border-right: none;
}

.region--empty {
  background: var(--color-surface);
}

.region--selected {
  box-shadow: inset 0 0 0 2px var(--color-accent);
  z-index: 1;
}

.region--defeated .region-image,
.region--defeated .region-placeholder {
  filter: grayscale(1) brightness(0.55);
}

.region-defeated-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.region-skull {
  width: min(42%, 7rem);
  height: auto;
  opacity: 0.85;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6));
  pointer-events: none;
  user-select: none;
}

.region:hover .region-placeholder,
.region--selected .region-placeholder {
  color: var(--color-text);
}

.region:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: -2px;
  z-index: 1;
}

.region-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
}

.region-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--color-text-secondary);
}

.region-label {
  text-transform: uppercase;
  font-size: 0.9rem;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

.region-edit-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  opacity: 0.9;
}

.region-edit-btn:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-accent-muted);
}

.region-edit-btn:disabled {
  cursor: wait;
  opacity: 0.6;
}

.region-edit-btn.uploading {
  opacity: 0.5;
}

.region-edit-icon {
  width: 0.9rem;
  height: 0.9rem;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  pointer-events: none;
  z-index: 1;
}

.grid-cell {
  border-right: 2px solid var(--color-border);
  border-bottom: 2px solid var(--color-border);
  opacity: 0.45;
}

.grid-overlay--quarters .grid-cell {
  background-image:
    linear-gradient(var(--color-border), var(--color-border)),
    linear-gradient(var(--color-border), var(--color-border));
  background-size: 1px 100%, 100% 1px;
  background-position: center, center;
  background-repeat: no-repeat;
}

.quarter-hit-layer {
  position: absolute;
  inset: 0;
  display: grid;
  z-index: 3;
}

.quarter-hit {
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: default;
}

.quarter-hit--dest {
  cursor: pointer;
  outline: 1px dashed var(--color-purple-outline-strong);
  outline-offset: -1px;
  background: var(--color-purple-faint-bg);
}

.quarter-hit--dest:hover {
  background: var(--color-accent-hover-bg);
}

.location-marker {
  position: absolute;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  cursor: pointer;
  transform: translate(-50%, -50%) scale(var(--board-icon-counter-scale, 2));
  transform-origin: center;
  transition: left 350ms ease, top 350ms ease;
}

.location-marker:hover,
.location-marker:focus-visible {
  z-index: 6;
}

.location-marker--inert {
  pointer-events: none;
  cursor: default;
}

.location-marker--selected .location-marker-icon {
  filter:
    drop-shadow(0 0 1.5px var(--color-accent))
    drop-shadow(0 0 3px var(--color-accent-bright))
    drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75));
}

.location-marker-icon {
  width: 70%;
  height: 70%;
  object-fit: contain;
  pointer-events: auto;
  user-select: none;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75));
}

.location-marker--inert .location-marker-icon {
  pointer-events: none;
}

.convoy-marker {
  position: absolute;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  cursor: pointer;
  transform: translate(-50%, -50%) scale(var(--board-icon-counter-scale, 2));
  transform-origin: center;
  transition: left 350ms ease, top 350ms ease;
}

.convoy-marker:hover,
.convoy-marker:focus-visible {
  z-index: 6;
}

.convoy-marker--inert {
  pointer-events: none;
  cursor: default;
}

.convoy-marker--selected .convoy-marker-icon {
  box-shadow:
    0 0 0 2px var(--color-accent),
    0 0 6px var(--color-accent-bright);
}

.convoy-marker-icon {
  width: 48%;
  height: 48%;
  border-radius: 3px;
  background: var(--color-danger, #c44);
  border: 2px solid var(--color-bg);
  box-shadow: 0 0 0 1px var(--color-border);
  pointer-events: auto;
  transform: rotate(45deg);
}

.convoy-marker--inert .convoy-marker-icon {
  pointer-events: none;
}

.location-tooltip {
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  opacity: 0;
  transition: opacity 0.12s ease;
  white-space: normal;
  min-width: 140px;
  max-width: 240px;
  text-align: left;
  pointer-events: none;
}

.location-marker:hover .location-tooltip,
.location-marker:focus-visible .location-tooltip,
.convoy-marker:hover .location-tooltip,
.convoy-marker:focus-visible .location-tooltip {
  opacity: 1;
}

.location-tooltip-name {
  font-weight: 600;
  line-height: 1.25;
}

.location-tooltip-meta {
  margin-top: 0.15rem;
  color: var(--color-text-secondary);
  font-size: 0.65rem;
  line-height: 1.3;
}

.party-token {
  position: absolute;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(var(--board-icon-counter-scale, 2));
  transform-origin: center;
  transition: left 350ms ease, top 350ms ease;
}

.party-token--no-transition {
  transition: none;
}

.party-token-dot {
  width: 58%;
  height: 58%;
  border-radius: 50%;
  background: var(--color-accent);
  border: 2px solid var(--color-bg);
  box-shadow: 0 0 0 1px var(--color-accent-bright);
}

.remove-location-copy {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text);
}

.reset-zoom-btn {
  position: absolute;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.reset-zoom-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-accent-muted);
}
</style>
