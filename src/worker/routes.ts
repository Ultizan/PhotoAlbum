import { getAccessIdentity } from "./access";
import type { RequestContext } from "./env";
import { errorResponse } from "./http";

function isPrivateApiPath(pathname: string): boolean {
  return pathname === "/api/albums" || pathname.startsWith("/api/albums/");
}

function isPrivateImagePath(pathname: string): boolean {
  return pathname.startsWith("/img/");
}

function isShareApiPath(pathname: string): boolean {
  return pathname.startsWith("/share-api/");
}

function isShareImagePath(pathname: string): boolean {
  return pathname.startsWith("/share-img/");
}

export async function handleRequest(ctx: RequestContext): Promise<Response> {
  const { request, env, url } = ctx;

  if (isPrivateApiPath(url.pathname) || isPrivateImagePath(url.pathname)) {
    const identity = getAccessIdentity(request, env);
    if (identity instanceof Response) {
      return identity;
    }
    return errorResponse(501, "bad_gateway", "Private B2 route unavailable before B2 handler task");
  }

  if (isShareApiPath(url.pathname) || isShareImagePath(url.pathname)) {
    return errorResponse(501, "bad_gateway", "Share B2 route unavailable before B2 handler task");
  }

  return env.ASSETS.fetch(request);
}
