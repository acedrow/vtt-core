<script setup lang="ts">
import {
  BASE_UPGRADES,
  BASE_UPGRADE_CARD_HEIGHT,
  BASE_UPGRADE_CARD_WIDTH,
  canAffordUpgradeConstruction,
  defaultPartyResources,
  type BaseUpgrade,
  type BaseUpgradeCost,
} from "@gaem/shared";
import { computed, nextTick, onUnmounted, ref, watch } from "vue";

import { useBoardViewport } from "@gaem/client/composables/useBoardViewport.js";
import { useGameState } from "@gaem/client/composables/useGameState.js";
import { activeMainTab } from "@gaem/client/composables/useMainSectionTab.js";
import { showToast } from "@gaem/client/composables/useToasts.js";
import BoardContextMenu, { type BoardContextMenuItem } from "@gaem/client/components/BoardContextMenu.vue";

const CARD_W = BASE_UPGRADE_CARD_WIDTH;
const CARD_H = BASE_UPGRADE_CARD_HEIGHT;
const CANVAS_PAD = 80;

const upgradeById = new Map(BASE_UPGRADES.map((u) => [u.id, u]));

const { gameState, send } = useGameState();

const viewportEl = ref<HTMLElement | null>(null);
const viewportKey = ref("base-upgrades");
const isReady = ref(true);

const partyResources = computed(() => gameState.value?.campaign?.partyResources ?? defaultPartyResources());

const constructedSet = computed(
  () => new Set(gameState.value?.campaign?.constructedBaseUpgrades ?? []),
);

const contentWidthPx = computed(() => {
  let maxX = 0;
  for (const u of BASE_UPGRADES) {
    maxX = Math.max(maxX, u.layout.x + CARD_W);
  }
  return maxX + CANVAS_PAD;
});

const contentHeightPx = computed(() => {
  let maxY = 0;
  for (const u of BASE_UPGRADES) {
    maxY = Math.max(maxY, u.layout.y + CARD_H);
  }
  return maxY + CANVAS_PAD;
});

const {
  stageStyle,
  isTransformed,
  fitToView,
  focusOnRect,
  restoreOrFit,
  onWheel,
  observeViewport,
  disconnect,
} = useBoardViewport(viewportEl, contentWidthPx, contentHeightPx, isReady, viewportKey);

watch(viewportEl, (el, prev) => {
  observeViewport(el, prev);
});

watch(
  () => activeMainTab.value,
  (tab) => {
    if (tab === "baseUpgrades") nextTick(restoreOrFit);
  },
);

onUnmounted(() => {
  disconnect();
});

type Connection = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const connections = computed((): Connection[] => {
  const lines: Connection[] = [];
  for (const upgrade of BASE_UPGRADES) {
    for (const prereqId of upgrade.prerequisites) {
      const prereq = upgradeById.get(prereqId);
      if (!prereq) continue;
      lines.push({
        x1: prereq.layout.x + CARD_W / 2,
        y1: prereq.layout.y + CARD_H,
        x2: upgrade.layout.x + CARD_W / 2,
        y2: upgrade.layout.y,
      });
    }
  }
  return lines;
});

const optionGroups: { key: keyof BaseUpgrade["options"]; label: string }[] = [
  { key: "weapons", label: "Weaponry" },
  { key: "armor", label: "Armor" },
  { key: "classes", label: "Classes" },
  { key: "equipment", label: "Equipment" },
  { key: "gear", label: "Gear" },
  { key: "haloSystems", label: "HALO System" },
];

const contextMenu = ref<{
  open: boolean;
  x: number;
  y: number;
  items: BoardContextMenuItem[];
  upgradeId?: string;
}>({ open: false, x: 0, y: 0, items: [] });

const zoomedUpgradeId = ref<string | null>(null);

function costParts(cost: BaseUpgradeCost): string[] {
  const parts: string[] = [];
  if (cost.hellsteel) parts.push(`${cost.hellsteel} Hellsteel`);
  if (cost.soulfire) parts.push(`${cost.soulfire} Soulfire`);
  if (cost.brimstone) parts.push(`${cost.brimstone} Brimstone`);
  return parts;
}

function visibleOptions(upgrade: BaseUpgrade) {
  return optionGroups.filter((g) => upgrade.options[g.key].length > 0);
}

function isConstructed(upgradeId: string): boolean {
  return constructedSet.value.has(upgradeId);
}

function onCardContextMenu(e: MouseEvent, upgrade: BaseUpgrade) {
  e.preventDefault();
  const built = isConstructed(upgrade.id);
  contextMenu.value = {
    open: true,
    x: e.clientX,
    y: e.clientY,
    upgradeId: upgrade.id,
    items: built
      ? [{ id: "demolish", label: "Demolish building", danger: true }]
      : [{ id: "construct", label: "Construct building" }],
  };
}

function closeContextMenu() {
  contextMenu.value = { open: false, x: 0, y: 0, items: [] };
}

function onContextMenuSelect(id: string) {
  const upgradeId = contextMenu.value.upgradeId;
  closeContextMenu();
  if (!upgradeId) return;
  const upgrade = upgradeById.get(upgradeId);
  if (!upgrade) return;

  if (id === "construct") {
    const constructed = gameState.value?.campaign?.constructedBaseUpgrades ?? [];
    if (!canAffordUpgradeConstruction(partyResources.value, constructed, upgradeId)) {
      showToast("Insufficient resources");
      return;
    }
    send({ type: "baseCampaignAction", action: { kind: "construct", upgradeId } });
  } else if (id === "demolish") {
    send({ type: "baseCampaignAction", action: { kind: "demolish", upgradeId } });
  }
}

function resetZoom() {
  zoomedUpgradeId.value = null;
  fitToView(true);
}

function onViewportDblClick(e: MouseEvent) {
  if (e.target !== e.currentTarget) return;
  if (zoomedUpgradeId.value || isTransformed.value) resetZoom();
}

function onStageDblClick() {
  if (zoomedUpgradeId.value || isTransformed.value) resetZoom();
}

function onCardDblClick(upgrade: BaseUpgrade) {
  if (zoomedUpgradeId.value === upgrade.id) {
    resetZoom();
    return;
  }
  zoomedUpgradeId.value = upgrade.id;
  focusOnRect(upgrade.layout.x, upgrade.layout.y, CARD_W, CARD_H);
}
</script>

<template>
  <div class="base-upgrades-root">
    <div
      ref="viewportEl"
      class="base-upgrades-viewport"
      @wheel.prevent="onWheel"
      @dblclick="onViewportDblClick"
    >
        <div
          class="base-upgrades-stage"
          :style="[
            stageStyle,
            { width: `${contentWidthPx}px`, height: `${contentHeightPx}px` },
          ]"
          @dblclick="onStageDblClick"
        >
          <svg
            class="base-upgrades-connections"
            :width="contentWidthPx"
            :height="contentHeightPx"
            aria-hidden="true"
          >
            <line
              v-for="(line, i) in connections"
              :key="i"
              :x1="line.x1"
              :y1="line.y1"
              :x2="line.x2"
              :y2="line.y2"
              class="connection-line"
            />
          </svg>
          <article
            v-for="upgrade in BASE_UPGRADES"
            :key="upgrade.id"
            class="upgrade-card list-card"
            :class="{ 'upgrade-card--constructed': isConstructed(upgrade.id) }"
            :style="{ left: `${upgrade.layout.x}px`, top: `${upgrade.layout.y}px` }"
            @contextmenu="onCardContextMenu($event, upgrade)"
            @dblclick.stop="onCardDblClick(upgrade)"
          >
            <header class="upgrade-card-header">
              <h2 class="upgrade-card-title">{{ upgrade.name }}</h2>
              <div class="upgrade-card-meta">
                <span v-if="isConstructed(upgrade.id)" class="upgrade-built-chip">Built</span>
                <div v-if="costParts(upgrade.cost).length" class="upgrade-costs">
                  <span
                    v-for="part in costParts(upgrade.cost)"
                    :key="part"
                    class="upgrade-cost-chip"
                  >{{ part }}</span>
                </div>
              </div>
            </header>
            <div class="upgrade-card-body">
              <p class="upgrade-flavor">{{ upgrade.flavor }}</p>
              <p class="upgrade-unlock">{{ upgrade.primaryUnlock }}</p>
              <div
                v-for="group in visibleOptions(upgrade)"
                :key="group.key"
                class="upgrade-option-group"
              >
                <span class="upgrade-option-label">{{ group.label }}</span>
                <ul class="upgrade-option-list">
                  <li v-for="item in upgrade.options[group.key]" :key="item">{{ item }}</li>
                </ul>
              </div>
            </div>
          </article>
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
  </div>
</template>

<style scoped>
.base-upgrades-root {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.base-upgrades-viewport {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.base-upgrades-stage {
  position: relative;
  transform-origin: 0 0;
  will-change: transform;
}

.base-upgrades-connections {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.connection-line {
  stroke: var(--color-border);
  stroke-width: 2;
}

.upgrade-card {
  position: absolute;
  width: v-bind('`${CARD_W}px`');
  min-height: v-bind('`${CARD_H}px`');
  z-index: 1;
  user-select: none;
}

.upgrade-card--constructed {
  border-color: var(--color-success-outline);
  background: var(--color-success-muted-bg);
}

.upgrade-card--constructed .upgrade-card-header {
  background: var(--color-success-muted-bg);
  border-bottom-color: var(--color-success-outline);
}

.upgrade-card-header {
  padding: 0.85rem 0.85rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.upgrade-card-title {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1.6rem;
  font-weight: 500;
  line-height: 1.3;
  color: var(--color-text);
  letter-spacing: 0.05rem;
}

.upgrade-card-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.45rem;
}

.upgrade-built-chip {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--color-success-muted-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-outline);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.upgrade-costs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.upgrade-cost-chip {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--color-accent-subtle-bg);
  color: var(--color-accent-bright);
  border: 1px solid var(--color-accent-muted);
}

.upgrade-card-body {
  padding: 0.65rem 0.75rem;
  font-size: 0.8rem;
  color: var(--color-muted);
}

.upgrade-flavor {
  margin: 0 0 0.6rem;
  font-style: italic;
  line-height: 1.4;
}

.upgrade-unlock {
  margin: 0 0 0.6rem;
  color: var(--color-text);
  line-height: 1.4;
}

.upgrade-option-group {
  margin-top: 0.45rem;
}

.upgrade-option-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text);
  margin-bottom: 0.2rem;
}

.upgrade-option-list {
  margin: 0;
  padding-left: 1.1rem;
  line-height: 1.35;
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
