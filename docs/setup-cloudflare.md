# Cloudflare Setup

## Worker

- Worker name: `photoalbum`
- Production URL: `https://photoalbum.ultizan.workers.dev`
- Preview URL pattern: `https://*-photoalbum.ultizan.workers.dev`

## Builds And Deploys

Configure these Cloudflare Workers Builds fields:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Alternative single-command setup:

- Build command: leave empty
- Deploy command: `npm run deploy`

Use one of those patterns, not both, to avoid double-building.

Important troubleshooting note: if Cloudflare logs this error:

```text
assets.directory ... /opt/buildhome/repo/dist/client does not exist
```

Wrangler is running before the build creates `dist/client`. Configure Worker Builds to run `npm run build` before deploy, or use `npm run deploy` where appropriate.

## Secrets

Set these as Cloudflare Worker secrets:

- `B2_KEY_ID`
- `B2_APPLICATION_KEY`
- `SHARE_TOKEN_SECRET`

## Variables

Set these as Cloudflare Worker variables:

- `B2_BUCKET_NAME`
- `B2_ENDPOINT`
- `B2_REGION`
- `ACCESS_AUD`
- `ACCESS_ISSUER`

## Cloudflare Access

Protect private application paths:

- `/`
- `/albums`
- `/albums/*`
- `/api/*`
- `/img/*`

Do not protect share-link paths:

- `/share/*`
- `/share-api/*`
- `/share-img/*`

## Smoke Tests

After deployment:

1. Open the production root and confirm Cloudflare Access login is required.
2. Generate a `/share/<token>` URL and confirm it works in a private browser without Access login.
3. Open images from the gallery and share pages, and confirm requests use `/img/` or `/share-img/` and never expose Backblaze B2 URLs.
