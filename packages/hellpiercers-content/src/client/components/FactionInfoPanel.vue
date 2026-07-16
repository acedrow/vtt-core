<script setup lang="ts">
import {
  FACTION_QUALITY_KEYS,
  defaultGmIchor,
  factionHasEnemyListings,
  getFactionById,
  isFactionUniqueLocationUnlocked,
  isFactionUpgradeUnlocked,
  resolveRuleTermTooltip,
  type FactionId,
  type FactionLocation,
  type FactionQualityDots,
  type FactionStratcomAction,
  type FactionUpgrade,
} from "@gaem/shared";
import { computed, nextTick, ref, watch } from "vue";

import { useBoardSelection } from "@gaem/client/composables/useBoardSelection.js";
import { useExpandableSet } from "@gaem/client/composables/useExpandableSet.js";
import { pendingFactionLocationReveal } from "@gaem/client/composables/useFactionSelection.js";
import { useGameState } from "@gaem/client/composables/useGameState.js";
import { useInfoDataSelection } from "@gaem/client/composables/useInfoDataSelection.js";
import { useSession } from "@gaem/client/composables/useSession.js";
import { showToast } from "@gaem/client/composables/useToasts.js";
import BoardContextMenu, { type BoardContextMenuItem } from "@gaem/client/components/BoardContextMenu.vue";
import PanelShell from "@gaem/client/components/PanelShell.vue";
import RuleTerm from "@gaem/client/components/RuleTerm.vue";
import RuleText from "@gaem/client/components/RuleText.vue";

type UnlockTarget =
  | { kind: "upgrade"; name: string }
  | { kind: "uniqueLocation"; name: string };

const props = defineProps<{
  factionId: FactionId;
}>();

const { closeRightPanel } = useBoardSelection();
const { isExpanded, toggle, expand } = useExpandableSet();
const { gameState, send } = useGameState();
const { selectDataCategory } = useInfoDataSelection();
const { isGm } = useSession();

const panelScrollEl = ref<HTMLElement | null>(null);

const faction = computed(() => getFactionById(props.factionId));

const canTrackUnlocks = computed(
  () => props.factionId === "paracletus" || props.factionId === "autophyes",
);

const hasEnemies = computed(() => factionHasEnemyListings(props.factionId));

const liveState = computed(() => gameState.value?.campaign?.factionStates?.[props.factionId] ?? null);

const gmIchor = computed(() => gameState.value?.campaign?.gmIchor ?? defaultGmIchor());

const crownValue = computed(() => liveState.value?.crown ?? faction.value?.crown ?? 5);

const contextMenu = ref<{
  open: boolean;
  x: number;
  y: number;
  items: BoardContextMenuItem[];
  target: UnlockTarget | null;
}>({ open: false, x: 0, y: 0, items: [], target: null });

function qualityValue(key: keyof FactionQualityDots): number {
  if (liveState.value) return liveState.value[key];
  return faction.value?.qualities[key] ?? 0;
}

function qualityLabel(key: keyof FactionQualityDots): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatQuality(quality: Partial<FactionQualityDots> | undefined): string {
  if (!quality) return "";
  return FACTION_QUALITY_KEYS.filter((key) => quality[key] != null)
    .map((key) => `${qualityLabel(key)} ${quality[key]}`)
    .join(", ");
}

function locationMeta(loc: FactionLocation): string {
  const parts: string[] = [];
  if (loc.type) parts.push(loc.type);
  if (loc.buildTime != null) parts.push(`Build ${"Θ".repeat(loc.buildTime)}`);
  const q = formatQuality(loc.quality);
  if (q) parts.push(q);
  if (loc.requires) parts.push(`Requires ${loc.requires}`);
  return parts.join(" · ");
}

function stratcomMeta(action: FactionStratcomAction): string {
  const parts: string[] = [];
  if (action.crownCost != null) parts.push(`Crown ${"Θ".repeat(action.crownCost)}`);
  if (action.requires) parts.push(`Requires ${action.requires}`);
  return parts.join(" · ");
}

function upgradeMeta(upgrade: FactionUpgrade): string {
  const parts = [`Ichor ${upgrade.ichorCost}`];
  if (upgrade.requires) parts.push(`Requires ${upgrade.requires}`);
  return parts.join(" · ");
}

function sectionKey(section: string): string {
  return `section:${section}`;
}

function itemKey(section: string, name: string): string {
  return `${section}:${name}`;
}

function isUpgradeUnlocked(name: string): boolean {
  return liveState.value != null && isFactionUpgradeUnlocked(liveState.value, name);
}

function isUniqueLocationUnlocked(name: string): boolean {
  return liveState.value != null && isFactionUniqueLocationUnlocked(liveState.value, name);
}

function onCrownAdjust(delta: number) {
  if (!isGm.value) return;
  send({
    type: "factionCampaignAction",
    action: { kind: "adjustCrown", factionId: props.factionId, delta },
  });
}

function onQualityAdjust(quality: keyof FactionQualityDots, delta: number) {
  if (!isGm.value) return;
  send({
    type: "factionCampaignAction",
    action: { kind: "adjustQuality", factionId: props.factionId, quality, delta },
  });
}

const isDefeated = computed(() => liveState.value?.defeated === true);

function onDefeatedToggle(defeated: boolean) {
  if (!isGm.value) return;
  send({
    type: "factionCampaignAction",
    action: { kind: "setDefeated", factionId: props.factionId, defeated },
  });
}

function openEnemies() {
  const id = props.factionId;
  if (!factionHasEnemyListings(id)) return;
  if (id !== "autophyes" && id !== "paracletus") return;
  selectDataCategory(id, { returnToFaction: id });
}

function closeContextMenu() {
  contextMenu.value = { open: false, x: 0, y: 0, items: [], target: null };
}

function onUpgradeContextMenu(e: MouseEvent, upgrade: FactionUpgrade) {
  if (!isGm.value || !canTrackUnlocks.value || isDefeated.value) return;
  e.preventDefault();
  const unlocked = isUpgradeUnlocked(upgrade.name);
  contextMenu.value = {
    open: true,
    x: e.clientX,
    y: e.clientY,
    target: { kind: "upgrade", name: upgrade.name },
    items: unlocked
      ? [{ id: "lock", label: "Lock upgrade", danger: true }]
      : [{ id: "unlock", label: `Unlock (−${upgrade.ichorCost} Ichor)` }],
  };
}

function onUniqueLocationContextMenu(e: MouseEvent, loc: FactionLocation) {
  if (!isGm.value || !canTrackUnlocks.value || isDefeated.value) return;
  e.preventDefault();
  const unlocked = isUniqueLocationUnlocked(loc.name);
  contextMenu.value = {
    open: true,
    x: e.clientX,
    y: e.clientY,
    target: { kind: "uniqueLocation", name: loc.name },
    items: unlocked
      ? [{ id: "lock", label: "Lock unique location", danger: true }]
      : [{ id: "unlock", label: "Unlock unique location" }],
  };
}

function onContextMenuSelect(id: string) {
  const target = contextMenu.value.target;
  const factionId = props.factionId;
  closeContextMenu();
  if (!target || !isGm.value) return;

  if (target.kind === "upgrade") {
    const upgrade = faction.value?.upgrades.find((u) => u.name === target.name);
    if (!upgrade) return;
    if (id === "unlock") {
      if (upgrade.requires && !isUniqueLocationUnlocked(upgrade.requires)) {
        showToast(`Requires ${upgrade.requires}`);
        return;
      }
      if (gmIchor.value < upgrade.ichorCost) {
        showToast("Insufficient ichor");
        return;
      }
      send({
        type: "factionCampaignAction",
        action: { kind: "unlockUpgrade", factionId, upgradeName: target.name },
      });
      return;
    }
    if (id === "lock") {
      send({
        type: "factionCampaignAction",
        action: { kind: "lockUpgrade", factionId, upgradeName: target.name },
      });
    }
    return;
  }

  const loc = faction.value?.uniqueLocations.find((l) => l.name === target.name);
  if (id === "unlock") {
    if (loc?.requires && !isUpgradeUnlocked(loc.requires)) {
      showToast(`Requires ${loc.requires}`);
      return;
    }
    send({
      type: "factionCampaignAction",
      action: { kind: "unlockUniqueLocation", factionId, locationName: target.name },
    });
    return;
  }
  if (id === "lock") {
    send({
      type: "factionCampaignAction",
      action: { kind: "lockUniqueLocation", factionId, locationName: target.name },
    });
  }
}

const crownTooltip = resolveRuleTermTooltip("Crown");
const qualitiesTooltip = resolveRuleTermTooltip("Qualities");
const qualityTooltips = Object.fromEntries(
  FACTION_QUALITY_KEYS.map((key) => [key, resolveRuleTermTooltip(qualityLabel(key))]),
) as Record<keyof FactionQualityDots, ReturnType<typeof resolveRuleTermTooltip>>;

watch(
  pendingFactionLocationReveal,
  async (reveal) => {
    if (!reveal || reveal.factionId !== props.factionId) return;
    const section = sectionKey(reveal.section);
    const item = itemKey(reveal.section, reveal.locationName);
    expand(section);
    expand(item);
    await nextTick();
    const el = panelScrollEl.value?.querySelector<HTMLElement>(
      `[data-location-key="${CSS.escape(item)}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (pendingFactionLocationReveal.value?.token === reveal.token) {
      pendingFactionLocationReveal.value = null;
    }
  },
  { immediate: true },
);
</script>

<template>
  <PanelShell
    v-if="faction"
    :title="faction.name"
    close-variant="ghost"
    @close="closeRightPanel"
  >
    <div ref="panelScrollEl" class="panel-scroll">
      <header class="faction-header">
        <div class="crown-row">
          <div class="crown-text">
            <RuleTerm text="Crown" :tooltip="crownTooltip" />
            <span class="theta-row" aria-hidden="true">
              <span class="theta-filled">{{ "Θ".repeat(crownValue) }}</span><span class="theta-empty">{{ "Θ".repeat(5 - crownValue) }}</span>
            </span>
            <span class="faction-tagline">{{ faction.tagline }}</span>
          </div>
          <div v-if="isGm && !isDefeated" class="stepper">
            <button
              type="button"
              class="step-btn"
              :disabled="crownValue <= 1"
              @click="onCrownAdjust(-1)"
            >
              −
            </button>
            <button
              type="button"
              class="step-btn"
              :disabled="crownValue >= 5"
              @click="onCrownAdjust(1)"
            >
              +
            </button>
          </div>
        </div>
        <p class="item-description"><RuleText :text="faction.description" /></p>
        <div class="qualities">
          <div class="qualities-heading">
            <RuleTerm text="Qualities" :tooltip="qualitiesTooltip" />
          </div>
          <div
            v-for="key in FACTION_QUALITY_KEYS"
            :key="key"
            class="quality-row"
          >
            <div class="quality-label-value">
              <RuleTerm
                :text="qualityLabel(key)"
                :tooltip="qualityTooltips[key]"
              />
              <span class="theta-row" aria-hidden="true">
                <span class="theta-filled">{{ "Θ".repeat(qualityValue(key)) }}</span><span class="theta-empty">{{ "Θ".repeat(5 - qualityValue(key)) }}</span>
              </span>
            </div>
            <div v-if="isGm && !isDefeated" class="stepper">
              <button
                type="button"
                class="step-btn"
                :disabled="qualityValue(key) <= 0"
                @click="onQualityAdjust(key, -1)"
              >
                −
              </button>
              <button
                type="button"
                class="step-btn"
                :disabled="qualityValue(key) >= 5"
                @click="onQualityAdjust(key, 1)"
              >
                +
              </button>
            </div>
          </div>
        </div>
        <div v-if="faction.uniqueMechanics?.length" class="mechanics">
          <p
            v-for="mech in faction.uniqueMechanics"
            :key="mech.name"
            class="mechanic"
          >
            <span class="mechanic-name">{{ mech.name }}</span>
            <RuleText :text="mech.effect" />
          </p>
        </div>
      </header>

      <section class="faction-section">
        <button
          type="button"
          class="section-toggle"
          :class="{ expanded: isExpanded(sectionKey('starting')) }"
          @click="toggle(sectionKey('starting'))"
        >
          <span>Starting Locations</span>
          <span class="chevron" aria-hidden="true">
            {{ isExpanded(sectionKey("starting")) ? "▾" : "▸" }}
          </span>
        </button>
        <div v-if="isExpanded(sectionKey('starting'))" class="section-body">
          <article
            v-for="loc in faction.startingLocations"
            :key="loc.name"
            class="list-card"
            :data-location-key="itemKey('starting', loc.name)"
          >
            <button
              type="button"
              class="list-card-header"
              :class="{ expanded: isExpanded(itemKey('starting', loc.name)) }"
              @click="toggle(itemKey('starting', loc.name))"
            >
              <span class="item-header">
                <span class="item-name">{{ loc.name }}</span>
                <span v-if="locationMeta(loc)" class="item-meta">{{ locationMeta(loc) }}</span>
              </span>
              <span class="chevron" aria-hidden="true">
                {{ isExpanded(itemKey("starting", loc.name)) ? "▾" : "▸" }}
              </span>
            </button>
            <div v-if="isExpanded(itemKey('starting', loc.name))" class="list-card-body">
              <p class="item-description"><RuleText :text="loc.description" /></p>
              <p v-if="loc.purpose" class="detail"><span class="detail-label">Purpose</span> {{ loc.purpose }}</p>
              <p v-if="loc.terrain" class="detail"><span class="detail-label">Terrain</span> {{ loc.terrain }}</p>
              <p v-if="loc.defenses" class="detail"><span class="detail-label">Defenses</span> {{ loc.defenses }}</p>
              <p v-if="loc.requires" class="detail"><span class="detail-label">Requires</span> {{ loc.requires }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="faction-section">
        <button
          type="button"
          class="section-toggle"
          :class="{ expanded: isExpanded(sectionKey('unique')) }"
          @click="toggle(sectionKey('unique'))"
        >
          <span>Unique Locations</span>
          <span class="chevron" aria-hidden="true">
            {{ isExpanded(sectionKey("unique")) ? "▾" : "▸" }}
          </span>
        </button>
        <div v-if="isExpanded(sectionKey('unique'))" class="section-body">
          <article
            v-for="loc in faction.uniqueLocations"
            :key="loc.name"
            class="list-card"
            :class="{ 'list-card--unlocked': isUniqueLocationUnlocked(loc.name) }"
            :data-location-key="itemKey('unique', loc.name)"
            @contextmenu="onUniqueLocationContextMenu($event, loc)"
          >
            <button
              type="button"
              class="list-card-header"
              :class="{ expanded: isExpanded(itemKey('unique', loc.name)) }"
              @click="toggle(itemKey('unique', loc.name))"
            >
              <span class="item-header">
                <span class="item-name">{{ loc.name }}</span>
                <span v-if="locationMeta(loc)" class="item-meta">{{ locationMeta(loc) }}</span>
              </span>
              <span class="chevron" aria-hidden="true">
                {{ isExpanded(itemKey("unique", loc.name)) ? "▾" : "▸" }}
              </span>
            </button>
            <div v-if="isExpanded(itemKey('unique', loc.name))" class="list-card-body">
              <p class="item-description"><RuleText :text="loc.description" /></p>
              <p v-if="loc.purpose" class="detail"><span class="detail-label">Purpose</span> {{ loc.purpose }}</p>
              <p v-if="loc.terrain" class="detail"><span class="detail-label">Terrain</span> {{ loc.terrain }}</p>
              <p v-if="loc.defenses" class="detail"><span class="detail-label">Defenses</span> {{ loc.defenses }}</p>
              <p v-if="loc.requires" class="detail"><span class="detail-label">Requires</span> {{ loc.requires }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="faction-section">
        <button
          type="button"
          class="section-toggle"
          :class="{ expanded: isExpanded(sectionKey('stratcom')) }"
          @click="toggle(sectionKey('stratcom'))"
        >
          <span>STRATCOM Actions</span>
          <span class="chevron" aria-hidden="true">
            {{ isExpanded(sectionKey("stratcom")) ? "▾" : "▸" }}
          </span>
        </button>
        <div v-if="isExpanded(sectionKey('stratcom'))" class="section-body">
          <article
            v-for="action in faction.stratcomActions"
            :key="action.name"
            class="list-card"
          >
            <button
              type="button"
              class="list-card-header"
              :class="{ expanded: isExpanded(itemKey('stratcom', action.name)) }"
              @click="toggle(itemKey('stratcom', action.name))"
            >
              <span class="item-header">
                <span class="item-name">{{ action.name }}</span>
                <span v-if="stratcomMeta(action)" class="item-meta">{{ stratcomMeta(action) }}</span>
              </span>
              <span class="chevron" aria-hidden="true">
                {{ isExpanded(itemKey("stratcom", action.name)) ? "▾" : "▸" }}
              </span>
            </button>
            <div v-if="isExpanded(itemKey('stratcom', action.name))" class="list-card-body">
              <p v-if="action.flavor" class="flavor"><RuleText :text="action.flavor" /></p>
              <p class="item-description">
                <RuleText :text="action.description" />
              </p>
            </div>
          </article>
        </div>
      </section>

      <section class="faction-section">
        <button
          type="button"
          class="section-toggle"
          :class="{ expanded: isExpanded(sectionKey('upgrades')) }"
          @click="toggle(sectionKey('upgrades'))"
        >
          <span>Upgrades</span>
          <span class="chevron" aria-hidden="true">
            {{ isExpanded(sectionKey("upgrades")) ? "▾" : "▸" }}
          </span>
        </button>
        <div v-if="isExpanded(sectionKey('upgrades'))" class="section-body">
          <article
            v-for="upgrade in faction.upgrades"
            :key="upgrade.name"
            class="list-card"
            :class="{ 'list-card--unlocked': isUpgradeUnlocked(upgrade.name) }"
            @contextmenu="onUpgradeContextMenu($event, upgrade)"
          >
            <button
              type="button"
              class="list-card-header"
              :class="{ expanded: isExpanded(itemKey('upgrades', upgrade.name)) }"
              @click="toggle(itemKey('upgrades', upgrade.name))"
            >
              <span class="item-header">
                <span class="item-name">{{ upgrade.name }}</span>
                <span class="item-meta">{{ upgradeMeta(upgrade) }}</span>
              </span>
              <span class="chevron" aria-hidden="true">
                {{ isExpanded(itemKey("upgrades", upgrade.name)) ? "▾" : "▸" }}
              </span>
            </button>
            <div v-if="isExpanded(itemKey('upgrades', upgrade.name))" class="list-card-body">
              <p v-if="upgrade.flavor" class="flavor"><RuleText :text="upgrade.flavor" /></p>
              <p class="item-description">
                <RuleText :text="upgrade.effect" />
              </p>
            </div>
          </article>
        </div>
      </section>

      <section v-if="hasEnemies" class="faction-section">
        <button type="button" class="section-toggle" @click="openEnemies">
          <span>Enemies</span>
          <span class="chevron" aria-hidden="true">→</span>
        </button>
      </section>

      <div v-if="isGm" class="defeated-footer">
        <label class="defeated-toggle">
          <span class="defeated-label">Defeated</span>
          <button
            type="button"
            role="switch"
            class="toggle"
            :class="{ on: isDefeated }"
            :aria-checked="isDefeated"
            @click="onDefeatedToggle(!isDefeated)"
          >
            <span class="toggle-thumb" />
          </button>
        </label>
      </div>
    </div>

    <BoardContextMenu
      :open="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @select="onContextMenuSelect"
      @close="closeContextMenu"
    />
  </PanelShell>
</template>

<style scoped>
.panel-scroll {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}

.faction-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--color-border);
}

.crown-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.75rem;
}

.crown-text {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.5rem;
  min-width: 0;
}

.faction-tagline {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-accent);
}

.qualities {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.qualities-heading {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
}

.quality-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.75rem;
}

.quality-label-value {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-width: 0;
}

.theta-row {
  font-size: 0.9rem;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.theta-filled {
  color: var(--color-text);
}

.theta-empty {
  color: var(--color-muted);
}

.stepper .step-btn + .step-btn {
  border-left: 1px solid var(--color-border);
}

.mechanics {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.mechanic {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.mechanic-name {
  display: block;
  font-weight: 600;
  color: var(--color-text);
}

.faction-section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.4rem 0.15rem;
  border: none;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.section-toggle:hover {
  color: var(--color-accent);
}

.section-body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.item-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  min-width: 0;
}

.item-meta {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.chevron {
  color: var(--color-muted);
  font-size: 1.25rem;
  flex-shrink: 0;
}

.flavor {
  margin: 0 0 0.5rem;
  font-style: italic;
  color: var(--color-text-secondary);
}

.detail {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.detail-label {
  display: inline-block;
  margin-right: 0.35rem;
  font-weight: 600;
  color: var(--color-text);
}

.list-card--unlocked {
  border-color: var(--color-success-outline);
  background: var(--color-success-muted-bg);
}

.list-card--unlocked .list-card-header {
  background: var(--color-success-muted-bg);
}

.defeated-footer {
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.defeated-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.defeated-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.toggle {
  position: relative;
  width: 2.25rem;
  height: 1.25rem;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface-raised);
  padding: 0;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
}

.toggle.on {
  background: var(--color-success-dark);
  border-color: var(--color-success-bright);
}

.toggle-thumb {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: var(--color-text);
  transition: transform 0.15s;
}

.toggle.on .toggle-thumb {
  transform: translateX(1rem);
}
</style>
