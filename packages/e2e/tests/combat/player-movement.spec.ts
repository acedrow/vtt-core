import { expect, test } from "../../src/fixtures/combat.js";
import { cell } from "../../src/pages/game.js";

test.describe("player movement", () => {
  test("destination move renders optimistically and blocks a second action", async ({ combat }) => {
    const { playerPage, playerCell } = combat;
    await cell(playerPage, playerCell.x, playerCell.y).click();

    const destination = playerPage
      .locator("button.cell.move-secondary:not(.sightline-explored)")
      .first();
    await expect(destination).toBeVisible();
    const destinationX = Number(await destination.getAttribute("data-cell-x"));
    const destinationY = Number(await destination.getAttribute("data-cell-y"));

    const result = await playerPage.evaluate(async ({ x, y }) => {
      const target = document.querySelector<HTMLElement>(
        `button.cell.move-secondary:not(.sightline-explored)[data-cell-x="${x}"][data-cell-y="${y}"]`,
      );
      const attack = [...document.querySelectorAll<HTMLButtonElement>(".action-bar:not(.gm-bar) button")]
        .find((button) => button.textContent?.trim() === "Attack");
      target?.click();
      await new Promise(requestAnimationFrame);
      const optimisticMoveVisible = document.querySelector(".teleport-overlay") !== null;
      attack?.click();
      await Promise.resolve();
      return {
        attackActive: attack?.classList.contains("active") ?? false,
        optimisticMoveVisible,
      };
    }, { x: destinationX, y: destinationY });

    expect(result).toEqual({ attackActive: false, optimisticMoveVisible: true });
    await expect(cell(playerPage, destinationX, destinationY).locator(".piece.player-piece")).toBeVisible();
  });
});
