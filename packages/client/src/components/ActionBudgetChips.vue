<script setup lang="ts">
import { actionTierLabel, actionTierTooltip, type ActionTier } from "@gaem/shared";
import { ref } from "vue";

import ModalDialog from "./ModalDialog.vue";

const props = defineProps<{
  interactive?: boolean;
  gmRestore?: boolean;
  fill?: boolean;
  mainSpent: boolean;
  supportSpent: boolean;
  auxSpent: boolean;
  mainGranted: boolean;
  supportGranted: boolean;
  auxGranted: boolean;
  canCommitMain: boolean;
  canCommitSupport: boolean;
  canCommitAux: boolean;
  hasteStacks?: number;
}>();

const emit = defineEmits<{
  commitHaste: [tier: ActionTier];
  restoreTier: [tier: ActionTier];
}>();

const pendingHasteTier = ref<ActionTier | null>(null);
const pendingRestoreTier = ref<ActionTier | null>(null);

const tiers: { tier: ActionTier; spent: () => boolean; granted: () => boolean; canCommit: () => boolean }[] = [
  { tier: "main", spent: () => props.mainSpent, granted: () => props.mainGranted, canCommit: () => props.canCommitMain },
  {
    tier: "support",
    spent: () => props.supportSpent,
    granted: () => props.supportGranted,
    canCommit: () => props.canCommitSupport,
  },
  { tier: "aux", spent: () => props.auxSpent, granted: () => props.auxGranted, canCommit: () => props.canCommitAux },
];

function chipClass(spent: boolean, granted: boolean, canCommit: boolean) {
  if (granted) return "chip haste-granted";
  if (spent && props.gmRestore) return "chip spent clickable";
  if (spent && canCommit && props.interactive) return "chip spent clickable";
  if (spent) return "chip spent";
  return "chip";
}

function chipDisabled(spent: boolean, canCommit: boolean) {
  if (props.gmRestore) return !spent;
  return !props.interactive || !spent || !canCommit;
}

function onChipClick(tier: ActionTier, spent: boolean, canCommit: boolean) {
  if (props.gmRestore) {
    if (!spent) return;
    pendingRestoreTier.value = tier;
    return;
  }
  if (!props.interactive || !spent || !canCommit) return;
  pendingHasteTier.value = tier;
}

function confirmHaste() {
  if (!pendingHasteTier.value) return;
  emit("commitHaste", pendingHasteTier.value);
  pendingHasteTier.value = null;
}

function cancelHaste() {
  pendingHasteTier.value = null;
}

function confirmRestore() {
  if (!pendingRestoreTier.value) return;
  emit("restoreTier", pendingRestoreTier.value);
  pendingRestoreTier.value = null;
}

function cancelRestore() {
  pendingRestoreTier.value = null;
}
</script>

<template>
  <div class="chip-row" :class="{ fill }">
    <button
      v-for="{ tier, spent, granted, canCommit } in tiers"
      :key="tier"
      type="button"
      class="chip-btn"
      :class="chipClass(spent(), granted(), canCommit())"
      :disabled="chipDisabled(spent(), canCommit())"
      @click="onChipClick(tier, spent(), canCommit())"
    >
      <span class="chip-label">{{ actionTierLabel(tier) }}</span>
      <span class="chip-tooltip" role="tooltip">{{ actionTierTooltip(tier) }}</span>
    </button>
    <span v-if="(hasteStacks ?? 0) > 0" class="chip haste">Haste {{ hasteStacks }}</span>
  </div>

  <ModalDialog
    :open="pendingHasteTier != null"
    title="Spend Haste"
    ok-label="Spend Haste"
    @close="cancelHaste"
    @confirm="confirmHaste"
  >
    <p v-if="pendingHasteTier" class="prompt">
      Would you like to spend Haste to gain an additional
      {{ actionTierLabel(pendingHasteTier) }} action?
    </p>
  </ModalDialog>

  <ModalDialog
    :open="pendingRestoreTier != null"
    title="Mark action unused"
    ok-label="Mark unused"
    @close="cancelRestore"
    @confirm="confirmRestore"
  >
    <p v-if="pendingRestoreTier" class="prompt">
      Mark {{ actionTierLabel(pendingRestoreTier) }} action as unused?
    </p>
  </ModalDialog>
</template>

<style scoped>
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.chip-row.fill {
  width: 100%;
}

.chip-row.fill .chip-btn {
  flex: 1;
  min-width: 0;
  justify-content: center;
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
}

.chip-btn {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.chip-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  font-family: inherit;
  cursor: default;
}

.chip-label {
  text-align: center;
}

.chip-tooltip {
  display: none;
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  min-width: 140px;
  max-width: 220px;
  padding: 0.45rem 0.55rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.72rem;
  font-weight: 400;
  line-height: 1.45;
  text-align: center;
  white-space: normal;
  box-shadow: var(--shadow-popover);
  pointer-events: none;
  opacity: 1;
}

.chip-btn:hover .chip-tooltip,
.chip-btn:focus-visible .chip-tooltip {
  display: block;
}

.chip-btn.spent .chip-label {
  opacity: 0.45;
}

.chip-btn.clickable {
  cursor: pointer;
  border-style: dashed;
  border-color: var(--color-accent);
}

.chip-btn.clickable .chip-label {
  opacity: 0.75;
}

.chip-btn.clickable:hover:not(:disabled) {
  background: var(--color-accent-muted);
}

.chip-btn.clickable:hover:not(:disabled) .chip-label {
  opacity: 1;
}

.chip-btn:disabled {
  cursor: default;
}

.chip-btn.haste-granted {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-muted);
}

.chip-btn.haste-granted .chip-label {
  opacity: 1;
}

.chip.haste {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.prompt {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
