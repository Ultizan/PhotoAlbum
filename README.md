# PhotoAlbum

Private photo gallery for albums stored in private Backblaze B2 and served through Cloudflare Workers.

## Development

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

For local Worker secrets, copy `.env.example` to `.dev.vars` and fill in local values. `.dev.vars*` files are ignored by git. For `npm run share-link`, pass `SHARE_TOKEN_SECRET` in the shell environment for that command.

## Preview Worker Runtime

Build the client and Worker:

```bash
npm run build
```

Preview the built Worker runtime:

```bash
npm run preview
```

## Test

Run the TypeScript test suite:

```bash
npm test
```

Run the album packaging tests with dependencies isolated through `uv`:

```bash
uv run --with-requirements tools/requirements.txt python -m pytest tools/test_package_album.py
```

If you already installed the Python tool dependencies, this also works:

```bash
python -m pytest tools/test_package_album.py
```

## Deploy

This repo is connected to Cloudflare Workers Builds. Push to `main` to deploy the `photoalbum` Worker at:

```text
https://photoalbum.ultizan.workers.dev
```

Ensure Workers Builds runs `npm run build` before Wrangler deploy so `dist/client` exists. Running raw Wrangler deploy before the build will fail because Wrangler expects the configured assets directory at `dist/client`.

Manual deploys can use:

```bash
npm run deploy
```

## Docs

- [Cloudflare setup](docs/setup-cloudflare.md)
- [Publish an album](docs/publish-album.md)
- [Design spec](docs/superpowers/specs/2026-06-28-private-photo-gallery-design.md)
