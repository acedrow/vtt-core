<script setup lang="ts">
import { parseRuleText } from "@gaem/shared";
import { computed } from "vue";

import RuleTerm from "./RuleTerm.vue";

const props = defineProps<{ text: string }>();

const segments = computed(() => parseRuleText(props.text));
</script>

<template>
  <span class="rule-text">
    <template v-for="(segment, index) in segments" :key="index">
      <RuleTerm
        v-if="segment.kind === 'term'"
        :text="segment.text"
        :tooltip="segment.tooltip"
        :link="segment.link"
      />
      <template v-else>{{ segment.text }}</template>
    </template>
  </span>
</template>
