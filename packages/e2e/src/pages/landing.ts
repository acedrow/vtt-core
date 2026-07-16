import { expect, type Page } from "@playwright/test";

import { E2E_ENV } from "../env.js";

export async function loginAsGm(page: Page, password = E2E_ENV.gmPassword): Promise<void> {
  await page.goto("/");
  const passwordInput = page.getByPlaceholder("Password");
  await passwordInput.fill(password);
  await expect(passwordInput).toHaveValue(password);
  const joinGm = page.getByRole("button", { name: "Join as GM" });
  await expect(joinGm).toBeEnabled();
  await Promise.all([page.waitForURL("**/game"), joinGm.click()]);
}

export async function loginAsPlayer(
  page: Page,
  profileName: string,
  password = E2E_ENV.playerPassword,
): Promise<void> {
  await page.goto("/");
  const passwordInput = page.getByPlaceholder("Password");
  await passwordInput.fill(password);
  await expect(passwordInput).toHaveValue(password);
  const joinPlayer = page.getByRole("button", { name: "Join as Player" });
  await expect(joinPlayer).toBeEnabled();
  await joinPlayer.click();
  await page.getByRole("button", { name: profileName }).click();
  await Promise.all([
    page.waitForURL("**/game"),
    page.getByRole("button", { name: "Join game as player" }).click(),
  ]);
}
