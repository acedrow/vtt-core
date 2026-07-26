import type { ComputedRef, InjectionKey, Ref } from "vue";

type R<T> = Ref<T> | ComputedRef<T>;

export type GmActionBarExtrasBridge = {
  activeEnemyId: R<string | null>;
  /** True when the generic action row should defer to pack swarm chrome. */
  swarmAttackActive: R<boolean>;
  targetingAttack: R<boolean>;
  targetingSwarmAttack: R<boolean>;
  targetingStainDest: R<boolean>;
  targetingFlowerbudPlant: R<boolean>;
  needsStainTeleport: R<boolean>;
  startGmSwarmAttack: (enemyId: string, attackIndex: number, damage?: number) => void;
  startGmEnemyAttack: (
    enemyId: string,
    attackIndex: number,
    damage?: number,
    opts?: { stainTeleport?: boolean; plantFlowerbud?: boolean },
  ) => void;
  exhaustEnemy: () => void;
};

export const gmActionBarExtrasKey: InjectionKey<GmActionBarExtrasBridge> = Symbol("gmActionBarExtras");
