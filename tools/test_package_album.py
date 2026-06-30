import json
from pathlib import Path

import piexif
import pytest
from PIL import Image

from package_album import package_album


def write_jpeg(path: Path, size: tuple[int, int] = (120, 80), exif: bytes | None = None) -> None:
    image = Image.new("RGB", size, color=(40, 90, 120))
    save_kwargs = {"format": "JPEG"}
    if exif:
        save_kwargs["exif"] = exif
    image.save(path, **save_kwargs)


def test_package_album_creates_manifest_thumbs_and_index_without_copying_full_files(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    write_jpeg(source / "family.jpg")

    output = tmp_path / "out"

    manifest = package_album(
        source_dir=source,
        album_id="2026-family-trip",
        title="2026 Family Trip",
        output_dir=output,
        strip_gps=True,
    )

    album_dir = output / "albums" / "2026-family-trip"
    assert (album_dir / "manifest.json").exists()
    assert (output / "albums" / "index.json").exists()
    assert (album_dir / "thumbs" / "img_001.webp").exists()
    assert (album_dir / "display" / "img_001.webp").exists()
    assert not (album_dir / "full").exists()
    assert manifest["photos"][0]["width"] == 120
    assert manifest["photos"][0]["height"] == 80

    saved = json.loads((album_dir / "manifest.json").read_text(encoding="utf-8"))
    assert saved["albumId"] == "2026-family-trip"
    assert saved["photos"][0]["filename"] == "family.jpg"
    assert saved["photos"][0]["thumbPath"] == "albums/2026-family-trip/thumbs/img_001.webp"
    assert saved["photos"][0]["displayPath"] == "albums/2026-family-trip/display/img_001.webp"
    assert saved["photos"][0]["fullPath"] == "source/family.jpg"

    index = json.loads((output / "albums" / "index.json").read_text(encoding="utf-8"))
    assert index["version"] == 1
    assert index["albums"][0]["albumId"] == "2026-family-trip"
    assert index["albums"][0]["coverPhotoId"] == "img_001"
    assert index["albums"][0]["photoCount"] == 1


def test_package_album_reads_images_from_dated_child_folders(tmp_path: Path) -> None:
    source = tmp_path / "source"
    day_one = source / "2026_06_26"
    day_two = source / "2026_06_27"
    day_one.mkdir(parents=True)
    day_two.mkdir(parents=True)
    write_jpeg(day_two / "second.JPG", size=(90, 60))
    write_jpeg(day_one / "first.JPG", size=(120, 80))

    manifest = package_album(
        source_dir=source,
        album_id="michigan-2026",
        title="50th Anniversary Celebration",
        output_dir=tmp_path / "out",
        strip_gps=True,
    )

    assert [photo["filename"] for photo in manifest["photos"]] == ["first.JPG", "second.JPG"]
    assert [photo["fullPath"] for photo in manifest["photos"]] == [
        "source/2026_06_26/first.JPG",
        "source/2026_06_27/second.JPG",
    ]
    assert manifest["photos"][0]["width"] == 120
    assert manifest["photos"][1]["width"] == 90


def test_package_album_creates_display_images_limited_to_display_size(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    write_jpeg(source / "large.jpg", size=(4200, 2800))

    output = tmp_path / "out"
    manifest = package_album(
        source_dir=source,
        album_id="michigan-2026",
        title="Michigan 2026",
        output_dir=output,
    )

    display_path = output / manifest["photos"][0]["displayPath"]
    assert display_path.exists()
    with Image.open(display_path) as display:
        assert max(display.size) == 3000
        assert display.format == "WEBP"


def test_package_album_can_backfill_display_images_only(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    write_jpeg(source / "large.jpg", size=(4200, 2800))

    output = tmp_path / "out"
    manifest = package_album(
        source_dir=source,
        album_id="michigan-2026",
        title="Michigan 2026",
        output_dir=output,
        display_only=True,
    )

    album_dir = output / "albums" / "michigan-2026"
    assert (album_dir / "display" / "img_001.webp").exists()
    assert not (album_dir / "thumbs").exists()
    assert not (album_dir / "full").exists()
    assert manifest["photos"][0]["thumbPath"] == "albums/michigan-2026/thumbs/img_001.webp"
    assert manifest["photos"][0]["displayPath"] == "albums/michigan-2026/display/img_001.webp"


def test_display_only_preserves_existing_manifest_metadata(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    write_jpeg(source / "large.jpg", size=(4200, 2800))

    album_dir = tmp_path / "out" / "albums" / "michigan-2026"
    album_dir.mkdir(parents=True)
    (album_dir / "manifest.json").write_text(
        json.dumps(
            {
                "version": 1,
                "albumId": "michigan-2026",
                "title": "Existing Title",
                "createdAt": "2026-06-28",
                "visibility": "access-controlled",
                "photos": [
                    {
                        "id": "img_001",
                        "filename": "existing-name.jpg",
                        "thumbPath": "albums/michigan-2026/thumbs/img_001.webp",
                        "fullPath": "already-uploaded/original.JPG",
                        "width": 6960,
                        "height": 4640,
                        "capturedAt": "2026-06-26T15:48:45",
                    }
                ],
            }
        )
        + "\n",
        encoding="utf-8",
    )

    manifest = package_album(
        source_dir=source,
        album_id="michigan-2026",
        title=None,
        output_dir=tmp_path / "out",
        display_only=True,
    )

    assert manifest["title"] == "Existing Title"
    assert manifest["createdAt"] == "2026-06-28"
    assert manifest["photos"][0]["filename"] == "existing-name.jpg"
    assert manifest["photos"][0]["fullPath"] == "already-uploaded/original.JPG"
    assert manifest["photos"][0]["displayPath"] == "albums/michigan-2026/display/img_001.webp"


def test_package_album_uses_custom_existing_originals_prefix(tmp_path: Path) -> None:
    source = tmp_path / "source"
    dated = source / "2026_06_26"
    dated.mkdir(parents=True)
    write_jpeg(dated / "3W7A1320.JPG")

    manifest = package_album(
        source_dir=source,
        album_id="michigan-2026",
        title="50th Anniversary Celebration",
        output_dir=tmp_path / "out",
        originals_prefix="already-synced/50thCelebration",
    )

    assert manifest["photos"][0]["fullPath"] == "already-synced/50thCelebration/2026_06_26/3W7A1320.JPG"


def test_package_album_can_copy_normalized_full_files_when_requested(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    write_jpeg(source / "family.jpg")

    output = tmp_path / "out"
    manifest = package_album(
        source_dir=source,
        album_id="2026-family-trip",
        title="2026 Family Trip",
        output_dir=output,
        copy_full=True,
    )

    assert (output / "albums" / "2026-family-trip" / "full" / "img_001.jpg").exists()
    assert manifest["photos"][0]["filename"] == "img_001.jpg"
    assert manifest["photos"][0]["fullPath"] == "albums/2026-family-trip/full/img_001.jpg"


def test_package_album_strips_gps_exif_by_default(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    exif = {
        "0th": {},
        "Exif": {piexif.ExifIFD.DateTimeOriginal: "2026:06:20 19:34:00"},
        "GPS": {
            piexif.GPSIFD.GPSLatitudeRef: "N",
            piexif.GPSIFD.GPSLatitude: ((47, 1), (36, 1), (0, 1)),
            piexif.GPSIFD.GPSLongitudeRef: "W",
            piexif.GPSIFD.GPSLongitude: ((122, 1), (20, 1), (0, 1)),
        },
        "1st": {},
        "thumbnail": None,
    }
    write_jpeg(source / "gps.jpg", exif=piexif.dump(exif))

    output = tmp_path / "out"
    manifest = package_album(source, "2026-family-trip", None, output, copy_full=True)

    full_exif = piexif.load(str(output / "albums" / "2026-family-trip" / "full" / "img_001.jpg"))
    assert full_exif["GPS"] == {}
    assert manifest["photos"][0]["capturedAt"] == "2026-06-20T19:34:00"


def test_package_album_can_preserve_gps_exif(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    exif = {
        "0th": {},
        "Exif": {},
        "GPS": {
            piexif.GPSIFD.GPSLatitudeRef: "N",
            piexif.GPSIFD.GPSLatitude: ((47, 1), (36, 1), (0, 1)),
        },
        "1st": {},
        "thumbnail": None,
    }
    write_jpeg(source / "gps.jpg", exif=piexif.dump(exif))

    output = tmp_path / "out"
    package_album(source, "2026-family-trip", None, output, strip_gps=False, copy_full=True)

    full_exif = piexif.load(str(output / "albums" / "2026-family-trip" / "full" / "img_001.jpg"))
    assert full_exif["GPS"][piexif.GPSIFD.GPSLatitudeRef] == b"N"


def test_package_album_rejects_invalid_album_id(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    write_jpeg(source / "family.jpg")

    with pytest.raises(ValueError, match="album id must use lowercase"):
        package_album(source, "../private", None, tmp_path / "out")
