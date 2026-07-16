import { getPortraitBgExcludeHues } from "@gaem/shared";
import { ref } from "vue";

const FALLBACK = "var(--color-surface-raised)";

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load portrait"));
    img.src = url;
  });
}

function pixelIncluded(
  r: number,
  g: number,
  b: number,
  a: number,
  excludeHues: [number, number][] | undefined,
): boolean {
  if (a < 128) return false;
  if (r < 24 && g < 24 && b < 24) return false;
  if (!excludeHues?.length) return true;
  const [h, s] = rgbToHsl(r, g, b);
  if (s < 20) return true;
  return !excludeHues.some(([lo, hi]) => h >= lo && h <= hi);
}

async function extractPortraitBackgroundColor(
  imageUrl: string,
  excludeHues?: [number, number][],
): Promise<string> {
  const img = await loadImage(imageUrl);
  const size = 36;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return FALLBACK;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (!pixelIncluded(r, g, b, a, excludeHues)) continue;
    const key = ((r >> 4) << 16) | ((g >> 4) << 8) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count++;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  const top = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  if (top.length === 0) return FALLBACK;

  let tr = 0;
  let tg = 0;
  let tb = 0;
  let tw = 0;
  for (const bucket of top) {
    tr += (bucket.r / bucket.count) * bucket.count;
    tg += (bucket.g / bucket.count) * bucket.count;
    tb += (bucket.b / bucket.count) * bucket.count;
    tw += bucket.count;
  }

  const [h, s, l] = rgbToHsl(Math.round(tr / tw), Math.round(tg / tw), Math.round(tb / tw));
  const sat = Math.min(72, Math.max(38, s));
  const lit = Math.min(50, Math.max(30, l * 0.9));
  return `hsl(${h} ${sat}% ${lit}%)`;
}

export function enemyTokenBackground(baseColor: string): string {
  return `linear-gradient(to top, #000 25%, transparent 100%), ${baseColor}`;
}

export function useEnemyPortraitColors() {
  const colors = ref<Record<string, string>>({});
  const loading = new Set<string>();

  function queueExtract(slug: string, url: string) {
    if (colors.value[slug] || loading.has(slug)) return;
    loading.add(slug);
    void extractPortraitBackgroundColor(url, getPortraitBgExcludeHues(slug))
      .then((color) => {
        colors.value = { ...colors.value, [slug]: color };
      })
      .catch(() => {
        colors.value = { ...colors.value, [slug]: FALLBACK };
      })
      .finally(() => {
        loading.delete(slug);
      });
  }

  function portraitBackgroundFor(slug: string | undefined, url: string | null): string {
    if (!slug || !url) return enemyTokenBackground(FALLBACK);
    queueExtract(slug, url);
    return enemyTokenBackground(colors.value[slug] ?? FALLBACK);
  }

  return { portraitBackgroundFor, colors };
}
