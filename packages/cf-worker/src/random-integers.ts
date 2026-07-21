import { actorForAuth, formatDiceRollMessage } from "@vtt-core/shared";

import type { AuthContext } from "./auth.js";
import { logConsole } from "./console-log.js";
import type { Env } from "./env.js";
import { getPlayerProfile } from "./player-profiles.js";

const RANDOM_ORG_URL = "https://api.random.org/json-rpc/4/invoke";

type RandomOrgSuccess = {
  result: {
    random: { data: number[] };
  };
};

type RandomOrgError = {
  error: { code: number; message: string };
};

type DiceParams = { n: number; min: number; max: number };

function parseDiceParams(raw: Record<string, unknown> | null): DiceParams | null {
  if (!raw) return null;
  const n = Number(raw.n);
  const min = Number(raw.min);
  const max = Number(raw.max);
  if (
    !Number.isInteger(n) || n < 1 || n > 10_000 ||
    !Number.isInteger(min) || min < -1e9 || min > 1e9 ||
    !Number.isInteger(max) || max < -1e9 || max > 1e9 ||
    min > max
  ) {
    return null;
  }
  return { n, min, max };
}

async function fetchRandomIntegers(
  env: Env,
  params: DiceParams,
): Promise<number[] | { error: string; status: number }> {
  const apiKey = env.RANDOM_ORG_API_KEY;
  if (!apiKey) {
    return { error: "RANDOM_ORG_API_KEY not configured", status: 500 };
  }

  let upstream: Response;
  try {
    upstream = await fetch(RANDOM_ORG_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "generateIntegers",
        params: { apiKey, ...params },
        id: 1,
      }),
    });
  } catch {
    return { error: "Failed to reach random.org", status: 502 };
  }

  const data = (await upstream.json()) as RandomOrgSuccess | RandomOrgError;
  if ("error" in data) {
    return { error: data.error.message, status: 502 };
  }

  return data.result.random.data;
}

export async function handleRandomIntegersGet(
  env: Env,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const params = parseDiceParams({
    n: url.searchParams.get("n"),
    min: url.searchParams.get("min"),
    max: url.searchParams.get("max"),
  });
  if (!params) {
    return Response.json(
      { error: "n, min, and max are required integers (n: 1–10000, min/max: ±1e9, min ≤ max)" },
      { status: 400 },
    );
  }

  const result = await fetchRandomIntegers(env, params);
  if (!Array.isArray(result)) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  return Response.json({ data: result });
}

export async function handleRollDicePost(
  env: Env,
  auth: AuthContext,
  request: Request,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const params = parseDiceParams(body);
  if (!params) {
    return Response.json(
      { error: "n, min, and max are required integers (n: 1–10000, min/max: ±1e9, min ≤ max)" },
      { status: 400 },
    );
  }

  const bonus = Number(body?.bonus);
  if (!Number.isInteger(bonus)) {
    return Response.json({ error: "bonus must be an integer" }, { status: 400 });
  }

  const result = await fetchRandomIntegers(env, params);
  if (!Array.isArray(result)) {
    return Response.json({ error: result.error }, { status: result.status });
  }

  const total = result.reduce((sum, v) => sum + v, 0) + bonus;
  const profile = auth.playerKey ? await getPlayerProfile(env, auth.playerKey) : null;
  const actor = actorForAuth(auth.role, profile?.name);
  await logConsole(env, actor, formatDiceRollMessage(result, params.max, bonus));

  return Response.json({ data: result, total });
}
