import { expect, type Locator, type Page } from "@playwright/test";

export type CellCoord = { x: number; y: number };

export function cell(page: Page, x: number, y: number): Locator {
  return page.locator(`[data-cell-x="${x}"][data-cell-y="${y}"]`);
}

export async function waitForBoard(page: Page): Promise<void> {
  await expect(page.locator("[data-cell-x]").first()).toBeVisible();
}

export async function waitForTaccomWaiting(page: Page): Promise<void> {
  await expect(page.getByText("Waiting for the GM to start TACCOM.")).toBeVisible();
}

export async function ensureTaccomNotStarted(page: Page): Promise<void> {
  await page.getByRole("button", { name: "TACCOM", exact: true }).click();
  await openTurnOrderTab(page);
  const toggle = page.getByRole("switch");
  if ((await toggle.getAttribute("aria-checked")) === "true") {
    await toggle.click();
  }
  const startTaccom = page.getByRole("button", { name: "Start TACCOM" });
  if (await startTaccom.isVisible().catch(() => false)) {
    return;
  }
  const resetCombat = page.getByRole("button", { name: "Reset combat" });
  if (await resetCombat.isVisible().catch(() => false)) {
    await resetCombat.click();
  } else {
    const endCombat = page.getByRole("button", { name: "End combat" });
    if (await endCombat.isEnabled().catch(() => false)) {
      await endCombat.click();
    }
  }
  await expect(page.getByRole("button", { name: "Start TACCOM" })).toBeVisible();
}

export async function advancePastDeployment(page: Page): Promise<void> {
  await page.getByRole("button", { name: "TACCOM", exact: true }).click();
  await openTurnOrderTab(page);
  const toggle = page.getByRole("switch");
  if ((await toggle.getAttribute("aria-checked")) === "true") {
    await toggle.click();
  }

  const startTaccom = page.getByRole("button", { name: "Start TACCOM" });
  if (await startTaccom.isVisible().catch(() => false)) {
    await startTaccom.click();
  }
  const endDeployment = page.getByRole("button", { name: "End deployment" });
  await expect(endDeployment).toBeVisible();
  await endDeployment.click();
  const doEffects = page.getByRole("button", { name: "Do effects" });
  await expect(doEffects).toBeVisible();
  await doEffects.click();
}

export async function openTurnOrderTab(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Turn order" }).click();
}

export async function enableSandbox(page: Page): Promise<void> {
  await openTurnOrderTab(page);
  const toggle = page.getByRole("switch");
  const checked = await toggle.getAttribute("aria-checked");
  if (checked !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-checked", "true");
}

export async function openInfoTab(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Info" }).click();
}

export async function openParacletusEnemies(page: Page): Promise<void> {
  await openInfoTab(page);
  await page.getByRole("button", { name: "Data" }).click();
  await page.getByRole("button", { name: "Enemies — Paracletus" }).click();
}

export async function spawnEnemy(page: Page, enemyName: string, coord: CellCoord): Promise<void> {
  await openInfoTab(page);
  await page.getByRole("searchbox", { name: "Search game data" }).fill(enemyName);
  await page.locator(".result-btn").filter({ hasText: enemyName }).first().click();
  await page.getByRole("button", { name: /Spawn unit|Selected for spawn/ }).click();
  await expect(page.getByText(/Click an empty walkable tile/)).toBeVisible();

  const boardCell = cell(page, coord.x, coord.y);
  await boardCell.scrollIntoViewIfNeeded();
  await expect(async () => {
    await boardCell.click();
    await expect(boardCell.locator(".piece.enemy")).toBeVisible();
  }).toPass({ timeout: 20_000 });
}

export async function openCharacterSheet(page: Page, sheetName: string): Promise<void> {
  const navBtn = page.getByRole("button", { name: "Character Sheets" });
  const navText = (await navBtn.textContent()) ?? "";
  if (navText.includes("▸")) {
    await navBtn.click();
  }
  await page.getByRole("button", { name: new RegExp(sheetName) }).click();
  await expect(page.locator(".sheet-hp-bar")).toBeVisible();
}

export async function spawnPlayerToken(page: Page, sheetName: string): Promise<CellCoord> {
  await openCharacterSheet(page, sheetName);
  await page.getByRole("button", { name: "Spawn token" }).click();
  const playerCell = page.locator("[data-cell-x] .piece.player-piece").first();
  await expect(playerCell).toBeVisible();
  const cellEl = playerCell.locator("xpath=ancestor::button[@data-cell-x][1]");
  const x = Number(await cellEl.getAttribute("data-cell-x"));
  const y = Number(await cellEl.getAttribute("data-cell-y"));
  return { x, y };
}

export async function findPlayerCell(page: Page): Promise<CellCoord> {
  const playerCell = page.locator("[data-cell-x] .piece.player-piece").first();
  await expect(playerCell).toBeVisible();
  const cellEl = playerCell.locator("xpath=ancestor::button[@data-cell-x][1]");
  return {
    x: Number(await cellEl.getAttribute("data-cell-x")),
    y: Number(await cellEl.getAttribute("data-cell-y")),
  };
}

export async function getHpOnCell(page: Page, coord: CellCoord): Promise<number> {
  const hpText = await cell(page, coord.x, coord.y).locator(".hp-current").textContent();
  return Number(hpText?.trim() ?? NaN);
}

export async function getPlayerHp(page: Page, sheetName: string): Promise<number> {
  await closeGmTool(page);
  await openCharacterSheet(page, sheetName);
  const hpLocator = page.locator(".sheet-hp-bar .hp-current, .sheet-hp-bar .hp-editable");
  await expect(hpLocator.first()).toBeVisible();
  const hpText = await hpLocator.first().textContent();
  return Number(hpText?.trim() ?? NaN);
}

export function playerAttackButton(page: Page): Locator {
  return page.locator(".action-bar:not(.gm-bar)").getByRole("button", { name: "Attack" });
}

export async function playerAttackCell(page: Page, coord: CellCoord): Promise<void> {
  const attackBtn = playerAttackButton(page);
  await attackBtn.click();
  const target = cell(page, coord.x, coord.y);
  for (let i = 0; i < 3; i++) {
    await target.click();
  }
}

export async function gmSelectEnemyOnBoard(page: Page, coord: CellCoord): Promise<void> {
  // Escape clears an active GM tool, then spawn selection — otherwise a still-selected
  // spawn unit would stack another enemy on the tile instead of selecting it.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await cell(page, coord.x, coord.y).locator(".piece.enemy").first().click();
  await expect(page.locator(".action-bar.gm-bar")).toBeVisible();
}

export async function gmDirectEnemyAttack(page: Page, targetCoord: CellCoord): Promise<void> {
  await page.locator(".action-bar.gm-bar").getByRole("button", { name: "Target" }).click();
  await cell(page, targetCoord.x, targetCoord.y).click();
}

export async function openDamageTool(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Damage / Effect" }).click();
  await expect(page.locator(".info-pane .panel-title")).toHaveText("Damage & Effect");
}

export async function closeGmTool(page: Page): Promise<void> {
  const closeBtn = page.locator(".info-pane .panel .close-btn");
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
  }
}

export async function setDamageAmount(page: Page, amount: number): Promise<void> {
  const stepper = page.locator(".info-pane .stepper").first();
  const input = stepper.locator(".step-input");
  const current = Number(await input.inputValue());
  const delta = amount - current;
  const clicks = Math.abs(delta);
  const button = delta > 0 ? stepper.getByRole("button", { name: "+" }) : stepper.getByRole("button", { name: "−" });
  for (let i = 0; i < clicks; i++) {
    await button.click();
  }
  await expect(input).toHaveValue(String(amount));
}

export async function removePlayerTokenFromSheet(page: Page, sheetName: string): Promise<void> {
  await closeGmTool(page);
  await openCharacterSheet(page, sheetName);
  const removeBtn = page.getByRole("button", { name: "Remove token" });
  if (await removeBtn.isVisible().catch(() => false)) {
    if (await removeBtn.isEnabled()) {
      await removeBtn.click();
    }
  }
}

export async function cleanupCombat(page: Page, sheetName?: string): Promise<void> {
  await closeGmTool(page);
  await openTurnOrderTab(page);
  const toggle = page.getByRole("switch");
  if ((await toggle.getAttribute("aria-checked")) === "true") {
    await toggle.click();
  }
  const removeEnemies = page.getByRole("button", { name: "Remove all enemies" });
  if (await removeEnemies.isEnabled()) {
    await removeEnemies.click();
  }
  const resetCombat = page.getByRole("button", { name: "Reset combat" });
  if (await resetCombat.isVisible().catch(() => false)) {
    await resetCombat.click();
  } else {
    const endCombat = page.getByRole("button", { name: "End combat" });
    if (await endCombat.isEnabled()) {
      await endCombat.click();
    }
  }
  if (sheetName) {
    await removePlayerTokenFromSheet(page, sheetName);
  }
}

export async function openConsoleTab(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Console" }).click();
}
