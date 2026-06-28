# Publish An Album

## Install Local Tool Dependencies

Install the Python tool dependencies:

```bash
python -m pip install -r tools/requirements.txt
```

Some environments have `python3` but no system `python` or `pip`. In that case, `uv run --with-requirements tools/requirements.txt ...` is a valid fallback for running commands without installing dependencies globally.

## Package Photos

Package a local photo directory:

```bash
python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --title "2026 Family Trip" --out ./dist-albums
```

The album directory contains:

- `manifest.json`
- `thumbs/*.webp`
- `full/*.jpg`

The full output also includes `dist-albums/albums/index.json`.

## Upload To B2

Upload the packaged album directory to Backblaze B2:

```text
dist-albums/albums/2026-family-trip/ -> albums/2026-family-trip/
```

Upload the album index:

```text
dist-albums/albums/index.json -> albums/index.json
```

## Generate A Share Link

Generate a share link token:

```bash
SHARE_TOKEN_SECRET=... npm run share-link -- --album 2026-family-trip
```

The default expiration is the end of the current month in `America/Los_Angeles`.

Use `--expires-at` for an exact expiration:

```bash
SHARE_TOKEN_SECRET=... npm run share-link -- --album 2026-family-trip --expires-at 2026-06-30T23:59:59-07:00
```
