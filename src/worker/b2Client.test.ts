import { describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import { fetchAlbumIndexFromB2, fetchAlbumManifestFromB2, fetchObjectFromB2 } from "./b2Client";

const env: Env = {
  ASSETS: {
    fetch: () => Promise.resolve(new Response("asset")),
    connect: () => {
      throw new Error("connect unavailable in test asset binding");
    }
  },
  B2_KEY_ID: "key-id",
  B2_APPLICATION_KEY: "app-key",
  B2_BUCKET_NAME: "photos",
  B2_ENDPOINT: "https://s3.us-west-004.backblazeb2.com",
  B2_REGION: "us-west-004",
  SHARE_TOKEN_SECRET: "secret",
  ACCESS_AUD: "aud",
  ACCESS_ISSUER: "issuer"
};

describe("B2 client", () => {
  it("fetches and validates the album index", async () => {
    const fetchMock = vi.fn(async (_request: Request) =>
      new Response(
        JSON.stringify({
          version: 1,
          generatedAt: "2026-06-28T12:00:00-07:00",
          albums: [
            {
              albumId: "2026-family-trip",
              title: "2026 Family Trip",
              createdAt: "2026-06-27",
              coverPhotoId: "img_001",
              photoCount: 1
            }
          ]
        })
      )
    );

    const index = await fetchAlbumIndexFromB2(env, fetchMock);

    expect(index.albums).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][0];
    expect(request.url).toBe("https://s3.us-west-004.backblazeb2.com/photos/albums/index.json");
    expect(request.headers.get("x-amz-content-sha256")).toBe("UNSIGNED-PAYLOAD");
    expect(request.headers.get("authorization")).toContain(
      "AWS4-HMAC-SHA256 Credential=key-id/"
    );
  });

  it("fetches a requested album manifest from the matching B2 key", async () => {
    const fetchMock = vi.fn(async (_request: Request) =>
      new Response(
        JSON.stringify({
          version: 1,
          albumId: "2026-family-trip",
          title: "2026 Family Trip",
          createdAt: "2026-06-27",
          visibility: "access-controlled",
          photos: []
        })
      )
    );

    const manifest = await fetchAlbumManifestFromB2(env, "2026-family-trip", fetchMock);

    expect(manifest.albumId).toBe("2026-family-trip");
    const request = fetchMock.mock.calls[0][0];
    expect(request.url).toBe("https://s3.us-west-004.backblazeb2.com/photos/albums/2026-family-trip/manifest.json");
    expect(request.headers.get("x-amz-content-sha256")).toBe("UNSIGNED-PAYLOAD");
    expect(request.headers.get("authorization")).toContain(
      "AWS4-HMAC-SHA256 Credential=key-id/"
    );
  });

  it("rejects an album manifest for a different album id", async () => {
    const fetchMock = vi.fn(async (_request: Request) =>
      new Response(
        JSON.stringify({
          version: 1,
          albumId: "other-album",
          title: "Other Album",
          createdAt: "2026-06-27",
          visibility: "access-controlled",
          photos: []
        })
      )
    );

    await expect(fetchAlbumManifestFromB2(env, "2026-family-trip", fetchMock)).rejects.toThrow(
      "B2 manifest albumId mismatch"
    );
  });

  it("rejects malformed requested album ids before fetching from B2", async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response("{}"));

    await expect(fetchAlbumManifestFromB2(env, "../private", fetchMock)).rejects.toThrow(
      "albumId must use lowercase letters, numbers, and hyphens"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches arbitrary B2 objects with a signed request", async () => {
    const fetchMock = vi.fn(async (_request: Request) => new Response("image-bytes"));

    const response = await fetchObjectFromB2(env, "albums/2026-family-trip/full/img_001.jpg", fetchMock);

    await expect(response.text()).resolves.toBe("image-bytes");
    const request = fetchMock.mock.calls[0][0];
    expect(request.url).toBe("https://s3.us-west-004.backblazeb2.com/photos/albums/2026-family-trip/full/img_001.jpg");
    expect(request.headers.get("x-amz-content-sha256")).toBe("UNSIGNED-PAYLOAD");
    expect(request.headers.get("authorization")).toContain(
      "AWS4-HMAC-SHA256 Credential=key-id/"
    );
  });
});
