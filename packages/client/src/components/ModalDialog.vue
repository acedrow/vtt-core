<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    open: boolean;
    wide?: boolean;
    okLabel?: string;
    cancelLabel?: string;
    okDisabled?: boolean;
  }>(),
  {
    okLabel: "OK",
    cancelLabel: "Cancel",
    okDisabled: false,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const backdropRef = ref<HTMLElement | null>(null);
const modalRef = ref<HTMLElement | null>(null);

function isTopmostModal(): boolean {
  const backdrops = document.querySelectorAll(".modal-backdrop");
  if (!backdrops.length || !backdropRef.value) return false;
  return backdrops[backdrops.length - 1] === backdropRef.value;
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (!props.open || !isTopmostModal()) return;

  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    emit("close");
    return;
  }

  if (e.key !== "Enter") return;
  if (e.repeat || e.isComposing) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const target = e.target;
  if (target instanceof HTMLElement) {
    if (target.tagName === "TEXTAREA") return;
    if (target.isContentEditable) return;
  }

  if (props.okDisabled) return;
  e.preventDefault();
  e.stopPropagation();
  emit("confirm");
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      document.addEventListener("keydown", onDocumentKeydown, true);
      await nextTick();
      modalRef.value?.focus();
    } else {
      document.removeEventListener("keydown", onDocumentKeydown, true);
    }
  },
);

onUnmounted(() => {
  document.removeEventListener("keydown", onDocumentKeydown, true);
});
</script>

<template>
  <div v-if="open" ref="backdropRef" class="modal-backdrop" @click.self="emit('close')">
    <div
      ref="modalRef"
      class="modal"
      :class="{ 'modal--wide': wide }"
      role="dialog"
      tabindex="-1"
      :aria-label="title"
    >
      <h2 class="modal-title">{{ title }}</h2>
      <slot />
      <div class="modal-actions">
        <slot name="actions">
          <button type="button" class="btn-secondary" @click="emit('close')">{{ cancelLabel }}</button>
          <button type="button" class="btn-primary" :disabled="okDisabled" @click="emit('confirm')">
            {{ okLabel }}
          </button>
        </slot>
      </div>
    </div>
  </div>
</template>
