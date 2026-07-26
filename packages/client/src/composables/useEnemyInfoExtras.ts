import type { ComputedRef, InjectionKey, Ref } from "vue";

type R<T> = Ref<T> | ComputedRef<T>;

export type EnemyInfoExtrasBridge = {
  enemyId: R<string | undefined>;
  enemyName: R<string | undefined>;
  hasGmCapabilities: R<boolean>;
  showGmCombatUi: R<boolean>;
  startGmSwarmAttack: (enemyId: string, attackIndex: number, damage?: number) => void;
  startGmEnemyAttack: (
    enemyId: string,
    attackIndex: number,
    damage?: number,
    opts?: { stainTeleport?: boolean; plantFlowerbud?: boolean },
  ) => void;
};

export const enemyInfoExtrasKey: InjectionKey<EnemyInfoExtrasBridge> = Symbol("enemyInfoExtras");
