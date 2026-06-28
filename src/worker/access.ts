import type { Env } from "./env";
import { errorResponse } from "./http";
import { fetchAccessJwks, tokenKeyId, verifyAccessJwt } from "./accessJwt";

export type AccessIdentity = {
  email: string;
};

type CertFetcher = (url: string) => Promise<Response>;

export async function getAccessIdentity(
  request: Request,
  env: Env,
  certFetcher: CertFetcher = fetch,
  now: Date = new Date()
): Promise<AccessIdentity | Response> {
  if (env.DEV_AUTH_BYPASS === "true") {
    const devEmail = request.headers.get("x-dev-access-email");
    if (devEmail) {
      return { email: devEmail };
    }
  }

  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!assertion) {
    return errorResponse(401, "unauthorized", "Cloudflare Access identity is required");
  }

  try {
    let keys = await fetchAccessJwks(env.ACCESS_ISSUER, certFetcher, now.getTime());
    const kid = tokenKeyId(assertion);
    if (kid && !keys.some((key) => key.kid === kid)) {
      keys = await fetchAccessJwks(env.ACCESS_ISSUER, certFetcher, now.getTime(), true);
    }

    const identity = await verifyAccessJwt(assertion, {
      audience: env.ACCESS_AUD,
      issuer: env.ACCESS_ISSUER,
      keys,
      now: now.getTime()
    });
    return { email: identity.email };
  } catch {
    return errorResponse(401, "unauthorized", "Cloudflare Access identity is required");
  }
}
