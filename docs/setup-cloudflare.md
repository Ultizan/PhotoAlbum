# Cloudflare Setup

## Worker

- Worker name: `photoalbum`
- Production URL: `photoalbum.ultizan.workers.dev`
- Preview URL pattern: `*-photoalbum.ultizan.workers.dev`
- Build command: none required when deploy command is `npx wrangler deploy`
- Deploy command: `npx wrangler deploy`

This repo uses the Cloudflare Vite plugin. `wrangler.jsonc` has `build.command = "npm run build"`, so a raw `npx wrangler deploy` runs the Vite build before checking the configured assets directory. The browser assets are generated at `dist/client`, and the Worker bundle/config are generated at `dist/photoalbum`.

`wrangler.jsonc` intentionally does not contain deployment values for B2 or Access. It sets `keep_vars: true`, so Worker variables managed in the Cloudflare dashboard are not deleted or replaced by local placeholder values during deploy.

## Worker Secrets

Set these as Worker secrets:

```bash
npx wrangler secret put B2_KEY_ID
npx wrangler secret put B2_APPLICATION_KEY
npx wrangler secret put SHARE_TOKEN_SECRET
npx wrangler secret put ACCESS_AUD
npx wrangler secret put ACCESS_ISSUER
```

## Worker Variables

Set these Worker variables in Cloudflare:

```text
B2_BUCKET_NAME
B2_REGION
```

`B2_ENDPOINT` is a non-secret value committed in `wrangler.jsonc` so deploys preserve the URL scheme required by the S3 signer.

`ACCESS_ISSUER` should look like:

```text
https://your-team.cloudflareaccess.com
```

## Cloudflare Access

Protect the private application paths:

```text
/
/albums
/albums/*
/api/*
/img/*
```

Do not protect share-link paths:

```text
/share/*
/share-api/*
/share-img/*
```

Create those share-link paths as a separate Access application with a `Bypass` policy for `Everyone`; otherwise Access will still redirect share-link visitors to login.

For family use, a one-time PIN policy with explicit email addresses is enough. Deny everyone else.

## Backblaze B2

Use a private bucket with S3-compatible access enabled. The B2 application key should be limited to the photo bucket.

Expected object layout:

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

## Smoke Tests

After deployment:

- Visit `https://photoalbum.ultizan.workers.dev/` and confirm Cloudflare Access login appears.
- Visit a generated `/share/<token>` URL in a private browser and confirm it reaches the app without Access login.
- Confirm image requests use `/img/` or `/share-img/` app URLs, not B2 URLs.
- Confirm an expired share token returns `403` from `/share-api/<token>/album`.
