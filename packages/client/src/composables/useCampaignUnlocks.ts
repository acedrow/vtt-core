import {
  getUnlockedOptionSets,
  getUnlockedFeatures,
  isCampaignFeatureUnlocked,
  isOptionUnlocked,
  type CampaignFeature,
  type UnlockCategory,
} from "@vtt-core/shared";
import { computed } from "vue";

import { useGameState } from "./useGameState.js";

export function useCampaignUnlocks() {
  const { gameState } = useGameState();

  const constructedIds = computed(() => gameState.value?.campaign?.constructedBaseUpgrades ?? []);
  const unlockedSets = computed(() => getUnlockedOptionSets(constructedIds.value));
  const features = computed(() => getUnlockedFeatures(constructedIds.value));

  function optionUnlocked(category: UnlockCategory, name: string): boolean {
    return isOptionUnlocked(category, name, constructedIds.value);
  }

  function featureUnlocked(feature: CampaignFeature): boolean {
    return isCampaignFeatureUnlocked(feature, constructedIds.value);
  }

  return {
    constructedIds,
    unlockedSets,
    features,
    optionUnlocked,
    featureUnlocked,
    hasEquipmentSlot: computed(() => featureUnlocked("equipmentSlot")),
    hasGearSlot: computed(() => featureUnlocked("gearSlot")),
    hasSecondWeaponSlot: computed(() => featureUnlocked("secondWeaponSlot")),
    hasReversals: computed(() => featureUnlocked("reversals")),
  };
}
