# Photo Album

Private photo gallery for albums stored in a private Backblaze B2 bucket and served through Cloudflare Workers.

The app is a Cloudflare Worker with static React assets. Private routes are protected by Cloudflare Access, while keyed share links are validated by the Worker and expire at the date encoded in the link.

## Development

```bash
npm install
npm run dev
```

## Preview The Worker Runtime

```bash
npm run build
npm run preview
```

## Test

```bash
npm test
python -m pytest tools/test_package_album.py
```

Or with `uv`:

```bash
uv run --managed-python --with-requirements tools/requirements.txt pytest tools/test_package_album.py
```

## Package An Album

By default this creates `manifest.json`, `albums/index.json`, thumbnails, and display-sized WebP images. Full-size originals are expected to already exist in B2 under keys that match the source folder name and relative file paths.

```bash
python --version
python -m pip install -r tools/requirements.txt
python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --title "2026 Family Trip"
```

Or with `uv`:

```bash
uv run --managed-python --with-requirements tools/requirements.txt python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --title "2026 Family Trip"
```

For a synced folder named `50thCelebration`, a file such as `50thCelebration/2026_06_26/3W7A1320.JPG` is referenced directly by the manifest. Use `--originals-prefix` if your B2 sync uses a different object-key prefix.

Upload the generated `dist-albums/albums/` contents into the private B2 bucket under the same `albums/` prefix. Use `--display-long-edge` to change the default 3000px display-image cap. Use `--display-only` to backfill display images and update manifests for an existing album without regenerating thumbnails or full-size files. Use `--copy-full` only when you want the tool to create normalized full-size JPEG copies.

## Generate A Share Link

```bash
SHARE_TOKEN_SECRET=... npm run share-link -- --album 2026-family-trip
```

By default, share links expire at the end of the current month in Pacific time.

## Deploy

This repo is connected to Cloudflare Workers Builds. Push to `main` to deploy `photoalbum.ultizan.workers.dev`.

See:

- `docs/setup-cloudflare.md`
- `docs/publish-album.md`
- `docs/superpowers/specs/2026-06-28-private-photo-gallery-design.md`
