<script setup lang="ts">
import type { ProvokeTrigger } from "@vtt-core/shared";

import ModalDialog from "./ModalDialog.vue";

defineProps<{
  open: boolean;
  triggers: ProvokeTrigger[];
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();
</script>

<template>
  <ModalDialog
    title="Provoke"
    :open="open"
    ok-label="Move"
    @close="emit('close')"
    @confirm="emit('confirm')"
  >
    <p class="prompt">
      This movement will trigger {{ triggers.length }} Provoke attack{{
        triggers.length === 1 ? "" : "s"
      }}
      ({{ triggers.length }}×1D6). Damage is rolled automatically when you confirm.
    </p>
    <ul v-if="triggers.length <= 5" class="sources">
      <li v-for="(t, i) in triggers" :key="`${t.label}-${i}`">{{ t.label }}</li>
    </ul>
  </ModalDialog>
</template>

<style scoped>
.prompt {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  line-height: 1.45;
  color: var(--color-text-secondary);
}

.sources {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.8rem;
  color: var(--color-muted);
}
</style>
