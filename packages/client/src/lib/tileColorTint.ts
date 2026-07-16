import type { TileColorTint } from "@gaem/shared";
import type { CSSProperties } from "vue";

function tintColorWithOpacity(color: string, opacity: number): string {
  const hex = color.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(hex);
  const long = /^#([0-9a-fA-F]{6})$/.exec(hex);
  let r = 0;
  let g = 0;
  let b = 0;
  if (short) {
    const h = short[1]!;
    r = parseInt(h[0]! + h[0]!, 16);
    g = parseInt(h[1]! + h[1]!, 16);
    b = parseInt(h[2]! + h[2]!, 16);
  } else if (long) {
    const h = long[1]!;
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Image (+ optional multiply tint) on one layer so zoom never leaves uncolored edge seams. */
export function tileImageLayerStyle(
  imageUrl: string,
  tint?: TileColorTint | null,
): CSSProperties {
  if (!tint) {
    return { backgroundImage: `url(${imageUrl})` };
  }
  const overlay = tintColorWithOpacity(tint.color, tint.opacity);
  return {
    backgroundImage: `linear-gradient(${overlay}, ${overlay}), url(${imageUrl})`,
    backgroundBlendMode: "multiply, normal",
    backgroundSize: "cover, cover",
    backgroundPosition: "center, center",
    backgroundRepeat: "no-repeat, no-repeat",
    WebkitMaskImage: `url(${imageUrl})`,
    maskImage: `url(${imageUrl})`,
    WebkitMaskSize: "cover",
    maskSize: "cover",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  };
}
