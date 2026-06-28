import { createHmac } from "node:crypto";

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function endOfMonthPacific(referenceDate) {
  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "numeric"
  });
  const parts = Object.fromEntries(monthFormatter.formatToParts(referenceDate).map((part) => [part.type, part.value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const target = { year, month, day: new Date(Date.UTC(year, month, 0)).getUTCDate(), hour: 23, minute: 59, second: 59 };
  let guess = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const offsetMatch = rendered.timeZoneName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
    if (!offsetMatch) {
      throw new Error(`Could not determine America/Los_Angeles offset: ${rendered.timeZoneName}`);
    }
    const sign = offsetMatch[1] === "+" ? 1 : -1;
    const offsetMinutes = sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3] ?? "0"));
    const nextGuess = Date.UTC(
      target.year,
      target.month - 1,
      target.day,
      target.hour,
      target.minute,
      target.second
    ) - offsetMinutes * 60_000;
    if (nextGuess === guess) {
      return new Date(guess).toISOString();
    }
    guess = nextGuess;
  }

  return new Date(guess).toISOString();
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
