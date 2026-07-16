import { expect, test, setupCombatBoard } from "../../src/fixtures/combat.js";
import {
  cell,
  openConsoleTab,
  playerAttackCell,
} from "../../src/pages/game.js";

test.describe("player attack", () => {
  test("player attack defeats a 1 HP enemy", async ({ combat }) => {
    const { gmPage, playerPage, playerCell } = combat;
    const { enemyCell } = await setupCombatBoard(combat);

    await cell(playerPage, playerCell.x, playerCell.y).click();
    await playerAttackCell(playerPage, enemyCell);

    await openConsoleTab(gmPage);
    await expect(gmPage.locator(".console-panel")).toContainText("Stain Creep", { timeout: 15_000 });
    await expect(gmPage.locator(".console-panel")).toContainText(/defeated|damage/i, { timeout: 15_000 });
  });
});
