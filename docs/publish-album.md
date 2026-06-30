# Publish Album

## Install Local Tool Dependencies

```bash
python -m pip install -r tools/requirements.txt
```

Or use `uv` without installing Python packages globally:

```bash
uv run --managed-python --with-requirements tools/requirements.txt pytest tools/test_package_album.py
```

## Package An Album

The default packaging mode assumes full-size originals are already synced to B2. It writes:

- `albums/index.json`
- `albums/<album>/manifest.json`
- `albums/<album>/thumbs/*.webp`
- `albums/<album>/display/*.webp`

For source files under `./photos/2026-family-trip/`, the manifest points full-size images at existing B2 keys under `2026-family-trip/`. For example, `./photos/2026-family-trip/2026_06_26/3W7A1320.JPG` becomes `2026-family-trip/2026_06_26/3W7A1320.JPG`.

```bash
python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --title "2026 Family Trip" --out ./dist-albums
```

With `uv`:

```bash
uv run --managed-python --with-requirements tools/requirements.txt python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --title "2026 Family Trip" --out ./dist-albums
```

If the B2 sync prefix differs from the local source folder name, set it explicitly:

```bash
python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --originals-prefix already-synced/2026-family-trip
```

The package step:

- Assigns stable photo ids as `img_###`.
- References existing full-size B2 objects by source-relative path.
- Writes WebP thumbnails under `thumbs/`.
- Writes WebP display images under `display/`, capped to 3000 pixels on the long edge by default.
- Writes the album `manifest.json`.
- Updates `albums/index.json`.

Generated output:

```text
dist-albums/
  albums/
    index.json
    2026-family-trip/
      manifest.json
      thumbs/
        img_001.webp
      display/
        img_001.webp
```

Upload the contents of `dist-albums/albums/` into the private B2 bucket under the `albums/` prefix. After upload, the bucket should contain `albums/index.json`, not `albums/albums/index.json`.

To change the display image size, set the long edge explicitly:

```bash
python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --display-long-edge 2560
```

## Backfill Display Images

For an album that already has thumbnails, full-size B2 objects, and a generated manifest, use `--display-only` to create only the `display/*.webp` files and update `manifest.json` with `displayPath` entries.

```bash
python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --display-only
```

Then upload only:

- `dist-albums/albums/<album>/display/`
- `dist-albums/albums/<album>/manifest.json`
- `dist-albums/albums/index.json`

## Copy Full-Size Files

For small albums that are not already synced, use `--copy-full` to create normalized full-size JPEGs under `albums/<album>/full/`.

```bash
python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --copy-full
```

In this mode, GPS EXIF is stripped from the generated full-size JPEGs by default.

## Preserve GPS Metadata

GPS EXIF can only be changed when `--copy-full` is used, because the default mode does not rewrite full-size originals. To preserve GPS in copied full-size JPEGs:

```bash
python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --copy-full --keep-gps
```

## Generate A Share Link

```bash
SHARE_TOKEN_SECRET=... npm run share-link -- --album 2026-family-trip
```

The default expiration is the end of the current month in Pacific time.

To set an exact expiration:

```bash
SHARE_TOKEN_SECRET=... npm run share-link -- --album 2026-family-trip --expires-at 2026-06-30T23:59:59-07:00
```

Share links have this shape:

```text
https://photoalbum.ultizan.workers.dev/share/<token>
```
