import { describe, expect, it } from "vitest";
import { createShareToken, verifyShareToken } from "./shareToken";

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
});
