import { describe, expect, it } from "vitest";
import { buildSignedB2GetRequest } from "./b2Signer";

describe("B2 S3 signer", () => {
  it("builds a path-style signed GET request", async () => {
    const request = await buildSignedB2GetRequest({
      endpoint: "https://s3.us-west-004.backblazeb2.com",
      region: "us-west-004",
      bucketName: "photos",
      key: "albums/2026-family-trip/manifest.json",
      keyId: "key-id",
      applicationKey: "app-key",
      now: new Date("2026-06-28T12:00:00Z")
    });

    expect(request.method).toBe("GET");
    expect(request.url).toBe("https://s3.us-west-004.backblazeb2.com/photos/albums/2026-family-trip/manifest.json");
    expect(request.headers.get("x-amz-date")).toBe("20260628T120000Z");
    expect(request.headers.get("x-amz-content-sha256")).toBe("UNSIGNED-PAYLOAD");
    expect(request.headers.get("authorization")).toContain(
      "AWS4-HMAC-SHA256 Credential=key-id/20260628/us-west-004/s3/aws4_request"
    );
    expect(request.headers.get("authorization")).not.toContain("app-key");
  });
});
