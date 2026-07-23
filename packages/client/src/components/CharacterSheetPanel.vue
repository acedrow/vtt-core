<script setup lang="ts">
import {
  boardModeForEquipment,
  extrasFromSheetData,
  extrasPayload,
  sheetChromeForSlot,
  sheetFieldForArmor,
  visibleSheetFields,
} from "../client-content-pack.js";
import type { CharacterSheet, PlayerProfile } from "@vtt-core/shared";
import { getArmorByName, getClassByName, classGrantsSecondWeapon, classGrantsDualGear, getEquipmentByName, getGearByName, getWeaponByName, getClassMaxHp, getHeavenBurningLevel, getSabaothChargesRemaining, hasSabaothBombSelected, isSabaothWeaponName } from "@vtt-core/shared";
import { computed, nextTick, onUnmounted, ref, watch } from "vue";

import AbilityBlock from "./AbilityBlock.vue";
import CharacterSheetCombat from "./CharacterSheetCombat.vue";
import HpBar from "./HpBar.vue";
import ModalDialog from "./ModalDialog.vue";
import RuleText from "./RuleText.vue";
import SheetActionButton from "./SheetActionButton.vue";
import SheetGearFieldRow from "./SheetGearFieldRow.vue";
import WeaponPatternDiagram from "./WeaponPatternDiagram.vue";
import { useApi } from "../composables/useApi.js";
import { useBoardActionMode } from "../composables/useBoardActionMode.js";
import { useBoardSelection } from "../composables/useBoardSelection.js";
import { useCampaignUnlocks } from "../composables/useCampaignUnlocks.js";
import { useCharacterSheetSelection, type GearField } from "../composables/useCharacterSheetSelection.js";
import { useCombatActions } from "../composables/useCombatActions.js";
import { useCombatModeActions } from "../composables/useCombatModeActions.js";
import { useCombatModeHints } from "../composables/useCombatModeHints.js";
import { useGameState } from "../composables/useGameState.js";
import { useSession } from "../composables/useSession.js";

type PlayerProfileOption = PlayerProfile & { isActive?: boolean };
type EditableField = "name" | "player" | "tags";

const props = defineProps<{ sheetId: string }>();

const { apiFetch, fetchPortraitUrl, fetchPlayerProfiles } = useApi();
const { role, playerProfile } = useSession();
const { gameState, yourPlayerId, send } = useGameState();
const { selectSheet, notifySheetsChanged, startGearPick, gearPick } = useCharacterSheetSelection();
const { closeRightPanel } = useBoardSelection();
const { hasEquipmentSlot, hasGearSlot, hasSecondWeaponSlot } = useCampaignUnlocks();

const sheet = ref<CharacterSheet | null>(null);
const profiles = ref<PlayerProfileOption[]>([]);
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const uploading = ref(false);
const error = ref<string | null>(null);
const portraitUrl = ref<string | null>(null);

const form = ref({
  player: "",
  name: "",
  class: "",
  armor: "",
  weapon: "",
  equipment: "",
  gear: "",
  gearArmor: "",
  weapon2: "",
  extras: {} as Record<string, string>,
  tags: [] as string[],
});
const editingField = ref<EditableField | null>(null);
const fieldInputEl = ref<HTMLInputElement | HTMLSelectElement | null>(null);
const nameInputEl = ref<HTMLInputElement | null>(null);
const tagsInputEl = ref<HTMLTextAreaElement | null>(null);
const tagsDraft = ref("");

const canEdit = computed(() => {
  if (!sheet.value) return false;
  if (role.value === "gm") return true;
  return role.value === "player" && playerProfile.value?.id === sheet.value.player;
});

const boardPlayer = computed(() =>
  gameState.value?.players.find((p) => p.characterSheetId === props.sheetId)
);

const boardPlayerId = computed(() => boardPlayer.value?.id ?? null);

// Read equipmentUses from gameState directly so charge UI updates on every state broadcast
const equipmentUsesRemaining = computed(() => {
  const players = gameState.value?.players;
  if (!players) return 1;
  const p = players.find((x) => x.characterSheetId === props.sheetId);
  return p?.equipmentUses ?? 1;
});

const hasEquipmentCharge = computed(() => equipmentUsesRemaining.value > 0);

const equippedWeaponName = computed(() => boardPlayer.value?.weapon ?? form.value.weapon);
const carriedWeaponName = computed(() => boardPlayer.value?.weapon2 ?? form.value.weapon2);

watch(
  () =>
    boardPlayer.value?.characterSheetId === props.sheetId
      ? ([boardPlayer.value.weapon, boardPlayer.value.weapon2 ?? ""] as const)
      : null,
  (weapons) => {
    if (!weapons) return;
    form.value.weapon = weapons[0] ?? form.value.weapon;
    form.value.weapon2 = weapons[1];
  },
);

const {
  showPlayerActionBar,
  combatUiUnlocked,
  canMain,
  canSupport,
  canAux,
  canUseWeaponActive,
  canUseHeavenBurningUnfold,
  canUseClassActive,
  hasThrownTrap,
  armorStructured,
  sendPlayerAction,
} = useCombatActions(() => boardPlayerId.value);

const {
  mode,
  attackAimed,
  attackAnchor,
  omnistrikeStep,
  omnistrikeBombs,
  setMode,
} = useBoardActionMode();

const playerClass = computed(() => form.value.class);

const {
  pickArmorMode,
  useClassActive,
  openEpeusBag,
  useHephaestusRestore,
  recallHarpeTrap,
  useWeaponActive,
  toggleWeaponAttack,
  onDualBombIndices,
  onDualBombComplete,
  clearMode,
  classModeActive,
} = useCombatModeActions({ playerClass, playerId: () => boardPlayerId.value });

const equipmentActionActive = computed(() => {
  const boardMode = form.value.equipment ? boardModeForEquipment(form.value.equipment) : null;
  return boardMode != null && mode.value === boardMode;
});

const { rangeAttackHint, rangedPatternAttackHint, omnistrikeHint, equipmentCorridorHint, warhookHint } =
  useCombatModeHints({
    player: boardPlayer,
    weaponName: equippedWeaponName,
  });

const showSheetCombatActions = computed(
  () => !!boardPlayer.value && showPlayerActionBar.value,
);

const showSecondWeaponRow = computed(
  () => hasSecondWeaponSlot.value || classGrantsSecondWeapon(form.value.class),
);
const showWeaponGearRow = computed(
  () => hasGearSlot.value || classGrantsDualGear(form.value.class),
);
const showArmorGearRow = computed(() => classGrantsDualGear(form.value.class));
const armorSheetField = computed(() => sheetFieldForArmor(form.value.armor));
const selectedArmorExtra = computed(() => {
  const field = armorSheetField.value;
  if (!field) return undefined;
  return form.value.extras[field.dataKey] || undefined;
});
const classChrome = computed(() =>
  sheetChromeForSlot("classActions", { className: form.value.class }),
);
const weaponChrome = computed(() =>
  sheetChromeForSlot("weaponActions", { weaponName: equippedWeaponName.value }),
);
const weaponSublines = computed(() =>
  sheetChromeForSlot("weaponSubline", { weaponName: equippedWeaponName.value }),
);
const gearChrome = computed(() =>
  sheetChromeForSlot("gearActions", { className: form.value.class }),
);
const gearArmorChrome = computed(() =>
  sheetChromeForSlot("gearArmorActions", { className: form.value.class }),
);
const replacesWeaponActive = computed(() =>
  weaponChrome.value.some((plugin) => plugin.replacesWeaponActive),
);

const canUseEquipmentCharge = computed(() => {
  if (!canSupport.value || !form.value.equipment) return false;
  return hasEquipmentCharge.value;
});

const canUseBaselineCommunism = computed(() => hasEquipmentCharge.value);

function weaponHasAttack(weaponName: string) {
  return !!getWeaponByName(weaponName)?.attack;
}

function canUseWeaponAttack(weaponName: string) {
  if (!weaponHasAttack(weaponName)) return false;
  if (!isSabaothWeaponName(weaponName)) return true;
  return hasSabaothBombSelected(boardPlayer.value ?? undefined);
}

function swapWeapon() {
  clearMode();
  sendPlayerAction({ action: "weaponSwap" });
}

const canSwapWeapon = computed(() => !!carriedWeaponName.value);
const weaponBombIndex = computed(() => boardPlayer.value?.counters?.sabaothBomb);
const weaponBombSelectable = computed(
  () =>
    combatUiUnlocked.value &&
    yourPlayerId.value === boardPlayerId.value &&
    isSabaothWeaponName(equippedWeaponName.value) &&
    !!getWeaponByName(equippedWeaponName.value)?.attack?.bombs?.length,
);
const attackTooltipPinned = computed(
  () => mode.value === "attack" && !!selectedWeapon.value?.attack?.bombs?.length,
);
const weaponVariantConfirmOpen = ref(false);
const pendingWeaponVariantIndex = ref<number | null>(null);
const weaponSublineText = computed(() => {
  const player = boardPlayer.value;
  if (!player || !combatUiUnlocked.value) return null;
  for (const plugin of weaponSublines.value) {
    const text = plugin.formatSubline?.(player);
    if (text) return text;
  }
  return null;
});
const heavenBurningLevelRemaining = computed(() => {
  const player = boardPlayer.value;
  if (!player) return null;
  return getHeavenBurningLevel(player);
});
const heavenBurningAttackLevelIndex = computed(() => {
  const level = heavenBurningLevelRemaining.value;
  if (level == null) return undefined;
  return level - 1;
});
const canConfirmWeaponVariant = computed(() => {
  const player = boardPlayer.value;
  if (!player) return false;
  return (getSabaothChargesRemaining(player) ?? 0) > 0;
});

function useHeavenBurningUnfold() {
  sendPlayerAction({
    action: "pack",
    kind: "weaponActive",
    detail: { detail: "heaven_burning_unfold" },
  });
}

function runSheetChromeAction(action: string | undefined) {
  if (!action) return;
  if (action === "hephaestusRestore") useHephaestusRestore();
  else if (action === "harpeRecall") recallHarpeTrap();
  else if (action === "heavenBurningUnfold") useHeavenBurningUnfold();
  else if (action === "epeusBagWeapon") openEpeusBag("weapon");
  else if (action === "epeusBagArmor") openEpeusBag("armor");
}

function sheetChromeDisabled(action: string | undefined): boolean {
  if (action === "hephaestusRestore") return !canUseBaselineCommunism.value;
  if (action === "harpeRecall") return !canSupport.value || !hasThrownTrap.value;
  if (action === "heavenBurningUnfold") return !canUseHeavenBurningUnfold.value;
  if (action === "epeusBagWeapon" || action === "epeusBagArmor") return !canMain.value;
  return false;
}

function requestWeaponVariantChange(index: number) {
  if (index === weaponBombIndex.value) return;
  if (!weaponBombSelectable.value) return;
  pendingWeaponVariantIndex.value = index;
  weaponVariantConfirmOpen.value = true;
}

function confirmWeaponVariantChange() {
  if (pendingWeaponVariantIndex.value == null) return;
  selectWeaponVariant(pendingWeaponVariantIndex.value);
  weaponVariantConfirmOpen.value = false;
  pendingWeaponVariantIndex.value = null;
}

function cancelWeaponVariantChange() {
  weaponVariantConfirmOpen.value = false;
  pendingWeaponVariantIndex.value = null;
}

function selectWeaponVariant(index: number) {
  if (index === weaponBombIndex.value) return;
  attackAimed.value = false;
  attackAnchor.value = null;
  sendPlayerAction({ action: "selectWeaponVariant", index });
}

function useEquipmentItem() {
  if (!form.value.equipment) return;
  const boardMode = boardModeForEquipment(form.value.equipment);
  if (boardMode) {
    if (mode.value === boardMode) clearMode();
    else {
      attackAimed.value = false;
      attackAnchor.value = null;
      setMode(boardMode);
    }
    return;
  }
  sendPlayerAction({ action: "useEquipment", detail: form.value.equipment });
}

function useGearItem() {
  sendPlayerAction({ action: "interact", detail: form.value.gear });
}

const maxHp = computed(() => getClassMaxHp(form.value.class));
const currentHp = computed(() => boardPlayer.value?.hp ?? 0);

const selectedClass = computed(() => getClassByName(form.value.class));
const selectedArmor = computed(() => getArmorByName(form.value.armor));
const selectedWeapon = computed(() => getWeaponByName(equippedWeaponName.value));
const selectedEquipment = computed(() => getEquipmentByName(form.value.equipment));
const selectedGear = computed(() => getGearByName(form.value.gear));
const selectedArmorGear = computed(() => getGearByName(form.value.gearArmor));
const selectedWeapon2 = computed(() => getWeaponByName(carriedWeaponName.value));
const selectedProfileName = computed(
  () => profiles.value.find((p) => p.id === form.value.player)?.name ?? form.value.player
);

async function loadProfiles() {
  if (role.value !== "gm") return;
  profiles.value = await fetchPlayerProfiles();
}

async function loadPortrait() {
  if (portraitUrl.value) {
    URL.revokeObjectURL(portraitUrl.value);
    portraitUrl.value = null;
  }
  if (!sheet.value?.portraitKey) return;
  portraitUrl.value = await fetchPortraitUrl(props.sheetId);
}

function syncBoardLoadoutIfNeeded() {
  const bp = boardPlayer.value;
  if (!bp) return;
  const boardExtras = extrasFromSheetData(bp.data);
  const formExtras = form.value.extras;
  let extrasOutOfSync = false;
  for (const field of visibleSheetFields({
    class: form.value.class,
    armor: form.value.armor,
    weapon: form.value.weapon,
  })) {
    if ((boardExtras[field.dataKey] ?? "") !== (formExtras[field.dataKey] ?? "")) {
      extrasOutOfSync = true;
      break;
    }
  }
  const outOfSync =
    bp.class !== form.value.class ||
    bp.armor !== form.value.armor ||
    (bp.equipment ?? "") !== form.value.equipment ||
    (bp.gear ?? "") !== form.value.gear ||
    (bp.gearArmor ?? "") !== form.value.gearArmor ||
    extrasOutOfSync;
  if (!outOfSync) return;
  send({
    type: "syncPlayerSheet",
    characterSheetId: props.sheetId,
    class: form.value.class,
    armor: form.value.armor,
    weapon: form.value.weapon,
    equipment: form.value.equipment,
    gear: form.value.gear,
    gearArmor: form.value.gearArmor || undefined,
    weapon2: form.value.weapon2,
    data: extrasPayload(form.value.extras),
  });
}

async function loadSheet() {
  loading.value = true;
  error.value = null;
  try {
    const res = await apiFetch(`/api/character-sheets/${props.sheetId}`);
    if (!res.ok) throw new Error("Character sheet not found");
    const data = (await res.json()) as { sheet: CharacterSheet };
    sheet.value = data.sheet;
    form.value = {
      player: data.sheet.player,
      name: data.sheet.name,
      class: data.sheet.class,
      armor: data.sheet.armor,
      weapon: data.sheet.weapon,
      equipment: data.sheet.equipment ?? "",
      gear: data.sheet.gear ?? "",
      gearArmor: data.sheet.gearArmor ?? "",
      weapon2: data.sheet.weapon2 ?? "",
      extras: extrasFromSheetData(data.sheet.data),
      tags: [...(data.sheet.tags ?? [])],
    };
    await loadPortrait();
    syncBoardLoadoutIfNeeded();
  } catch {
    error.value = "Unable to load character sheet";
    sheet.value = null;
  } finally {
    loading.value = false;
  }
}

async function saveSheet() {
  if (!sheet.value || !canEdit.value) return;
  saving.value = true;
  error.value = null;
  try {
    const body: Record<string, unknown> = {
      name: form.value.name,
      class: form.value.class,
      armor: form.value.armor,
      weapon: form.value.weapon,
      equipment: form.value.equipment,
      gear: form.value.gear,
      gearArmor: form.value.gearArmor,
      weapon2: form.value.weapon2,
      tags: form.value.tags,
      ...form.value.extras,
    };
    if (role.value === "gm") body.player = form.value.player;

    const res = await apiFetch(`/api/character-sheets/${props.sheetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Failed to save");
    }
    const data = (await res.json()) as { sheet: CharacterSheet };
    sheet.value = data.sheet;
    notifySheetsChanged();
    if (boardPlayer.value) {
        send({
          type: "syncPlayerSheet",
          characterSheetId: props.sheetId,
          class: form.value.class,
          armor: form.value.armor,
          weapon: form.value.weapon,
          equipment: form.value.equipment,
          gear: form.value.gear,
          weapon2: form.value.weapon2,
          data: extrasPayload(form.value.extras),
        });
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unable to save";
  } finally {
    saving.value = false;
  }
}

function resetFormFromSheet() {
  if (!sheet.value) return;
  form.value = {
    player: sheet.value.player,
    name: sheet.value.name,
    class: sheet.value.class,
    armor: sheet.value.armor,
    weapon: sheet.value.weapon,
    equipment: sheet.value.equipment ?? "",
    gear: sheet.value.gear ?? "",
    gearArmor: sheet.value.gearArmor ?? "",
    weapon2: sheet.value.weapon2 ?? "",
    extras: extrasFromSheetData(sheet.value.data),
    tags: [...(sheet.value.tags ?? [])],
  };
  tagsDraft.value = "";
}

function parseTagsDraft(text: string): string[] {
  return text.split("\n").map((t) => t.trim()).filter(Boolean);
}

function startFieldEdit(field: EditableField) {
  if (!canEdit.value) return;
  if (field === "tags") tagsDraft.value = form.value.tags.join("\n");
  editingField.value = field;
  nextTick(() => {
    const el =
      field === "name" ? nameInputEl.value : field === "tags" ? tagsInputEl.value : fieldInputEl.value;
    el?.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select();
  });
}

function startGearFieldEdit(field: GearField) {
  if (!canEdit.value || !sheet.value) return;
  const gearSlotFilter =
    field === "gearArmor"
      ? "armor"
      : field === "gear" && classGrantsDualGear(form.value.class)
        ? "weapon"
        : undefined;
  startGearPick(
    props.sheetId,
    field,
    form.value[field],
    field === "armor" ? form.value.extras : undefined,
    gearSlotFilter,
  );
}

async function commitFieldEdit() {
  if (!editingField.value) return;
  if (editingField.value === "tags") {
    form.value.tags = parseTagsDraft(tagsDraft.value);
  }
  editingField.value = null;
  tagsDraft.value = "";
  await saveSheet();
}

function cancelFieldEdit() {
  editingField.value = null;
  tagsDraft.value = "";
  resetFormFromSheet();
}

async function deleteSheet() {
  if (!sheet.value || !confirm("Delete this character sheet?")) return;
  deleting.value = true;
  error.value = null;
  try {
    const res = await apiFetch(`/api/character-sheets/${props.sheetId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete");
    notifySheetsChanged();
    closeRightPanel();
    selectSheet(null);
  } catch {
    error.value = "Unable to delete character sheet";
  } finally {
    deleting.value = false;
  }
}

function spawnToken() {
  if (!sheet.value || boardPlayer.value) return;
  send({ type: "spawnPlayerToken", characterSheetId: props.sheetId });
}

function removeToken() {
  const playerId = boardPlayer.value?.id;
  if (!playerId) return;
  send({ type: "removePlayerToken", playerId });
}

async function onPortraitSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !sheet.value) return;

  uploading.value = true;
  error.value = null;
  try {
    const res = await apiFetch(`/api/character-sheets/${props.sheetId}/portrait`, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Failed to upload portrait");
    }
    const data = (await res.json()) as { sheet: CharacterSheet };
    sheet.value = data.sheet;
    await loadPortrait();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Unable to upload portrait";
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

function commitHp(hp: number) {
  if (!canEdit.value || !boardPlayer.value) return;
  send({ type: "setPlayerHp", playerId: boardPlayer.value.id, hp });
}

watch(
  () => props.sheetId,
  async (id) => {
    if (!id) return;
    editingField.value = null;
    await loadProfiles();
    await loadSheet();
  },
  { immediate: true }
);

watch(gearPick, (pick, prev) => {
  if (prev && !pick) loadSheet();
});

onUnmounted(() => {
  if (portraitUrl.value) URL.revokeObjectURL(portraitUrl.value);
});
</script>

<template>
  <div class="panel">
    <svg aria-hidden="true" class="icon-defs">
      <symbol id="icon-pencil" viewBox="0 0 16 16">
        <path
          d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.387 8.387L2.5 14.5l1.126-3.666 8.387-8.387z"
        />
      </symbol>
    </svg>

    <div class="panel-header">
      <div v-if="sheet" class="sheet-hero">
        <div class="portrait-block">
          <div class="portrait-frame" :class="{ editable: canEdit }">
            <img v-if="portraitUrl" :src="portraitUrl" alt="Portrait" class="portrait" />
            <span v-else class="portrait-placeholder">No portrait</span>
            <label v-if="canEdit" class="portrait-edit-btn" :class="{ uploading }">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                :disabled="uploading"
                @change="onPortraitSelected"
              />
              <svg class="icon"><use href="#icon-pencil" /></svg>
            </label>
          </div>
        </div>

        <div class="sheet-summary">
          <div class="sheet-title-row">
            <input
              v-if="editingField === 'name'"
              ref="nameInputEl"
              v-model="form.name"
              class="panel-title-input"
              type="text"
              required
              @blur="commitFieldEdit"
              @keydown.enter.prevent="commitFieldEdit"
              @keydown.esc.prevent="cancelFieldEdit"
            />
            <h2
              v-else
              class="panel-title"
              :class="{ editable: canEdit }"
              @click="canEdit && startFieldEdit('name')"
            >
              {{ form.name || "Character sheet" }}
            </h2>
            <button class="close-btn close-btn--ghost" type="button" title="Close" @click="closeRightPanel">×</button>
          </div>

          <HpBar
            inline
            class="sheet-hp-bar"
            :current-hp="currentHp"
            :max-hp="maxHp"
            :editable="canEdit && !!boardPlayer"
            @commit="commitHp"
          />

          <div class="field-row tags-row">
            <template v-if="editingField !== 'tags'">
              <span class="field-label">Tags:</span>
              <div class="tags">
                <span v-for="tag in form.tags" :key="tag" class="tag">{{ tag }}</span>
                <span v-if="!form.tags.length" class="field-value">—</span>
              </div>
              <button
                v-if="canEdit"
                type="button"
                class="edit-btn"
                aria-label="Edit tags"
                @click="startFieldEdit('tags')"
              >
                <svg class="icon"><use href="#icon-pencil" /></svg>
              </button>
            </template>
            <template v-else>
              <span class="field-label">Tags:</span>
              <textarea
                ref="tagsInputEl"
                v-model="tagsDraft"
                class="field-input tags-input"
                rows="3"
                placeholder="One tag per line"
                @blur="commitFieldEdit"
                @keydown.esc.prevent="cancelFieldEdit"
              />
            </template>
          </div>
        </div>
      </div>
      <div v-else class="sheet-title-row">
        <h2 class="panel-title">Character sheet</h2>
        <button class="close-btn close-btn--ghost" type="button" title="Close" @click="closeRightPanel">×</button>
      </div>
    </div>

    <p v-if="loading" class="muted">Loading…</p>
    <p v-else-if="error && !sheet" class="error">{{ error }}</p>

    <div v-else-if="sheet" class="panel-body">
      <CharacterSheetCombat v-if="boardPlayer" :player-id="boardPlayer.id" />
      <p v-if="error" class="error">{{ error }}</p>

      <div class="fields">
          <div v-if="role === 'gm'" class="field-row">
            <template v-if="editingField !== 'player'">
              <span class="field-label">Player:</span>
              <span class="field-value">{{ selectedProfileName || "—" }}</span>
              <button
                v-if="canEdit"
                type="button"
                class="edit-btn"
                aria-label="Edit player"
                @click="startFieldEdit('player')"
              >
                <svg class="icon"><use href="#icon-pencil" /></svg>
              </button>
            </template>
            <template v-else>
              <span class="field-label">Player:</span>
              <select
                ref="fieldInputEl"
                v-model="form.player"
                class="field-input"
                @change="commitFieldEdit"
                @blur="commitFieldEdit"
                @keydown.esc.prevent="cancelFieldEdit"
              >
                <option v-for="p in profiles" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </template>
          </div>

          <SheetGearFieldRow
            label="Class"
            :value="form.class"
            kind="classes"
            :item="selectedClass"
            :can-edit="canEdit"
            @start-edit="startGearFieldEdit('class')"
          >
            <template v-if="showSheetCombatActions && selectedClass" #actions>
              <SheetActionButton
                :active="classModeActive"
                :disabled="!canUseClassActive"
                @click="useClassActive"
              >
                Active ability
                <template #tooltip>
                  <AbilityBlock tier-label="Active" :content="selectedClass.activeAbility" />
                </template>
              </SheetActionButton>
              <SheetActionButton
                v-for="plugin in classChrome"
                :key="plugin.id"
                :active="plugin.modeId ? mode === plugin.modeId : false"
                :disabled="sheetChromeDisabled(plugin.action)"
                @click="runSheetChromeAction(plugin.action)"
              >
                {{ plugin.label }}
                <template v-if="plugin.action === 'hephaestusRestore'" #tooltip>
                  <AbilityBlock tier-label="Free action" :content="selectedClass.passiveAbility" />
                </template>
              </SheetActionButton>
            </template>
          </SheetGearFieldRow>

          <SheetGearFieldRow
            label="Armor"
            :value="form.armor"
            kind="armor"
            :item="selectedArmor"
            :can-edit="canEdit"
            :selected-tower="selectedArmorExtra"
            @start-edit="startGearFieldEdit('armor')"
          >
            <template v-if="showSheetCombatActions && selectedArmor" #actions>
              <SheetActionButton
                :active="mode === 'armorTeleport' || mode === 'armorPush' || mode === 'armorPlaceTower'"
                :disabled="!canSupport || !armorStructured"
                @click="pickArmorMode(armorStructured)"
              >
                Active ability
                <template #tooltip>
                  <AbilityBlock
                    tier-label="Armor action"
                    :content="selectedArmor.armorAction"
                  />
                </template>
              </SheetActionButton>
            </template>
          </SheetGearFieldRow>

          <SheetGearFieldRow
            label="Equipped weapon"
            :value="equippedWeaponName"
            kind="weapons"
            :item="selectedWeapon"
            :can-edit="canEdit"
            :weapon-bomb-index="weaponBombIndex"
            :weapon-bomb-selectable="weaponBombSelectable"
            @request-weapon-bomb-select="requestWeaponVariantChange"
            @start-edit="startGearFieldEdit('weapon')"
          >
            <template v-if="showSheetCombatActions && selectedWeapon" #actions>
              <SheetActionButton
                :active="mode === 'attack'"
                :tooltip-pinned="attackTooltipPinned"
                :disabled="!canMain || !canUseWeaponAttack(equippedWeaponName)"
                @click="toggleWeaponAttack"
              >
                Attack
                <template #tooltip>
                  <WeaponPatternDiagram
                    v-if="selectedWeapon.attack"
                    :attack="selectedWeapon.attack"
                    :bomb-index="weaponBombIndex"
                    :combat-level-index="heavenBurningAttackLevelIndex"
                    :selectable="weaponBombSelectable"
                    @request-select="requestWeaponVariantChange"
                  />
                </template>
              </SheetActionButton>
              <SheetActionButton
                v-for="plugin in weaponChrome"
                :key="plugin.id"
                :disabled="sheetChromeDisabled(plugin.action)"
                @click="runSheetChromeAction(plugin.action)"
              >
                {{ plugin.label }}
                <template #tooltip>
                  <AbilityBlock tier-label="Aux action" :content="selectedWeapon.activeAbility" />
                </template>
              </SheetActionButton>
              <SheetActionButton
                v-if="!replacesWeaponActive"
                :active="mode === 'omnistrike' || mode === 'warhook'"
                :disabled="!canUseWeaponActive"
                @click="useWeaponActive(equippedWeaponName)"
              >
                Active ability
                <template #tooltip>
                  <AbilityBlock tier-label="Active" :content="selectedWeapon.activeAbility" />
                </template>
              </SheetActionButton>
              <SheetActionButton
                :disabled="!canAux || !canSwapWeapon"
                @click="swapWeapon"
              >
                Swap
                <template #tooltip>
                  <AbilityBlock
                    tier-label="Aux action"
                    content="Swap weapon — Switch your equipped and carried weapons."
                  />
                </template>
              </SheetActionButton>
            </template>
            <template v-if="weaponSublineText" #subline>
              {{ weaponSublineText }}
            </template>
            <p v-if="rangeAttackHint" class="range-attack-hint">{{ rangeAttackHint }}</p>
            <p v-if="rangedPatternAttackHint" class="range-attack-hint">{{ rangedPatternAttackHint }}</p>
            <p v-if="omnistrikeHint" class="range-attack-hint">{{ omnistrikeHint }}</p>
            <p v-if="equipmentCorridorHint" class="range-attack-hint">{{ equipmentCorridorHint }}</p>
            <p v-if="warhookHint" class="range-attack-hint">{{ warhookHint }}</p>
            <div
              v-if="mode === 'omnistrike' && omnistrikeStep === 'selectBombs' && selectedWeapon?.attack"
              class="omnistrike-picker"
            >
              <WeaponPatternDiagram
                :attack="selectedWeapon.attack"
                dual-select
                compact
                :dual-bomb-indices="omnistrikeBombs"
                @update:dual-bomb-indices="onDualBombIndices"
                @dual-complete="onDualBombComplete"
              />
            </div>
          </SheetGearFieldRow>

          <SheetGearFieldRow
            v-if="showSecondWeaponRow"
            label="Carried weapon"
            :value="carriedWeaponName"
            kind="weapons"
            :item="selectedWeapon2"
            :can-edit="canEdit"
            @start-edit="startGearFieldEdit('weapon2')"
          />

          <SheetGearFieldRow
            v-if="hasEquipmentSlot"
            label="Equipment"
            :value="form.equipment"
            kind="equipment"
            :item="selectedEquipment"
            :can-edit="canEdit"
            @start-edit="startGearFieldEdit('equipment')"
          >
            <template v-if="showSheetCombatActions && selectedEquipment && form.equipment" #actions>
              <SheetActionButton
                :disabled="!canUseEquipmentCharge"
                :active="equipmentActionActive"
                @click="useEquipmentItem"
              >
                Use
                <template #tooltip>
                  <RuleText :text="selectedEquipment.effect" />
                </template>
              </SheetActionButton>
            </template>
            <template v-if="boardPlayer" #subline>
              <span :key="`eq-${equipmentUsesRemaining}`">
                Equipment charges {{ hasEquipmentCharge ? "●" : "○" }}
              </span>
            </template>
          </SheetGearFieldRow>

          <SheetGearFieldRow
            v-if="showWeaponGearRow"
            :label="showArmorGearRow ? 'Weapon gear' : 'Gear'"
            :value="form.gear"
            kind="gear"
            :item="selectedGear"
            :can-edit="canEdit"
            @start-edit="startGearFieldEdit('gear')"
          >
            <template v-if="showSheetCombatActions && selectedGear && form.gear" #actions>
              <SheetActionButton :disabled="!canSupport" @click="useGearItem">
                Use
                <template #tooltip>
                  <RuleText :text="selectedGear.effect" />
                </template>
              </SheetActionButton>
              <SheetActionButton
                v-for="plugin in gearChrome"
                :key="plugin.id"
                :disabled="sheetChromeDisabled(plugin.action)"
                @click="runSheetChromeAction(plugin.action)"
              >
                {{ plugin.label }}
              </SheetActionButton>
            </template>
          </SheetGearFieldRow>

          <SheetGearFieldRow
            v-if="showArmorGearRow"
            label="Armor gear"
            :value="form.gearArmor"
            kind="gear"
            :item="selectedArmorGear"
            :can-edit="canEdit"
            @start-edit="startGearFieldEdit('gearArmor')"
          >
            <template v-if="showSheetCombatActions && form.gearArmor" #actions>
              <SheetActionButton
                v-for="plugin in gearArmorChrome"
                :key="plugin.id"
                :disabled="sheetChromeDisabled(plugin.action)"
                @click="runSheetChromeAction(plugin.action)"
              >
                {{ plugin.label }}
              </SheetActionButton>
            </template>
          </SheetGearFieldRow>
      </div>
    </div>

    <div v-if="canEdit && sheet" class="panel-footer">
      <button
        v-if="!boardPlayer"
        class="cta"
        type="button"
        :disabled="saving"
        @click="spawnToken"
      >
        Spawn token
      </button>
      <button
        v-else
        class="cta secondary"
        type="button"
        :disabled="saving"
        @click="removeToken"
      >
        Remove token
      </button>
      <button class="cta danger" type="button" :disabled="deleting || saving" @click="deleteSheet">
        {{ deleting ? "Deleting…" : "Delete" }}
      </button>
    </div>

    <ModalDialog
      title="Change weapon pattern"
      :open="weaponVariantConfirmOpen"
      :ok-disabled="!canConfirmWeaponVariant"
      @close="cancelWeaponVariantChange"
      @confirm="confirmWeaponVariantChange"
    >
      <p class="variant-confirm-text">Confirm changing weapon pattern for 1 charge.</p>
    </ModalDialog>
  </div>
</template>

<style scoped>
.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.75rem;
}

.panel-footer {
  flex-shrink: 0;
  display: flex;
  gap: 0.5rem;
  padding-top: 1rem;
}

.icon-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.panel-header {
  flex-shrink: 0;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.sheet-hero {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
}

.sheet-summary {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.1rem;
}

.sheet-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.portrait-block {
  flex-shrink: 0;
}

.sheet-summary :deep(.sheet-hp-bar) {
  margin-bottom: 0;
}

.panel-title {
  margin: 0;
  flex: 1;
  min-width: 0;
}

.panel-title.editable {
  cursor: pointer;
  border-bottom: 1px dashed transparent;
}

.panel-title.editable:hover {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent-muted);
}

.panel-title-input {
  flex: 1;
  min-width: 0;
  margin: 0;
  border: 1px solid var(--color-accent);
  border-radius: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 500;
  letter-spacing: 0.04rem;
  padding: 0.1rem 0.35rem;
}

.portrait-frame {
  position: relative;
  width: 88px;
  height: 88px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-surface);
  display: grid;
  place-items: center;
}

.portrait-frame.editable:hover .portrait-edit-btn,
.portrait-frame.editable:focus-within .portrait-edit-btn {
  opacity: 1;
}

.portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.portrait-placeholder {
  color: var(--color-muted);
  font-size: 0.72rem;
  text-align: center;
  padding: 0 0.25rem;
}

.portrait-edit-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-translucent);
  color: var(--color-text);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.portrait-edit-btn:hover {
  background: var(--color-surface);
  color: var(--color-accent-bright);
}

.portrait-edit-btn.uploading {
  opacity: 1;
  cursor: wait;
}

.portrait-edit-btn .icon {
  width: 0.85rem;
  height: 0.85rem;
  fill: currentColor;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.variant-confirm-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.9rem;
  line-height: 1.4;
  min-height: 1.75rem;
}

.field-label {
  flex-shrink: 0;
  color: var(--color-muted);
  font-weight: 500;
}

.field-value {
  color: var(--color-text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--color-accent);
  border-radius: 0;
  background: var(--color-bg);
  color: var(--color-text);
  padding: 0.2rem 0.45rem;
  font: inherit;
  font-size: 0.9rem;
}

.tags-row {
  align-items: flex-start;
}

.tags-row .tags {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tag {
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  font-size: 0.72rem;
}

.tags-input {
  resize: vertical;
  min-height: 3.5rem;
  line-height: 1.35;
}

.edit-btn {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  padding: 0;
}

.edit-btn:hover {
  color: var(--color-accent-bright);
  background: var(--color-surface-raised);
}

.edit-btn .icon {
  width: 0.75rem;
  height: 0.75rem;
  fill: currentColor;
}

.cta {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text);
  padding: 0.45rem 0.75rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
}

.cta:hover {
  background: var(--color-surface-alt);
}

.cta:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.danger {
  border-color: var(--color-danger-muted-border);
  color: var(--color-danger);
}

.range-attack-hint {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: var(--color-muted);
  line-height: 1.35;
}
</style>
