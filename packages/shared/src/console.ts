import type { Enemy, Player } from "./types.js";

export type ConsoleActor = {
  name: string;
  role: "gm" | "player";
};

export const CONSOLE_MAX_ENTRIES = 200;

export const CONSOLE_MSG_CONNECTED = "connected to game";
export const CONSOLE_MSG_DISCONNECTED = "disconnected from game";

export type ConsoleLogEntry = {
  id: string;
  at: number;
  actor: ConsoleActor;
  message: string;
};

export function trimConsoleEntries(
  entries: ConsoleLogEntry[],
): ConsoleLogEntry[] {
  if (entries.length <= CONSOLE_MAX_ENTRIES) return entries;
  return entries.slice(-CONSOLE_MAX_ENTRIES);
}

export function formatDiceRollMessage(
  rolls: number[],
  max: number,
  bonus: number,
): string {
  const dice = rolls.map((v) => `[${v}]`).join("");
  const total = rolls.reduce((sum, v) => sum + v, 0) + bonus;
  return `rolled ${rolls.length}d${max}${bonus !== 0 ? ` + ${bonus}` : ""}: ${dice}${ bonus !== 0 ? ` + ${bonus}` : ""} = ${total}`;
}

export function playerLabel(player: Player): string {
  return player.nickname ?? player.id;
}

export function enemyLabel(enemy: Enemy): string {
  return enemy.name ?? "Enemy";
}

export function characterTargetLabel(
  player: Player | undefined,
  sheetName?: string | null,
): string {
  if (sheetName) return sheetName;
  if (player) return playerLabel(player);
  return "Player";
}
