import { verifyShareToken } from "../shared/shareToken";
import type { AlbumManifest } from "../shared/types";
import { getAccessIdentity } from "./access";
import { fetchAlbumIndexFromB2, fetchAlbumManifestFromB2, fetchObjectFromB2 } from "./b2Client";
import type { RequestContext } from "./env";
import { errorResponse, jsonResponse, withCacheHeaders } from "./http";

type ImageKind = "thumb" | "display" | "full";

type TestableEnv = RequestContext["env"] & {
  TEST_B2_INDEX_JSON?: string;
  TEST_B2_MANIFEST_JSON?: string;
  TEST_B2_OBJECT_BODY?: string;
  TEST_B2_ECHO_OBJECT_PATH?: string;
  TEST_B2_OBJECT_STATUS?: number;
};

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

function testB2Fetch(env: TestableEnv): ((request: Request) => Promise<Response>) | undefined {
  if (!env.TEST_B2_INDEX_JSON && !env.TEST_B2_MANIFEST_JSON && !env.TEST_B2_OBJECT_BODY && !env.TEST_B2_ECHO_OBJECT_PATH) {
    return undefined;
  }
  return async (request: Request) => {
    const pathname = new URL(request.url).pathname;
    if (pathname.endsWith("/albums/index.json") && env.TEST_B2_INDEX_JSON) {
      return new Response(env.TEST_B2_INDEX_JSON);
    }
    if (pathname.endsWith("/manifest.json") && env.TEST_B2_MANIFEST_JSON) {
      return new Response(env.TEST_B2_MANIFEST_JSON);
    }
    const body = env.TEST_B2_ECHO_OBJECT_PATH === "true" ? pathname : (env.TEST_B2_OBJECT_BODY ?? "object-body");
    return new Response(body, {
      status: env.TEST_B2_OBJECT_STATUS ?? 200,
      headers: { "content-type": "image/jpeg" }
    });
  };
}

function findPhoto(manifest: AlbumManifest, photoId: string) {
  return manifest.photos.find((photo) => photo.id === photoId);
}

function imageKey(manifest: AlbumManifest, photoId: string, kind: ImageKind): string | undefined {
  const photo = findPhoto(manifest, photoId);
  if (!photo) {
    return undefined;
  }
  if (kind === "thumb") {
    return photo.thumbPath;
  }
  if (kind === "display") {
    return photo.displayPath ?? photo.fullPath;
  }
  return photo.fullPath;
}

function safeDecodePathSegment(value: string): string | undefined {
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function parsePrivateAlbumPath(pathname: string): { albumId: string } | undefined {
  const match = /^\/api\/albums\/([^/]+)$/.exec(pathname);
  if (!match) {
    return undefined;
  }
  const albumId = safeDecodePathSegment(match[1]);
  return albumId ? { albumId } : undefined;
}

function parsePrivateImagePath(pathname: string): { albumId: string; kind: ImageKind; photoId: string } | undefined {
  const match = /^\/img\/([^/]+)\/(thumb|display|full)\/([^/]+)$/.exec(pathname);
  if (!match) {
    return undefined;
  }
  const albumId = safeDecodePathSegment(match[1]);
  const photoId = safeDecodePathSegment(match[3]);
  if (!albumId || !photoId) {
    return undefined;
  }
  return {
    albumId,
    kind: match[2] as ImageKind,
    photoId
  };
}

function parseShareAlbumPath(pathname: string): { token: string } | undefined {
  const match = /^\/share-api\/([^/]+)\/album$/.exec(pathname);
  if (!match) {
    return undefined;
  }
  return { token: safeDecodePathSegment(match[1]) ?? "" };
}

function parseShareImagePath(pathname: string): { token: string; kind: ImageKind; photoId: string } | undefined {
  const match = /^\/share-img\/([^/]+)\/(thumb|display|full)\/([^/]+)$/.exec(pathname);
  if (!match) {
    return undefined;
  }
  const token = safeDecodePathSegment(match[1]) ?? "";
  const photoId = safeDecodePathSegment(match[3]);
  if (!photoId) {
    return undefined;
  }
  return {
    token,
    kind: match[2] as ImageKind,
    photoId
  };
}

function imageCacheControl(kind: ImageKind): string {
  return kind === "full" ? "private, max-age=0" : "private, max-age=86400";
}

function shareCacheControl(): string {
  return "private, no-store";
}

async function proxyObject(ctx: RequestContext, key: string, cacheControl: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetchObjectFromB2(ctx.env, key, testB2Fetch(ctx.env as TestableEnv));
  } catch {
    return errorResponse(502, "bad_gateway", "Image object could not be fetched");
  }

  if (!response.ok) {
    return errorResponse(
      response.status === 404 ? 404 : 502,
      response.status === 404 ? "not_found" : "bad_gateway",
      "Image object could not be fetched"
    );
  }
  return withCacheHeaders(response, cacheControl);
}

async function proxyShareObject(ctx: RequestContext, key: string, cacheControl: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetchObjectFromB2(ctx.env, key, testB2Fetch(ctx.env as TestableEnv));
  } catch {
    return errorResponse(403, "forbidden", "Share token is invalid or album is unavailable");
  }

  if (!response.ok) {
    return errorResponse(403, "forbidden", "Share token is invalid or album is unavailable");
  }
  return withCacheHeaders(response, cacheControl);
}

async function handlePrivateApi(ctx: RequestContext): Promise<Response> {
  if (ctx.url.pathname === "/api/albums") {
    try {
      const index = await fetchAlbumIndexFromB2(ctx.env, testB2Fetch(ctx.env as TestableEnv));
      return jsonResponse(index, { headers: { "cache-control": "private, max-age=60" } });
    } catch {
      return errorResponse(502, "bad_gateway", "Album index could not be fetched");
    }
  }

  const albumPath = parsePrivateAlbumPath(ctx.url.pathname);
  if (!albumPath) {
    return errorResponse(404, "not_found", "Album route not found");
  }

  try {
    const manifest = await fetchAlbumManifestFromB2(ctx.env, albumPath.albumId, testB2Fetch(ctx.env as TestableEnv));
    return jsonResponse(manifest, { headers: { "cache-control": "private, max-age=60" } });
  } catch {
    return errorResponse(404, "not_found", "Album manifest could not be fetched");
  }
}

async function handlePrivateImage(ctx: RequestContext): Promise<Response> {
  const imagePath = parsePrivateImagePath(ctx.url.pathname);
  if (!imagePath) {
    return errorResponse(404, "not_found", "Image route not found");
  }

  let manifest: AlbumManifest;
  try {
    manifest = await fetchAlbumManifestFromB2(ctx.env, imagePath.albumId, testB2Fetch(ctx.env as TestableEnv));
  } catch {
    return errorResponse(404, "not_found", "Album manifest could not be fetched");
  }

  const key = imageKey(manifest, imagePath.photoId, imagePath.kind);
  if (!key) {
    return errorResponse(404, "not_found", "Photo not found");
  }

  return proxyObject(ctx, key, imageCacheControl(imagePath.kind));
}

async function handleShareApi(ctx: RequestContext): Promise<Response> {
  const sharePath = parseShareAlbumPath(ctx.url.pathname);
  if (!sharePath) {
    return errorResponse(404, "not_found", "Share route not found");
  }

  try {
    const payload = await verifyShareToken(sharePath.token, ctx.env.SHARE_TOKEN_SECRET);
    const manifest = await fetchAlbumManifestFromB2(ctx.env, payload.albumId, testB2Fetch(ctx.env as TestableEnv));
    return jsonResponse(manifest, { headers: { "cache-control": shareCacheControl() } });
  } catch {
    return errorResponse(403, "forbidden", "Share token is invalid or album is unavailable");
  }
}

async function handleShareImage(ctx: RequestContext): Promise<Response> {
  const imagePath = parseShareImagePath(ctx.url.pathname);
  if (!imagePath) {
    return errorResponse(404, "not_found", "Share image route not found");
  }

  let manifest: AlbumManifest;
  try {
    const payload = await verifyShareToken(imagePath.token, ctx.env.SHARE_TOKEN_SECRET);
    manifest = await fetchAlbumManifestFromB2(ctx.env, payload.albumId, testB2Fetch(ctx.env as TestableEnv));
  } catch {
    return errorResponse(403, "forbidden", "Share token is invalid or album is unavailable");
  }

  const key = imageKey(manifest, imagePath.photoId, imagePath.kind);
  if (!key) {
    return errorResponse(404, "not_found", "Photo not found");
  }

  return proxyShareObject(ctx, key, shareCacheControl());
}

export async function handleRequest(ctx: RequestContext): Promise<Response> {
  const { request, env, url } = ctx;

  if (isPrivateApiPath(url.pathname) || isPrivateImagePath(url.pathname)) {
    const identity = await getAccessIdentity(request, env);
    if (identity instanceof Response) {
      return identity;
    }
    if (isPrivateApiPath(url.pathname)) {
      return handlePrivateApi(ctx);
    }
    return handlePrivateImage(ctx);
  }

  if (isShareApiPath(url.pathname)) {
    return handleShareApi(ctx);
  }

  if (isShareImagePath(url.pathname)) {
    return handleShareImage(ctx);
  }

  return env.ASSETS.fetch(request);
}
