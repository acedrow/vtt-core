<script setup lang="ts">
import { kataptyNeedsTargetPick } from "@gaem/hellpiercers-content/combat-ui";
import type { PhaseAction } from "@gaem/shared";
import { isPlayerDowned, isSandboxMode, remainingPlayerIds, roundPhaseLabel, turnHolderLabel } from "@gaem/shared";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";

import { useBoardActionMode } from "../composables/useBoardActionMode.js";
import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useCharacterSheetSelection } from "../composables/useCharacterSheetSelection.js";
import { activeTab } from "../composables/useGameConsole.js";
import { useMapSelection } from "../composables/useMapSelection.js";
import { useGameConnection } from "../composables/useGameConnection.js";
import { gameWsUrl, useGameSocket } from "../composables/useGameSocket.js";
import { useGameState } from "../composables/useGameState.js";
import { listClientMainSections } from "../client-content-pack.js";
import { useInfoDataSelection } from "../composables/useInfoDataSelection.js";
import { activeMainTab } from "../composables/useMainSectionTab.js";
import type { MainSectionTab } from "../composables/useMainSectionTab.js";
import { useFactionSelection } from "../composables/useFactionSelection.js";
import { useTableSelection } from "../composables/useTableSelection.js";
import { useSession } from "../composables/useSession.js";
import { showToast } from "../composables/useToasts.js";
import { useMapPing } from "../composables/useMapPing.js";
import { initUiPersistence } from "../composables/uiPersist.js";
import {
  applyPersistedGmTools,
  gmToolsWatchSources,
  snapshotGmTools,
  useGmTools,
} from "../composables/useGmTools.js";
import ActionBar from "./ActionBar.vue";
import GmActionBar from "./GmActionBar.vue";
import ReversalPrompt from "./ReversalPrompt.vue";
import ClassReactionPrompt from "./ClassReactionPrompt.vue";
import GameBoard from "./GameBoard.vue";
import GmToolsToolbar from "./GmToolsToolbar.vue";
import RightPanel from "./RightPanel.vue";
import SideNav from "./SideNav.vue";

const mainSections = listClientMainSections();

const router = useRouter();
const { role, playerProfile, hasGmCapabilities, clearSession } = useSession();
const { selectedSheetId, sheetsExpanded, selectSheet } = useCharacterSheetSelection();
const { selectedMapId, mapsExpanded } = useMapSelection();
const { selectedFactionId, factionsExpanded } = useFactionSelection();
const { selectedTableId, tablesExpanded } = useTableSelection();
const { boardSelection, selectBoardPlayer, clearBoardSelection, selectSheetFromNav } = useBoardSelection();
const {
  dataCategory,
  dataFocus,
  dataFocusReturnCategory,
  dataCategoryReturnFactionId,
  dataExpanded,
  clearDataCategory,
  selectDataCategory,
} = useInfoDataSelection();
const { connection } = useGameConnection();
const { gameState, yourPlayerId, send } = useGameState();
const { setMode } = useBoardActionMode();
useGmTools();
const { remotePingOnTaccom, remotePingOnOverworld } = useMapPing();

const boardOverlaysEl = ref<HTMLElement | null>(null);

const showTaccomPingBadge = computed(
  () => remotePingOnTaccom.value && activeMainTab.value !== "taccom",
);

function sectionShowsPingBadge(sectionId: string): boolean {
  return sectionId === "overworld" && remotePingOnOverworld.value && activeMainTab.value !== "overworld";
}

const playerProfileRef = computed(() => playerProfile.value ?? null);
const sessionRole = computed(() => role.value!);

const { connect, disconnect: disconnectSocket } = useGameSocket({
  wsUrl: gameWsUrl,
  role: sessionRole,
  playerProfile: playerProfileRef,
  selectedSheetId,
  onError: (message) => showToast(message),
});

onMounted(() => {
  initUiPersistence({
    boardSelection,
    selectedSheetId,
    selectedMapId,
    selectedFactionId,
    selectedTableId,
    dataCategory,
    dataFocus,
    dataFocusReturnCategory,
    dataCategoryReturnFactionId,
    activeTab,
    activeMainTab,
    sheetsExpanded,
    dataExpanded,
    mapsExpanded,
    factionsExpanded,
    tablesExpanded,
    snapshotGmTools,
    applyGmTools: applyPersistedGmTools,
    gmToolsWatchSources,
  });
  if (activeMainTab.value === "baseUpgrades") {
    openResourcesPanel();
  }
  connect();
});

const activePackSection = computed(
  () => mainSections.find((section) => section.id === activeMainTab.value) ?? null,
);

onUnmounted(() => {
  disconnectSocket();
});

const mapName = computed(() => gameState.value?.mapName ?? gameState.value?.mapId ?? null);
const sandboxMode = computed(() => gameState.value != null && isSandboxMode(gameState.value));

const centerHeaderTitle = computed(() => {
  if (activePackSection.value) return activePackSection.value.label;
  return mapName.value;
});

const roundStatus = computed(() => {
  const s = gameState.value;
  if (!s) return null;
  return {
    round: s.round,
    phase: roundPhaseLabel(s.roundPhase),
    turn: turnHolderLabel(s),
  };
});

const yourPlayer = computed(() => {
  const s = gameState.value;
  const id = yourPlayerId.value;
  if (!s || !id) return null;
  return s.players.find((p) => p.id === id) ?? null;
});

const phaseAction = computed((): { label: string; action: PhaseAction } | null => {
  const s = gameState.value;
  if (!s || !role.value || isSandboxMode(s)) return null;

  if (s.roundPhase === "taccomNotStarted" && hasGmCapabilities.value) {
    return { label: "Start TACCOM", action: "startTaccom" };
  }
  if (s.roundPhase === "deployment" && hasGmCapabilities.value) {
    return { label: "End deployment", action: "endDeployment" };
  }
  if (s.roundPhase === "startRoundEffects" && hasGmCapabilities.value) {
    return { label: "Do effects", action: "doEffects" };
  }
  if (
    s.roundPhase === "playersChoice" &&
    role.value === "player" &&
    yourPlayerId.value &&
    yourPlayer.value &&
    !isPlayerDowned(yourPlayer.value) &&
    !s.actedPlayerIds.includes(yourPlayerId.value)
  ) {
    return { label: "Take turn", action: "takeTurn" };
  }
  if (
    s.roundPhase === "playerTurn" &&
    role.value === "player" &&
    yourPlayerId.value &&
    s.turn?.role === "player" &&
    s.turn.playerId === yourPlayerId.value
  ) {
    return { label: "End turn", action: "endPlayerTurn" };
  }
  if (s.roundPhase === "gmTurn" && hasGmCapabilities.value) {
    if (remainingPlayerIds(s).length > 0) {
      return { label: "End turn", action: "endGmTurn" };
    }
    return { label: "End turn", action: "countdownTags" };
  }
  if (s.roundPhase === "countdownTags" && hasGmCapabilities.value) {
    return { label: "End round", action: "endRound" };
  }
  return null;
});

const showTaccomWaiting = computed(
  () =>
    !hasGmCapabilities.value &&
    !sandboxMode.value &&
    gameState.value?.roundPhase === "taccomNotStarted",
);

function leave() {
  clearSession();
  router.push("/");
}

function onPhaseAction() {
  if (!phaseAction.value) return;
  const action = phaseAction.value.action;
  if (action === "takeTurn" && yourPlayerId.value) {
    const player = gameState.value?.players.find((p) => p.id === yourPlayerId.value);
    if (player) selectBoardPlayer(player.id, player.characterSheetId);
  }
  if (
    action === "endPlayerTurn" &&
    yourPlayerId.value &&
    gameState.value &&
    kataptyNeedsTargetPick(gameState.value, yourPlayerId.value)
  ) {
    setMode("kataptyPick");
    showToast("Select exactly 3 Katapty targets, then end turn again");
    return;
  }
  send({ type: "phaseAction", action });
}

function openResourcesPanel() {
  clearBoardSelection();
  selectSheet(null);
  selectedFactionId.value = null;
  selectedTableId.value = null;
  selectDataCategory("resources");
  activeTab.value = "info";
}

function openTaccomInfoPanel() {
  if (role.value === "gm") {
    clearBoardSelection();
    selectSheet(null);
    clearDataCategory();
    selectedFactionId.value = null;
    selectedTableId.value = null;
    activeTab.value = "info";
    return;
  }
  if (role.value === "player" && yourPlayerId.value) {
    const player = gameState.value?.players.find((p) => p.id === yourPlayerId.value);
    if (player?.characterSheetId) {
      selectSheetFromNav(player.characterSheetId);
    }
  }
}

function selectMainTab(tab: MainSectionTab) {
  activeMainTab.value = tab;
  if (tab === "baseUpgrades") {
    openResourcesPanel();
  } else if (tab === "taccom") {
    openTaccomInfoPanel();
  }
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="sidebar-content">
        <div
          v-if="hasGmCapabilities && activeMainTab === 'taccom'"
          class="sidebar-gm-tools"
        >
          <GmToolsToolbar />
        </div>
        <div class="sidebar-nav">
          <SideNav />
        </div>
        <div class="sidebar-footer">
          <div class="session-info">
            <span class="role-tag">{{ role === "gm" ? "GM" : "Player" }}</span>
            <span v-if="role === 'player'">{{ playerProfile?.name ?? "—" }}</span>
            <span>Status: <span :class="['status-pill', connection]">{{ connection }}</span></span>
          </div>
          <button class="leave-btn" type="button" @click="leave">
            Leave game
          </button>
        </div>
      </div>
    </aside>

    <main class="main">
      <header v-if="role" class="center-header">
        <div class="center-tabs chrome-tabs">
          <button
            type="button"
            class="chrome-tab"
            :class="{ active: activeMainTab === 'taccom', 'chrome-tab--ping': showTaccomPingBadge }"
            data-tooltip="TACCOM"
            aria-label="TACCOM"
            @click="selectMainTab('taccom')"
          >
            <svg class="chrome-tab-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.25" />
              <path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
              <circle cx="8" cy="8" r="1.25" fill="currentColor" />
            </svg>
            <span v-if="showTaccomPingBadge" class="chrome-tab-ping" aria-hidden="true" />
          </button>
          <button
            v-for="section in mainSections"
            :key="section.id"
            type="button"
            class="chrome-tab"
            :class="{
              active: activeMainTab === section.id,
              'chrome-tab--ping': sectionShowsPingBadge(section.id),
            }"
            :data-tooltip="section.label"
            :aria-label="section.label"
            @click="selectMainTab(section.id)"
          >
            <svg class="chrome-tab-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect
                x="2.5"
                y="2.5"
                width="11"
                height="11"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.25"
              />
              <path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
            </svg>
            <span
              v-if="sectionShowsPingBadge(section.id)"
              class="chrome-tab-ping"
              aria-hidden="true"
            />
          </button>
        </div>
        <h1 class="map-title">{{ centerHeaderTitle }}</h1>
        <p v-if="activeMainTab === 'taccom' && sandboxMode" class="sandbox-badge">Sandbox mode</p>
        <p v-else-if="activeMainTab === 'taccom' && roundStatus" class="round-status">
          Round {{ roundStatus.round }} · {{ roundStatus.phase }} · {{ roundStatus.turn }}
        </p>
        <button
          v-if="activeMainTab === 'taccom' && phaseAction"
          class="phase-action-btn"
          type="button"
          @click="onPhaseAction"
        >
          {{ phaseAction.label }}
        </button>
      </header>
      <div v-if="role && activeMainTab === 'taccom'" class="board-area">
        <p v-if="showTaccomWaiting" class="taccom-waiting">
          Waiting for the GM to start TACCOM.
        </p>
        <template v-else>
          <GameBoard
            :role="role"
            :gm-capabilities="hasGmCapabilities"
            :player-profile="playerProfile"
            :overlay-el="boardOverlaysEl"
          />
          <div ref="boardOverlaysEl" class="board-overlays">
            <ReversalPrompt />
            <ClassReactionPrompt />
            <ActionBar />
            <GmActionBar />
          </div>
        </template>
      </div>
      <template v-for="section in mainSections" :key="section.id">
        <component :is="section.component" v-show="activeMainTab === section.id" />
      </template>
    </main>

    <RightPanel v-if="role" />

  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  max-width: none;
}

.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 12rem;
  flex-shrink: 0;
  min-height: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg);
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sidebar-gm-tools {
  flex-shrink: 0;
}

.sidebar-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.sidebar-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.session-info {
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.role-tag {
  font-size: 0.72rem;
  color: var(--color-warning);
  text-transform: uppercase;
  font-weight: 700;
}

.status-pill {
  display: inline-block;
  width: fit-content;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: capitalize;
}

.status-pill.connecting {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.status-pill.connected {
  background: var(--color-success-muted-bg);
  color: var(--color-success);
}

.status-pill.disconnected {
  background: var(--color-danger-hover-bg);
  color: var(--color-danger);
}

.leave-btn {
  border: 1px solid var(--color-danger-muted-border);
  border-radius: 8px;
  background: var(--color-danger-subtle-bg);
  color: var(--color-danger);
  padding: 0.4rem 0.55rem;
  cursor: pointer;
  font-size: 0.85rem;
}

.leave-btn:hover {
  background: var(--color-danger-hover-bg);
  border-color: var(--color-danger);
}

.main {
  flex: 1;
  padding: 0 0.75rem 0.75rem;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: var(--color-bg);
}

.center-header {
  position: relative;
  z-index: 21;
  box-sizing: border-box;
  min-height: var(--chrome-header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0 -0.75rem;
  padding: 0 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.center-tabs {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  margin-bottom: -1px;
}

.chrome-tab-icon-beaker {
  width: 1.15rem;
  height: 1.15rem;
}

.map-title {
  margin: 0;
  flex-shrink: 0;
}

.round-status,
.sandbox-badge {
  margin: 0;
  flex: 1;
  font-size: 0.9rem;
  text-align: center;
}

.round-status {
  color: var(--color-muted);
}

.sandbox-badge {
  color: var(--color-warning);
  font-weight: 600;
}

.phase-action-btn {
  margin-left: auto;
  flex-shrink: 0;
  border: 1px solid var(--color-accent-muted);
  border-radius: 8px;
  background: var(--color-accent-subtle-bg);
  color: var(--color-accent-bright);
  padding: 0.2rem 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}

.phase-action-btn:hover {
  background: var(--color-accent-hover-bg);
  border-color: var(--color-accent-bright);
}

.board-area {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.taccom-waiting {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 1.5rem;
  color: var(--color-muted);
  font-size: 1.05rem;
  text-align: center;
}

.board-overlays {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 0.75rem;
  pointer-events: none;
}

.board-overlays > * {
  pointer-events: auto;
}
</style>
