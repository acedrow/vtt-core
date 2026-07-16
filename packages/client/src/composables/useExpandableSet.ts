import { ref } from "vue";

export function useExpandableSet() {
  const expanded = ref<Set<string>>(new Set());

  function isExpanded(key: string): boolean {
    return expanded.value.has(key);
  }

  function toggle(key: string) {
    if (expanded.value.has(key)) expanded.value.delete(key);
    else expanded.value.add(key);
  }

  function expand(key: string) {
    if (expanded.value.has(key)) return;
    const next = new Set(expanded.value);
    next.add(key);
    expanded.value = next;
  }

  return { expanded, isExpanded, toggle, expand };
}
