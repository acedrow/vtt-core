<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
  kicker?: string;
  showBack?: boolean;
  closeVariant?: "ghost";
}>();

const emit = defineEmits<{
  close: [];
  back: [];
}>();
</script>

<template>
  <div class="panel">
    <div v-if="showBack" class="panel-toolbar">
      <button class="back-btn" type="button" title="Back" @click="emit('back')">←</button>
      <button
        class="close-btn"
        :class="{ 'close-btn--ghost': closeVariant === 'ghost' }"
        type="button"
        title="Close"
        @click="emit('close')"
      >
        ×
      </button>
    </div>
    <div class="panel-header" :class="{ 'with-toolbar': showBack }">
      <div class="title-block">
        <p v-if="kicker" class="panel-kicker">{{ kicker }}</p>
        <h2 class="panel-title">{{ title }}</h2>
        <p v-if="subtitle" class="panel-subtitle">{{ subtitle }}</p>
      </div>
      <button
        v-if="!showBack"
        class="close-btn"
        :class="{ 'close-btn--ghost': closeVariant === 'ghost' }"
        type="button"
        title="Close"
        @click="emit('close')"
      >
        ×
      </button>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.title-block {
  min-width: 0;
}
</style>
