<script setup lang="ts">
import type { EffectStacks, Enemy, MapTile, Player, TileColorTint } from "@vtt-core/shared";
import { getEnemyMaxHp, getEnemyScale, getPlayerMaxHp, isFortificationEnemy, formatTileEffectTooltipLabel, primaryTerrainTypeForIcon, terrainTypeDisplayName, tileEffectShowsStackCount } from "@vtt-core/shared";
import { computed } from "vue";

import { tileImageLayerStyle } from "../lib/tileColorTint.js";
import EffectIcon from "./EffectIcon.vue";
import HpBar from "./HpBar.vue";
import NoLosIcon from "./NoLosIcon.vue";
import TerrainTypeIcon from "./TerrainTypeIcon.vue";
import { getClientCombatBoard } from "../client-content-pack.js";

const combatBoard = getClientCombatBoard();

export type StackedEnemyRender = {
  enemy: Enemy;
  portraitUrl: string | null;
  portraitBg: string | null;
  hp?: { currentHp: number; maxHp: number };
  selected: boolean;
  dying: boolean;
  defeated: boolean;
  turnEnded: boolean;
  animating: boolean;
};

export type CellRenderState = {
  terrainClass: string | null;
  movable: boolean;
  moveSecondary: boolean;
  moveAegis: boolean;
  deployable: boolean;
  gmMovable: boolean;
  gmSpawnable: boolean;
  patternPrimary: boolean;
  patternSecondary: boolean;
  combatTargetPrimary: boolean;
  combatTargetSecondary: boolean;
  combatTargetHeal: boolean;
  combatTargetInvalid: boolean;
  patternRecoil: boolean;
  tile: MapTile | undefined;
  player: Player | undefined;
  enemyAnchor: Enemy | undefined;
  stackedEnemies?: StackedEnemyRender[];
  enemyHp?: { currentHp: number; maxHp: number };
  showSwarmHp?: boolean;
  effectStacks?: EffectStacks;
  turnEnded?: boolean;
  playerDowned?: boolean;
  playerPortraitUrl?: string | null;
  enemyPortraitUrl?: string | null;
  enemyPortraitBg?: string | null;
  hasSeed?: boolean;
  kopisToken?: boolean;
  kopisTokenMine?: boolean;
  kopisMarked?: boolean;
  trapLine?: boolean;
  trapWeapon?: boolean;
  attractorZone?: boolean;
  attractorCenter?: boolean;
  attractorVoid?: boolean;
  attractorPreviewZone?: boolean;
  attractorPreviewCenter?: boolean;
  attractorPreviewVoid?: boolean;
  towerOwnerHue?: number | null;
  tileEffects?: EffectStacks;
  outOfLineOfSight?: boolean;
  tileAppearanceUrl?: string | null;
  tileOverlayUrl?: string | null;
  tileFeatureUrl?: string | null;
  tileBaseColor?: string | null;
  appearanceTint?: TileColorTint | null;
  overlayTint?: TileColorTint | null;
  featureTint?: TileColorTint | null;
  appearanceRotation?: 0 | 90 | 180 | 270;
  appearanceFlip?: boolean;
  overlayRotation?: 0 | 90 | 180 | 270;
  overlayFlip?: boolean;
  featureRotation?: 0 | 90 | 180 | 270;
  featureFlip?: boolean;
  paintbrushPreview?: {
    baseColor?: string | null;
    appearanceUrl?: string | null;
    overlayUrl?: string | null;
    featureUrl?: string | null;
    appearanceTint?: TileColorTint | null;
    overlayTint?: TileColorTint | null;
    featureTint?: TileColorTint | null;
    appearanceRotation: 0 | 90 | 180 | 270;
    appearanceFlip: boolean;
    overlayRotation: 0 | 90 | 180 | 270;
    overlayFlip: boolean;
    featureRotation: 0 | 90 | 180 | 270;
    featureFlip: boolean;
  } | null;
};

const MAX_VISIBLE_EFFECTS = 4;
const TILE_GLYPH_ICON_SIZE = 8;

const props = defineProps<{
  x: number;
  y: number;
  cell: CellRenderState;
  isHovered: boolean;
  draggingDeploy: boolean;
  playerHue: number | null;
  canDragDeploy: boolean;
  isPlayerSelected: boolean;
  isEnemySelected: boolean;
  isBulkTileSelected?: boolean;
  showHealthBars: boolean;
  showEnemyHealthBars: boolean;
  enemyDying?: boolean;
  enemyDefeated?: boolean;
  playerTeleporting?: boolean;
  enemyAnimating?: boolean;
  paintbrushActive?: boolean;
  gmInheritCursor?: boolean;
}>();

const emit = defineEmits<{
  click: [];
  hover: [];
  unhover: [];
  playerClick: [];
  enemyClick: [enemyId: string];
  enemyDblclick: [enemyId: string];
  deployPointerDown: [event: PointerEvent];
}>();

const effectEntries = computed(() => {
  const stacks = props.cell.effectStacks;
  if (!stacks) return [];
  return Object.entries(stacks)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, stacks]) => ({ id, stacks }));
});

const visibleEffects = computed(() => effectEntries.value.slice(0, MAX_VISIBLE_EFFECTS));
const overflowCount = computed(() =>
  Math.max(0, effectEntries.value.length - MAX_VISIBLE_EFFECTS),
);

function effectTitle(id: string, stacks: number): string {
  return `${id}: ${stacks}`;
}

function tileEffectTitle(id: string, stacks: number): string {
  return formatTileEffectTooltipLabel(id, stacks);
}

function towerIconSize(enemy: Enemy): number {
  const scale = getEnemyScale(enemy);
  return scale > 1 ? 22 : 16;
}

const ENEMY_SCALE_GAP = 3;
const ENEMY_SCALE_INSET = 8;
const ENEMY_PIECE_OFFSET = 4;

function enemyPieceStyle(enemy: Enemy): Record<string, string> {
  const scale = getEnemyScale(enemy);
  if (scale <= 1) return {};
  return {
    width: `calc(${scale * 100}% + ${(scale - 1) * ENEMY_SCALE_GAP}px - ${ENEMY_SCALE_INSET}px)`,
    height: `calc(${scale * 100}% + ${(scale - 1) * ENEMY_SCALE_GAP}px - ${ENEMY_SCALE_INSET}px)`,
    inset: `${ENEMY_PIECE_OFFSET}px auto auto ${ENEMY_PIECE_OFFSET}px`,
  };
}

function stackedPieceStyle(index: number, total: number): Record<string, string> {
  if (total <= 1) return {};
  const corners: Record<string, string>[] = [
    { top: "1px", left: "1px" },
    { bottom: "1px", right: "1px" },
    { top: "1px", right: "1px" },
    { bottom: "1px", left: "1px" },
  ];
  return {
    width: "62%",
    height: "62%",
    inset: "auto",
    zIndex: String(2 + index),
    ...corners[index % corners.length]!,
  };
}

function effectBadgeStyle(enemy: Enemy | undefined): Record<string, string> {
  if (!enemy) return {};
  const scale = getEnemyScale(enemy);
  if (scale <= 1) return {};
  const extra = scale - 1;
  return {
    top: `${ENEMY_PIECE_OFFSET}px`,
    right: `calc(-${extra * 100}% - ${extra * ENEMY_SCALE_GAP}px - ${ENEMY_PIECE_OFFSET}px + ${ENEMY_SCALE_INSET}px)`,
  };
}

const stackedEnemyCount = computed(() => 1 + (props.cell.stackedEnemies?.length ?? 0));

const scaledEnemyEffects = computed(
  () => !!props.cell.enemyAnchor && getEnemyScale(props.cell.enemyAnchor) > 1 && effectEntries.value.length > 0,
);

function onPlayerPieceClick(e: MouseEvent) {
  if (props.paintbrushActive) return;
  e.stopPropagation();
  emit("playerClick");
}

function onPlayerPiecePointerDown(e: PointerEvent) {
  if (props.paintbrushActive) return;
  e.stopPropagation();
  emit("deployPointerDown", e);
}

function onEnemyPieceClick(e: MouseEvent, enemyId: string) {
  if (props.paintbrushActive) return;
  e.stopPropagation();
  emit("enemyClick", enemyId);
}

function onEnemyPieceDblClick(e: MouseEvent, enemyId: string) {
  if (props.paintbrushActive) return;
  e.stopPropagation();
  emit("enemyDblclick", enemyId);
}

const playerHp = computed(() => {
  const player = props.cell.player;
  if (!player) return null;
  const maxHp = getPlayerMaxHp(player);
  return { currentHp: player.hp ?? maxHp, maxHp };
});

const enemyHp = computed(() => {
  if (props.cell.enemyHp) return props.cell.enemyHp;
  const enemy = props.cell.enemyAnchor;
  if (!enemy) return null;
  const maxHp = getEnemyMaxHp(enemy);
  return { currentHp: enemy.hp ?? maxHp, maxHp };
});

const showEnemyHpBar = computed(
  () =>
    props.showEnemyHealthBars &&
    enemyHp.value &&
    (props.cell.showSwarmHp !== false),
);

const tileEffectEntries = computed(() => {
  const stacks = props.cell.tileEffects;
  if (!stacks) return [];
  return Object.entries(stacks)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => ({ id, stacks: count }));
});

const primaryTerrainIcon = computed(() =>
  primaryTerrainTypeForIcon(props.cell.tile?.terrain ?? []),
);

function tileImageTransform(rotation?: 0 | 90 | 180 | 270, flip?: boolean): string | undefined {
  const deg = rotation ?? 0;
  const scaleX = flip ? -1 : 1;
  if (!deg && scaleX === 1) return undefined;
  return `rotate(${deg}deg) scaleX(${scaleX})`;
}

const appearanceImageTransformStyle = computed(() =>
  tileImageTransform(props.cell.appearanceRotation, props.cell.appearanceFlip),
);

const overlayImageTransformStyle = computed(() =>
  tileImageTransform(props.cell.overlayRotation, props.cell.overlayFlip),
);

const featureImageTransformStyle = computed(() =>
  tileImageTransform(props.cell.featureRotation, props.cell.featureFlip),
);

const previewAppearanceTransformStyle = computed(() => {
  const preview = props.cell.paintbrushPreview;
  if (!preview) return undefined;
  return tileImageTransform(preview.appearanceRotation, preview.appearanceFlip);
});

const previewOverlayTransformStyle = computed(() => {
  const preview = props.cell.paintbrushPreview;
  if (!preview) return undefined;
  return tileImageTransform(preview.overlayRotation, preview.overlayFlip);
});

const previewFeatureTransformStyle = computed(() => {
  const preview = props.cell.paintbrushPreview;
  if (!preview) return undefined;
  return tileImageTransform(preview.featureRotation, preview.featureFlip);
});

const appearanceLayerStyle = computed(() => {
  const url = props.cell.tileAppearanceUrl;
  if (!url) return undefined;
  return tileImageLayerStyle(url, props.cell.appearanceTint);
});

const overlayLayerStyle = computed(() => {
  const url = props.cell.tileOverlayUrl;
  if (!url) return undefined;
  return tileImageLayerStyle(url, props.cell.overlayTint);
});

const featureLayerStyle = computed(() => {
  const url = props.cell.tileFeatureUrl;
  if (!url) return undefined;
  return tileImageLayerStyle(url, props.cell.featureTint);
});

const previewAppearanceLayerStyle = computed(() => {
  const preview = props.cell.paintbrushPreview;
  const url = preview?.appearanceUrl;
  if (!url) return undefined;
  return tileImageLayerStyle(url, preview.appearanceTint);
});

const previewOverlayLayerStyle = computed(() => {
  const preview = props.cell.paintbrushPreview;
  const url = preview?.overlayUrl;
  if (!url) return undefined;
  return tileImageLayerStyle(url, preview.overlayTint);
});

const previewFeatureLayerStyle = computed(() => {
  const preview = props.cell.paintbrushPreview;
  const url = preview?.featureUrl;
  if (!url) return undefined;
  return tileImageLayerStyle(url, preview.featureTint);
});

const tileEffectBadgeEntries = computed(() => tileEffectEntries.value);
</script>

<template>
  <button
    type="button"
    class="cell"
    :data-cell-x="x"
    :data-cell-y="y"
    :style="cell.tileBaseColor ? { backgroundColor: cell.tileBaseColor } : undefined"
    :class="{
      [cell.terrainClass ?? '']: !!cell.terrainClass,
      movable: cell.movable,
      'move-secondary': cell.moveSecondary,
      'move-aegis': cell.moveAegis,
      deployable: cell.deployable,
      'gm-movable': cell.gmMovable,
      'gm-spawnable': cell.gmSpawnable,
      'pattern-primary': cell.patternPrimary,
      'pattern-secondary': cell.patternSecondary,
      'combat-target-primary': cell.combatTargetPrimary,
      'combat-target-secondary': cell.combatTargetSecondary,
      'combat-target-heal': cell.combatTargetHeal,
      'combat-target-invalid': cell.combatTargetInvalid,
      'pattern-recoil': cell.patternRecoil,
      'scaled-enemy-effects': scaledEnemyEffects,
      'enemy-dying': enemyDying,
      'enemy-defeated': enemyDefeated,
      'bulk-tile-selected': isBulkTileSelected,
      'out-of-los': cell.outOfLineOfSight,
      'gm-inherit-cursor': gmInheritCursor,
    }"
    @click="emit('click')"
    @mouseenter="emit('hover')"
    @mouseleave="emit('unhover')"
  >
    <span
      v-if="cell.tileBaseColor && !cell.paintbrushPreview"
      class="tile-base-color"
      :style="{ backgroundColor: cell.tileBaseColor }"
      aria-hidden="true"
    />
    <span v-if="cell.trapLine && !cell.trapWeapon" class="board-overlay trap-line" aria-hidden="true" />
    <span v-if="cell.trapWeapon" class="board-overlay trap-weapon" title="Thrown weapon" />
    <span
      v-if="cell.kopisToken"
      class="board-overlay kopis-token"
      :class="{ mine: cell.kopisTokenMine }"
      title="Kopis token"
    />
    <span v-if="cell.attractorZone" class="board-overlay attractor-zone" aria-hidden="true" />
    <span
      v-if="cell.attractorCenter"
      class="board-overlay attractor-center"
      :class="{ 'attractor-void': cell.attractorVoid }"
      title="Attractor"
    />
    <span v-if="cell.attractorPreviewZone" class="board-overlay attractor-zone attractor-zone-preview" aria-hidden="true" />
    <span
      v-if="cell.attractorPreviewCenter"
      class="board-overlay attractor-center attractor-center-preview"
      :class="{ 'attractor-void': cell.attractorPreviewVoid }"
      aria-hidden="true"
    />
    <span v-if="cell.hasSeed" class="seed-marker" title="Seed" />
    <div
      v-if="!cell.paintbrushPreview && (cell.tileAppearanceUrl || cell.tileOverlayUrl || cell.tileFeatureUrl)"
      class="tile-image-stack"
      aria-hidden="true"
    >
      <span
        v-if="cell.tileAppearanceUrl"
        class="tile-image-layer"
        :style="{ transform: appearanceImageTransformStyle }"
      >
        <span
          class="board-overlay tile-appearance-image tile-image"
          :style="appearanceLayerStyle"
        />
      </span>
      <span
        v-if="cell.tileOverlayUrl"
        class="tile-image-layer"
        :style="{ transform: overlayImageTransformStyle }"
      >
        <span
          class="board-overlay tile-overlay-image tile-image"
          :style="overlayLayerStyle"
        />
      </span>
      <span
        v-if="cell.tileFeatureUrl"
        class="tile-image-layer"
        :style="{ transform: featureImageTransformStyle }"
      >
        <span
          class="board-overlay tile-feature-image tile-image"
          :style="featureLayerStyle"
        />
      </span>
    </div>
    <div
      v-if="cell.paintbrushPreview"
      class="paintbrush-preview"
      aria-hidden="true"
    >
      <span
        v-if="cell.paintbrushPreview.baseColor"
        class="tile-base-color"
        :style="{ backgroundColor: cell.paintbrushPreview.baseColor }"
      />
      <div class="tile-image-stack">
        <span
          v-if="cell.paintbrushPreview.appearanceUrl"
          class="tile-image-layer"
          :style="{ transform: previewAppearanceTransformStyle }"
        >
          <span
            class="board-overlay tile-appearance-image tile-image"
            :style="previewAppearanceLayerStyle"
          />
        </span>
        <span
          v-if="cell.paintbrushPreview.overlayUrl"
          class="tile-image-layer"
          :style="{ transform: previewOverlayTransformStyle }"
        >
          <span
            class="board-overlay tile-overlay-image tile-image"
            :style="previewOverlayLayerStyle"
          />
        </span>
        <span
          v-if="cell.paintbrushPreview.featureUrl"
          class="tile-image-layer"
          :style="{ transform: previewFeatureTransformStyle }"
        >
          <span
            class="board-overlay tile-feature-image tile-image"
            :style="previewFeatureLayerStyle"
          />
        </span>
      </div>
    </div>
    <span v-if="cell.combatTargetInvalid" class="combat-target-invalid-mark" aria-hidden="true" />
    <span v-if="cell.outOfLineOfSight" class="board-overlay out-of-los-shadow" aria-hidden="true" />
    <NoLosIcon v-if="cell.outOfLineOfSight" class="no-los-overlay" :size="20" />
    <span
      v-if="cell.enemyAnchor && !enemyAnimating"
      class="piece enemy"
      :class="{
        selected: isEnemySelected,
        'turn-ended': cell.turnEnded,
        'kopis-marked': cell.kopisMarked,
        dying: enemyDying,
        'tower-piece': cell.enemyAnchor.kind === 'tower',
        'fortification-piece': isFortificationEnemy(cell.enemyAnchor),
        'has-portrait': !!cell.enemyPortraitUrl && cell.enemyAnchor.kind !== 'tower',
        stacked: stackedEnemyCount > 1,
      }"
      :style="[
        stackedEnemyCount > 1
          ? stackedPieceStyle(0, stackedEnemyCount)
          : enemyPieceStyle(cell.enemyAnchor),
        cell.enemyPortraitUrl && cell.enemyAnchor.kind !== 'tower'
          ? { background: cell.enemyPortraitBg ?? undefined }
          : cell.towerOwnerHue != null
            ? { background: `hsl(${cell.towerOwnerHue} 55% 38%)`, borderColor: `hsl(${cell.towerOwnerHue} 70% 55%)` }
            : undefined,
      ]"
      @click="onEnemyPieceClick($event, cell.enemyAnchor.id)"
      @dblclick="onEnemyPieceDblClick($event, cell.enemyAnchor.id)"
    >
      <img
        v-if="cell.enemyPortraitUrl && cell.enemyAnchor.kind !== 'tower'"
        :src="cell.enemyPortraitUrl"
        alt=""
        class="portrait-img"
      />
      <span
        v-if="cell.enemyAnchor.kind === 'tower'"
        class="tower-icon-wrap"
        :title="cell.enemyAnchor.name ?? 'Tower'"
      >
        <component
          :is="combatBoard.towerTokenIcon"
          v-if="combatBoard.towerTokenIcon"
          :size="towerIconSize(cell.enemyAnchor)"
        />
      </span>
      <span v-if="cell.turnEnded" class="turn-ended-shade" aria-hidden="true"></span>
      <span v-if="cell.turnEnded" class="turn-ended-zzz" aria-hidden="true">
        <span class="z z1">z</span><span class="z z2">z</span><span class="z z3">z</span>
      </span>
      <HpBar
        v-if="showEnemyHpBar"
        class="token-hp-bar"
        compact
        :current-hp="enemyHp!.currentHp"
        :max-hp="enemyHp!.maxHp"
      />
    </span>
    <span
      v-for="(stacked, stackedIndex) in cell.stackedEnemies"
      v-show="!stacked.animating"
      :key="stacked.enemy.id"
      class="piece enemy stacked"
      :class="{
        selected: stacked.selected,
        'turn-ended': stacked.turnEnded,
        dying: stacked.dying,
        'tower-piece': stacked.enemy.kind === 'tower',
        'fortification-piece': isFortificationEnemy(stacked.enemy),
        'has-portrait': !!stacked.portraitUrl && stacked.enemy.kind !== 'tower',
        'enemy-defeated': stacked.defeated,
      }"
      :style="[
        stackedPieceStyle(stackedIndex + 1, stackedEnemyCount),
        stacked.portraitUrl && stacked.enemy.kind !== 'tower'
          ? { background: stacked.portraitBg ?? undefined }
          : undefined,
      ]"
      @click="onEnemyPieceClick($event, stacked.enemy.id)"
      @dblclick="onEnemyPieceDblClick($event, stacked.enemy.id)"
    >
      <img
        v-if="stacked.portraitUrl && stacked.enemy.kind !== 'tower'"
        :src="stacked.portraitUrl"
        alt=""
        class="portrait-img"
      />
      <span v-if="stacked.turnEnded" class="turn-ended-shade" aria-hidden="true"></span>
      <HpBar
        v-if="showEnemyHealthBars && stacked.hp"
        class="token-hp-bar"
        compact
        :current-hp="stacked.hp.currentHp"
        :max-hp="stacked.hp.maxHp"
      />
    </span>
    <span
      v-if="cell.player && !playerTeleporting"
      class="piece player-piece"
      :class="{
        selected: isPlayerSelected,
        draggable: canDragDeploy,
        dragging: draggingDeploy && canDragDeploy,
        'turn-ended': cell.turnEnded && !cell.playerDowned,
        'player-downed': cell.playerDowned,
        'has-portrait': !!cell.playerPortraitUrl,
      }"
      :style="!cell.playerPortraitUrl && playerHue != null ? { background: `hsl(${playerHue} 70% 45%)` } : undefined"
      @click="onPlayerPieceClick"
      @pointerdown="onPlayerPiecePointerDown"
    >
      <img
        v-if="cell.playerPortraitUrl"
        :src="cell.playerPortraitUrl"
        alt=""
        class="portrait-img"
      />
      <span
        v-if="cell.playerDowned || (cell.turnEnded && !cell.playerPortraitUrl)"
        class="turn-ended-shade"
        aria-hidden="true"
      ></span>
      <span v-if="cell.turnEnded && !cell.playerDowned" class="turn-ended-zzz" aria-hidden="true">
        <span class="z z1">z</span><span class="z z2">z</span><span class="z z3">z</span>
      </span>
      <span v-if="cell.playerDowned" class="player-down-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path
            d="M12 2a5 5 0 0 0-5 5c0 1.74.89 3.27 2.24 4.17C7.77 12.03 6 14.13 6 16.5V18h12v-1.5c0-2.37-1.77-4.47-3.24-5.33A4.99 4.99 0 0 0 17 7a5 5 0 0 0-5-5Zm-1.5 15v2h3v-2h-3Z"
          />
        </svg>
      </span>
      <HpBar
        v-if="showHealthBars && playerHp"
        class="token-hp-bar"
        compact
        :current-hp="playerHp.currentHp"
        :max-hp="playerHp.maxHp"
      />
    </span>
    <div v-if="effectEntries.length" class="effect-badges" :style="effectBadgeStyle(cell.enemyAnchor)">
      <span
        v-for="effect in visibleEffects"
        :key="effect.id"
        class="effect-badge"
        :title="effectTitle(effect.id, effect.stacks)"
      >
        <EffectIcon :effect-id="effect.id" :stacks="effect.stacks" :size="12" show-stacks />
      </span>
      <span v-if="overflowCount > 0" class="effect-overflow" :title="`${overflowCount} more effects`">
        +{{ overflowCount }}
      </span>
    </div>
    <div v-if="primaryTerrainIcon || tileEffectBadgeEntries.length" class="tile-glyphs">
      <span
        v-if="primaryTerrainIcon"
        class="effect-badge"
        :title="terrainTypeDisplayName(primaryTerrainIcon)"
      >
        <TerrainTypeIcon :terrain-type="primaryTerrainIcon" :size="TILE_GLYPH_ICON_SIZE" />
      </span>
      <span
        v-for="effect in tileEffectBadgeEntries"
        :key="effect.id"
        class="effect-badge"
        :title="tileEffectTitle(effect.id, effect.stacks)"
      >
        <EffectIcon
          :effect-id="effect.id"
          :stacks="effect.stacks"
          :size="TILE_GLYPH_ICON_SIZE"
          :show-stacks="tileEffectShowsStackCount(effect.id)"
        />
      </span>
    </div>
  </button>
</template>

<style scoped>
.cell {
  position: relative;
  border: none;
  border-radius: 0;
  min-height: 28px;
  padding: 0;
  cursor: default;
  background: var(--color-surface-raised);
}

.cell.gm-inherit-cursor {
  cursor: inherit !important;
}

.cell.impassable {
  cursor: not-allowed;
}

.cell.obstacle {
  cursor: not-allowed;
}

.cell.void {
  cursor: not-allowed;
}

.cell.movable {
  cursor: pointer;
  outline: 1px dashed var(--color-accent-muted);
}

.cell.move-secondary {
  cursor: pointer;
  outline: 1px dashed var(--color-purple-outline-strong);
  background: var(--color-purple-faint-bg);
}

.cell.move-aegis {
  cursor: pointer;
  outline: 1px dashed var(--color-accent-muted);
  background: color-mix(in srgb, var(--color-accent-muted) 12%, transparent);
}

.cell.deployable {
  cursor: pointer;
  outline: 1px dashed var(--color-success-outline);
}

.cell.gm-movable {
  cursor: pointer;
  outline: 1px dashed var(--color-danger-muted-border);
}

.cell.gm-spawnable {
  cursor: crosshair;
  outline: 1px dashed var(--color-purple-outline);
}

.cell.pattern-primary {
  cursor: pointer;
}

.cell.pattern-primary::after {
  content: "";
  position: absolute;
  inset: 0;
  outline: 2px solid var(--color-purple);
  background: var(--color-purple-subtle-bg);
  z-index: 1;
  pointer-events: none;
}

.cell.pattern-secondary {
  cursor: pointer;
}

.cell.pattern-secondary::before {
  content: "";
  position: absolute;
  inset: 0;
  outline: 1px dashed var(--color-purple-outline-strong);
  background: var(--color-purple-faint-bg);
  z-index: 0;
  pointer-events: none;
}

.cell.combat-target-primary {
  cursor: pointer;
}

.cell.combat-target-primary::after {
  content: "";
  position: absolute;
  inset: 0;
  outline: 2px solid var(--color-board-target-attack);
  background: var(--color-board-target-attack-bg);
  z-index: 1;
  pointer-events: none;
}

.cell.combat-target-primary.combat-target-heal::after {
  outline-color: var(--color-board-target-heal);
  background: var(--color-board-target-heal-bg);
}

.cell.combat-target-secondary {
  cursor: pointer;
}

.cell.combat-target-secondary::before {
  content: "";
  position: absolute;
  inset: 0;
  outline: 1px dashed var(--color-board-target-attack-outline);
  background: var(--color-board-target-attack-bg-faint);
  z-index: 0;
  pointer-events: none;
}

.cell.combat-target-secondary.combat-target-heal::before {
  outline-color: var(--color-board-target-heal-outline);
  background: var(--color-board-target-heal-bg-faint);
}

.combat-target-invalid-mark {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    linear-gradient(
      to top left,
      transparent calc(50% - 1.5px),
      var(--color-danger) calc(50% - 1.5px),
      var(--color-danger) calc(50% + 1.5px),
      transparent calc(50% + 1.5px)
    ),
    linear-gradient(
      to top right,
      transparent calc(50% - 1.5px),
      var(--color-danger) calc(50% - 1.5px),
      var(--color-danger) calc(50% + 1.5px),
      transparent calc(50% + 1.5px)
    );
  opacity: 0.9;
}

.cell.combat-target-invalid {
  cursor: not-allowed;
}

.cell.pattern-recoil {
  outline: 1px dashed var(--color-warning-outline);
  background: var(--color-warning-faint-bg);
}

.cell.scaled-enemy-effects {
  z-index: 4;
}

.cell.enemy-dying .piece.enemy,
.cell.enemy-dying .effect-badges {
  pointer-events: none;
  animation: enemy-death-fade 0.5s ease-in-out 1.5s forwards;
}

.cell.enemy-defeated .piece.enemy,
.cell.enemy-defeated .effect-badges {
  opacity: 0;
  pointer-events: none;
}

.piece.enemy.enemy-defeated {
  opacity: 0;
  pointer-events: none;
}

@keyframes enemy-death-fade {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

.piece {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  display: block;
  z-index: 1;
  overflow: visible;
}

.piece.player-piece.has-portrait {
  background: var(--color-surface);
}

.portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}

.piece.turn-ended .portrait-img,
.piece.player-downed .portrait-img {
  filter: brightness(0.42) saturate(0.65);
}

.player-down-icon {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-items: center;
  pointer-events: none;
  color: var(--color-text);
  opacity: 0.92;
  filter: drop-shadow(var(--shadow-text));
}

.turn-ended-shade {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--color-overlay-label);
  pointer-events: none;
  z-index: 1;
}

.turn-ended-zzz {
  position: absolute;
  top: -3px;
  left: -1px;
  z-index: 3;
  display: flex;
  align-items: flex-end;
  pointer-events: none;
  font-weight: 900;
  font-style: italic;
  color: var(--color-muted);
  text-shadow: var(--shadow-text-strong);
  line-height: 1;
  animation: turn-ended-zzz-float 2.4s ease-in-out infinite;
}

.turn-ended-zzz .z1 {
  font-size: 0.62rem;
}

.turn-ended-zzz .z2 {
  font-size: 0.48rem;
  margin-bottom: 1px;
}

.turn-ended-zzz .z3 {
  font-size: 0.36rem;
  margin-bottom: 2px;
}

@keyframes turn-ended-zzz-float {
  0%,
  100% {
    transform: translate(0, 0);
    opacity: 0.88;
  }
  50% {
    transform: translate(1px, -3px);
    opacity: 1;
  }
}

.piece.player-piece {
  cursor: pointer;
  z-index: 2;
}

.piece.player-piece.draggable {
  cursor: grab;
}

.piece.player-piece.dragging {
  cursor: grabbing;
}

.piece.enemy {
  background: var(--color-enemy-piece);
  z-index: 1;
}

.piece.enemy.has-portrait {
  overflow: hidden;
}

.piece.enemy .portrait-img {
  object-fit: contain;
}

.piece.enemy.fortification-piece {
  border-radius: 4px;
}

.piece.enemy.fortification-piece .portrait-img {
  border-radius: 4px;
}

.piece.selected {
  outline: 2px solid var(--color-on-accent);
}

.cell.bulk-tile-selected::after {
  content: "";
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 0 2px var(--color-accent-bright);
  z-index: 3;
  pointer-events: none;
}

.token-hp-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2;
  pointer-events: none;
}

.effect-badges {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  pointer-events: none;
}

.effect-badge {
  display: flex;
  padding: 1px;
  border-radius: 3px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  pointer-events: auto;
}

.effect-overflow {
  padding: 0 3px;
  border-radius: 3px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 0.5rem;
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-muted);
  pointer-events: auto;
}

.tower-piece {
  border: 2px solid var(--color-accent);
  border-radius: 5px;
  background: var(--color-surface-raised);
}

.tower-icon-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-on-accent);
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
  pointer-events: none;
}

.seed-marker {
  position: absolute;
  bottom: 2px;
  left: 2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
  border: 1px solid var(--color-success-dark);
  z-index: 4;
  pointer-events: none;
}

.tile-glyphs {
  position: absolute;
  top: 1px;
  left: 1px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  z-index: 4;
  pointer-events: none;
}

.tile-glyphs .effect-badge {
  padding: 0;
  border-radius: 2px;
  line-height: 0;
}

.tile-glyphs :deep(.stack-badge) {
  top: -2px;
  right: -3px;
  font-size: 0.45rem;
}

.tile-base-color {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.tile-image-stack {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  transform-origin: center;
}

.tile-image-layer {
  position: absolute;
  inset: 0;
  transform-origin: center;
}

.tile-appearance-image,
.tile-overlay-image,
.tile-feature-image {
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

.paintbrush-preview {
  position: absolute;
  inset: 0;
  z-index: 3;
  opacity: 0.75;
  pointer-events: none;
  overflow: hidden;
}

.paintbrush-preview .tile-image-stack {
  z-index: 0;
}

.board-overlay {
  position: absolute;
  pointer-events: none;
  z-index: 2;
}

.trap-line {
  inset: 3px;
  border: 1px dashed var(--color-warning);
  border-radius: 2px;
  opacity: 0.75;
}

.trap-weapon {
  top: 3px;
  right: 3px;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--color-warning);
  border: 1px solid var(--color-warning-outline);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25);
}

.kopis-token {
  bottom: 2px;
  right: 2px;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-accent) 30%, transparent);
  border: 1.5px solid var(--color-accent);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  z-index: 5;
}

.kopis-token.mine {
  background: color-mix(in srgb, var(--color-accent-bright) 45%, transparent);
  border-color: var(--color-accent-bright);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 0 5px color-mix(in srgb, var(--color-accent-bright) 55%, transparent);
}

.attractor-zone {
  inset: 0;
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
}

.attractor-zone-preview {
  z-index: 1;
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  outline: 1px dashed color-mix(in srgb, var(--color-accent) 55%, transparent);
  outline-offset: -1px;
}

.attractor-center {
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: var(--color-accent);
  border: 1px solid var(--color-accent-bright);
}

.attractor-center.attractor-void {
  background: var(--color-danger);
  border-color: var(--color-danger-muted-border);
  box-shadow: 0 0 6px color-mix(in srgb, var(--color-danger) 50%, transparent);
}

.attractor-center-preview {
  z-index: 2;
  opacity: 0.9;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 35%, transparent);
}

.piece.enemy.kopis-marked::before {
  content: "✛";
  position: absolute;
  top: -2px;
  right: -2px;
  font-size: 0.55rem;
  line-height: 1;
  color: var(--color-accent-bright);
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  z-index: 6;
}

.out-of-los-shadow {
  inset: 0;
  z-index: 7;
  background: rgba(0, 0, 0, 0.25);
}

.no-los-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 8;
  pointer-events: none;
  color: rgba(255, 255, 255, 0.5);
}
</style>
