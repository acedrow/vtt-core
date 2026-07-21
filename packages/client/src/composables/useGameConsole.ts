import type { ConsoleLogEntry } from "@vtt-core/shared";
import { ref } from "vue";

import { readPersistedUi } from "./uiPersist.js";

export type RightPanelTab = "console" | "info" | "turnOrder" | "settings";

const entries = ref<ConsoleLogEntry[]>([]);
export const activeTab = ref<RightPanelTab>(readPersistedUi().activeTab);

export function setConsoleEntries(next: ConsoleLogEntry[]) {
  entries.value = next;
}

export function appendConsoleEntry(entry: ConsoleLogEntry) {
  if (entries.value.some((e) => e.id === entry.id)) return;
  entries.value.push(entry);
}

export function useGameConsole() {
  return {
    entries,
    activeTab,
    setConsoleEntries,
    appendConsoleEntry,
  };
}
