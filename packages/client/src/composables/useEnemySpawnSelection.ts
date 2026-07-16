import { ref } from "vue";

const selectedSpawnEnemyName = ref<string | null>(null);

export function useEnemySpawnSelection() {
function selectSpawnEnemy(name: string | null) {
  if (name === selectedSpawnEnemyName.value) {
    selectedSpawnEnemyName.value = null;
    return;
  }
  selectedSpawnEnemyName.value = name;
}

  function clearSpawnEnemySelection() {
    selectedSpawnEnemyName.value = null;
  }

  function isSpawnEnemySelected(name: string): boolean {
    return selectedSpawnEnemyName.value === name;
  }

  return {
    selectedSpawnEnemyName,
    selectSpawnEnemy,
    clearSpawnEnemySelection,
    isSpawnEnemySelected,
  };
}
