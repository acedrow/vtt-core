<script setup lang="ts">
import {
  getFactionById,
  isEnemyCrownGated,
  isEnemyUpgradeLocked,
  listEnemyListingsForFaction,
  type EnemyListing,
  type FactionId,
} from "@gaem/shared";
import { computed } from "vue";

import { useApi } from "@gaem/client/composables/useApi.js";
import { useBoardSelection } from "@gaem/client/composables/useBoardSelection.js";
import { useEnemySpawnSelection } from "@gaem/client/composables/useEnemySpawnSelection.js";
import { useExpandableSet } from "@gaem/client/composables/useExpandableSet.js";
import { useGameState } from "@gaem/client/composables/useGameState.js";
import { useInfoDataSelection } from "@gaem/client/composables/useInfoDataSelection.js";
import { useSession } from "@gaem/client/composables/useSession.js";
import { useStainGeyserPlacement } from "@gaem/client/composables/useStainGeyserPlacement.js";
import PanelShell from "@gaem/client/components/PanelShell.vue";
import RuleText from "@gaem/client/components/RuleText.vue";

const props = defineProps<{
  factionId: FactionId;
}>();

const { hasGmCapabilities } = useSession();
const { closeRightPanel } = useBoardSelection();
const { selectedSpawnEnemyName, selectSpawnEnemy } = useEnemySpawnSelection();
const { stainGeyserPlacementActive } = useStainGeyserPlacement();
const { dataCategoryReturnFactionId, goBackFromDataCategory } = useInfoDataSelection();
const { enemyPortraitUrl } = useApi();
const { gameState } = useGameState();

const enemies = computed(() => listEnemyListingsForFaction(props.factionId));
const factionLabel = computed(() => getFactionById(props.factionId)?.name ?? props.factionId);
const { isExpanded, toggle } = useExpandableSet();

const showBack = computed(() => dataCategoryReturnFactionId.value != null);

const factionState = computed(() => gameState.value?.campaign?.factionStates?.[props.factionId] ?? null);
const factionCrown = computed(() => factionState.value?.crown ?? 5);

function showLockedTag(enemy: EnemyListing): boolean {
  return isEnemyUpgradeLocked(enemy, factionState.value);
}

function crownGateLabel(enemy: EnemyListing): string | null {
  if (!isEnemyCrownGated(enemy, factionCrown.value) || enemy.crown == null) return null;
  return `${"Θ".repeat(enemy.crown)} < Crowns`;
}
</script>

<template>
  <PanelShell
    :title="`Enemies — ${factionLabel}`"
    close-variant="ghost"
    :show-back="showBack"
    @close="closeRightPanel"
    @back="goBackFromDataCategory"
  >
    <p v-if="hasGmCapabilities && stainGeyserPlacementActive" class="spawn-hint">
      Click to place the stain area (Esc to skip).
    </p>
    <p v-else-if="hasGmCapabilities && selectedSpawnEnemyName" class="spawn-hint">
      Click an empty walkable tile to spawn {{ selectedSpawnEnemyName }}.
    </p>

    <div class="panel-scroll">
      <div class="list-block">
        <article
          v-for="enemy in enemies"
          :key="enemy.name"
          class="list-card"
          :class="{ selected: hasGmCapabilities && selectedSpawnEnemyName === enemy.name }"
        >
          <button
            type="button"
            class="list-card-header"
            :class="{ expanded: isExpanded(enemy.name) }"
            @click="toggle(enemy.name)"
          >
            <span class="header-main">
              <span class="enemy-name">{{ enemy.name }}</span>
              <span class="enemy-tags">
                <span v-for="tag in enemy.tags ?? []" :key="tag" class="enemy-tag">{{ tag }}</span>
                <span v-if="showLockedTag(enemy)" class="enemy-tag enemy-tag--locked">Locked</span>
                <span
                  v-if="crownGateLabel(enemy)"
                  class="enemy-tag enemy-tag--crown"
                >{{ crownGateLabel(enemy) }}</span>
              </span>
            </span>
            <span class="chevron" aria-hidden="true">{{ isExpanded(enemy.name) ? "▾" : "▸" }}</span>
          </button>

          <div v-if="isExpanded(enemy.name)" class="list-card-body">
            <img
              v-if="enemyPortraitUrl(enemy)"
              :src="enemyPortraitUrl(enemy)!"
              :alt="enemy.name"
              class="enemy-portrait"
            />

            <p v-if="enemy.summary" class="enemy-summary">
              <RuleText :text="enemy.summary" />
            </p>

            <div class="stats">
              <span v-if="hasGmCapabilities" class="stat">HP: {{ enemy.hp }}</span>
              <span v-if="enemy.crown != null" class="stat">Crown: {{ enemy.crown }}</span>
              <span v-if="enemy.scale != null" class="stat">Scale: {{ enemy.scale }}</span>
              <span v-if="enemy.speed != null" class="stat">Speed: {{ enemy.speed }}</span>
              <span v-if="enemy.actions" class="stat">Actions: {{ enemy.actions }}</span>
              <span v-if="hasGmCapabilities && enemy.agnosiaHp != null" class="stat">Agnosia HP: {{ enemy.agnosiaHp }}</span>
            </div>

            <p v-if="enemy.title" class="enemy-title">{{ enemy.title }}</p>
            <p v-if="enemy.codename" class="codename"><em>{{ enemy.codename }}</em></p>
            <p v-if="enemy.description" class="item-description">
              <RuleText :text="enemy.description" />
            </p>

            <p v-for="(attack, i) in enemy.attacks" :key="`${enemy.name}-attack-${i}`" class="ability">
              <span class="ability-label">Attack {{ i + 1 }}</span>
              <RuleText :text="attack.text" />
            </p>
            <p v-if="enemy.agnosia" class="ability">
              <span class="ability-label">Agnosia</span>
              <RuleText :text="enemy.agnosia" />
            </p>
            <p v-if="enemy.special" class="ability">
              <span class="ability-label">Special</span>
              <RuleText :text="enemy.special" />
            </p>
            <p v-if="enemy.stainwalk" class="ability">
              <span class="ability-label">Stainwalk</span>
              <RuleText :text="enemy.stainwalk" />
            </p>

            <button
              v-if="hasGmCapabilities"
              type="button"
              class="spawn-btn"
              :class="{ active: selectedSpawnEnemyName === enemy.name }"
              @click="selectSpawnEnemy(enemy.name)"
            >
              {{ selectedSpawnEnemyName === enemy.name ? "Selected for spawn" : "Spawn on board" }}
            </button>
          </div>
        </article>
      </div>
    </div>
  </PanelShell>
</template>

<style scoped>
.spawn-hint {
  margin: 0 0 0.65rem;
  font-size: 0.8rem;
  color: var(--color-accent-bright);
  flex-shrink: 0;
}

.panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.list-block {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.list-card.selected {
  border-color: var(--color-accent-muted);
}

.header-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  min-width: 0;
  flex: 1;
}

.enemy-name {
  font-weight: 700;
  line-height: 1.3;
}

.enemy-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-width: 0;
  flex: 1 1 auto;
}

.enemy-tag {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
}

.enemy-tag--locked,
.enemy-tag--crown {
  background: var(--color-surface-raised);
}

.chevron {
  flex-shrink: 0;
  color: var(--color-muted);
  font-size: 1.5rem;
  line-height: 1;
}

.enemy-summary {
  margin: 0 0 0.5rem;
  font-weight: 600;
  color: var(--color-text);
}

.enemy-portrait {
  display: block;
  width: 100%;
  max-height: 180px;
  object-fit: contain;
  margin-bottom: 0.65rem;
  border-radius: 8px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  margin-bottom: 0.5rem;
}

.stat {
  font-size: 0.8rem;
  color: var(--color-muted);
  font-weight: 600;
}

.enemy-title {
  margin: 0 0 0.35rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-text);
}

.codename {
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.ability {
  margin: 0.5rem 0 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--color-text-secondary);
}

.spawn-btn {
  margin-top: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.35rem 0.65rem;
  cursor: pointer;
}

.spawn-btn:hover {
  background: var(--color-surface-hover);
}

.spawn-btn.active {
  border-color: var(--color-accent-muted);
  color: var(--color-accent-bright);
}
</style>
