#!/usr/bin/env python3
"""Crop enemy/fortification portrait PNGs to non-background content bounds."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
# Prefer an explicit path (enemy-portraits-crop.mjs passes content package assets/).
DEFAULT_DIR = ROOT / "node_modules/@gaem/hellpiercers-content/assets/enemies"


def content_bbox(im: Image.Image, black_thresh: int = 24) -> tuple[int, int, int, int] | None:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if r < black_thresh and g < black_thresh and b < black_thresh:
                continue
            found = True
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if not found:
        return None
    return minx, miny, maxx + 1, maxy + 1


def crop_portrait(path: Path, dry_run: bool = False) -> str | None:
    im = Image.open(path)
    bbox = content_bbox(im)
    if bbox is None:
        return f"{path.name}: no content"
    if bbox == (0, 0, im.width, im.height):
        return None
    cropped = im.crop(bbox)
    if dry_run:
        return f"{path.name}: {im.size} -> {cropped.size}"
    cropped.save(path, format="PNG", optimize=True)
    return f"{path.name}: {im.size} -> {cropped.size}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="PNG files or directories (default: content package assets/enemies)",
    )
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    roots = args.paths or [DEFAULT_DIR]
    files: list[Path] = []
    for root in roots:
        if root.is_file() and root.suffix.lower() == ".png":
            files.append(root)
        elif root.is_dir():
            files.extend(sorted(root.rglob("*.png")))

    if not files:
        print("No PNG files found")
        return

    changed = 0
    for path in files:
        msg = crop_portrait(path, dry_run=args.dry_run)
        if msg:
            print(msg)
            if "->" in msg:
                changed += 1

    suffix = "would crop" if args.dry_run else "cropped"
    print(f"{suffix} {changed} of {len(files)} portrait(s)")


if __name__ == "__main__":
    main()
