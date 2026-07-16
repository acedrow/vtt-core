import type { ConsoleActor, ConsoleLogEntry } from "@gaem/shared";
import { trimConsoleEntries } from "@gaem/shared";
import { randomUUID } from "node:crypto";

let entries: ConsoleLogEntry[] = [];
let broadcaster: ((entry: ConsoleLogEntry) => void) | null = null;

export function registerConsoleBroadcaster(fn: (entry: ConsoleLogEntry) => void): void {
  broadcaster = fn;
}

export function getConsoleEntries(): ConsoleLogEntry[] {
  return entries;
}

export function appendConsole(actor: ConsoleActor, message: string): ConsoleLogEntry {
  const entry: ConsoleLogEntry = {
    id: randomUUID(),
    at: Date.now(),
    actor,
    message,
  };
  entries.push(entry);
  entries = trimConsoleEntries(entries);
  broadcaster?.(entry);
  return entry;
}
