<script setup lang="ts">
import { TILE_EFFECTS, UNIT_EFFECTS, WEAPON_EFFECTS, type RuleEffect } from "@gaem/shared";

import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useExpandableSet } from "../composables/useExpandableSet.js";
import EffectIcon from "./EffectIcon.vue";
import PanelShell from "./PanelShell.vue";
import RuleText from "./RuleText.vue";

const { isExpanded: isKeyExpanded, toggle: toggleKey } = useExpandableSet();
const { closeRightPanel } = useBoardSelection();

const sections: { title: string; effects: RuleEffect[] }[] = [
  { title: "Unit effects", effects: UNIT_EFFECTS },
  { title: "Weapon effects", effects: WEAPON_EFFECTS },
  { title: "Tile effects", effects: TILE_EFFECTS },
];

function effectKey(sectionTitle: string, id: string): string {
  return `${sectionTitle}-${id}`;
}

function isExpanded(sectionTitle: string, id: string): boolean {
  return isKeyExpanded(effectKey(sectionTitle, id));
}

function toggle(sectionTitle: string, id: string) {
  toggleKey(effectKey(sectionTitle, id));
}
</script>

<template>
  <PanelShell title="Effects" @close="closeRightPanel">
    <div class="panel-body">
      <section v-for="section in sections" :key="section.title" class="effect-section">
        <h3 class="section-title">{{ section.title }}</h3>
        <article
          v-for="effect in section.effects"
          :key="effectKey(section.title, effect.id)"
          class="list-card"
        >
          <button
            type="button"
            class="list-card-header"
            :class="{ expanded: isExpanded(section.title, effect.id) }"
            @click="toggle(section.title, effect.id)"
          >
            <span class="item-header">
              <EffectIcon :effect-id="effect.id" :size="18" />
              <span class="item-name">{{ effect.id }}</span>
            </span>
            <span class="chevron" aria-hidden="true">{{
              isExpanded(section.title, effect.id) ? "▾" : "▸"
            }}</span>
          </button>

          <div v-if="isExpanded(section.title, effect.id)" class="list-card-body">
            <p class="item-summary">{{ effect.summary }}</p>
            <p class="item-description">
              <RuleText :text="effect.description" />
            </p>
          </div>
        </article>
      </section>
    </div>
  </PanelShell>
</template>

<style scoped>
.effect-section + .effect-section {
  margin-top: 1.25rem;
}

.section-title {
  margin: 0 0 0.5rem;
  color: var(--color-muted);
  text-transform: uppercase;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.chevron {
  color: var(--color-muted);
  font-size: 1.5rem;
}

.item-summary {
  margin: 0 0 0.5rem;
  font-weight: 600;
  color: var(--color-text);
}
</style>
