<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { BrandStripCandidate } from "@vtt-core/shared";

import { useCombatActions } from "../composables/useCombatActions.js";
import { useGameState } from "../composables/useGameState.js";
import NumberStepper from "./NumberStepper.vue";

const { pendingClassReaction, activePlayer, sendPlayerAction, canSupport } = useCombatActions();
const { gameState } = useGameState();

const pullDistance = ref(1);
const pullToward = ref<"self" | "weapon">("self");

const isHarpePull = computed(() => pendingClassReaction.value?.kind === "harpe_trap_pull");
const isBorrowFollowUp = computed(() => pendingClassReaction.value?.kind === "borrowing_follow_up");
const isOffhandPistolPush = computed(() => pendingClassReaction.value?.kind === "offhand_pistol_push");
const isBrandStrip = computed(() => pendingClassReaction.value?.kind === "brand_strip");

const harpeDamageDealt = computed(() => {
  const r = pendingClassReaction.value;
  return r?.kind === "harpe_trap_pull" ? r.damageDealt : 0;
});

const offhandPushEnemyCount = computed(() => {
  const r = pendingClassReaction.value;
  if (r?.kind !== "offhand_pistol_push") return 0;
  return r.enemyIds.length;
});

const borrowTargetCount = computed(() => {
  const r = pendingClassReaction.value;
  if (r?.kind !== "borrowing_follow_up") return 0;
  return r.extraEnemyIds.length;
});

const borrowMaxDamage = computed(() => {
  const r = pendingClassReaction.value;
  if (r?.kind !== "borrowing_follow_up") return 0;
  return r.maxDamage;
});

const brandStripCandidates = computed(() => {
  const r = pendingClassReaction.value;
  if (r?.kind !== "brand_strip") return [];
  return r.candidates;
});

function brandCandidateLabel(c: BrandStripCandidate): string {
  const s = gameState.value;
  if (c.kind === "enemy") {
    const enemy = s?.enemies.find((e) => e.id === c.id);
    return enemy?.name ?? c.id;
  }
  if (c.kind === "player") {
    const player = s?.players.find((p) => p.id === c.id);
    return player?.nickname ?? c.id;
  }
  return `Obstacle (${c.x}, ${c.y})`;
}

function brandCandidateKey(c: BrandStripCandidate): string {
  if (c.kind === "obstacle") return `obs-${c.x}-${c.y}`;
  return `${c.kind}-${c.id}`;
}

function confirmHarpePull() {
  sendPlayerAction({
    action: "resolveClassReaction",
    pullDistance: pullDistance.value,
    pullToward: pullToward.value,
  });
}

function confirmBorrowFollowUp() {
  sendPlayerAction({ action: "resolveClassReaction", accept: true });
}

function skipBorrowFollowUp() {
  sendPlayerAction({ action: "resolveClassReaction", accept: false });
}

function confirmOffhandPush() {
  sendPlayerAction({ action: "resolveClassReaction", accept: true });
}

function skipOffhandPush() {
  sendPlayerAction({ action: "resolveClassReaction", accept: false });
}

function confirmBrandStrip(c: BrandStripCandidate) {
  if (c.kind === "enemy") {
    sendPlayerAction({
      action: "resolveClassReaction",
      accept: true,
      targetEnemyId: c.id,
    });
    return;
  }
  if (c.kind === "player") {
    sendPlayerAction({
      action: "resolveClassReaction",
      accept: true,
      targetPlayerId: c.id,
    });
    return;
  }
  sendPlayerAction({
    action: "resolveClassReaction",
    accept: true,
    x: c.x,
    y: c.y,
  });
}

function skipBrandStrip() {
  sendPlayerAction({ action: "resolveClassReaction", accept: false });
}

watch(pendingClassReaction, (r) => {
  if (r?.kind === "harpe_trap_pull") {
    pullDistance.value = 1;
    pullToward.value = "self";
  }
});
</script>

<template>
  <div v-if="pendingClassReaction" class="class-reaction-banner">
    <div v-if="isHarpePull" class="class-reaction-copy">
      <strong>Weapon Trap — choose pull</strong>
      <p class="class-reaction-detail">
        {{ harpeDamageDealt }} damage dealt. Pull toward you or your weapon?
      </p>
      <div class="class-reaction-controls">
        <label class="class-reaction-field">
          Distance
          <NumberStepper v-model="pullDistance" :min="0" :max="6" />
        </label>
        <label class="class-reaction-radio">
          <input v-model="pullToward" type="radio" value="self" />
          Toward {{ activePlayer?.nickname ?? "you" }}
        </label>
        <label class="class-reaction-radio">
          <input v-model="pullToward" type="radio" value="weapon" />
          Toward weapon
        </label>
      </div>
      <div class="class-reaction-actions">
        <button type="button" class="action-btn" @click="confirmHarpePull">Confirm pull</button>
      </div>
    </div>

    <div v-else-if="isBorrowFollowUp" class="class-reaction-copy">
      <strong>Borrowing This — Support follow-up</strong>
      <p class="class-reaction-detail">
        Deal max damage ({{ borrowMaxDamage }}) to {{ borrowTargetCount }}
        {{ borrowTargetCount === 1 ? "enemy" : "enemies" }} outside your weapon pattern?
      </p>
      <div class="class-reaction-actions">
        <button
          type="button"
          class="action-btn"
          :disabled="!canSupport"
          @click="confirmBorrowFollowUp"
        >
          Confirm (Support)
        </button>
        <button type="button" class="action-btn reject" @click="skipBorrowFollowUp">Skip</button>
      </div>
    </div>

    <div v-else-if="isOffhandPistolPush" class="class-reaction-copy">
      <strong>Offhand Pistol — Push:1</strong>
      <p class="class-reaction-detail">
        Push
        {{ offhandPushEnemyCount === 1 ? "this enemy" : `these ${offhandPushEnemyCount} enemies` }}
        1 space away from you?
      </p>
      <div class="class-reaction-actions">
        <button type="button" class="action-btn" @click="confirmOffhandPush">Push</button>
        <button type="button" class="action-btn reject" @click="skipOffhandPush">Skip</button>
      </div>
    </div>

    <div v-else-if="isBrandStrip" class="class-reaction-copy">
      <strong>Embedded Flame Rejection — strip Brand</strong>
      <p class="class-reaction-detail">
        Remove 1 Brand stack from someone you Branded?
      </p>
      <div class="class-reaction-actions class-reaction-actions--wrap">
        <button
          v-for="c in brandStripCandidates"
          :key="brandCandidateKey(c)"
          type="button"
          class="action-btn"
          @click="confirmBrandStrip(c)"
        >
          {{ brandCandidateLabel(c) }}
        </button>
        <button type="button" class="action-btn reject" @click="skipBrandStrip">Skip</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.class-reaction-banner {
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  background: var(--color-surface-raised);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.class-reaction-copy {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.class-reaction-detail {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-muted);
}

.class-reaction-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  align-items: center;
  font-size: 0.78rem;
}

.class-reaction-field {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.class-reaction-radio {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.class-reaction-actions {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.class-reaction-actions--wrap {
  max-height: 8rem;
  overflow-y: auto;
}
</style>
