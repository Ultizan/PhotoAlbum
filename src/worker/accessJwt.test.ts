import { describe, expect, it, vi } from "vitest";
import { fetchAccessJwks, verifyAccessJwt, type AccessJwk } from "./accessJwt";

const ISSUER = "https://team.cloudflareaccess.com";
const AUDIENCE = "gallery-aud";
const KID = "test-key";
const NOW = Date.UTC(2026, 5, 28, 12, 0, 0);

function base64UrlEncode(value: string | BufferSource): string {
  const bytes =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["sign", "verify"]
  );
}

async function publicJwk(key: CryptoKey, kid: string = KID): Promise<AccessJwk> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return { ...jwk, kid, alg: "RS256", use: "sig" };
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: ISSUER,
    aud: [AUDIENCE],
    email: "family@example.com",
    sub: "user-123",
    exp: Math.floor(NOW / 1000) + 300,
    ...overrides
  };
}

async function signJwt(
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  kid: string = KID,
  headerOverrides: Record<string, unknown> = {}
): Promise<string> {
  const header = { alg: "RS256", typ: "JWT", kid, ...headerOverrides };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

const jwksBody = {
  keys: [{ kid: "cache-key", kty: "RSA", n: "modulus", e: "AQAB", alg: "RS256", use: "sig" }]
};

describe("fetchAccessJwks", () => {
  it("caches Access signing keys by issuer for the short TTL", async () => {
    const issuer = "https://cache-test.cloudflareaccess.com";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(jwksBody)));

    const first = await fetchAccessJwks(issuer, fetchMock, 1_000);
    const second = await fetchAccessJwks(`${issuer}/`, fetchMock, 1_000 + 60_000);

    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${issuer}/cdn-cgi/access/certs`);
  });

  it("refetches Access signing keys after the short TTL expires", async () => {
    const issuer = "https://ttl-test.cloudflareaccess.com";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(jwksBody)));

    await fetchAccessJwks(issuer, fetchMock, 1_000);
    await fetchAccessJwks(issuer, fetchMock, 1_000 + 5 * 60 * 1000 + 1);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("verifyAccessJwt", () => {
  it("returns identity for a valid Access JWT", async () => {
    const keyPair = await generateKeyPair();
    const token = await signJwt(claims(), keyPair.privateKey);

    await expect(
      verifyAccessJwt(token, {
        audience: AUDIENCE,
        issuer: ISSUER,
        keys: [await publicJwk(keyPair.publicKey)],
        now: NOW
      })
    ).resolves.toEqual({ email: "family@example.com", sub: "user-123" });
  });

  it("rejects a well-formed token signed by a different key", async () => {
    const trustedKeyPair = await generateKeyPair();
    const attackerKeyPair = await generateKeyPair();
    const token = await signJwt(claims(), attackerKeyPair.privateKey);

    await expect(
      verifyAccessJwt(token, {
        audience: AUDIENCE,
        issuer: ISSUER,
        keys: [await publicJwk(trustedKeyPair.publicKey)],
        now: NOW
      })
    ).rejects.toThrow("access token signature invalid");
  });

  it("rejects invalid security claims", async () => {
    const keyPair = await generateKeyPair();
    const key = await publicJwk(keyPair.publicKey);
    const options = { audience: AUDIENCE, issuer: ISSUER, keys: [key], now: NOW };

    await expect(verifyAccessJwt(await signJwt(claims({ iss: "https://evil.example.com" }), keyPair.privateKey), options)).rejects.toThrow(
      "access token issuer invalid"
    );
    await expect(verifyAccessJwt(await signJwt(claims({ aud: ["other-aud"] }), keyPair.privateKey), options)).rejects.toThrow(
      "access token audience invalid"
    );
    await expect(verifyAccessJwt(await signJwt(claims({ exp: Math.floor(NOW / 1000) - 1 }), keyPair.privateKey), options)).rejects.toThrow(
      "access token expired"
    );
    await expect(verifyAccessJwt(await signJwt(claims({ nbf: Math.floor(NOW / 1000) + 60 }), keyPair.privateKey), options)).rejects.toThrow(
      "access token not active"
    );
    await expect(verifyAccessJwt(await signJwt(claims({ email: "" }), keyPair.privateKey), options)).rejects.toThrow(
      "access token email missing"
    );
  });
});
