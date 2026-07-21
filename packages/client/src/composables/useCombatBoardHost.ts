import type { EnemyAttackSpec } from "@gaem/shared";
import type { ComputedRef, InjectionKey, Ref } from "vue";

export type CombatBoardSwarmChipTarget = { kind: "player"; id: string; label: string };

type R<T> = Ref<T> | ComputedRef<T>;

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
};

export const combatBoardHostKey: InjectionKey<CombatBoardHostBridge> = Symbol("combatBoardHost");
