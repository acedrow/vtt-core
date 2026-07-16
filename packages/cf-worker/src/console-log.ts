import type { ConsoleActor, ConsoleLogEntry } from "@gaem/shared";
import { trimConsoleEntries } from "@gaem/shared";

import type { Env } from "./env.js";

const CONSOLE_KEY = "console:log";

export async function loadConsoleEntries(env: Env): Promise<ConsoleLogEntry[]> {
  return (await env.PLAYER_KV.get<ConsoleLogEntry[]>(CONSOLE_KEY, "json")) ?? [];
}

export async function appendConsole(
  env: Env,
  actor: ConsoleActor,
  message: string,
): Promise<ConsoleLogEntry> {
  const entries = await loadConsoleEntries(env);
  const entry: ConsoleLogEntry = {
    id: crypto.randomUUID(),
    at: Date.now(),
    actor,
    message,
  };
  entries.push(entry);
  await env.PLAYER_KV.put(CONSOLE_KEY, JSON.stringify(trimConsoleEntries(entries)));
  return entry;
}

export async function broadcastConsoleEntry(env: Env, entry: ConsoleLogEntry): Promise<void> {
  const id = env.GAME_ROOM.idFromName("default");
  const stub = env.GAME_ROOM.get(id);
  await stub.fetch("http://internal/internal/broadcast-console", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry }),
  });
}

export async function logConsole(
  env: Env,
  actor: ConsoleActor,
  message: string,
): Promise<ConsoleLogEntry> {
  const entry = await appendConsole(env, actor, message);
  await broadcastConsoleEntry(env, entry);
  return entry;
}
