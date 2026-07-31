import { computed, type Ref } from "vue";

export function useHpBar(currentHp: Ref<number>, maxHp: Ref<number>) {
  const hpPercent = computed(() => {
    if (maxHp.value <= 0) return 0;
    const hp = Math.min(currentHp.value, maxHp.value);
    return Math.max(0, Math.min(100, (hp / maxHp.value) * 100));
  });

  return { hpPercent };
}
