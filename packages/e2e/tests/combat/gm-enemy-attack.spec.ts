import { expect, test, setupCombatBoard } from "../../src/fixtures/combat.js";
import {
  getPlayerHp,
  gmDirectEnemyAttack,
  gmSelectEnemyOnBoard,
} from "../../src/pages/game.js";

test.describe("gm enemy attack", () => {
  test("gm direct enemy attack damages the player", async ({ combat }) => {
    const { gmPage, sheetName } = combat;
    const { playerCell, enemyCell } = await setupCombatBoard(combat, "Stain Creep", { dx: 1 });

    await expect(async () => {
      expect(await getPlayerHp(gmPage, sheetName)).toBe(30);
    }).toPass();

    await gmSelectEnemyOnBoard(gmPage, enemyCell);
    await gmDirectEnemyAttack(gmPage, playerCell);

    await expect(async () => {
      expect(await getPlayerHp(gmPage, sheetName)).toBe(26);
    }).toPass();
  });
});
