<script setup lang="ts">
import { YADATHAN_ARMOR_NAME } from "@gaem/hellpiercers-content/combat-ui";
import { computed } from "vue";

import { PLAYER_ARMOR, PLAYER_CLASSES, PLAYER_WEAPONS } from "@gaem/shared";

import { useCampaignUnlocks } from "../composables/useCampaignUnlocks.js";
import YadathanTowerPicker from "./YadathanTowerPicker.vue";

export type CharacterSheetFormValue = {
  player: string;
  name: string;
  class: string;
  armor: string;
  weapon: string;
  yadathanTower?: string;
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

const showYadathanTowerPick = computed(() => props.modelValue.armor === YADATHAN_ARMOR_NAME);

function updateField(field: keyof CharacterSheetFormValue, value: string) {
  const next = { ...props.modelValue, [field]: value };
  if (field === "armor" && value !== YADATHAN_ARMOR_NAME) {
    next.yadathanTower = "";
  }
  emit("update:modelValue", next);
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

  <YadathanTowerPicker
    v-if="showYadathanTowerPick"
    :model-value="modelValue.yadathanTower ?? ''"
    label="Tower type"
    @update:model-value="updateField('yadathanTower', $event)"
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
</template>
