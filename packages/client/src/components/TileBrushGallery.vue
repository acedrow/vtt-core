<script setup lang="ts">
import { computed } from "vue";

export type TileBrushGalleryEntry = {
  kind: "single" | "group";
  key: string;
  url: string;
  name: string;
};

const props = defineProps<{
  entries: TileBrushGalleryEntry[];
  selectedKey: string | null | undefined;
  ariaLabel: string;
}>();

const emit = defineEmits<{
  select: [key: string];
  selectNone: [];
}>();

const groupEntries = computed(() => props.entries.filter((e) => e.kind === "group"));
const singleEntries = computed(() => props.entries.filter((e) => e.kind === "single"));

function itemTitle(item: TileBrushGalleryEntry): string {
  return item.kind === "group" ? `Random from ${item.name}/` : item.name;
}
</script>

<template>
  <div class="tile-brush-gallery" role="listbox" :aria-label="ariaLabel" @click.stop>
    <div class="gallery-col gallery-col--groups">
      <button
        v-for="item in groupEntries"
        :key="item.key"
        type="button"
        role="option"
        class="gallery-item"
        :class="{ selected: selectedKey === item.key }"
        :aria-selected="selectedKey === item.key"
        :aria-label="itemTitle(item)"
        :data-tooltip="item.name"
        @click="emit('select', item.key)"
      >
        <img :src="item.url" alt="" class="gallery-thumb tile-image" />
      </button>
    </div>
    <div class="gallery-col gallery-col--singles">
      <button
        type="button"
        role="option"
        class="gallery-item"
        :class="{ selected: selectedKey == null }"
        :aria-selected="selectedKey == null"
        aria-label="None"
        data-tooltip="None"
        @click="emit('selectNone')"
      >
        <span class="gallery-thumb gallery-thumb-none" aria-hidden="true">—</span>
      </button>
      <button
        v-for="item in singleEntries"
        :key="item.key"
        type="button"
        role="option"
        class="gallery-item"
        :class="{ selected: selectedKey === item.key }"
        :aria-selected="selectedKey === item.key"
        :aria-label="item.name"
        :data-tooltip="item.name"
        @click="emit('select', item.key)"
      >
        <img :src="item.url" alt="" class="gallery-thumb tile-image" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.tile-brush-gallery {
  display: grid;
  grid-template-columns: 1fr 2fr;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  background: var(--color-surface);
}

.gallery-col {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 0.35rem;
  padding: 0.4rem;
  overflow-y: auto;
  min-height: 0;
}

.gallery-col--groups {
  border-right: 1px solid var(--color-border);
}

.gallery-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.15rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}

.gallery-item:hover,
.gallery-item.selected {
  background: var(--color-surface-raised);
  border-color: var(--color-border);
}

.gallery-item[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  box-shadow: var(--shadow-popover);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.gallery-item:hover::after,
.gallery-item:focus-visible::after {
  opacity: 1;
}

.gallery-thumb {
  width: 2.5rem;
  height: 2.5rem;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  display: block;
  flex-shrink: 0;
}

.gallery-thumb-none {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: var(--color-muted);
  background: var(--color-bg-elevated, transparent);
}
</style>
