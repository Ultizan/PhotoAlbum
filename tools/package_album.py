from __future__ import annotations

import argparse
import json
import re
import shutil
import tempfile
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


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic", ".heif"}
ALBUM_ID_PATTERN = re.compile(r"[a-z0-9][a-z0-9-]*")


def title_from_album_id(album_id: str) -> str:
    return " ".join(part.capitalize() for part in album_id.replace("_", "-").split("-") if part)


def sorted_images(source_dir: Path) -> list[Path]:
    return sorted(
        path for path in source_dir.iterdir() if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def safe_album_id(album_id: str) -> str:
    if not ALBUM_ID_PATTERN.fullmatch(album_id):
        raise ValueError("album id must use lowercase letters, numbers, and hyphens")
    return album_id


def captured_at(image: Image.Image) -> str | None:
    exif = image.getexif()
    for tag in (36867, 306):
        value = exif.get(tag)
        if isinstance(value, str):
            try:
                return datetime.strptime(value, "%Y:%m:%d %H:%M:%S").isoformat()
            except ValueError:
                continue
    return None


def sanitized_exif_bytes(image: Image.Image, strip_gps: bool) -> bytes | None:
    raw_exif = image.info.get("exif")
    if not raw_exif:
        return None
    try:
        exif_dict = piexif.load(raw_exif)
        exif_dict["0th"].pop(piexif.ImageIFD.Orientation, None)
        exif_dict["1st"].pop(piexif.ImageIFD.Orientation, None)
        if strip_gps:
            exif_dict["GPS"] = {}
        return piexif.dump(exif_dict)
    except Exception:
        return None


def save_full_jpeg(image: Image.Image, output_path: Path, strip_gps: bool) -> None:
    transposed = ImageOps.exif_transpose(image)
    rgb = transposed.convert("RGB")
    exif_bytes = sanitized_exif_bytes(image, strip_gps)
    save_kwargs: dict[str, Any] = {"format": "JPEG", "quality": 95, "subsampling": 1}
    if exif_bytes:
        save_kwargs["exif"] = exif_bytes
    rgb.save(output_path, **save_kwargs)


def save_thumbnail(image: Image.Image, output_path: Path) -> None:
    thumb = ImageOps.exif_transpose(image).convert("RGB")
    thumb.thumbnail((800, 800), Image.Resampling.LANCZOS)
    thumb.save(output_path, "WEBP", quality=82, method=6)


def package_album(
    source_dir: Path,
    album_id: str,
    title: str | None,
    output_dir: Path,
    strip_gps: bool = True,
) -> dict[str, Any]:
    album_id = safe_album_id(album_id)
    source_dir = source_dir.resolve()
    output_dir = output_dir.resolve()
    if not source_dir.is_dir():
        raise ValueError(f"source directory does not exist: {source_dir}")

    image_paths = sorted_images(source_dir)
    if not image_paths:
        raise ValueError(f"no supported images found in {source_dir}")

    albums_dir = output_dir / "albums"
    album_dir = albums_dir / album_id
    output_dir.mkdir(parents=True, exist_ok=True)
    staging_root = Path(tempfile.mkdtemp(prefix=f".{album_id}-", dir=output_dir))
    staged_album_dir = staging_root / album_id
    thumbs_dir = staged_album_dir / "thumbs"
    full_dir = staged_album_dir / "full"
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    full_dir.mkdir(parents=True, exist_ok=True)

    photos: list[dict[str, Any]] = []
    try:
        for index, image_path in enumerate(image_paths, start=1):
            photo_id = f"img_{index:03d}"
            full_name = f"{photo_id}.jpg"
            thumb_name = f"{photo_id}.webp"
            with Image.open(image_path) as image:
                width, height = ImageOps.exif_transpose(image).size
                save_full_jpeg(image, full_dir / full_name, strip_gps)
                save_thumbnail(image, thumbs_dir / thumb_name)
                photo: dict[str, Any] = {
                    "id": photo_id,
                    "filename": full_name,
                    "thumbPath": f"albums/{album_id}/thumbs/{thumb_name}",
                    "fullPath": f"albums/{album_id}/full/{full_name}",
                    "width": width,
                    "height": height,
                }
                captured = captured_at(image)
                if captured:
                    photo["capturedAt"] = captured
                photos.append(photo)

        manifest: dict[str, Any] = {
            "version": 1,
            "albumId": album_id,
            "title": title or title_from_album_id(album_id),
            "createdAt": date.today().isoformat(),
            "visibility": "access-controlled",
            "photos": photos,
        }
        (staged_album_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        albums_dir.mkdir(parents=True, exist_ok=True)
        if album_dir.exists():
            shutil.rmtree(album_dir)
        shutil.move(str(staged_album_dir), album_dir)
        write_album_index(albums_dir / "index.json", manifest)
        return manifest
    finally:
        shutil.rmtree(staging_root, ignore_errors=True)


def write_album_index(index_path: Path, manifest: dict[str, Any]) -> None:
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding="utf-8"))
    else:
        index = {"version": 1, "generatedAt": datetime.now().astimezone().isoformat(), "albums": []}

    albums = [album for album in index.get("albums", []) if album.get("albumId") != manifest["albumId"]]
    cover_photo_id = manifest["photos"][0]["id"] if manifest["photos"] else ""
    albums.append(
        {
            "albumId": manifest["albumId"],
            "title": manifest["title"],
            "createdAt": manifest["createdAt"],
            "coverPhotoId": cover_photo_id,
            "photoCount": len(manifest["photos"]),
        }
    )
    albums.sort(key=lambda album: album["createdAt"], reverse=True)
    index["version"] = 1
    index["generatedAt"] = datetime.now().astimezone().isoformat()
    index["albums"] = albums
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Package a local album for manual B2 upload")
    parser.add_argument("source", type=Path)
    parser.add_argument("--album", required=True)
    parser.add_argument("--title")
    parser.add_argument("--out", type=Path, default=Path("dist-albums"))
    parser.add_argument("--keep-gps", action="store_true")
    args = parser.parse_args()

    manifest = package_album(
        source_dir=args.source,
        album_id=args.album,
        title=args.title,
        output_dir=args.out,
        strip_gps=not args.keep_gps,
    )
    print(json.dumps({"albumId": manifest["albumId"], "photos": len(manifest["photos"])}, indent=2))


if __name__ == "__main__":
    main()
