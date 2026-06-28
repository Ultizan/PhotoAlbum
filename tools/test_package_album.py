import json
from pathlib import Path

import piexif
import pytest
from PIL import Image

from package_album import package_album


def test_package_album_creates_manifest_thumbs_and_full_files(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    image = Image.new("RGB", (120, 80), color=(40, 90, 120))
    image.save(source / "family.jpg", "JPEG")

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
    assert (album_dir / "full" / "img_001.jpg").exists()
    assert manifest["photos"][0]["width"] == 120
    assert manifest["photos"][0]["height"] == 80

    saved = json.loads((album_dir / "manifest.json").read_text(encoding="utf-8"))
    assert saved["albumId"] == "2026-family-trip"
    assert saved["photos"][0]["filename"] == "img_001.jpg"
    assert saved["photos"][0]["thumbPath"] == "albums/2026-family-trip/thumbs/img_001.webp"
    assert saved["photos"][0]["fullPath"] == "albums/2026-family-trip/full/img_001.jpg"

    index = json.loads((output / "albums" / "index.json").read_text(encoding="utf-8"))
    assert index["albums"][0]["albumId"] == "2026-family-trip"
    assert index["albums"][0]["photoCount"] == 1



def test_package_album_rejects_empty_source_without_writing_index(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    output = tmp_path / "out"

    with pytest.raises(ValueError, match="no supported images"):
        package_album(
            source_dir=source,
            album_id="empty-album",
            title="Empty Album",
            output_dir=output,
        )

    assert not (output / "albums" / "index.json").exists()


def test_package_album_strips_gps_and_orientation_exif(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    image = Image.new("RGB", (10, 20), color=(80, 40, 20))
    exif = {
        "0th": {piexif.ImageIFD.Orientation: 6},
        "Exif": {},
        "GPS": {piexif.GPSIFD.GPSLatitudeRef: "N", piexif.GPSIFD.GPSLatitude: ((1, 1), (2, 1), (3, 1))},
        "1st": {},
        "thumbnail": None,
    }
    image.save(source / "rotated.jpg", "JPEG", exif=piexif.dump(exif))

    output = tmp_path / "out"

    manifest = package_album(
        source_dir=source,
        album_id="rotated-album",
        title="Rotated Album",
        output_dir=output,
    )

    full_path = output / "albums" / "rotated-album" / "full" / "img_001.jpg"
    saved_exif = piexif.load(str(full_path))
    assert piexif.ImageIFD.Orientation not in saved_exif["0th"]
    assert saved_exif["GPS"] == {}
    assert manifest["photos"][0]["width"] == 20
    assert manifest["photos"][0]["height"] == 10


def test_package_album_replaces_existing_album_without_stale_files(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    Image.new("RGB", (10, 10), color=(1, 2, 3)).save(source / "first.jpg", "JPEG")
    Image.new("RGB", (10, 10), color=(4, 5, 6)).save(source / "second.jpg", "JPEG")
    output = tmp_path / "out"

    package_album(source_dir=source, album_id="rerun-album", title="Rerun Album", output_dir=output)
    (source / "second.jpg").unlink()

    package_album(source_dir=source, album_id="rerun-album", title="Rerun Album", output_dir=output)

    album_dir = output / "albums" / "rerun-album"
    assert sorted(path.name for path in (album_dir / "full").iterdir()) == ["img_001.jpg"]
    assert sorted(path.name for path in (album_dir / "thumbs").iterdir()) == ["img_001.webp"]



def test_package_album_omits_malformed_exif_without_failing(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    image = Image.new("RGB", (12, 8), color=(20, 30, 40))
    image.save(source / "bad-exif.jpg", "JPEG", exif=b"not-valid-exif")
    output = tmp_path / "out"

    manifest = package_album(
        source_dir=source,
        album_id="bad-exif-album",
        title="Bad Exif Album",
        output_dir=output,
    )

    full_path = output / "albums" / "bad-exif-album" / "full" / "img_001.jpg"
    assert full_path.exists()
    assert manifest["photos"][0]["filename"] == "img_001.jpg"
