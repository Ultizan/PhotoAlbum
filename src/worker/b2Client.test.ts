import { describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import { fetchAlbumIndexFromB2, fetchAlbumManifestFromB2 } from "./b2Client";

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
    const fetchMock = vi.fn(async () =>
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
  });

  it("rejects an album manifest for a different album id", async () => {
    const fetchMock = vi.fn(async () =>
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
});
