<script setup lang="ts">
import { computed } from "vue";

import { PLAYER_ARMOR, PLAYER_CLASSES, PLAYER_WEAPONS } from "@vtt-core/shared";

import {
  clearHiddenSheetExtras,
  sheetFieldsAfter,
} from "../client-content-pack.js";
import { useCampaignUnlocks } from "../composables/useCampaignUnlocks.js";

export type CharacterSheetFormValue = {
  player: string;
  name: string;
  class: string;
  armor: string;
  weapon: string;
  extras: Record<string, string>;
};

const props = defineProps<{
  modelValue: CharacterSheetFormValue;
  profiles: { id: string; name: string }[];
  showPlayer?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: CharacterSheetFormValue];
}>();

const { optionUnlocked } = useCampaignUnlocks();

const loadout = computed(() => ({
  class: props.modelValue.class,
  armor: props.modelValue.armor,
  weapon: props.modelValue.weapon,
}));

const fieldsAfterClass = computed(() => sheetFieldsAfter("class", loadout.value));
const fieldsAfterArmor = computed(() => sheetFieldsAfter("armor", loadout.value));
const fieldsAfterWeapon = computed(() => sheetFieldsAfter("weapon", loadout.value));

function emitNext(next: CharacterSheetFormValue) {
  emit("update:modelValue", {
    ...next,
    extras: clearHiddenSheetExtras(
      { class: next.class, armor: next.armor, weapon: next.weapon },
      next.extras,
    ),
  });
}

function updateField(field: "player" | "name" | "class" | "armor" | "weapon", value: string) {
  emitNext({ ...props.modelValue, [field]: value });
}

function updateExtra(dataKey: string, value: string) {
  emitNext({
    ...props.modelValue,
    extras: { ...props.modelValue.extras, [dataKey]: value },
  });
}
</script>

<template>
  <label v-if="showPlayer" class="modal-field">
    <span>Player profile</span>
    <select
      :value="modelValue.player"
      class="modal-input"
      @change="updateField('player', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled>Select player</option>
      <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
    </select>
  </label>

  <label class="modal-field">
    <span>Name</span>
    <input
      :value="modelValue.name"
      class="modal-input"
      type="text"
      @input="updateField('name', ($event.target as HTMLInputElement).value)"
    />
  </label>

  <label class="modal-field">
    <span>Class</span>
    <select
      :value="modelValue.class"
      class="modal-input"
      @change="updateField('class', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled>Select class</option>
      <option
        v-for="c in PLAYER_CLASSES"
        :key="c.name"
        :value="c.name"
        :disabled="!optionUnlocked('classes', c.name)"
      >
        {{ c.name }}{{ optionUnlocked('classes', c.name) ? '' : ' (locked)' }}
      </option>
    </select>
  </label>

  <component
    :is="field.component"
    v-for="field in fieldsAfterClass"
    :key="field.id"
    :model-value="modelValue.extras[field.dataKey] ?? ''"
    :label="field.label"
    @update:model-value="updateExtra(field.dataKey, $event)"
  />

  <label class="modal-field">
    <span>Armor</span>
    <select
      :value="modelValue.armor"
      class="modal-input"
      @change="updateField('armor', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled>Select armor</option>
      <option
        v-for="a in PLAYER_ARMOR"
        :key="a.name"
        :value="a.name"
        :disabled="!optionUnlocked('armor', a.name)"
      >
        {{ a.name }}{{ optionUnlocked('armor', a.name) ? '' : ' (locked)' }}
      </option>
    </select>
  </label>

  <component
    :is="field.component"
    v-for="field in fieldsAfterArmor"
    :key="field.id"
    :model-value="modelValue.extras[field.dataKey] ?? ''"
    :label="field.label"
    @update:model-value="updateExtra(field.dataKey, $event)"
  />

  <label class="modal-field">
    <span>Weapon</span>
    <select
      :value="modelValue.weapon"
      class="modal-input"
      @change="updateField('weapon', ($event.target as HTMLSelectElement).value)"
    >
      <option value="" disabled>Select weapon</option>
      <option
        v-for="w in PLAYER_WEAPONS"
        :key="w.name"
        :value="w.name"
        :disabled="!optionUnlocked('weapons', w.name)"
      >
        {{ w.name }}{{ optionUnlocked('weapons', w.name) ? '' : ' (locked)' }}
      </option>
    </select>
  </label>

  <component
    :is="field.component"
    v-for="field in fieldsAfterWeapon"
    :key="field.id"
    :model-value="modelValue.extras[field.dataKey] ?? ''"
    :label="field.label"
    @update:model-value="updateExtra(field.dataKey, $event)"
  />
</template>
