<script setup lang="ts">
export type BoardContextMenuItem = {
  id: string;
  label: string;
  danger?: boolean;
};

defineProps<{
  open: boolean;
  x: number;
  y: number;
  items: BoardContextMenuItem[];
}>();

const emit = defineEmits<{
  select: [id: string];
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && items.length"
      class="board-context-menu-backdrop"
      @click="emit('close')"
      @contextmenu.prevent="emit('close')"
    >
      <div
        class="board-context-menu"
        :style="{ left: `${x}px`, top: `${y}px` }"
        @click.stop
        @contextmenu.prevent.stop
      >
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="menu-item"
          :class="{ danger: item.danger }"
          @click="emit('select', item.id)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.board-context-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
}
.board-context-menu {
  position: fixed;
  min-width: 140px;
  padding: 0.25rem;
  border-radius: 0;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-menu);
}
.menu-item {
  display: block;
  width: 100%;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--color-text);
  padding: 0.4rem 0.65rem;
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
}
.menu-item:hover {
  background: var(--color-surface-raised);
}
.menu-item.danger {
  color: var(--color-danger);
}
.menu-item.danger:hover {
  background: var(--color-danger-subtle-bg);
}
</style>
