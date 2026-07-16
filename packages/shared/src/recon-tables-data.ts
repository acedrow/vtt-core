import { assertContentPackRegistered } from "./content-pack-state.js";

export type ReconTableId = string;

export type ReconTableEntry = {
  roll: number;
  text: string;
};

export type ReconTable = {
  id: ReconTableId;
  name: string;
  die: number;
  entries: ReconTableEntry[];
};

export const RECON_TABLE_IDS: ReconTableId[] = [];

export const RECON_TABLES: ReconTable[] = [];

const BY_ID = new Map<ReconTableId, ReconTable>();

export function replaceReconTablesCatalog(tables: ReconTable[]): void {
  RECON_TABLES.length = 0;
  RECON_TABLES.push(...tables);
  RECON_TABLE_IDS.length = 0;
  BY_ID.clear();
  for (const table of RECON_TABLES) {
    BY_ID.set(table.id, table);
    RECON_TABLE_IDS.push(table.id);
  }
}

export function getReconTable(id: ReconTableId | string | null | undefined): ReconTable | undefined {
  assertContentPackRegistered();
  if (!id) return undefined;
  return BY_ID.get(id);
}

export function listReconTables(): ReconTable[] {
  assertContentPackRegistered();
  return RECON_TABLES;
}
