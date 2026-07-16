import { expect, test } from "../../src/fixtures/combat.js";
import {
  cell,
  closeGmTool,
  findPlayerCell,
  getPlayerHp,
  openDamageTool,
  setDamageAmount,
} from "../../src/pages/game.js";

test.describe("gm damage tool", () => {
  test("gm damage tool reduces player HP", async ({ combat }) => {
    const { gmPage, sheetName } = combat;

    await expect(async () => {
      expect(await getPlayerHp(gmPage, sheetName)).toBe(30);
    }).toPass();

    await openDamageTool(gmPage);
    await setDamageAmount(gmPage, 3);
    const playerCell = await findPlayerCell(gmPage);
    await cell(gmPage, playerCell.x, playerCell.y).click();
    await closeGmTool(gmPage);

    await expect(async () => {
      expect(await getPlayerHp(gmPage, sheetName)).toBe(27);
    }).toPass();
  });
});
