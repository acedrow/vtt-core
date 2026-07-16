import { describe, expect, it } from "vitest";

import {
  RECON_TABLE_IDS,
  getReconTable,
  listReconTables,
} from "@gaem/shared";

describe("recon-tables-data", () => {
  it("lists the six core RECON tables in rulebook order", () => {
    expect(listReconTables().map((t) => t.id)).toEqual([
      "chambers",
      "corridors",
      "vaults",
      "scavenge",
      "scout",
      "travel",
    ]);
    expect(RECON_TABLE_IDS).toEqual([
      "chambers",
      "corridors",
      "vaults",
      "scavenge",
      "scout",
      "travel",
    ]);
  });

  it("has contiguous rolls 1..die for each table", () => {
    for (const table of listReconTables()) {
      expect(table.entries.length).toBe(table.die);
      expect(table.entries.map((e) => e.roll)).toEqual(
        Array.from({ length: table.die }, (_, i) => i + 1),
      );
      for (const entry of table.entries) {
        expect(entry.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("resolves tables by id", () => {
    expect(getReconTable("scavenge")?.name).toBe("Scavenge");
    expect(getReconTable("scout")?.die).toBe(20);
    expect(getReconTable("travel")?.die).toBe(13);
    expect(getReconTable(null)).toBeUndefined();
  });
});
