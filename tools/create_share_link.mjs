import { createHmac } from "node:crypto";

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function endOfMonthPacific(referenceDate) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "numeric"
  });
  const parts = Object.fromEntries(formatter.formatToParts(referenceDate).map((part) => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const firstOfNextMonthUtc = new Date(Date.UTC(year, month, 1, 7, 59, 59));
  return firstOfNextMonthUtc.toISOString();
}

function readArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const albumId = readArg("album");
const secret = process.env.SHARE_TOKEN_SECRET;
const baseUrl = readArg("base-url") ?? "https://photoalbum.ultizan.workers.dev";
const expiresAt = readArg("expires-at") ?? endOfMonthPacific(new Date());

if (!albumId) {
  console.error("Usage: SHARE_TOKEN_SECRET=... npm run share-link -- --album <albumId> [--expires-at <iso>] [--base-url <url>]");
  process.exit(1);
}
if (!secret) {
  console.error("SHARE_TOKEN_SECRET is required");
  process.exit(1);
}

const payloadPart = base64Url(JSON.stringify({ v: 1, albumId, expiresAt }));
const signaturePart = createHmac("sha256", secret).update(payloadPart).digest("base64url");
console.log(`${baseUrl.replace(/\/$/, "")}/share/${payloadPart}.${signaturePart}`);
