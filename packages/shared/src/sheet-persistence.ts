import { getCampaignHooks } from "./campaign-hooks.js";
import {
  getContentPackMeta,
  type ContentPackMeta,
} from "./content-pack-state.js";
import { liftSheetDataKeys } from "./player-data.js";
import type { CharacterSheet, GameState } from "./types.js";

export function currentContentPackMeta(): ContentPackMeta | null {
  return getContentPackMeta();
}

export function stampContentPackMeta<T extends { contentPack?: ContentPackMeta }>(
  target: T,
  meta: ContentPackMeta | null = getContentPackMeta(),
): T {
  if (meta) {
    target.contentPack = { id: meta.id, version: meta.version };
  }
  return target;
}

/**
 * Reject when persisted pack id differs from the boot pack.
 * Missing stamp is allowed (legacy); same id with different version is allowed (migrators).
 */
export function contentPackMismatchError(
  stamped: ContentPackMeta | undefined,
  current: ContentPackMeta | null = getContentPackMeta(),
): string | null {
  if (!stamped?.id || !current) return null;
  if (stamped.id !== current.id) {
    return `Content pack mismatch: state is "${stamped.id}", boot pack is "${current.id}"`;
  }
  return null;
}

export type EnsureSheetResult =
  | { ok: true; sheet: CharacterSheet; dirty: boolean }
  | { ok: false; error: string };

/**
 * Lift pack data keys, run ensureSheet migrator, stamp current pack.
 * Persisted id mismatch rejects; version changes migrate then stamp.
 */
export function ensureCharacterSheet(sheet: CharacterSheet): EnsureSheetResult {
  const current = getContentPackMeta();
  const mismatch = contentPackMismatchError(sheet.contentPack, current);
  if (mismatch) return { ok: false, error: mismatch };

  const from = sheet.contentPack ?? null;
  liftSheetDataKeys(sheet);
  getCampaignHooks()?.ensureSheet?.(sheet, from);

  let dirty = false;
  if (current) {
    if (!sheet.contentPack || sheet.contentPack.id !== current.id || sheet.contentPack.version !== current.version) {
      stampContentPackMeta(sheet, current);
      dirty = true;
    }
  }
  return { ok: true, sheet, dirty };
}

export type EnsureGameStatePackResult =
  | { ok: true; dirty: boolean }
  | { ok: false; error: string };

/** Stamp / validate GameState.contentPack (migrators run via campaign ensure elsewhere). */
export function ensureGameStateContentPack(state: GameState): EnsureGameStatePackResult {
  const current = getContentPackMeta();
  const mismatch = contentPackMismatchError(state.contentPack, current);
  if (mismatch) return { ok: false, error: mismatch };

  let dirty = false;
  if (current) {
    if (
      !state.contentPack ||
      state.contentPack.id !== current.id ||
      state.contentPack.version !== current.version
    ) {
      stampContentPackMeta(state, current);
      dirty = true;
    }
  }
  return { ok: true, dirty };
}
