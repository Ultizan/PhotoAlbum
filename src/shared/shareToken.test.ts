import type { ShareTokenPayload } from "./types";
import { describe, expect, it } from "vitest";
import { createShareToken, verifyShareToken } from "./shareToken";

async function createRawPayloadToken(payload: unknown, secret: string): Promise<string> {
  return createShareToken(payload as ShareTokenPayload, secret);
}

describe("share tokens", () => {
  it("round-trips a valid one-album token", async () => {
    const token = await createShareToken(
      { v: 1, albumId: "2026-family-trip", expiresAt: "2026-06-30T23:59:59-07:00" },
      "test-secret"
    );

    const payload = await verifyShareToken(token, "test-secret", new Date("2026-06-29T12:00:00-07:00"));

    expect(payload.albumId).toBe("2026-family-trip");
  });

  it("rejects expired tokens", async () => {
    const token = await createShareToken(
      { v: 1, albumId: "2026-family-trip", expiresAt: "2026-06-30T23:59:59-07:00" },
      "test-secret"
    );

    await expect(
      verifyShareToken(token, "test-secret", new Date("2026-07-01T00:00:00-07:00"))
    ).rejects.toThrow("share token expired");
  });

  it("rejects a token signed with another secret", async () => {
    const token = await createShareToken(
      { v: 1, albumId: "2026-family-trip", expiresAt: "2026-06-30T23:59:59-07:00" },
      "test-secret"
    );

    await expect(
      verifyShareToken(token, "other-secret", new Date("2026-06-29T12:00:00-07:00"))
    ).rejects.toThrow("share token signature invalid");
  });

  it("rejects signed non-object payloads with a controlled error", async () => {
    const token = await createRawPayloadToken(null, "test-secret");

    await expect(
      verifyShareToken(token, "test-secret", new Date("2026-06-29T12:00:00-07:00"))
    ).rejects.toThrow("share token payload invalid");
  });

  it("rejects signed invalid payload fields", async () => {
    const token = await createRawPayloadToken(
      { v: 1, albumId: "", expiresAt: "not-a-date" },
      "test-secret"
    );

    await expect(
      verifyShareToken(token, "test-secret", new Date("2026-06-29T12:00:00-07:00"))
    ).rejects.toThrow("share token albumId invalid");
  });

  it("rejects malformed token shapes", async () => {
    await expect(verifyShareToken("only-one-part", "test-secret")).rejects.toThrow("share token malformed");
  });
});
