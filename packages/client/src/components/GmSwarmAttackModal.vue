<script setup lang="ts">
import { enemyAttackDamage, previewSwarmEnemyAttack, type EnemyAttackSpec } from "@gaem/shared";
import { computed, ref, watch } from "vue";

import { useGameState } from "../composables/useGameState.js";
import ModalDialog from "./ModalDialog.vue";

const props = defineProps<{
  open: boolean;
  enemyId: string;
  attackIndex: number;
  attackText: string;
  attackSpec?: EnemyAttackSpec;
  targetPlayerId: string;
  targetPlayerName: string;
  maxStrikes: number;
  damageOverride?: number;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [strikeCount: number];
}>();

const { gameState } = useGameState();
const strikeCount = ref(1);

watch(
  () => [props.open, props.maxStrikes, props.targetPlayerId] as const,
  ([isOpen, max]) => {
    if (!isOpen) return;
    strikeCount.value = Math.max(1, max);
  },
);

const preview = computed(() => {
  const s = gameState.value;
  if (!s || !props.targetPlayerId || !props.attackSpec) return null;
  return previewSwarmEnemyAttack(s, props.enemyId, props.attackSpec, props.targetPlayerId, {
    damage: props.damageOverride ?? enemyAttackDamage(props.attackSpec),
    strikeCount: strikeCount.value,
  });
});

function decrement() {
  strikeCount.value = Math.max(1, strikeCount.value - 1);
}

function increment() {
  strikeCount.value = Math.min(props.maxStrikes, strikeCount.value + 1);
}

function onConfirm() {
  emit("confirm", strikeCount.value);
}
</script>

<template>
  <ModalDialog
    title="Swarm attack"
    :open="open"
    ok-label="Attack"
    :ok-disabled="maxStrikes < 1"
    @close="emit('close')"
    @confirm="onConfirm"
  >
    <p v-if="attackText" class="attack-text">{{ attackText }}</p>
    <p class="target-line">
      Target: <strong>{{ targetPlayerName }}</strong>
    </p>
    <p class="adjacent-hint">
      Up to {{ maxStrikes }} strike{{ maxStrikes === 1 ? "" : "s" }} (one per orthogonally adjacent swarm tile).
    </p>

    <div class="strike-row">
      <span class="strike-label">Strikes</span>
      <div class="stepper">
        <button type="button" class="step-btn" :disabled="strikeCount <= 1" @click="decrement">−</button>
        <span class="strike-value">{{ strikeCount }}</span>
        <button type="button" class="step-btn" :disabled="strikeCount >= maxStrikes" @click="increment">+</button>
      </div>
    </div>

    <p v-if="preview && preview.strikeCount > 0" class="preview">
      Total damage: {{ preview.totalDamage }} ({{ preview.detail }})
    </p>
  </ModalDialog>
</template>

<style scoped>
.attack-text,
.target-line,
.adjacent-hint,
.preview {
  margin: 0 0 0.75rem;
  font-size: 0.82rem;
  line-height: 1.45;
  color: var(--color-muted);
}

.target-line strong {
  color: var(--color-text);
}

.preview {
  color: var(--color-accent);
  font-weight: 600;
}

.strike-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.strike-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-muted);
}

.stepper {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.step-btn {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.step-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.strike-value {
  min-width: 1.5rem;
  text-align: center;
  font-weight: 700;
  font-size: 0.95rem;
}
</style>
