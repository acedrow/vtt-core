<script setup lang="ts">
import type { AbilityText } from "@gaem/shared";
import { isStructuredAbility, parseAbilityNameBody } from "@gaem/shared";
import { computed } from "vue";


import RuleText from "./RuleText.vue";

const props = defineProps<{
  content: AbilityText | undefined;
  tierLabel?: string;
  hideSections?: boolean;
}>();

const structured = computed(() =>
  props.content && isStructuredAbility(props.content) ? props.content : null,
);

const parsed = computed(() => {
  if (!props.content || isStructuredAbility(props.content)) return null;
  return parseAbilityNameBody(props.content) ?? { name: "", body: props.content };
});
</script>

<template>
  <div v-if="content" class="ability-block">
    <div
      v-if="tierLabel || (structured?.name) || parsed?.name"
      class="ability-header"
    >
      <span v-if="tierLabel" class="ability-label">{{ tierLabel }}</span>
      <span v-if="structured?.name || parsed?.name" class="ability-name">
        {{ structured?.name ?? parsed?.name }}
      </span>
    </div>
    <template v-if="structured">
      <RuleText v-if="structured.intro" class="ability-body" :text="structured.intro" />
      <template v-if="!hideSections">
        <template v-for="(section, i) in structured.sections" :key="`${section.title ?? ''}-${i}`">
          <div v-if="section.title" class="ability-section-title">{{ section.title }}</div>
          <ul v-if="section.options.length > 1" class="ability-options">
            <li v-for="(option, j) in section.options" :key="`${option}-${j}`">
              <RuleText :text="option" />
            </li>
          </ul>
          <p v-else-if="section.options[0]" class="ability-section-body">
            <RuleText :text="section.options[0]" />
          </p>
        </template>
      </template>
      <RuleText v-if="structured.outro" class="ability-body" :text="structured.outro" />
    </template>
    <template v-else-if="parsed">
      <RuleText class="ability-body" :text="parsed.body" />
    </template>
  </div>
</template>

<style scoped>
.ability-block {
  margin-top: 0.5rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  line-height: 1.45;
}

.ability-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
  margin-bottom: 0.25rem;
}

.ability-name {
  font-weight: 600;
  color: var(--color-text);
}

.ability-body {
  display: block;
}

.ability-section-title {
  margin: 0.45rem 0 0.15rem;
  text-transform: uppercase;
  color: var(--color-text);
}

.ability-section-body {
  margin: 0.15rem 0 0.35rem;
}

.ability-options {
  margin: 0.15rem 0 0.35rem;
  padding-left: 1rem;
}

.ability-options li + li {
  margin-top: 0.2rem;
}
</style>
