import type { ConsoleLogEntry } from "@vtt-core/shared";
import { ref } from "vue";

import { readPersistedUi } from "./uiPersist.js";

export type RightPanelTab = "console" | "info" | "turnOrder" | "settings";

const entries = ref<ConsoleLogEntry[]>([]);
export const activeTab = ref<RightPanelTab>(readPersistedUi().activeTab);

export function setConsoleEntries(next: ConsoleLogEntry[]) {
  const byId = new Map<string, ConsoleLogEntry>();
  for (const entry of next) byId.set(entry.id, entry);
  // Keep live entries that arrived after the sync snapshot was built.
  for (const entry of entries.value) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  entries.value = [...byId.values()].sort(
    (a, b) => a.at - b.at || a.id.localeCompare(b.id),
  );
}

export function appendConsoleEntry(entry: ConsoleLogEntry) {
  if (entries.value.some((e) => e.id === entry.id)) return;
  entries.value = [...entries.value, entry];
}

export function useGameConsole() {
  return {
    entries,
    activeTab,
    setConsoleEntries,
    appendConsoleEntry,
  };
}
