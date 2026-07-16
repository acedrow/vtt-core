import type { Env } from "./env.js";
import type { AuthContext } from "./auth.js";
import { authHasGmCapabilities } from "./auth.js";

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function extForContentType(contentType: string): string | null {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return null;
}

export function regionImageObjectKey(contentType: string): string | null {
  const ext = extForContentType(contentType);
  if (!ext) return null;
  return `region-images/${crypto.randomUUID()}.${ext}`;
}

export async function handlePutRegionImage(
  env: Env,
  auth: AuthContext,
  request: Request,
): Promise<Response> {
  if (!(await authHasGmCapabilities(auth, env))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return Response.json(
      { error: "Content-Type must be image/png, image/jpeg, or image/webp" },
      { status: 400 },
    );
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return Response.json({ error: "Empty body" }, { status: 400 });
  }
  if (body.byteLength > MAX_BYTES) {
    return Response.json({ error: "File too large" }, { status: 400 });
  }

  const key = regionImageObjectKey(contentType);
  if (!key) {
    return Response.json({ error: "Unsupported image type" }, { status: 400 });
  }

  await env.PORTRAIT_R2.put(key, body, {
    httpMetadata: { contentType },
  });

  return Response.json({ key });
}

export async function handleGetRegionImage(
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
