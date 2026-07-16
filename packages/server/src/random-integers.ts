import type { Request, Response } from "express";

import { formatDiceRollMessage } from "@gaem/shared";

const RANDOM_ORG_URL = "https://api.random.org/json-rpc/4/invoke";

type RandomOrgSuccess = {
  result: {
    random: { data: number[] };
  };
};

type RandomOrgError = {
  error: { code: number; message: string };
};

function parseParams(req: Request): { n: number; min: number; max: number } | null {
  const raw = req.method === "GET" ? req.query : req.body;
  const n = Number(raw?.n);
  const min = Number(raw?.min);
  const max = Number(raw?.max);
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

async function fetchRandomIntegers(params: {
  n: number;
  min: number;
  max: number;
}): Promise<number[] | { error: string; status: number }> {
  const apiKey = process.env.RANDOM_ORG_API_KEY;
  if (!apiKey) {
    return { error: "RANDOM_ORG_API_KEY not configured", status: 500 };
  }

  let upstream: globalThis.Response;
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

export async function randomIntegersHandler(req: Request, res: Response): Promise<void> {
  const params = parseParams(req);
  if (!params) {
    res.status(400).json({
      error: "n, min, and max are required integers (n: 1–10000, min/max: ±1e9, min ≤ max)",
    });
    return;
  }

  const result = await fetchRandomIntegers(params);
  if (!Array.isArray(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({ data: result });
}

export async function rollDiceHandler(
  req: Request,
  res: Response,
  logRoll: (message: string) => void,
): Promise<void> {
  const params = parseParams(req);
  if (!params) {
    res.status(400).json({
      error: "n, min, and max are required integers (n: 1–10000, min/max: ±1e9, min ≤ max)",
    });
    return;
  }

  const bonus = Number(req.body?.bonus);
  if (!Number.isInteger(bonus)) {
    res.status(400).json({ error: "bonus must be an integer" });
    return;
  }

  const result = await fetchRandomIntegers(params);
  if (!Array.isArray(result)) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const total = result.reduce((sum, v) => sum + v, 0) + bonus;
  logRoll(formatDiceRollMessage(result, params.max, bonus));
  res.json({ data: result, total });
}
