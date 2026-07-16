import { randomUUID } from "node:crypto";
import type { Response } from "express";

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

export const regionImages = new Map<string, { body: Buffer; contentType: string }>();

export function regionImageObjectKey(contentType: string): string | null {
  const ext = extForContentType(contentType);
  if (!ext) return null;
  return `region-images/${randomUUID()}.${ext}`;
}

export function putRegionImageHandler(
  auth: AuthContext,
  req: { body: unknown; headers: Record<string, string | string[] | undefined> },
  res: Response,
): void {
  if (!authHasGmCapabilities(auth)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const contentType = req.headers["content-type"] ?? "";
  const type = Array.isArray(contentType) ? contentType[0] ?? "" : contentType;
  if (!ALLOWED_TYPES.has(type)) {
    res.status(400).json({ error: "Content-Type must be image/png, image/jpeg, or image/webp" });
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

  const key = regionImageObjectKey(type);
  if (!key) {
    res.status(400).json({ error: "Unsupported image type" });
    return;
  }
  regionImages.set(key, { body, contentType: type });
  res.json({ key });
}

export function getRegionImageHandler(key: string, res: Response): void {
  const decoded = decodeURIComponent(key);
  const image = regionImages.get(decoded);
  if (!image) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.setHeader("Content-Type", image.contentType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(image.body);
}
