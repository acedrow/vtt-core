import type { BoardCoord, PatternDirection, PatternModifierValues } from "@gaem/shared";
import {
  canExtendArc,
  clampModifierSize,
  clampPatternSize,
  DEFAULT_MODIFIER_VALUES,
  drawableExpansionOptions,
  getModifierById,
  getPatternById,
  hasBlobHole,
  nextPatternDirection,
} from "@gaem/shared";
import { computed, ref, watch } from "vue";

const selectedPatternId = ref<string | null>(null);
const patternSize = ref(1);
const patternDirection = ref<PatternDirection>("n");
const wallLopsidedExtra = ref<"left" | "right">("right");
const modifierValues = ref<PatternModifierValues>({ ...DEFAULT_MODIFIER_VALUES });
const selectedModifierId = ref<string | null>(null);
const drawnTiles = ref<BoardCoord[]>([]);
const patternHoverOrigin = ref<BoardCoord | null>(null);

export function usePatternSelection() {
  const selectedPattern = computed(() => {
    if (!selectedPatternId.value) return null;
    return getPatternById(selectedPatternId.value) ?? null;
  });

  const isPatternMode = computed(() => selectedPatternId.value !== null);

  const isDrawablePattern = computed(
    () => selectedPattern.value?.kind === "drawable",
  );

  const isDrawing = computed(() => drawnTiles.value.length > 0);

  const activeModifiers = computed(() => modifierValues.value);

  function selectPattern(id: string | null) {
    if (id === selectedPatternId.value) {
      selectedPatternId.value = null;
      drawnTiles.value = [];
      patternHoverOrigin.value = null;
      return;
    }
    selectedPatternId.value = id;
    drawnTiles.value = [];
    patternHoverOrigin.value = null;
    const pattern = id ? getPatternById(id) : null;
    if (pattern) patternSize.value = pattern.size.default;
  }

  function selectModifier(id: string | null) {
    selectedModifierId.value = selectedModifierId.value === id ? null : id;
  }

  function clearPatternSelection() {
    selectedPatternId.value = null;
    selectedModifierId.value = null;
    drawnTiles.value = [];
    patternHoverOrigin.value = null;
    modifierValues.value = { ...DEFAULT_MODIFIER_VALUES };
  }

  function clampSize(value: number): number {
    const pattern = selectedPattern.value;
    if (!pattern) return 1;
    return clampPatternSize(pattern, value);
  }

  function clampModifierValue(id: keyof PatternModifierValues, value: number): number {
    const modifier = getModifierById(id);
    if (!modifier) return value;
    return clampModifierSize(modifier, value);
  }

  function adjustPatternSize() {
    if (drawnTiles.value.length > patternSize.value) {
      drawnTiles.value = drawnTiles.value.slice(0, patternSize.value);
    }
  }

  function setModifierValue(id: keyof PatternModifierValues, value: number) {
    modifierValues.value = {
      ...modifierValues.value,
      [id]: clampModifierValue(id, value),
    };
  }

  function cyclePatternDirection() {
    patternDirection.value = nextPatternDirection(patternDirection.value);
  }

  function setPatternHoverOrigin(origin: BoardCoord | null) {
    patternHoverOrigin.value = origin;
  }

  function resetDrawing() {
    drawnTiles.value = [];
  }

  function tryExtendDrawing(coord: BoardCoord, width: number, height: number): boolean {
    const pattern = selectedPattern.value;
    if (!pattern || pattern.kind !== "drawable") return false;

    const key = `${coord.x},${coord.y}`;
    const index = drawnTiles.value.findIndex((t) => `${t.x},${t.y}` === key);
    if (index >= 0) {
      drawnTiles.value = drawnTiles.value.slice(0, index);
      return true;
    }

    if (drawnTiles.value.length >= patternSize.value) return false;

    if (drawnTiles.value.length === 0) {
      drawnTiles.value = [coord];
      return true;
    }

    const options = drawableExpansionOptions(drawnTiles.value, patternSize.value, width, height);
    if (!options.some((o) => o.x === coord.x && o.y === coord.y)) return false;

    const next = [...drawnTiles.value, coord];
    if (pattern.id === "blob" && hasBlobHole(next)) return false;
    if (pattern.id === "arc" && !canExtendArc(drawnTiles.value, coord, patternSize.value)) {
      return false;
    }

    drawnTiles.value = next;
    return true;
  }

  watch(selectedPatternId, () => {
    drawnTiles.value = [];
    patternHoverOrigin.value = null;
  });

  return {
    selectedPatternId,
    selectedPattern,
    selectedModifierId,
    patternSize,
    patternDirection,
    wallLopsidedExtra,
    modifierValues,
    activeModifiers,
    drawnTiles,
    patternHoverOrigin,
    isPatternMode,
    isDrawablePattern,
    isDrawing,
    selectPattern,
    selectModifier,
    clearPatternSelection,
    clampSize,
    clampModifierValue,
    adjustPatternSize,
    setModifierValue,
    cyclePatternDirection,
    setPatternHoverOrigin,
    resetDrawing,
    tryExtendDrawing,
  };
}
