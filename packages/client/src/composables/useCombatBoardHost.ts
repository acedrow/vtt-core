import type { EnemyAttackSpec } from "@vtt-core/shared";
import type { ComputedRef, InjectionKey, Ref } from "vue";

export type CombatBoardSwarmChipTarget = { kind: "player"; id: string; label: string };

type R<T> = Ref<T> | ComputedRef<T>;

export type CombatBoardPlacementPreviewTile = {
  x: number;
  y: number;
  overlayUrl?: string | null;
};

export type CombatBoardHostBridge = {
  breakerPromptOpen: R<boolean>;
  breakerSethianHint: R<string | undefined>;
  onBreakerConfirm: (useBreaker: boolean) => void;
  onBreakerCancel: () => void;
  swarmChipOpen: R<boolean>;
  swarmChipEnemyName: R<string>;
  swarmChipTargets: R<CombatBoardSwarmChipTarget[]>;
  onSwarmChipConfirm: (targetPlayerIds: string[]) => void;
  onSwarmChipClose: () => void;
  swarmAttackModalOpen: R<boolean>;
  swarmAttackModalProps: R<{
    enemyId: string;
    attackIndex: number;
    attackText: string;
    attackSpec?: EnemyAttackSpec;
    targetPlayerId: string;
    targetPlayerName: string;
    maxStrikes: number;
    damageOverride?: number;
  } | null>;
  onSwarmAttackConfirm: (strikeCount: number) => void;
  onSwarmAttackClose: () => void;

  /** Content host wires these; GameBoard only reads/calls. */
  placementActive: R<boolean>;
  placementPrimaryKeys: R<ReadonlySet<string>>;
  placementSecondaryKeys: R<ReadonlySet<string>>;
  placementPreviewTiles: R<readonly CombatBoardPlacementPreviewTile[]>;

  tryConsumePlacementClick: (x: number, y: number) => boolean;
  onPlacementHover: (x: number, y: number) => void;
  /** Return true if Escape was handled (clear / recenter). */
  onPlacementEscape: () => boolean;
  /** Clear any active pack placement mode. */
  clearPlacement: () => void;
  /** After GM addEnemy send — content may start stain placement. */
  onAfterAddEnemy: (name: string, x: number, y: number) => void;
};

export const combatBoardHostKey: InjectionKey<CombatBoardHostBridge> = Symbol("combatBoardHost");
