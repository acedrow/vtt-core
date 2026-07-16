<script setup lang="ts">
import { getEffectiveEnemyHp, getEffectiveEnemyMaxHp, getSwarmMemberHp, getSwarmMaxHp, getSwarmMovementRemaining, getYadathanTowerDef, isTowerEnemy, swarmGroupForEnemy } from "@gaem/hellpiercers-content/combat-ui";
import { getEnemyBossActionBudget, getEnemyListingByName, getEnemyScale, getEnemySpeed, isAutoResolvableEnemyAttack, isDirectTargetEnemyAttack, isPatternEnemyAttack, isSelectTargetEnemyAttack } from "@gaem/shared";
import { computed } from "vue";

import { useBoardActionMode } from "../composables/useBoardActionMode.js";
import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useCombatActions } from "../composables/useCombatActions.js";
import { useGameState } from "../composables/useGameState.js";
import { useInfoDataSelection } from "../composables/useInfoDataSelection.js";
import { useApi } from "../composables/useApi.js";
import { useEnemySpawnSelection } from "../composables/useEnemySpawnSelection.js";
import { useEnemyPortraitColors } from "../composables/useEnemyPortraitColors.js";
import { useSession } from "../composables/useSession.js";
import { useStainGeyserPlacement } from "../composables/useStainGeyserPlacement.js";
import { useGorgenautAgnosiaPlacement } from "../composables/useGorgenautAgnosiaPlacement.js";
import HpBar from "./HpBar.vue";
import PanelShell from "./PanelShell.vue";
import RuleText from "./RuleText.vue";

const props = defineProps<{
  enemyId?: string;
  enemyName?: string;
  showBack?: boolean;
}>();

const { hasGmCapabilities } = useSession();
const { enemyPortraitUrl } = useApi();
const { portraitBackgroundFor, colors: enemyPortraitColors } = useEnemyPortraitColors();
const { showGmCombatUi } = useCombatActions();
const { gameState, send } = useGameState();
const { closeRightPanel, boardSelection } = useBoardSelection();
const { startGmEnemyAttack, startGmSwarmAttack } = useBoardActionMode();
const { goBackFromDataFocus } = useInfoDataSelection();
const { selectedSpawnEnemyName, selectSpawnEnemy } = useEnemySpawnSelection();
const { stainGeyserPlacementActive } = useStainGeyserPlacement();
const { gorgenautAgnosiaPlacementActive } = useGorgenautAgnosiaPlacement();

const activeEnemy = computed(() =>
  props.enemyId ? gameState.value?.enemies.find((e) => e.id === props.enemyId) : undefined,
);

const listing = computed(() =>
  getEnemyListingByName(activeEnemy.value?.name ?? props.enemyName),
);

const towerDef = computed(() => {
  const enemy = activeEnemy.value;
  if (enemy && !isTowerEnemy(enemy)) return undefined;
  const name = enemy?.name ?? props.enemyName;
  if (!name) return undefined;
  if (enemy || !listing.value) return getYadathanTowerDef(name);
  return undefined;
});

const portraitUrl = computed(() => enemyPortraitUrl(listing.value));

const portraitFrameStyle = computed(() => {
  void enemyPortraitColors.value;
  const url = portraitUrl.value;
  const slug = listing.value?.portrait;
  if (!url || !slug) return undefined;
  return { background: portraitBackgroundFor(slug, url) };
});

const swarmGroup = computed(() => {
  const s = gameState.value;
  const id = props.enemyId;
  if (!s || !id) return null;
  return swarmGroupForEnemy(s, id);
});

const soloSwarmMember = computed(
  () =>
    boardSelection.value?.kind === "enemy" &&
    boardSelection.value.soloSwarmMember === true &&
    boardSelection.value.id === props.enemyId,
);

const displayName = computed(() => {
  const group = swarmGroup.value;
  const listingName =
    listing.value?.name ?? towerDef.value?.name ?? activeEnemy.value?.name ?? props.enemyName ?? "Enemy";
  if (soloSwarmMember.value && group) return `${listingName} (Swarm member)`;
  if (group && group.size > 1) return `${listingName} (Swarm · ${group.size})`;
  return listingName;
});
const maxHp = computed(() => {
  const s = gameState.value;
  const enemy = activeEnemy.value;
  if (!s || !enemy) return listing.value?.hp ?? towerDef.value?.hp ?? 0;
  const group = swarmGroup.value;
  if (soloSwarmMember.value && group) {
    return getSwarmMaxHp(1);
  }
  return getEffectiveEnemyMaxHp(enemy, s);
});
const currentHp = computed(() => {
  const s = gameState.value;
  const enemy = activeEnemy.value;
  if (!s || !enemy) return 0;
  const group = swarmGroup.value;
  if (soloSwarmMember.value && group) {
    return getSwarmMemberHp(getEffectiveEnemyHp(enemy, s), group.size);
  }
  return getEffectiveEnemyHp(enemy, s);
});
const showHpBar = computed(() => {
  const enemy = activeEnemy.value;
  if (!enemy) return false;
  if (isTowerEnemy(enemy)) return true;
  return hasGmCapabilities.value;
});
const hpEditable = computed(() => hasGmCapabilities.value && !!activeEnemy.value);

const enemyScale = computed(() => {
  if (activeEnemy.value) return getEnemyScale(activeEnemy.value);
  return listing.value?.scale ?? towerDef.value?.scale ?? 1;
});

const notFound = computed(() => !listing.value && !towerDef.value && !activeEnemy.value);

const bossBudget = computed(() => {
  const s = gameState.value;
  const enemy = activeEnemy.value;
  if (!s || !enemy) return null;
  return getEnemyBossActionBudget(s, enemy.id);
});

const showUseAttack = computed(
  () => hasGmCapabilities.value && showGmCombatUi.value && !!activeEnemy.value && !isTowerEnemy(activeEnemy.value!),
);

const isInSwarm = computed(() => (swarmGroup.value?.size ?? 0) > 1);

const swarmDirectAttackIndex = computed(() => {
  const attacks = listing.value?.attacks ?? [];
  return attacks.findIndex((entry) => isDirectTargetEnemyAttack(entry.attack));
});

const showSwarmAttack = computed(
  () =>
    showUseAttack.value &&
    isInSwarm.value &&
    swarmDirectAttackIndex.value >= 0,
);

const spawnEnemyName = computed(
  () => listing.value?.name ?? activeEnemy.value?.name ?? props.enemyName ?? null,
);

const showSpawnUnit = computed(
  () => hasGmCapabilities.value && !!spawnEnemyName.value && !towerDef.value,
);

const spawnSelected = computed(
  () => spawnEnemyName.value != null && selectedSpawnEnemyName.value === spawnEnemyName.value,
);

const enemySpeedLabel = computed(() => {
  const s = gameState.value;
  const enemy = activeEnemy.value;
  if (!enemy || !s) return null;
  const group = swarmGroupForEnemy(s, enemy.id);
  const max = getEnemySpeed(enemy);
  if (group && group.size > 1) {
    return `${getSwarmMovementRemaining(s, group.memberIds)}/${max}`;
  }
  const remaining = enemy.movementRemaining ?? max;
  return `${remaining}/${max}`;
});

function useSwarmAttack() {
  const enemy = activeEnemy.value;
  const index = swarmDirectAttackIndex.value;
  if (!enemy || index < 0) return;
  startGmSwarmAttack(enemy.id, index);
}

function attackIsResolvable(index: number): boolean {
  const attackSpec = listing.value?.attacks?.[index]?.attack;
  return !!attackSpec && isAutoResolvableEnemyAttack(attackSpec);
}

function useAttack(index: number) {
  const enemy = activeEnemy.value;
  const attackSpec = listing.value?.attacks?.[index]?.attack;
  if (!enemy || !attackSpec || !isAutoResolvableEnemyAttack(attackSpec)) return;
  if (
    attackSpec.specialId === "flowerbud-plant" ||
    attackSpec.specialId === "stain-teleport" ||
    isSelectTargetEnemyAttack(attackSpec) ||
    isPatternEnemyAttack(attackSpec)
  ) {
    startGmEnemyAttack(enemy.id, index, undefined, {
      stainTeleport: attackSpec.specialId === "stain-teleport",
      plantFlowerbud: attackSpec.specialId === "flowerbud-plant",
    });
  }
}

function commitHp(hp: number) {
  const enemy = activeEnemy.value;
  if (!enemy) return;
  send({ type: "setEnemyHp", enemyId: enemy.id, hp });
}

function endEnemyTurn() {
  const enemy = activeEnemy.value;
  if (!enemy || enemy.exhausted || isTowerEnemy(enemy)) return;
  send({ type: "gmEnemyAction", action: { action: "exhaust", enemyId: enemy.id } });
}

function spawnUnit() {
  const name = spawnEnemyName.value;
  if (!name) return;
  selectSpawnEnemy(name);
}
</script>

<template>
  <PanelShell
    :title="displayName"
    :subtitle="listing?.title"
    :show-back="showBack"
    @close="closeRightPanel"
    @back="goBackFromDataFocus"
  >
    <div
      v-if="!notFound && portraitUrl"
      class="enemy-portrait-frame"
      :class="{ 'enemy-portrait-frame--gm': hasGmCapabilities }"
      :style="portraitFrameStyle"
    >
      <img :src="portraitUrl" :alt="displayName" class="enemy-portrait" />
    </div>

    <div v-if="!notFound" class="panel-body">
      <template v-if="hasGmCapabilities || showHpBar">
        <HpBar
          v-if="showHpBar"
          :current-hp="currentHp"
          :max-hp="maxHp"
          :editable="hpEditable"
          @commit="commitHp"
        />

        <div
          v-if="showSpawnUnit"
          class="spawn-row"
        >
          <button
            type="button"
            class="spawn-btn"
            :class="{ active: spawnSelected }"
            @click="spawnUnit"
          >
            {{ spawnSelected ? "Selected for spawn" : "Spawn unit" }}
          </button>
          <p v-if="stainGeyserPlacementActive" class="spawn-hint">
            Click to place the stain area (Esc to skip).
          </p>
          <p v-else-if="spawnSelected" class="spawn-hint">Click an empty walkable tile on the board.</p>
        </div>

        <div
          v-if="showGmCombatUi && activeEnemy && !activeEnemy.exhausted && !isTowerEnemy(activeEnemy)"
          class="enemy-actions"
        >
          <button type="button" class="action-btn end-turn-btn" @click="endEnemyTurn">
            End turn
          </button>
        </div>

        <div
          v-if="showSwarmAttack"
          class="swarm-attack-row"
        >
          <button type="button" class="use-attack-btn swarm-attack-btn" @click="useSwarmAttack">
            Swarm attack
          </button>
          <p class="swarm-attack-hint">Select a target on the board, then choose how many strikes.</p>
        </div>

        <p v-if="isInSwarm && activeEnemy && !soloSwarmMember" class="swarm-member-hint">
          Double-click a swarm tile to select a single member.
        </p>
        <p v-if="soloSwarmMember" class="swarm-member-hint">
          Move this member to rearrange the swarm or break it away from the group.
        </p>
      </template>

      <div v-if="listing || towerDef" class="stats">
        <span v-if="hasGmCapabilities && !showHpBar" class="stat">
          HP: {{ listing?.hp ?? towerDef?.hp }}
        </span>
        <span v-if="listing?.crown != null" class="stat">Crown: {{ listing.crown }}</span>
        <span v-if="listing?.scale != null || towerDef || activeEnemy" class="stat">
          Scale: {{ enemyScale }}
        </span>
        <span v-if="listing?.speed != null || (activeEnemy && !towerDef)" class="stat">
          Speed: {{ enemySpeedLabel ?? listing?.speed }}
        </span>
        <span v-if="listing?.actions" class="stat">Actions: {{ listing.actions }}</span>
        <span v-if="bossBudget != null" class="stat">Boss budget: {{ bossBudget }}</span>
        <span
          v-if="activeEnemy?.exhausted && !isTowerEnemy(activeEnemy)"
          class="stat exhausted"
        >Exhausted</span>
        <span v-if="hasGmCapabilities && listing?.agnosiaHp != null" class="stat">Agnosia HP: {{ listing.agnosiaHp }}</span>
        <span v-if="activeEnemy?.agnosiaTriggered" class="stat">Agnosia triggered</span>
        <span v-if="activeEnemy?.burrowed" class="stat">Burrowed</span>
        <p v-if="gorgenautAgnosiaPlacementActive" class="spawn-hint">
          Move the 5×5 stain area, then click to confirm (Esc to recenter).
        </p>
      </div>

      <div v-if="listing?.tags?.length || towerDef?.tags" class="tags">
        <span v-for="tag in listing?.tags ?? []" :key="tag" class="tag">{{ tag }}</span>
        <span v-if="towerDef?.tags" class="tag">{{ towerDef.tags }}</span>
      </div>

      <p v-if="listing?.codename" class="codename"><em>{{ listing.codename }}</em></p>
      <p v-if="listing?.description" class="item-description">
        <RuleText :text="listing.description" />
      </p>
      <p v-else-if="towerDef?.special" class="ability">
        <span class="ability-label">Special</span>
        <RuleText :text="towerDef.special" />
      </p>
      <p v-else-if="!listing?.codename" class="muted">No description available.</p>

      <template v-if="listing">
        <div v-for="(attack, i) in listing.attacks" :key="i" class="ability">
          <span class="ability-label">Attack {{ i + 1 }}</span>
          <p class="ability-text"><RuleText :text="attack.text" /></p>
          <div v-if="showUseAttack && !isInSwarm && attackIsResolvable(i)" class="attack-actions">
            <button
              type="button"
              class="use-attack-btn"
              @click="useAttack(i)"
            >
              Target
            </button>
          </div>
        </div>
        <p v-if="listing.agnosia" class="ability">
          <span class="ability-label">Agnosia</span>
          <RuleText :text="listing.agnosia" />
        </p>
        <p v-if="listing.special" class="ability">
          <span class="ability-label">Special</span>
          <RuleText :text="listing.special" />
        </p>
        <p v-if="listing.stainwalk" class="ability">
          <span class="ability-label">Stainwalk</span>
          <RuleText :text="listing.stainwalk" />
        </p>
      </template>

      <p v-if="activeEnemy" class="position">
        Position ({{ activeEnemy.x }}, {{ activeEnemy.y }}){{ enemyScale > 1 ? ` · ${enemyScale}×${enemyScale}` : "" }}
      </p>
    </div>

    <p v-else class="muted">Enemy not found.</p>
  </PanelShell>
</template>

<style scoped>
.panel-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.enemy-portrait-frame {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 50%;
  aspect-ratio: 1;
  margin: 0 auto 1rem;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.enemy-portrait-frame--gm {
  width: 25%;
}

.enemy-portrait {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.codename {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-muted);
}

.stat {
  font-size: 0.8rem;
  color: var(--color-muted);
  font-weight: 600;
}

.stat.exhausted {
  color: var(--color-danger);
}

.stats {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
}

.ability {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--color-text-secondary);
}

.ability-text {
  margin: 0;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag {
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  font-size: 0.72rem;
}

.ability-label {
  display: block;
  margin-bottom: 0.15rem;
}

.use-attack-btn {
  margin-top: 0.4rem;
  font-size: 0.75rem;
  padding: 0.25rem 0.55rem;
  border-radius: 6px;
  border: 1px solid var(--color-accent-muted);
  background: var(--color-accent-subtle-bg);
  color: var(--color-accent);
  cursor: pointer;
  font-weight: 600;
}

.attack-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.15rem;
}

.attack-actions .use-attack-btn {
  margin-top: 0;
}

.use-attack-btn:hover {
  background: var(--color-accent-hover-bg);
}

.swarm-attack-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.swarm-attack-btn {
  align-self: flex-start;
}

.swarm-attack-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-muted);
  line-height: 1.4;
}

.swarm-member-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-muted);
  line-height: 1.4;
}

.position {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-muted);
}

.muted {
  color: var(--color-muted);
  font-size: 0.85rem;
}

.enemy-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.spawn-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.spawn-btn {
  align-self: flex-start;
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

.spawn-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-accent-bright);
  line-height: 1.4;
}

.end-turn-btn {
  border-color: var(--color-accent-muted);
  color: var(--color-accent);
}

.action-btn {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-surface-raised);
}
</style>
