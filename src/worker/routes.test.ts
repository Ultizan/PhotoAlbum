import { describe, expect, it } from "vitest";
import worker from "./index";
import type { Env } from "./env";

function env(overrides: Partial<Env> = {}): Env {
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
});
