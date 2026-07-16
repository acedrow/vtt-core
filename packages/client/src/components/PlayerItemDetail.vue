<script setup lang="ts">
import type {
  PlayerArmor,
  PlayerClass,
  PlayerEquipment,
  PlayerGear,
  PlayerWeapon,
} from "@gaem/shared";
import { computed } from "vue";

import { useCampaignUnlocks } from "../composables/useCampaignUnlocks.js";
import AbilityBlock from "./AbilityBlock.vue";
import RuleText from "./RuleText.vue";
import WeaponPatternDiagram from "./WeaponPatternDiagram.vue";

defineProps<{
  item: PlayerClass | PlayerArmor | PlayerWeapon | PlayerEquipment | PlayerGear;
  kind: "classes" | "armor" | "weapons" | "equipment" | "gear";
  weaponBombIndex?: number;
  weaponBombSelectable?: boolean;
  selectedTower?: string;
}>();

const emit = defineEmits<{
  "update:weaponBombIndex": [index: number];
  requestWeaponBombSelect: [index: number];
}>();

const { hasReversals } = useCampaignUnlocks();
const showReversals = computed(() => hasReversals.value);
</script>

<template>
  <template v-if="kind === 'classes'">
    <p class="item-stat">HP {{ (item as PlayerClass).hp }}</p>
    <AbilityBlock
      :content="(item as PlayerClass).activeAbility"
      tier-label="Active"
    />
    <AbilityBlock
      :content="(item as PlayerClass).passiveAbility"
      tier-label="Passive"
    />
    <template v-if="(item as PlayerClass).pocketDimension">
      <div class="extra-block">
        <div class="ability-section-title">
          Pocket dimension ({{ (item as PlayerClass).pocketDimension!.gridSize }})
        </div>
        <template v-if="(item as PlayerClass).pocketDimension!.wraith">
          <div class="ability-section-title">Wraith</div>
          <p class="ability-section-body">
            <RuleText
              :text="`HP ${(item as PlayerClass).pocketDimension!.wraith!.hp}, Speed ${(item as PlayerClass).pocketDimension!.wraith!.speed}. ${(item as PlayerClass).pocketDimension!.wraith!.strike}. On death: ${(item as PlayerClass).pocketDimension!.wraith!.onDeath}. ${(item as PlayerClass).pocketDimension!.wraith!.notes}`"
            />
          </p>
        </template>
        <template v-if="(item as PlayerClass).pocketDimension!.hermeticCrystal">
          <div class="ability-section-title">Hermetic crystal</div>
          <p class="ability-section-body">
            <RuleText
              :text="`HP ${(item as PlayerClass).pocketDimension!.hermeticCrystal!.hp}, Speed ${(item as PlayerClass).pocketDimension!.hermeticCrystal!.speed}. ${(item as PlayerClass).pocketDimension!.hermeticCrystal!.special}`"
            />
          </p>
        </template>
      </div>
    </template>
  </template>

  <template v-else-if="kind === 'armor'">
    <p class="item-stat">Speed {{ (item as PlayerArmor).speed }}</p>
    <AbilityBlock
      v-if="(item as PlayerArmor).specialMovement && (item as PlayerArmor).specialMovement !== 'N/A'"
      :content="(item as PlayerArmor).specialMovement"
      tier-label="Movement"
    />
    <p v-if="(item as PlayerArmor).special" class="item-ability">
      <span class="ability-label">Special</span>
      <RuleText :text="(item as PlayerArmor).special!" />
    </p>
    <AbilityBlock
      :content="(item as PlayerArmor).armorAction"
      tier-label="Armor action"
    />
    <p v-if="showReversals && (item as PlayerArmor).reversal" class="item-ability">
      <span class="ability-label">
        Reversal ({{ (item as PlayerArmor).reversal!.charges }} charges)
      </span>
      <RuleText :text="(item as PlayerArmor).reversal!.effect" />
    </p>
    <template v-if="(item as PlayerArmor).towers?.length">
      <div class="extra-block">
        <div class="ability-section-title">Towers</div>
        <div v-for="tower in (item as PlayerArmor).towers" :key="tower.name" class="tower-block">
          <div
            class="ability-section-title"
            :class="{ 'tower-selected': selectedTower === tower.name }"
          >
            {{ tower.name }}
          </div>
          <p class="ability-section-body">
            <RuleText
              :text="`${tower.tags}, HP ${tower.hp}${tower.scale > 1 ? `, scale ${tower.scale}` : ''}. ${tower.special}`"
            />
          </p>
        </div>
      </div>
    </template>
  </template>

  <template v-else-if="kind === 'equipment' || kind === 'gear'">
    <p v-if="kind === 'gear'" class="item-stat">
      {{ (item as PlayerGear).slot === "armor" ? "Armor gear" : "Weapon gear" }}
    </p>
    <p class="item-ability">
      <span class="ability-label">Effect</span>
      <RuleText :text="(item as PlayerEquipment | PlayerGear).effect" />
    </p>
  </template>

  <template v-else>
    <WeaponPatternDiagram
      v-if="(item as PlayerWeapon).attack"
      :attack="(item as PlayerWeapon).attack!"
      :bomb-index="weaponBombIndex"
      :selectable="weaponBombSelectable"
      @update:bomb-index="emit('update:weaponBombIndex', $event)"
      @request-select="emit('requestWeaponBombSelect', $event)"
    />
    <AbilityBlock
      :content="(item as PlayerWeapon).activeAbility"
      tier-label="Active"
    />
    <AbilityBlock
      :content="(item as PlayerWeapon).passiveAbility"
      tier-label="Passive"
      :hide-sections="!!(item as PlayerWeapon).attack?.bombs?.length"
    />
  </template>
</template>

<style scoped>
.item-stat {
  margin: 0.5rem 0 0;
  color: var(--color-text);
  font-size: 0.85rem;
}

.item-ability {
  margin: 0.5rem 0 0;
  line-height: 1.45;
}

.extra-block,
.tower-block {
  margin-top: 0.5rem;
}

.ability-section-title {
  margin: 0.45rem 0 0.15rem;
  text-transform: uppercase;
  color: var(--color-text);
}

.ability-section-title.tower-selected {
  color: var(--color-accent-bright);
}

.ability-section-body {
  margin: 0.15rem 0 0.35rem;
  line-height: 1.45;
}
</style>
