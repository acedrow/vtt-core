import { computed, type Ref } from "vue";

const HP_MEDIUM_THRESHOLD = 0.5;
const HP_LOW_THRESHOLD = 0.25;

export function useHpBar(currentHp: Ref<number>, maxHp: Ref<number>) {
  const hpPercent = computed(() => {
    if (maxHp.value <= 0) return 0;
    const hp = Math.min(currentHp.value, maxHp.value);
    return Math.max(0, Math.min(100, (hp / maxHp.value) * 100));
  });

  const hpBarLevel = computed(() => {
    if (maxHp.value <= 0) return "high" as const;
    const ratio = Math.min(currentHp.value, maxHp.value) / maxHp.value;
    if (ratio < HP_LOW_THRESHOLD) return "low" as const;
    if (ratio < HP_MEDIUM_THRESHOLD) return "medium" as const;
    return "high" as const;
  });

  return { hpPercent, hpBarLevel };
}
