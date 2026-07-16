import type { Env } from "./env.js";
import type { AuthContext } from "./auth.js";
import { authHasGmCapabilities } from "./auth.js";

const MAX_BYTES = 2 * 1024 * 1024;

export function tileAppearanceObjectKey(): string {
  return `tile-appearances/${crypto.randomUUID()}.png`;
}

export async function handlePutTileAppearance(
  env: Env,
  auth: AuthContext,
  request: Request,
): Promise<Response> {
  if (!(await authHasGmCapabilities(auth, env))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType !== "image/png") {
    return Response.json({ error: "Content-Type must be image/png" }, { status: 400 });
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return Response.json({ error: "Empty body" }, { status: 400 });
  }
  if (body.byteLength > MAX_BYTES) {
    return Response.json({ error: "File too large" }, { status: 400 });
  }

  const key = tileAppearanceObjectKey();
  await env.PORTRAIT_R2.put(key, body, {
    httpMetadata: { contentType: "image/png" },
  });

  return Response.json({ key });
}

export async function handleGetTileAppearance(
  env: Env,
  key: string,
): Promise<Response> {
  const object = await env.PORTRAIT_R2.get(key);
  if (!object) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
