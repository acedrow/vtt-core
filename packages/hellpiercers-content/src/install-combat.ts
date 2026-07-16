import * as chalazaor from "./combat/chalazaor.js";
import * as chrysaor from "./combat/chrysaor.js";
import * as classAbilities from "./combat/class-abilities.js";
import * as equipment from "./combat/equipment.js";
import * as gorgenaut from "./combat/gorgenaut.js";
import * as heavenBurning from "./combat/heaven-burning.js";
import * as kopis from "./combat/kopis.js";
import * as lurkingFreak from "./combat/lurking-freak.js";
import * as provoke from "./combat/provoke-rules.js";
import * as stainGeyser from "./combat/stain-geyser.js";
import * as stainwalk from "./combat/stainwalk.js";
import * as swarm from "./combat/swarm.js";
import * as yadathan from "./combat/yadathan.js";

export function hellpiercersCombatModules(): Record<string, object> {
  return {
    chalazaor,
    gorgenaut,
    stainwalk,
    swarm,
    classAbilities,
    chrysaor,
    kopis,
    equipment,
    yadathan,
    stainGeyser,
    lurkingFreak,
    provoke,
    heavenBurning,
  };
}
