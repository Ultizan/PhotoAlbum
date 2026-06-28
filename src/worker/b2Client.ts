import { parseAlbumIndex, parseAlbumManifest } from "../shared/validation";
import type { AlbumIndex, AlbumManifest } from "../shared/types";
import type { Env } from "./env";
import { buildSignedB2GetRequest } from "./b2Signer";

type Fetcher = (request: Request) => Promise<Response>;

async function signedGet(env: Env, key: string, fetcher: Fetcher = fetch): Promise<Response> {
  const request = await buildSignedB2GetRequest({
    endpoint: env.B2_ENDPOINT,
    region: env.B2_REGION,
    bucketName: env.B2_BUCKET_NAME,
    key,
    keyId: env.B2_KEY_ID,
    applicationKey: env.B2_APPLICATION_KEY
  });
  return fetcher(request);
}

async function fetchJson(env: Env, key: string, fetcher?: Fetcher): Promise<unknown> {
  const response = await signedGet(env, key, fetcher);
  if (!response.ok) {
    throw new Error(`B2 returned ${response.status} for ${key}`);
  }
  return response.json();
}

export async function fetchAlbumIndexFromB2(env: Env, fetcher?: Fetcher): Promise<AlbumIndex> {
  return parseAlbumIndex(await fetchJson(env, "albums/index.json", fetcher));
}

export async function fetchAlbumManifestFromB2(env: Env, albumId: string, fetcher?: Fetcher): Promise<AlbumManifest> {
  const manifest = parseAlbumManifest(await fetchJson(env, `albums/${albumId}/manifest.json`, fetcher));
  if (manifest.albumId !== albumId) {
    throw new Error(`B2 manifest albumId mismatch for ${albumId}`);
  }
  return manifest;
}

export async function fetchObjectFromB2(env: Env, key: string, fetcher?: Fetcher): Promise<Response> {
  return signedGet(env, key, fetcher);
}
