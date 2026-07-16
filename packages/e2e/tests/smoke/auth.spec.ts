import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { bootstrapCombatData } from "../../src/api.js";
import { loginAsGm, loginAsPlayer } from "../../src/pages/landing.js";
import { ensureTaccomNotStarted, waitForBoard, waitForTaccomWaiting } from "../../src/pages/game.js";

test.describe("auth", () => {
  test("gm and player can join the game", async ({ browser, request }) => {
    const suffix = randomUUID().slice(0, 8);
    const { profile } = await bootstrapCombatData(request, suffix);

    const gmContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const gmPage = await gmContext.newPage();
    const playerPage = await playerContext.newPage();

    gmPage.on("dialog", (dialog) => void dialog.accept());

    try {
      await loginAsGm(gmPage);
      await waitForBoard(gmPage);
      await ensureTaccomNotStarted(gmPage);

      await loginAsPlayer(playerPage, profile.name);
      await waitForTaccomWaiting(playerPage);

      await expect(gmPage.getByRole("button", { name: "Attack" })).toHaveCount(0);
      await expect(playerPage.getByRole("button", { name: "Attack" })).toHaveCount(0);
    } finally {
      await gmContext.close();
      await playerContext.close();
    }
  });
});
