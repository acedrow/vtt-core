#!/usr/bin/env python3
import argparse
import io
import re
import sys
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PDF = REPO_ROOT / "HELLPIERCERS v1.02.pdf"
DEFAULT_IMAGE_OUT = Path(__file__).resolve().parent / "out"


def load_reader(pdf_path: Path) -> PdfReader:
    if not pdf_path.is_file():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        print("Place HELLPIERCERS v1.02.pdf at the repo root (gitignored).", file=sys.stderr)
        sys.exit(1)
    return PdfReader(str(pdf_path))


def page_text(reader: PdfReader, page_num: int) -> str:
    return reader.pages[page_num - 1].extract_text() or ""


def print_pages(reader: PdfReader, start: int, end: int) -> None:
    total = len(reader.pages)
    start = max(1, start)
    end = min(total, end)
    for page_num in range(start, end + 1):
        print(f"\n=== PAGE {page_num} ===\n")
        print(page_text(reader, page_num))


def search_pages(reader: PdfReader, query: str, context: int) -> None:
    pattern = re.compile(re.escape(query), re.IGNORECASE)
    hits = 0
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        if not pattern.search(text):
            continue
        hits += 1
        print(f"\n=== PAGE {i} ===\n")
        if context <= 0:
            print(text)
            continue
        for match in pattern.finditer(text):
            start = max(0, match.start() - context)
            end = min(len(text), match.end() + context)
            snippet = text[start:end].replace("\n", " ")
            print(f"...{snippet}...")
    if hits == 0:
        print(f"No matches for {query!r}", file=sys.stderr)
        sys.exit(1)


def iter_page_images(page) -> list[tuple[str, object]]:
    resources = page.get("/Resources")
    if not resources:
        return []
    xobject = resources.get("/XObject")
    if not xobject:
        return []
    xobject = xobject.get_object()
    results: list[tuple[str, object]] = []
    for name, ref in xobject.items():
        obj = ref.get_object()
        if obj.get("/Subtype") != "/Image":
            continue
        results.append((name, obj))
    return results


def image_filter_name(obj) -> str | None:
    filt = obj.get("/Filter")
    if isinstance(filt, list):
        filt = filt[-1] if filt else None
    return str(filt) if filt else None


def decode_page_image(obj) -> Image.Image:
    width = int(obj["/Width"])
    height = int(obj["/Height"])
    data = obj.get_data()
    filt = image_filter_name(obj)

    if filt == "/DCTDecode":
        return Image.open(io.BytesIO(data)).convert("RGB")

    for mode, channels in (("RGB", 3), ("RGBA", 4), ("L", 1)):
        expected = width * height * channels
        if len(data) == expected:
            return Image.frombytes(mode, (width, height), data[:expected])

    raise ValueError(f"unsupported {width}x{height} payload ({len(data)} bytes, filter={filt})")


def resolve_page_range(reader: PdfReader, page: int | None, from_page: int | None, to_page: int | None) -> range:
    total = len(reader.pages)
    if page is not None:
        if page < 1 or page > total:
            print(f"Page {page} out of range (1–{total})", file=sys.stderr)
            sys.exit(1)
        return range(page, page + 1)
    if from_page is not None or to_page is not None:
        start = max(1, from_page or 1)
        end = min(total, to_page or total)
        return range(start, end + 1)
    print("Image commands require --page or --from-page/--to-page", file=sys.stderr)
    sys.exit(2)


def list_images(reader: PdfReader, pages: range) -> None:
    found = False
    for page_num in pages:
        images = iter_page_images(reader.pages[page_num - 1])
        if not images:
            continue
        found = True
        print(f"\n=== PAGE {page_num} ({len(images)} images) ===")
        for name, obj in images:
            width = int(obj["/Width"])
            height = int(obj["/Height"])
            print(
                f"  {name}: {width}x{height}, filter={image_filter_name(obj)}, "
                f"bytes={len(obj.get_data())}"
            )
    if not found:
        print("No embedded images on the requested page(s)", file=sys.stderr)
        sys.exit(1)


def extract_images(
    reader: PdfReader,
    pages: range,
    out_dir: Path,
    max_dim: int | None,
) -> None:
    saved = 0
    for page_num in pages:
        page_dir = out_dir / f"page-{page_num}"
        for name, obj in iter_page_images(reader.pages[page_num - 1]):
            width = int(obj["/Width"])
            height = int(obj["/Height"])
            if max_dim is not None and (width > max_dim or height > max_dim):
                continue
            try:
                image = decode_page_image(obj)
            except ValueError as err:
                print(f"skip {name} on page {page_num}: {err}", file=sys.stderr)
                continue
            page_dir.mkdir(parents=True, exist_ok=True)
            safe_name = str(name).replace("/", "")
            path = page_dir / f"{safe_name}_{width}x{height}.png"
            image.save(path)
            print(path)
            saved += 1
    if saved == 0:
        print("No images extracted (try --all-images or a different page range)", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract text from the Hellpiercers rulebook PDF")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF, help="Path to rulebook PDF")
    parser.add_argument("--page", type=int, help="Single page number (1-indexed)")
    parser.add_argument("--from-page", type=int, dest="from_page", help="Start page (1-indexed)")
    parser.add_argument("--to-page", type=int, dest="to_page", help="End page (1-indexed)")
    parser.add_argument("--search", "-s", help="Search all pages (case-insensitive)")
    parser.add_argument(
        "--context",
        type=int,
        default=120,
        help="Characters of context around each search hit (0 = full page)",
    )
    parser.add_argument("--pages", action="store_true", help="Print total page count and exit")
    parser.add_argument(
        "--list-images",
        action="store_true",
        help="List embedded images on the requested page(s)",
    )
    parser.add_argument(
        "--extract-images",
        action="store_true",
        help="Decode embedded images on the requested page(s) to PNG",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_IMAGE_OUT,
        help="Output directory for --extract-images (default: scripts/rulebook/out)",
    )
    parser.add_argument(
        "--max-dim",
        type=int,
        default=600,
        help="Skip images wider or taller than this (default: 600). Use --all-images to disable.",
    )
    parser.add_argument(
        "--all-images",
        action="store_true",
        help="Extract every embedded image, including full-page backgrounds",
    )
    args = parser.parse_args()

    reader = load_reader(args.pdf)

    if args.pages:
        print(len(reader.pages))
        return

    if args.list_images or args.extract_images:
        pages = resolve_page_range(reader, args.page, args.from_page, args.to_page)
        if args.list_images:
            list_images(reader, pages)
        if args.extract_images:
            max_dim = None if args.all_images else args.max_dim
            extract_images(reader, pages, args.out, max_dim)
        return

    if args.search:
        search_pages(reader, args.search, args.context)
        return

    if args.page is not None:
        print_pages(reader, args.page, args.page)
        return

    if args.from_page is not None or args.to_page is not None:
        start = args.from_page or 1
        end = args.to_page or len(reader.pages)
        print_pages(reader, start, end)
        return

    parser.print_help()
    sys.exit(2)


if __name__ == "__main__":
    main()
