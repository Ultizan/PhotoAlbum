# Cloudflare Setup

## Worker

- Worker name: `photoalbum`
- Production URL: `photoalbum.ultizan.workers.dev`
- Preview URL pattern: `*-photoalbum.ultizan.workers.dev`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

This repo uses the Cloudflare Vite plugin. After `npm run build`, Wrangler redirects deployment to the generated config at `dist/client/photoalbum/wrangler.json` and serves static assets from `dist/client/client`.

`wrangler.jsonc` intentionally does not contain deployment values for B2 or Access. It sets `keep_vars: true`, so Worker variables managed in the Cloudflare dashboard are not deleted or replaced by local placeholder values during deploy.

## Worker Secrets

Set these as Worker secrets:

```bash
npx wrangler secret put B2_KEY_ID
npx wrangler secret put B2_APPLICATION_KEY
npx wrangler secret put SHARE_TOKEN_SECRET
```

## Worker Variables

Set these Worker variables in Cloudflare:

```text
B2_BUCKET_NAME
B2_ENDPOINT
B2_REGION
ACCESS_AUD
ACCESS_ISSUER
```

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
