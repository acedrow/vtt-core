<script setup lang="ts">
import { dismissToast, useToasts } from "../composables/useToasts.js";

const { toasts } = useToasts();
</script>

<template>
  <div class="toast-host" aria-live="polite" aria-relevant="additions">
    <TransitionGroup name="toast">
      <button
        v-for="toast in toasts"
        :key="toast.id"
        type="button"
        class="toast"
        :class="toast.kind"
        @click="dismissToast(toast.id)"
      >
        {{ toast.message }}
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: min(24rem, calc(100vw - 2rem));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  width: 100%;
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0.65rem 0.85rem;
  font: inherit;
  font-size: 0.88rem;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  box-shadow: var(--shadow-popover);
}

.toast.error {
  border-color: var(--color-danger-muted-border);
  color: var(--color-danger);
}

.toast.info {
  border-color: var(--color-accent-muted);
  color: var(--color-text);
}

.toast.success {
  border-color: var(--color-success-outline);
  color: var(--color-success);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

.toast-move {
  transition: transform 0.2s ease;
}
</style>
