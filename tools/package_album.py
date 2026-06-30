from __future__ import annotations

import argparse
import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

import piexif
from PIL import Image, ImageOps

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except Exception:
    pass


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
ALBUM_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]*$")
DEFAULT_DISPLAY_LONG_EDGE = 3000


def title_from_album_id(album_id: str) -> str:
    return " ".join(part.capitalize() for part in album_id.split("-") if part)


def safe_album_id(album_id: str) -> str:
    if not ALBUM_ID_PATTERN.fullmatch(album_id):
        raise ValueError("album id must use lowercase letters, numbers, and hyphens")
    return album_id


def sorted_images(source_dir: Path) -> list[Path]:
    def sort_key(path: Path) -> tuple[str, ...]:
        return tuple(part.lower() for part in path.relative_to(source_dir).parts)

    return sorted(
        (
            path
            for path in source_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
        ),
        key=sort_key,
    )


def object_key(prefix: str, relative_path: Path) -> str:
    prefix_parts = [part for part in prefix.replace("\\", "/").strip("/").split("/") if part]
    parts = [*prefix_parts, *relative_path.parts]
    if any(part in ("", ".", "..") or "\\" in part for part in parts):
        raise ValueError("object keys must be safe relative paths")
    return "/".join(parts)


def parse_exif_datetime(value: object) -> str | None:
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="ignore").rstrip("\x00")
    if isinstance(value, str):
        try:
            return datetime.strptime(value, "%Y:%m:%d %H:%M:%S").isoformat()
        except ValueError:
            return None
    return None


def captured_at(image: Image.Image) -> str | None:
    raw_exif = image.info.get("exif")
    if raw_exif:
        try:
            exif_dict = piexif.load(raw_exif)
        except Exception:
            exif_dict = {}

        for ifd_name, tag in (
            ("Exif", piexif.ExifIFD.DateTimeOriginal),
            ("0th", piexif.ImageIFD.DateTime),
        ):
            captured = parse_exif_datetime(exif_dict.get(ifd_name, {}).get(tag))
            if captured:
                return captured

    exif = image.getexif()
    for tag in (36867, 306):
        captured = parse_exif_datetime(exif.get(tag))
        if captured:
            return captured
    return None


def sanitized_exif_bytes(image: Image.Image, strip_gps: bool) -> bytes | None:
    raw_exif = image.info.get("exif")
    if not raw_exif:
        return None

    try:
        exif_dict = piexif.load(raw_exif)
    except Exception:
        return None

    if strip_gps:
        exif_dict["GPS"] = {}

    for ifd_name in ("0th", "1st"):
        exif_dict.get(ifd_name, {}).pop(piexif.ImageIFD.Orientation, None)

    return piexif.dump(exif_dict)


def save_full_jpeg(image: Image.Image, output_path: Path, strip_gps: bool) -> None:
    normalized = ImageOps.exif_transpose(image).convert("RGB")
    save_kwargs: dict[str, Any] = {"format": "JPEG", "quality": 95, "subsampling": 1}
    exif_bytes = sanitized_exif_bytes(image, strip_gps)
    if exif_bytes:
        save_kwargs["exif"] = exif_bytes
    normalized.save(output_path, **save_kwargs)


def save_thumbnail(image: Image.Image, output_path: Path) -> None:
    thumbnail = ImageOps.exif_transpose(image).convert("RGB")
    thumbnail.thumbnail((800, 800), Image.Resampling.LANCZOS)
    thumbnail.save(output_path, "WEBP", quality=82, method=6)


def save_display_image(image: Image.Image, output_path: Path, long_edge: int) -> None:
    if long_edge <= 0:
        raise ValueError("display long edge must be positive")
    display = ImageOps.exif_transpose(image).convert("RGB")
    display.thumbnail((long_edge, long_edge), Image.Resampling.LANCZOS)
    display.save(output_path, "WEBP", quality=86, method=6)


def write_album_index(index_path: Path, manifest: dict[str, Any]) -> None:
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding="utf-8"))
    else:
        index = {"version": 1, "generatedAt": "", "albums": []}

    albums = [
        album
        for album in index.get("albums", [])
        if isinstance(album, dict) and album.get("albumId") != manifest["albumId"]
    ]
    albums.append(
        {
            "albumId": manifest["albumId"],
            "title": manifest["title"],
            "createdAt": manifest["createdAt"],
            "coverPhotoId": manifest["photos"][0]["id"],
            "photoCount": len(manifest["photos"]),
        }
    )
    albums.sort(key=lambda album: album["createdAt"], reverse=True)

    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(
        json.dumps(
            {
                "version": 1,
                "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
                "albums": albums,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def package_album(
    source_dir: Path,
    album_id: str,
    title: str | None,
    output_dir: Path,
    strip_gps: bool = True,
    copy_full: bool = False,
    originals_prefix: str | None = None,
    display_long_edge: int = DEFAULT_DISPLAY_LONG_EDGE,
    display_only: bool = False,
) -> dict[str, Any]:
    if copy_full and display_only:
        raise ValueError("display-only mode cannot copy full-size files")

    album_id = safe_album_id(album_id)
    source_dir = source_dir.resolve()
    output_dir = output_dir.resolve()

    images = sorted_images(source_dir)
    if not images:
        raise ValueError(f"no supported images found in {source_dir}")

    album_dir = output_dir / "albums" / album_id
    thumbs_dir = album_dir / "thumbs"
    display_dir = album_dir / "display"
    if not display_only:
        thumbs_dir.mkdir(parents=True, exist_ok=True)
    display_dir.mkdir(parents=True, exist_ok=True)
    full_dir = album_dir / "full"
    if copy_full:
        full_dir.mkdir(parents=True, exist_ok=True)

    existing_originals_prefix = source_dir.name if originals_prefix is None else originals_prefix
    existing_manifest_path = album_dir / "manifest.json"
    existing_manifest: dict[str, Any] = {}
    existing_photos_by_id: dict[str, dict[str, Any]] = {}
    if display_only and existing_manifest_path.exists():
        existing_manifest = json.loads(existing_manifest_path.read_text(encoding="utf-8"))
        existing_photos_by_id = {
            photo["id"]: photo
            for photo in existing_manifest.get("photos", [])
            if isinstance(photo, dict) and isinstance(photo.get("id"), str)
        }

    photos: list[dict[str, Any]] = []
    for index, image_path in enumerate(images, start=1):
        photo_id = f"img_{index:03d}"
        thumb_name = f"{photo_id}.webp"
        display_name = f"{photo_id}.webp"
        relative_image_path = image_path.relative_to(source_dir)

        with Image.open(image_path) as image:
            width, height = ImageOps.exif_transpose(image).size
            if not display_only:
                save_thumbnail(image, thumbs_dir / thumb_name)
            save_display_image(image, display_dir / display_name, display_long_edge)
            if copy_full:
                filename = f"{photo_id}.jpg"
                full_path = f"albums/{album_id}/full/{filename}"
                save_full_jpeg(image, full_dir / filename, strip_gps)
            else:
                filename = image_path.name
                full_path = object_key(existing_originals_prefix, relative_image_path)

            photo: dict[str, Any] = {
                "id": photo_id,
                "filename": filename,
                "thumbPath": f"albums/{album_id}/thumbs/{thumb_name}",
                "displayPath": f"albums/{album_id}/display/{display_name}",
                "fullPath": full_path,
                "width": width,
                "height": height,
            }
            captured = captured_at(image)
            if captured:
                photo["capturedAt"] = captured
            existing_photo = existing_photos_by_id.get(photo_id)
            if display_only and existing_photo:
                photo = {
                    **existing_photo,
                    "id": photo_id,
                    "displayPath": f"albums/{album_id}/display/{display_name}",
                }
            photos.append(photo)

    manifest: dict[str, Any] = {
        "version": 1,
        "albumId": album_id,
        "title": title or existing_manifest.get("title") or title_from_album_id(album_id),
        "createdAt": existing_manifest.get("createdAt") or date.today().isoformat(),
        "visibility": "access-controlled",
        "photos": photos,
    }

    (album_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    write_album_index(output_dir / "albums" / "index.json", manifest)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Package a local photo album for manual B2 upload")
    parser.add_argument("source", type=Path, help="Directory of source images")
    parser.add_argument("--album", required=True, help="Album id, for example 2026-family-trip")
    parser.add_argument("--title", help="Album title; defaults to a title-cased album id")
    parser.add_argument("--out", type=Path, default=Path("dist-albums"), help="Output directory")
    parser.add_argument("--copy-full", action="store_true", help="Copy normalized full-size JPEGs into the package")
    parser.add_argument(
        "--display-only",
        action="store_true",
        help="Backfill display images and manifest display paths without regenerating thumbnails or full-size files",
    )
    parser.add_argument(
        "--display-long-edge",
        type=int,
        default=DEFAULT_DISPLAY_LONG_EDGE,
        help=f"Maximum width or height for generated display images; defaults to {DEFAULT_DISPLAY_LONG_EDGE}",
    )
    parser.add_argument(
        "--originals-prefix",
        help="B2 key prefix for already-synced originals; defaults to the source folder name",
    )
    parser.add_argument("--keep-gps", action="store_true", help="Preserve GPS EXIF metadata when --copy-full is used")
    args = parser.parse_args()
    if args.copy_full and args.originals_prefix is not None:
        parser.error("--originals-prefix cannot be used with --copy-full")
    if args.copy_full and args.display_only:
        parser.error("--display-only cannot be used with --copy-full")

    manifest = package_album(
        source_dir=args.source,
        album_id=args.album,
        title=args.title,
        output_dir=args.out,
        strip_gps=not args.keep_gps,
        copy_full=args.copy_full,
        originals_prefix=args.originals_prefix,
        display_long_edge=args.display_long_edge,
        display_only=args.display_only,
    )
    print(json.dumps({"albumId": manifest["albumId"], "photos": len(manifest["photos"])}, indent=2))


if __name__ == "__main__":
    main()
