import type { Env } from "./env";
import { errorResponse } from "./http";

export type AccessIdentity = {
  email: string;
};

export function getAccessIdentity(request: Request, env: Env): AccessIdentity | Response {
  if (env.DEV_AUTH_BYPASS === "true") {
    const devEmail = request.headers.get("x-dev-access-email");
    if (devEmail) {
      return { email: devEmail };
    }
  }

  const email = request.headers.get("cf-access-authenticated-user-email");
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!email || !assertion) {
    return errorResponse(401, "unauthorized", "Cloudflare Access identity is required");
  }
  return { email };
}
