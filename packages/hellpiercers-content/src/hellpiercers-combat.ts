import {
  enemyAttackDamage,
  type CombatHookContribution,
  type SpecialIdHandler,
} from "@gaem/shared";
import {
  applyChalazaorAgnosia,
  applyFlowerbudPlant,
  validateFlowerbudPlant,
} from "./combat/chalazaor.js";
import {
  chazaorAgnosiaCountdownHandler,
  flowerbudCountdownHandler,
  hellpiercersInferCountdownKind,
} from "./combat/countdown-handlers.js";
import {
  applyGorgenautStainTeleport,
  GORGENAUT_AGNOSIA_CONFIRM_KIND,
  gorgenautAgnosiaConfirmHandler,
  validateGorgenautStainTeleport,
} from "./combat/gorgenaut.js";
import { onProvokeRetaliation } from "./combat/kopis.js";
import { applyLurkingFreakAgnosia } from "./combat/lurking-freak.js";
import { applyOrobasStainedLine, validateOrobasStainedLine } from "./combat/orobas.js";
import { hellpiercersCombatModules } from "./install-combat.js";

const flowerbudPlantHandler: SpecialIdHandler = {
  validate: ({ state, enemy, action }) => {
    if (action.action !== "attack") return "Invalid action";
    return validateFlowerbudPlant(state, enemy, {
      destX: action.destX,
      destY: action.destY,
    });
  },
  apply: ({ state, enemy, action }) => {
    if (action.action !== "attack" || action.destX == null || action.destY == null) {
      return "Flowerbud plant incomplete";
    }
    return applyFlowerbudPlant(state, enemy, action.destX, action.destY);
  },
};

const stainTeleportHandler: SpecialIdHandler = {
  validate: ({ state, enemy, action, attackSpec }) => {
    if (action.action !== "attack") return "Invalid action";
    return validateGorgenautStainTeleport(
      state,
      enemy,
      {
        targetPlayerId: action.targetPlayerId,
        targetEnemyId: action.targetEnemyId,
        destX: action.destX,
        destY: action.destY,
      },
      attackSpec,
    );
  },
  apply: ({ state, enemy, action, attackSpec }) => {
    if (
      action.action !== "attack" ||
      action.destX == null ||
      action.destY == null ||
      (!action.targetPlayerId && !action.targetEnemyId)
    ) {
      return "Stain teleport incomplete";
    }
    const damage = action.damage ?? enemyAttackDamage(attackSpec) ?? 10;
    return applyGorgenautStainTeleport(state, enemy, {
      targetPlayerId: action.targetPlayerId,
      targetEnemyId: action.targetEnemyId,
      destX: action.destX,
      destY: action.destY,
      damage,
    });
  },
};

const orobasStainedLineHandler: SpecialIdHandler = {
  validate: ({ state, enemy, action }) => {
    if (action.action !== "attack") return "Invalid action";
    return validateOrobasStainedLine(state, enemy, action.direction);
  },
  apply: ({ state, enemy, action }) => {
    if (action.action !== "attack" || !action.direction) {
      return "Orobas stained line incomplete";
    }
    return applyOrobasStainedLine(state, enemy, action.direction);
  },
};

export function hellpiercersCombatHooks(): CombatHookContribution {
  return {
    specialIdHandlers: {
      "flowerbud-plant": flowerbudPlantHandler,
      "stain-teleport": stainTeleportHandler,
      "orobas-stained-line": orobasStainedLineHandler,
    },
    countdownHandlers: {
      chazaor_agnosia: chazaorAgnosiaCountdownHandler,
      flowerbud: flowerbudCountdownHandler,
    },
    countdownKindInferrer: hellpiercersInferCountdownKind,
    agnosiaHandlers: {
      "soaring bombardier": applyChalazaorAgnosia,
      "lurking freak": applyLurkingFreakAgnosia,
    },
    pendingConfirmHandlers: {
      [GORGENAUT_AGNOSIA_CONFIRM_KIND]: gorgenautAgnosiaConfirmHandler,
    },
    onProvokeRetaliation,
    modules: hellpiercersCombatModules(),
  };
}
