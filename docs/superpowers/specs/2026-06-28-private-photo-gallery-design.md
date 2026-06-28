# Private Photo Gallery MVP Design

Date: 2026-06-28

## Goal

Build a small GitHub-managed private photo sharing portal backed by a private Backblaze B2 bucket and deployed through Cloudflare Workers. The portal is for browsing and sharing already-uploaded albums. It does not upload photos from the UI.

## Approved Scope

- React/Vite gallery deployed as Cloudflare Worker static assets.
- Cloudflare Worker API/image proxy for private Backblaze B2 objects.
- Cloudflare Access protection for the private family portal.
- Public, signed, expiring share links for one album at a time.
- Selectable bulk download of original files as individual downloads, not a zip.
- Local standalone album packager that creates thumbnails, sanitized full-size files, and manifests.
- Manual upload of generated album package into B2 through the user's existing sync/manual process.

## Explicit Non-Scope

- Upload/admin UI.
- GitHub Actions workflow that processes private photo files.
- Server-side zip download.
- Per-album Access allowlists.
- Early revocation of share links.
- Terraform for MVP.
- Face tagging, search, comments, favorites, map view, video support, or phone auto-upload.

## Deployment Model

The production app is one Cloudflare Worker named `photoalbum`.

- Production URL: `photoalbum.ultizan.workers.dev`
- Preview URL pattern: `*-photoalbum.ultizan.workers.dev`
- Git integration: this repository is already connected to Cloudflare Workers Builds.
- Production branch: `main`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy` or repo script `npm run deploy`
- Preview deploy command: Cloudflare default `npx wrangler versions upload`

The Worker deploys both static assets and API/proxy code in a single unit. Static assets contain only application code and styling; album data and image URLs are fetched at runtime.

## Tooling

The scaffold should follow Cloudflare's React/Vite Worker pattern:

```bash
npm create cloudflare@latest -- photoalbum --framework=react
```

Because this repository already exists and is linked to Cloudflare, implementation should create the equivalent structure at the repository root instead of nesting a new `photoalbum/` directory.

Expected npm scripts:

```bash
npm run dev      # local Vite development with Worker runtime integration
npm run preview  # local built preview in workerd/Wrangler runtime
npm run build    # production build
npm run deploy   # wrangler deploy
```

## High-Level Architecture

```text
Browser
  -> photoalbum.ultizan.workers.dev
  -> Cloudflare Access for private paths
  -> Cloudflare Worker
       - static gallery assets
       - API routes
       - B2 proxy routes
       - signed share-token validation
  -> private Backblaze B2 bucket
```

Backblaze B2 remains private. The browser only sees app URLs such as `/img/...` or `/share-img/...`; it never receives B2 credentials, B2 object URLs, or S3 signed URLs.

## Route Design

Private routes:

- `GET /` serves the private gallery shell.
- `GET /albums` serves the private album list route in the SPA.
- `GET /albums/:albumId` serves the private album route in the SPA.
- `GET /api/albums` returns the album index.
- `GET /api/albums/:albumId` returns one album manifest.
- `GET /img/:albumId/thumb/:photoId` proxies a thumbnail.
- `GET /img/:albumId/full/:photoId` proxies a full-size image.

Public share routes:

- `GET /share/:token` serves the shared album route in the SPA.
- `GET /share-api/:token/album` returns the shared album manifest if the token is valid.
- `GET /share-img/:token/thumb/:photoId` proxies one thumbnail if the token is valid.
- `GET /share-img/:token/full/:photoId` proxies one full-size image if the token is valid.

Static asset routes such as built JS/CSS are public and contain no private album data.

## Access And Share Policy

Cloudflare Access protects private paths only. It must not protect the public share paths, or token holders would be blocked before the Worker can validate the token.

Recommended Access application paths:

- `/`
- `/albums`
- `/albums/*`
- `/api/*`
- `/img/*`

Do not include:

- `/share/*`
- `/share-api/*`
- `/share-img/*`
- built asset paths

The implementation must smoke-test this configuration by confirming `/` requires Access and `/share/<token>` reaches the Worker without an Access login prompt.

The Worker also enforces authorization:

- Private API/image routes require a valid Cloudflare Access identity/JWT context.
- Share API/image routes require a valid signed token.
- Share tokens grant exactly one album.
- Share tokens expire at a fixed timestamp.
- There is no early revocation in MVP.

## Share Token Design

Share links are stateless signed tokens. A token payload contains:

```json
{
  "v": 1,
  "albumId": "2026-family-trip",
  "expiresAt": "2026-06-30T23:59:59-07:00"
}
```

The token is encoded with base64url JSON plus an HMAC-SHA256 signature using `SHARE_TOKEN_SECRET`. The Worker verifies the signature and compares `expiresAt` with the current time before serving any share manifest or image.

The local share-link tool defaults expiration to the last second of the current calendar month in `America/Los_Angeles`, then stores the exact timestamp in the token. The Worker compares only the timestamp, so behavior is deterministic.

Example link:

```text
https://photoalbum.ultizan.workers.dev/share/<token>
```

## B2 Object Contract

Album packages are uploaded to a private B2 bucket under predictable keys:

```text
albums/
  index.json
  2026-family-trip/
    manifest.json
    thumbs/
      img_001.webp
    full/
      img_001.jpg
```

The gallery does not list the bucket. Discovery starts from `albums/index.json`.

Album index format:

```json
{
  "version": 1,
  "generatedAt": "2026-06-28T12:00:00-07:00",
  "albums": [
    {
      "albumId": "2026-family-trip",
      "title": "2026 Family Trip",
      "createdAt": "2026-06-27",
      "coverPhotoId": "img_001",
      "photoCount": 42
    }
  ]
}
```

Album manifest format:

```json
{
  "version": 1,
  "albumId": "2026-family-trip",
  "title": "2026 Family Trip",
  "createdAt": "2026-06-27",
  "visibility": "access-controlled",
  "photos": [
    {
      "id": "img_001",
      "filename": "img_001.jpg",
      "thumbPath": "albums/2026-family-trip/thumbs/img_001.webp",
      "fullPath": "albums/2026-family-trip/full/img_001.jpg",
      "width": 6000,
      "height": 4000,
      "capturedAt": "2026-06-20T19:34:00"
    }
  ]
}
```

The Worker trusts only object paths from validated manifests. It does not accept arbitrary object keys from browser input.

## Local Album Packager

The album packager is a standalone local script outside the web app runtime. It creates a folder that can be uploaded manually to B2.

Example command:

```bash
python tools/package_album.py ./photos/2026-family-trip --album 2026-family-trip --title "2026 Family Trip" --out ./dist-albums
```

Output:

```text
dist-albums/
  albums/
    2026-family-trip/
      manifest.json
      thumbs/
      full/
```

Responsibilities:

- Read JPEG/PNG/HEIC source images where supported by installed libraries.
- Normalize output filenames as `img_001`, `img_002`, etc.
- Strip GPS EXIF by default from full-size output files.
- Generate WebP thumbnails.
- Preserve full-size originals as sanitized copies in `full/`.
- Capture dimensions and best-effort capture time.
- Generate `manifest.json`.
- Optionally update a local `albums/index.json` when an existing index is supplied.

The script does not upload to B2 and does not need B2 credentials.

## Gallery UI

The UI is a real gallery, not a landing page.

Primary views:

- Album list.
- Album grid.
- Photo detail/lightbox.
- Selection mode.
- Download selected.

Bulk download behavior:

- Users select photos in an album.
- The browser downloads selected originals as individual files through `/img/.../full/...` or `/share-img/.../full/...`.
- The UI should download sequentially or in a small controlled queue to reduce browser blocking.
- If the browser blocks multiple automatic downloads, the UI shows direct download links for the selected files.

Private users can browse all indexed albums. Share-link users can browse and download only the album embedded in the token.

## Worker Responsibilities

The Worker:

- Serves static gallery assets.
- Serves SPA fallbacks for `/`, `/albums`, `/albums/:albumId`, and `/share/:token`.
- Validates private Access context before private API/image routes.
- Validates share token before share API/image routes.
- Fetches `albums/index.json` and album manifests from private B2.
- Proxies thumbnail and full-size object responses from private B2.
- Signs B2 S3-compatible requests internally using Worker secrets.
- Adds browser-safe cache headers.
- Returns structured JSON errors for API failures.
- Does not expose B2 credentials, B2 URLs, or internal signed requests.

## B2 Access

Runtime configuration:

- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `B2_BUCKET_NAME`
- `B2_ENDPOINT`
- `B2_REGION`

The B2 application key must be scoped to the photo bucket only and should have read access for MVP runtime use.

The Worker should use S3-compatible signed GET requests internally. Signing logic should be small and covered by tests because credentials must never reach the browser.

## Secrets And Variables

Cloudflare runtime secrets:

- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `SHARE_TOKEN_SECRET`

Cloudflare runtime variables:

- `B2_BUCKET_NAME`
- `B2_ENDPOINT`
- `B2_REGION`
- `ACCESS_AUD`
- `ACCESS_ISSUER`

Local-only tool secrets:

- `SHARE_TOKEN_SECRET` for generating share links.

The album packager does not require B2 credentials.

## Caching

Default cache policy:

- Album index and manifests: short browser cache, for example `private, max-age=60`.
- Thumbnails: browser cache, for example `private, max-age=86400`.
- Full-size images: `private, max-age=0` or `no-store` unless later testing proves stronger caching is safe.

Share routes must not use edge caching that can bypass token expiration. If edge caching is added later, the Worker must validate Access/share state before reading from cache.

## Error Handling

API errors return JSON:

```json
{
  "error": {
    "code": "not_found",
    "message": "Album not found"
  }
}
```

Expected error cases:

- Missing or invalid Access context: `401`.
- Access denied by Cloudflare Access: handled before Worker.
- Invalid, malformed, or expired share token: `403`.
- Album not found in index/manifest: `404`.
- B2 object missing: `404`.
- B2 credential/signing/fetch failure: `502`.
- Bad manifest shape: `502`.

The UI should show calm empty/error states without revealing internal bucket paths or credentials.

## Testing Strategy

Unit tests:

- Share token creation and validation.
- Expired token rejection.
- Token album scoping.
- B2 object key validation.
- Manifest schema validation.
- Route authorization decisions.

Worker integration tests:

- Private manifest request requires Access context.
- Share manifest request succeeds with valid token.
- Share image request cannot fetch a photo outside the token album.
- B2 fetch helper signs the expected request shape using fixtures.

Tool tests:

- Package generation creates expected folder layout.
- Manifest includes dimensions and paths.
- Thumbnail files are generated.
- GPS EXIF is removed by default.

Manual acceptance tests:

- `npm run dev` starts local app.
- `npm run preview` serves built app in Worker runtime.
- Approved Access user can view private gallery.
- Unapproved user is denied by Access.
- Public share link works until its expiration.
- Expired share link is denied.
- Thumbnail and full-size image URLs are app URLs, not B2 URLs.
- Selected originals download individually.

## References

- Cloudflare React/Vite Workers guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
- Cloudflare Workers static assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Workers preview URLs: https://developers.cloudflare.com/workers/configuration/previews/
- Cloudflare Workers Builds configuration: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Cloudflare Access application paths: https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/
