import type { GmTool } from "../composables/useGmTools.js";
import { GM_TOOL_ICONS, type GmToolIconId } from "./gmToolIcons.js";

const CURSOR_SIZE = 32;
const STROKE = "#e6edf3";
const SHADOW = "#0d1117";

type CursorHotspot = { x: number; y: number; fallback: string };

const HOTSPOTS: Record<GmToolIconId, CursorHotspot> = {
  select: { x: 4, y: 4, fallback: "default" },
  damageEffect: { x: 16, y: 16, fallback: "default" },
  forceMove: { x: 16, y: 16, fallback: "default" },
  paintbrush: { x: 8, y: 28, fallback: "crosshair" },
  eyedropper: { x: 6, y: 28, fallback: "crosshair" },
};

function parseViewBox(viewBox: string): { w: number; h: number } {
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  return { w, h };
}

function buildCursorSvg(iconId: GmToolIconId): string {
  const icon = GM_TOOL_ICONS[iconId];
  const { w, h } = parseViewBox(icon.viewBox);
  const scale = CURSOR_SIZE / Math.max(w, h);
  const offsetX = (CURSOR_SIZE - w * scale) / 2;
  const offsetY = (CURSOR_SIZE - h * scale) / 2;
  const transform = `translate(${offsetX} ${offsetY}) scale(${scale})`;

  const strokeAttrs =
    'stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-width="1.25"';
  const shadowPaths = icon.paths
    .map((d) => `<path d="${d}" ${strokeAttrs} stroke="${SHADOW}" stroke-width="2.5" />`)
    .join("");
  const mainPaths = icon.paths
    .map((d) => `<path d="${d}" ${strokeAttrs} stroke="${STROKE}" />`)
    .join("");
  const damageEffectExtra =
    iconId === "damageEffect"
      ? [
          `<circle cx="8" cy="8" r="5.5" fill="none" stroke="${SHADOW}" stroke-width="2.5" />`,
          `<circle cx="8" cy="8" r="5.5" fill="none" stroke="${STROKE}" stroke-width="1.25" />`,
          `<circle cx="8.5" cy="8.5" r="1.25" fill="${SHADOW}" />`,
          `<circle cx="8" cy="8" r="1.25" fill="${STROKE}" />`,
        ].join("")
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" viewBox="0 0 ${CURSOR_SIZE} ${CURSOR_SIZE}"><g transform="${transform}">${shadowPaths}${damageEffectExtra}${mainPaths}</g></svg>`;
}

export function gmToolCursor(tool: GmTool | "eyedropper"): string {
  const iconId: GmToolIconId = tool;
  const { x, y, fallback } = HOTSPOTS[iconId];
  const encoded = encodeURIComponent(buildCursorSvg(iconId)).replace(/'/g, "%27");
  return `url("data:image/svg+xml,${encoded}") ${x} ${y}, ${fallback}`;
}
