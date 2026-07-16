import type { ConsoleActor } from "./console.js";

export type SheetLoadoutSnapshot = {
  class: string;
  armor: string;
  weapon: string;
  equipment?: string;
  gear?: string;
  weapon2?: string;
  data?: Record<string, unknown>;
};

export function actorForAuth(
  role: "gm" | "player",
  profileName?: string | null,
): ConsoleActor {
  if (role === "gm") return { name: "GM", role: "gm" };
  return { name: profileName ?? "Player", role: "player" };
}

function logDataBagChanges(
  log: (actor: ConsoleActor, message: string) => void,
  actor: ConsoleActor,
  label: string,
  prev: Record<string, unknown> | undefined,
  next: Record<string, unknown> | undefined,
): void {
  const prevData = prev ?? {};
  const nextData = next ?? {};
  const keys = new Set([...Object.keys(prevData), ...Object.keys(nextData)]);
  for (const key of keys) {
    if (prevData[key] !== nextData[key]) {
      const value = nextData[key];
      log(actor, `set ${label} ${key} to ${typeof value === "string" && value ? value : "none"}`);
    }
  }
}

function logLoadoutChanges(
  log: (actor: ConsoleActor, message: string) => void,
  actor: ConsoleActor,
  label: string,
  prev: SheetLoadoutSnapshot,
  next: SheetLoadoutSnapshot,
  options?: { skipClass?: boolean },
): void {
  if (prev.armor !== next.armor) {
    log(actor, `set ${label} armor to ${next.armor}`);
  }
  if (prev.weapon !== next.weapon) {
    log(actor, `set ${label} equipped weapon to ${next.weapon}`);
  }
  if (prev.equipment !== next.equipment) {
    log(actor, `set ${label} equipment to ${next.equipment || "none"}`);
  }
  if (prev.gear !== next.gear) {
    log(actor, `set ${label} gear to ${next.gear || "none"}`);
  }
  if (prev.weapon2 !== next.weapon2) {
    log(actor, `set ${label} carried weapon to ${next.weapon2 || "none"}`);
  }
  logDataBagChanges(log, actor, label, prev.data, next.data);
  if (prev.class !== next.class && !options?.skipClass) {
    log(actor, `set ${label} class to ${next.class}`);
  }
}

export function logSyncPlayerLoadoutChanges(
  log: (actor: ConsoleActor, message: string) => void,
  actor: ConsoleActor,
  label: string,
  prev: SheetLoadoutSnapshot,
  next: SheetLoadoutSnapshot,
): void {
  logLoadoutChanges(log, actor, label, prev, next);
}

export function logSheetFieldChanges(
  log: (actor: ConsoleActor, message: string) => void,
  actor: ConsoleActor,
  label: string,
  prev: {
    name: string;
    class: string;
    armor: string;
    weapon: string;
    equipment?: string;
    gear?: string;
    weapon2?: string;
    data?: Record<string, unknown>;
    tags?: string[];
  },
  next: {
    name: string;
    class: string;
    armor: string;
    weapon: string;
    equipment?: string;
    gear?: string;
    weapon2?: string;
    data?: Record<string, unknown>;
    tags?: string[];
  },
  sheetOnBoard: boolean,
): void {
  if (prev.name !== next.name) {
    log(actor, `set ${label} name to ${next.name}`);
  }
  if (!sheetOnBoard) {
    logLoadoutChanges(log, actor, label, prev, next);
  }
  if (JSON.stringify(prev.tags ?? []) !== JSON.stringify(next.tags ?? [])) {
    log(actor, `set ${label} tags to ${next.tags?.length ? next.tags.join(", ") : "none"}`);
  }
}
