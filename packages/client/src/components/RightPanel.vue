<script setup lang="ts">
import { computed } from "vue";

import { getClientDetailPanels } from "../client-content-pack.js";
import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useCharacterSheetSelection } from "../composables/useCharacterSheetSelection.js";
import { selectedFactionId } from "../composables/useFactionSelection.js";
import { activeTab } from "../composables/useGameConsole.js";
import { useGameState } from "../composables/useGameState.js";
import { isEnemyDataCategory, useInfoDataSelection } from "../composables/useInfoDataSelection.js";
import { selectedMapId } from "../composables/useMapSelection.js";
import { selectedTableId } from "../composables/useTableSelection.js";
import { useGmTools } from "../composables/useGmTools.js";
import CharacterSheetPanel from "./CharacterSheetPanel.vue";
import ConvoyInfoPanel from "./ConvoyInfoPanel.vue";
import EnemyInfoPanel from "./EnemyInfoPanel.vue";
import GameConsolePanel from "./GameConsolePanel.vue";
import EffectsPanel from "./EffectsPanel.vue";
import TerrainTypesPanel from "./TerrainTypesPanel.vue";
import GameDataDetailPanel from "./GameDataDetailPanel.vue";
import GmToolOptionsPanel from "./GmToolOptionsPanel.vue";
import InfoSearchPanel from "./InfoSearchPanel.vue";
import MapPanel from "./MapPanel.vue";
import PlayerBoardPanel from "./PlayerBoardPanel.vue";
import PlayerDataPanel from "./PlayerDataPanel.vue";
import PartyResourcesPanel from "./PartyResourcesPanel.vue";
import PatternsPanel from "./PatternsPanel.vue";
import SettingsPanel from "./SettingsPanel.vue";
import TableInfoPanel from "./TableInfoPanel.vue";
import TileBrushGalleryOverlay from "./TileBrushGalleryOverlay.vue";
import TurnOrderPanel from "./TurnOrderPanel.vue";
import { selectedOverworldConvoyId } from "../composables/useOverworldEntitySelection.js";

const { selectedSheetId, gearPickCategory } = useCharacterSheetSelection();
const { boardSelection } = useBoardSelection();
const { dataCategory, dataFocus, dataFocusReturnCategory } = useInfoDataSelection();
const { gameState } = useGameState();
const { activeTool } = useGmTools();
const {
  factionInfo: FactionInfoPanel,
  factionEnemies: FactionEnemiesPanel,
  overworldLocationVisibility: OverworldLocationVisibilityPanel,
} = getClientDetailPanels();

const boardPlayerSheetId = computed(() => {
  if (boardSelection.value?.kind !== "player") return null;
  const player = gameState.value?.players.find((p) => p.id === boardSelection.value!.id);
  return player?.characterSheetId ?? null;
});

const activeSheetId = computed(() => boardPlayerSheetId.value ?? selectedSheetId.value);
</script>

<template>
  <aside class="right-panel">
    <div class="chrome-tabs">
        <button
          type="button"
          class="chrome-tab"
          :class="{ active: activeTab === 'console' }"
          data-tooltip="Console"
          aria-label="Console"
          @click="activeTab = 'console'"
        >
          <svg class="chrome-tab-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" stroke="currentColor" stroke-width="1.25" />
            <path d="M9.5 5.5L6.5 10.5" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
          </svg>
        </button>
        <button
          type="button"
          class="chrome-tab"
          :class="{ active: activeTab === 'info' }"
          data-tooltip="Info"
          aria-label="Info"
          @click="activeTab = 'info'"
        >
          <svg class="chrome-tab-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.25" />
            <circle cx="8" cy="5.25" r="0.75" fill="currentColor" />
            <path d="M8 7.25v4" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
          </svg>
        </button>
        <button
          type="button"
          class="chrome-tab"
          :class="{ active: activeTab === 'turnOrder' }"
          data-tooltip="Turn order"
          aria-label="Turn order"
          @click="activeTab = 'turnOrder'"
        >
          <svg class="chrome-tab-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 2.5h8M4 13.5h8" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" />
            <path
              d="M6 2.5v2.25l2 2.25-2 2.25v2.25M10 2.5v2.25l-2 2.25 2 2.25v2.25"
              stroke="currentColor"
              stroke-width="1.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="chrome-tab"
          :class="{ active: activeTab === 'settings' }"
          data-tooltip="Settings"
          aria-label="Settings"
          @click="activeTab = 'settings'"
        >
          <svg class="chrome-tab-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M9.75 4.25a0.65 0.65 0 0 0 0 0.95l1.05 1.05a0.65 0.65 0 0 0 0.95 0l2.5-2.5a4 4 0 0 1-5.3 5.3l-4.6 4.6a1.4 1.4 0 0 1-2-2l4.6-4.6a4 4 0 0 1 5.3-5.3l-2.5 2.5z"
              stroke="currentColor"
              stroke-width="1.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <div class="tab-body">
        <GameConsolePanel v-if="activeTab === 'console'" />
        <div v-show="activeTab === 'info'" id="info-pane" class="info-pane">
          <TileBrushGalleryOverlay />
          <GmToolOptionsPanel
            v-if="activeTool"
            :key="activeTool"
          />
          <EnemyInfoPanel
            v-else-if="boardSelection?.kind === 'enemy'"
            :key="`board:${boardSelection.id}`"
            :enemy-id="boardSelection.id"
          />
          <PlayerBoardPanel
            v-else-if="boardSelection?.kind === 'player' && !boardPlayerSheetId"
            :key="boardSelection.id"
            :player-id="boardSelection.id"
          />
          <EnemyInfoPanel
            v-else-if="dataFocus?.kind === 'enemy'"
            :key="`bestiary:${dataFocus.name}`"
            :enemy-name="dataFocus.name"
            :show-back="!!dataFocusReturnCategory && isEnemyDataCategory(dataFocusReturnCategory)"
          />
          <GameDataDetailPanel
            v-else-if="dataFocus"
            :key="`${dataFocus.kind}:${dataFocus.name}`"
            :focus="dataFocus"
          />
          <PatternsPanel
            v-else-if="dataCategory === 'patterns'"
            key="patterns"
          />
          <component
            :is="FactionEnemiesPanel"
            v-else-if="FactionEnemiesPanel && dataCategory && isEnemyDataCategory(dataCategory)"
            :key="dataCategory"
            :faction-id="dataCategory"
          />
          <EffectsPanel
            v-else-if="dataCategory === 'effects'"
            key="effects"
          />
          <TerrainTypesPanel
            v-else-if="dataCategory === 'terrain'"
            key="terrain"
          />
          <PartyResourcesPanel
            v-else-if="dataCategory === 'resources'"
            key="resources"
          />
          <PlayerDataPanel
            v-else-if="gearPickCategory"
            :key="`pick-${gearPickCategory}`"
            :category="gearPickCategory"
          />
          <PlayerDataPanel
            v-else-if="dataCategory === 'armor' || dataCategory === 'classes' || dataCategory === 'weapons' || dataCategory === 'equipment' || dataCategory === 'gear'"
            :key="dataCategory"
            :category="dataCategory"
          />
          <ConvoyInfoPanel
            v-else-if="selectedOverworldConvoyId"
            :key="selectedOverworldConvoyId"
            :convoy-id="selectedOverworldConvoyId"
          />
          <template v-else-if="selectedFactionId">
            <component :is="OverworldLocationVisibilityPanel" v-if="OverworldLocationVisibilityPanel" />
            <component
              :is="FactionInfoPanel"
              v-if="FactionInfoPanel"
              :key="selectedFactionId"
              :faction-id="selectedFactionId"
            />
          </template>
          <TableInfoPanel
            v-else-if="selectedTableId"
            :key="selectedTableId"
          />
          <MapPanel
            v-else-if="selectedMapId"
            :key="selectedMapId"
            :map-id="selectedMapId"
          />
          <CharacterSheetPanel
            v-else-if="activeSheetId"
            :key="activeSheetId"
            :sheet-id="activeSheetId"
          />
          <InfoSearchPanel v-else />
        </div>
        <TurnOrderPanel v-if="activeTab === 'turnOrder'" />
        <SettingsPanel v-if="activeTab === 'settings'" />
      </div>
  </aside>
</template>

<style scoped>
.right-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 22rem;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border);
  background: var(--color-bg);
  overflow: hidden;
}

.right-panel :deep(.panel) {
  flex: 1;
  min-height: 0;
}

.right-panel .chrome-tabs {
  position: relative;
  z-index: 2;
  border-bottom: 1px solid var(--color-border);
  padding: 0 0.5rem;
}

.right-panel .chrome-tab {
  flex: 1;
}

.tab-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.info-pane {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
