import type { VttRole } from "./types.js";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type TokenPayload = {
  role: VttRole;
  exp: number;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const encoder = new TextEncoder();

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(signature));
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function createAuthToken(
  role: VttRole,
  secret: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<string> {
  const payload: TokenPayload = { role, exp: Date.now() + ttlMs };
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export async function verifyAuthToken(
  token: string,
  secret: string,
): Promise<{ role: VttRole } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;

  const expected = await sign(encoded, secret);
  if (!constantTimeEqual(signature, expected)) return null;

  let payload: TokenPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as TokenPayload;
  } catch {
    return null;
  }
  if (payload.role !== "gm" && payload.role !== "player") return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  return { role: payload.role };
}
