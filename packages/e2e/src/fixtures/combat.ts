import { randomUUID } from "node:crypto";

import { test as base, expect, type Browser, type Page } from "@playwright/test";

import { bootstrapCombatData, deleteCharacterSheet, deletePlayerProfile, login } from "../api.js";
import { E2E_ENV } from "../env.js";
import { loginAsGm, loginAsPlayer } from "../pages/landing.js";
import {
  advancePastDeployment,
  cleanupCombat,
  enableSandbox,
  ensureTaccomNotStarted,
  playerAttackButton,
  spawnEnemy,
  spawnPlayerToken,
  waitForBoard,
  waitForTaccomWaiting,
  type CellCoord,
} from "../pages/game.js";

export type CombatSession = {
  gmPage: Page;
  playerPage: Page;
  profileName: string;
  sheetName: string;
  sheetId: string;
  profileId: string;
  gmToken: string;
  playerCell: CellCoord;
};

async function openCombatSession(
  browser: Browser,
  request: import("@playwright/test").APIRequestContext,
  suffix: string,
): Promise<CombatSession> {
  const { profile, sheet, gmToken } = await bootstrapCombatData(request, suffix);

  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const gmPage = await gmContext.newPage();
  const playerPage = await playerContext.newPage();

  gmPage.on("dialog", (dialog) => void dialog.accept());

  await loginAsGm(gmPage);
  await waitForBoard(gmPage);
  await ensureTaccomNotStarted(gmPage);

  await loginAsPlayer(playerPage, profile.name);
  await waitForTaccomWaiting(playerPage);

  const playerCell = await spawnPlayerToken(gmPage, sheet.name);
  await advancePastDeployment(gmPage);
  await enableSandbox(gmPage);
  await waitForBoard(playerPage);
  await playerPage.getByRole("button", { name: "TACCOM", exact: true }).click();
  await expect(playerAttackButton(playerPage)).toBeVisible();

  return {
    gmPage,
    playerPage,
    profileName: profile.name,
    sheetName: sheet.name,
    sheetId: sheet.id,
    profileId: profile.id,
    gmToken,
    playerCell,
  };
}

export async function setupCombatBoard(
  session: CombatSession,
  enemyName = "Stain Creep",
  offset: { dx?: number; dy?: number } = {},
): Promise<{ playerCell: CellCoord; enemyCell: CellCoord }> {
  const playerCell = session.playerCell;
  const enemyCell = {
    x: playerCell.x + (offset.dx ?? 2),
    y: playerCell.y + (offset.dy ?? 0),
  };
  await spawnEnemy(session.gmPage, enemyName, enemyCell);
  return { playerCell, enemyCell };
}

export const test = base.extend<{ combat: CombatSession }>({
  combat: async ({ browser, request }, use) => {
    const suffix = randomUUID().slice(0, 8);
    const session = await openCombatSession(browser, request, suffix);
    try {
      await use(session);
    } finally {
      try {
        await cleanupCombat(session.gmPage, session.sheetName);
      } catch {
        // Best-effort UI cleanup; API teardown below still runs.
      }
      const token = await login(request, "gm", E2E_ENV.gmPassword).catch(() => session.gmToken);
      await deleteCharacterSheet(request, token, session.sheetId).catch(() => undefined);
      await deletePlayerProfile(request, token, session.profileId).catch(() => undefined);
      await session.gmPage.context().close();
      await session.playerPage.context().close();
    }
  },
});

export { expect } from "@playwright/test";
