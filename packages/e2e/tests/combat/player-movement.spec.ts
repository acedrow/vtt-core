import { expect, test } from "../../src/fixtures/combat.js";
import { cell } from "../../src/pages/game.js";

test.describe("player movement", () => {
  test("destination move renders optimistically and blocks a second action", async ({ combat }) => {
    const { playerPage, playerCell } = combat;
    await cell(playerPage, playerCell.x, playerCell.y).click();

    const destination = playerPage.locator("button.cell.move-secondary").first();
    await expect(destination).toBeVisible();
    const destinationX = Number(await destination.getAttribute("data-cell-x"));
    const destinationY = Number(await destination.getAttribute("data-cell-y"));

    const result = await playerPage.evaluate(() => {
      const target = document.querySelector<HTMLElement>("button.cell.move-secondary");
      const attack = [...document.querySelectorAll<HTMLButtonElement>(".action-bar:not(.gm-bar) button")]
        .find((button) => button.textContent?.trim() === "Attack");
      target?.click();
      attack?.click();
      return attack?.classList.contains("active") ?? false;
    });

    expect(result).toBe(false);
    await expect(playerPage.locator(".teleport-overlay")).toBeVisible();
    await expect(cell(playerPage, destinationX, destinationY).locator(".piece.player-piece")).toBeVisible();
  });
});
