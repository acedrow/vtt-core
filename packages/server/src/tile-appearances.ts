import { randomUUID } from "node:crypto";
import type { Response } from "express";

import type { AuthContext } from "./auth.js";
import { authHasGmCapabilities } from "./auth.js";

const MAX_BYTES = 2 * 1024 * 1024;

export const tileAppearances = new Map<string, { body: Buffer; contentType: string }>();

export function tileAppearanceObjectKey(): string {
  return `tile-appearances/${randomUUID()}.png`;
}

export function putTileAppearanceHandler(auth: AuthContext, req: { body: unknown; headers: Record<string, string | string[] | undefined> }, res: Response): void {
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const contentType = req.headers["content-type"] ?? "";
  if (contentType !== "image/png") {
    res.status(400).json({ error: "Content-Type must be image/png" });
    return;
  }

  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).json({ error: "Empty body" });
    return;
  }
  if (body.length > MAX_BYTES) {
    res.status(400).json({ error: "File too large" });
    return;
  }

  const key = tileAppearanceObjectKey();
  tileAppearances.set(key, { body, contentType: "image/png" });
  res.json({ key });
}

export function getTileAppearanceHandler(key: string, res: Response): void {
  const decoded = decodeURIComponent(key);
  const appearance = tileAppearances.get(decoded);
  if (!appearance) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.setHeader("Content-Type", appearance.contentType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(appearance.body);
}
