<script setup lang="ts">
import { ref, watch } from "vue";

import ModalDialog from "./ModalDialog.vue";
import YadathanTowerPicker from "./YadathanTowerPicker.vue";

const props = defineProps<{
  open: boolean;
  modelValue: string;
  title?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [tower: string];
}>();

const draft = ref("");

watch(
  () => props.open,
  (open) => {
    if (open) draft.value = props.modelValue;
  },
);

function confirm() {
  if (!draft.value) return;
  emit("confirm", draft.value);
}
</script>

<template>
  <ModalDialog
    :title="title ?? 'Select tower type'"
    :open="open"
    :ok-disabled="!draft"
    @close="emit('close')"
    @confirm="confirm"
  >
    <YadathanTowerPicker v-model="draft" label="Tower type" />
  </ModalDialog>
</template>
