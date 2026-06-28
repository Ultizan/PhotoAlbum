import { describe, expect, it } from "vitest";
import { createShareToken } from "../shared/shareToken";
import worker from "./index";
import type { Env } from "./env";

type TestEnv = Env & {
  TEST_B2_INDEX_JSON?: string;
  TEST_B2_MANIFEST_JSON?: string;
  TEST_B2_OBJECT_BODY?: string;
  TEST_B2_OBJECT_STATUS?: number;
};

const albumIndex = {
  version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  albums: [
    {
      albumId: "summer-2025",
      title: "Summer 2025",
      createdAt: "2025-07-01T00:00:00.000Z",
      coverPhotoId: "img_001",
      photoCount: 1
    }
  ]
};

const albumManifest = {
  version: 1,
  albumId: "summer-2025",
  title: "Summer 2025",
  createdAt: "2025-07-01T00:00:00.000Z",
  visibility: "access-controlled",
  photos: [
    {
      id: "img_001",
      filename: "img_001.jpg",
      thumbPath: "albums/summer-2025/thumbs/img_001.webp",
      fullPath: "albums/summer-2025/full/img_001.jpg",
      width: 1600,
      height: 1200,
      capturedAt: "2025-07-04T12:00:00.000Z"
    }
  ]
};

function env(overrides: Partial<TestEnv> = {}): TestEnv {
  return {
    ASSETS: {
      fetch: () => Promise.resolve(new Response("asset", { status: 200 })),
      connect: () => {
        throw new Error("connect unavailable in test asset binding");
      }
    },
    B2_KEY_ID: "key-id",
    B2_APPLICATION_KEY: "app-key",
    B2_BUCKET_NAME: "bucket",
    B2_ENDPOINT: "https://s3.us-west-004.backblazeb2.com",
    B2_REGION: "us-west-004",
    SHARE_TOKEN_SECRET: "secret",
    ACCESS_AUD: "aud",
    ACCESS_ISSUER: "https://team.cloudflareaccess.com",
    DEV_AUTH_BYPASS: "false",
    ...overrides
  };
}

function accessRequest(url: string): Request {
  return new Request(url, {
    headers: {
      "x-dev-access-email": "viewer@example.com"
    }
  });
}

describe("worker routes", () => {
  it("rejects private API requests without Access headers", async () => {
    const response = await worker.fetch(new Request("https://example.com/api/albums"), env(), {} as ExecutionContext);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "unauthorized" }
    });
  });

  it("serves static assets for share page shell without Access headers", async () => {
    const response = await worker.fetch(new Request("https://example.com/share/token"), env(), {} as ExecutionContext);

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("asset");
  });

  it("returns the private album index for Access users", async () => {
    const response = await worker.fetch(
      accessRequest("https://example.com/api/albums"),
      env({
        DEV_AUTH_BYPASS: "true",
        TEST_B2_INDEX_JSON: JSON.stringify(albumIndex)
      }),
      {} as ExecutionContext
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    await expect(response.json()).resolves.toEqual(albumIndex);
  });

  it("returns a private album manifest for Access users", async () => {
    const response = await worker.fetch(
      accessRequest("https://example.com/api/albums/summer-2025"),
      env({
        DEV_AUTH_BYPASS: "true",
        TEST_B2_MANIFEST_JSON: JSON.stringify(albumManifest)
      }),
      {} as ExecutionContext
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    await expect(response.json()).resolves.toEqual(albumManifest);
  });

  it("proxies private thumbnails for Access users", async () => {
    const response = await worker.fetch(
      accessRequest("https://example.com/img/summer-2025/thumb/img_001"),
      env({
        DEV_AUTH_BYPASS: "true",
        TEST_B2_MANIFEST_JSON: JSON.stringify(albumManifest),
        TEST_B2_OBJECT_BODY: "thumb-body"
      }),
      {} as ExecutionContext
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    await expect(response.text()).resolves.toBe("thumb-body");
  });

  it("returns a share album manifest for a valid token", async () => {
    const token = await createShareToken(
      { v: 1, albumId: "summer-2025", expiresAt: "2999-01-01T00:00:00.000Z" },
      "secret"
    );

    const response = await worker.fetch(
      new Request(`https://example.com/share-api/${token}/album`),
      env({
        TEST_B2_MANIFEST_JSON: JSON.stringify(albumManifest)
      }),
      {} as ExecutionContext
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
    await expect(response.json()).resolves.toEqual(albumManifest);
  });

  it("proxies shared full-size images for a valid token", async () => {
    const token = await createShareToken(
      { v: 1, albumId: "summer-2025", expiresAt: "2999-01-01T00:00:00.000Z" },
      "secret"
    );

    const response = await worker.fetch(
      new Request(`https://example.com/share-img/${token}/full/img_001`),
      env({
        TEST_B2_MANIFEST_JSON: JSON.stringify(albumManifest),
        TEST_B2_OBJECT_BODY: "full-body"
      }),
      {} as ExecutionContext
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=0");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    await expect(response.text()).resolves.toBe("full-body");
  });

  it("returns forbidden when a shared image object cannot be fetched from B2", async () => {
    const token = await createShareToken(
      { v: 1, albumId: "summer-2025", expiresAt: "2999-01-01T00:00:00.000Z" },
      "secret"
    );

    const response = await worker.fetch(
      new Request(`https://example.com/share-img/${token}/full/img_001`),
      env({
        TEST_B2_MANIFEST_JSON: JSON.stringify(albumManifest),
        TEST_B2_OBJECT_STATUS: 404
      }),
      {} as ExecutionContext
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "forbidden" }
    });
  });

  it("returns forbidden for malformed share token path encoding", async () => {
    const albumResponse = await worker.fetch(
      new Request("https://example.com/share-api/%/album"),
      env(),
      {} as ExecutionContext
    );
    const imageResponse = await worker.fetch(
      new Request("https://example.com/share-img/%/full/img_001"),
      env(),
      {} as ExecutionContext
    );

    expect(albumResponse.status).toBe(403);
    expect(imageResponse.status).toBe(403);
  });

});
