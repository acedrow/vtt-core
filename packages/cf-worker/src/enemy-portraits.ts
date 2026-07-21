import type { Env } from "./env.js";

const PORTRAIT_RE = /^\/api\/enemy-portraits\/([a-z0-9-]+)\/([a-z0-9-]+)$/;
const portraitCache = new Map<string, ArrayBuffer>();

export async function handleGetEnemyPortrait(
  env: Env,
  request: Request
): Promise<Response | null> {
  const match = new URL(request.url).pathname.match(PORTRAIT_RE);
  if (!match || request.method !== "GET") return null;

  const set = match[1];
  const slug = match[2];
  const cacheKey = `${set}/${slug}`;
  let body = portraitCache.get(cacheKey);
  if (!body) {
    const assetUrl = new URL(`/enemies/${set}/${slug}.png`, request.url);
    const assetRes = await env.ASSETS.fetch(assetUrl);
    const contentType = assetRes.headers.get("Content-Type") ?? "";
    if (!assetRes.ok || !contentType.startsWith("image/")) {
      return Response.json({ error: "Portrait not found" }, { status: 404 });
    }
    body = await assetRes.arrayBuffer();
    portraitCache.set(cacheKey, body);
  }

  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
