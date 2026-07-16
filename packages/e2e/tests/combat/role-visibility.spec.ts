import { expect, test, setupCombatBoard } from "../../src/fixtures/combat.js";
import { gmSelectEnemyOnBoard, playerAttackButton } from "../../src/pages/game.js";

test.describe("role visibility", () => {
  test("enemy HP bars and action bars respect GM vs player roles", async ({ combat }) => {
    const { gmPage, playerPage } = combat;
    const { enemyCell } = await setupCombatBoard(combat);

    const gmEnemyCell = gmPage.locator(
      `[data-cell-x="${enemyCell.x}"][data-cell-y="${enemyCell.y}"]`,
    );
    const playerEnemyCell = playerPage.locator(
      `[data-cell-x="${enemyCell.x}"][data-cell-y="${enemyCell.y}"]`,
    );

    await expect(gmEnemyCell.locator(".token-hp-bar")).toBeVisible();
    await expect(playerEnemyCell.locator(".token-hp-bar")).toHaveCount(0);

    // GmActionBar only mounts when an enemy is selected.
    await gmSelectEnemyOnBoard(gmPage, enemyCell);
    await expect(gmPage.locator(".action-bar.gm-bar")).toBeVisible();
    await expect(gmPage.locator(".action-bar:not(.gm-bar)")).toHaveCount(0);
    await expect(playerAttackButton(playerPage)).toBeVisible();
    await expect(playerPage.locator(".action-bar.gm-bar")).toHaveCount(0);
  });
});
