import { readFileSync } from "node:fs";

const wranglerConfig = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");

const forbiddenValues = [
  "set-in-cloudflare",
  "your-team.cloudflareaccess.com",
  "B2_KEY_ID=",
  "B2_APPLICATION_KEY=",
  "SHARE_TOKEN_SECRET="
];

const found = forbiddenValues.filter((value) => wranglerConfig.includes(value));
if (found.length > 0) {
  console.error(`wrangler.jsonc contains deploy placeholder value(s): ${found.join(", ")}`);
  process.exit(1);
}

if (!/"keep_vars"\s*:\s*true/.test(wranglerConfig)) {
  console.error("wrangler.jsonc must set keep_vars=true so dashboard Worker variables are not overwritten.");
  process.exit(1);
}
