// Engine Vitest defaults to the fixture mini-pack (no Hellpiercers IP).
// HP behavioral suites live under @gaem/hellpiercers-content.
import { registerContentPack } from "../content-pack.js";
import { createFixtureContentPack } from "../fixture-content-pack.js";

function stubModule(): object {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop === "symbol") return undefined;
        return (...args: unknown[]) => {
          if (prop === "getEffectiveEnemyMaxHp") {
            const enemy = args[0] as { hp?: number; maxHp?: number } | undefined;
            return enemy?.maxHp ?? enemy?.hp ?? 1;
          }
          if (
            prop === "clearAnnihilationCorridorTileEffects" ||
            prop === "applyStainwalkGmTurnEnd" ||
            prop === "applyStainwalkMovement"
          ) {
            return undefined;
          }
          if (
            prop === "tileIsStained" ||
            prop === "enemyOnStainedTile" ||
            prop === "isSoaringBombardier"
          ) {
            return false;
          }
          if (prop === "stainwalkDamageAdjustment") return 0;
          return undefined;
        };
      },
    },
  );
}

const moduleKeys = [
  "chalazaor",
  "gorgenaut",
  "stainwalk",
  "swarm",
  "classAbilities",
  "chrysaor",
  "kopis",
  "equipment",
  "yadathan",
  "stainGeyser",
  "lurkingFreak",
  "provoke",
  "heavenBurning",
];

const pack = createFixtureContentPack();
registerContentPack({
  ...pack,
  combat: {
    ...(pack.combat ?? {}),
    modules: Object.fromEntries(moduleKeys.map((k) => [k, stubModule()])),
  },
});
