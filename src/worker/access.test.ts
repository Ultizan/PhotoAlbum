import { describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import { getAccessIdentity } from "./access";

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
  ACCESS_AUD: "gallery-aud",
  ACCESS_ISSUER: "https://team.cloudflareaccess.com"
};

function base64UrlEncode(value: BufferSource): string {
  const bytes = ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function jsonPart(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

async function createAccessJwt(payloadOverrides: Record<string, unknown> = {}, kid = "test-key-id") {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["sign", "verify"]
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const header = { alg: "RS256", typ: "JWT", kid };
  const payload = {
    iss: env.ACCESS_ISSUER,
    aud: env.ACCESS_AUD,
    email: "family@example.com",
    exp: Math.floor(Date.now() / 1000) + 300,
    ...payloadOverrides
  };
  const signingInput = `${jsonPart(header)}.${jsonPart(payload)}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keyPair.privateKey,
    new TextEncoder().encode(signingInput)
  );

  return {
    jwt: `${signingInput}.${base64UrlEncode(signature)}`,
    jwks: { keys: [{ ...publicJwk, kid, alg: "RS256", use: "sig" }] }
  };
}

describe("Cloudflare Access guard", () => {
  it("rejects a forged Access JWT even when the email header is present", async () => {
    const request = new Request("https://example.com/api/albums", {
      headers: {
        "cf-access-authenticated-user-email": "family@example.com",
        "cf-access-jwt-assertion": "not.a.valid-token"
      }
    });
    const fetchCerts = async () => new Response(JSON.stringify({ keys: [] }));

    const identity = await getAccessIdentity(request, env, fetchCerts);

    expect(identity).toBeInstanceOf(Response);
    expect((identity as Response).status).toBe(401);
  });

  it("accepts a signed Access JWT for the configured issuer and audience", async () => {
    const { jwt, jwks } = await createAccessJwt();
    const request = new Request("https://example.com/api/albums", {
      headers: { "cf-access-jwt-assertion": jwt }
    });
    const fetchCerts = async (url: string) => {
      expect(url).toBe("https://team.cloudflareaccess.com/cdn-cgi/access/certs");
      return new Response(JSON.stringify(jwks));
    };

    const identity = await getAccessIdentity(request, env, fetchCerts);

    expect(identity).toEqual({ email: "family@example.com" });
  });

  it("refreshes Access signing keys when the token kid is not cached", async () => {
    const rotationIssuer = "https://rotation.cloudflareaccess.com";
    const rotationEnv = { ...env, ACCESS_ISSUER: rotationIssuer };
    const { jwks: oldJwks } = await createAccessJwt({ iss: rotationIssuer }, "old-key-id");
    const { jwt, jwks: rotatedJwks } = await createAccessJwt({ iss: rotationIssuer }, "rotated-key-id");
    const request = new Request("https://example.com/api/albums", {
      headers: { "cf-access-jwt-assertion": jwt }
    });
    const fetchCerts = vi.fn(async () =>
      new Response(JSON.stringify(fetchCerts.mock.calls.length === 1 ? oldJwks : rotatedJwks))
    );

    const identity = await getAccessIdentity(request, rotationEnv, fetchCerts);

    expect(identity).toEqual({ email: "family@example.com" });
    expect(fetchCerts).toHaveBeenCalledTimes(2);
  });

  it("uses the verified JWT email instead of the unsigned email header", async () => {
    const spoofIssuer = "https://spoof-test.cloudflareaccess.com";
    const spoofEnv = { ...env, ACCESS_ISSUER: spoofIssuer };
    const { jwt, jwks } = await createAccessJwt({ email: "verified@example.com", iss: spoofIssuer }, "spoof-key-id");
    const request = new Request("https://example.com/api/albums", {
      headers: {
        "cf-access-authenticated-user-email": "spoofed@example.com",
        "cf-access-jwt-assertion": jwt
      }
    });
    const fetchCerts = async () => new Response(JSON.stringify(jwks));

    const identity = await getAccessIdentity(request, spoofEnv, fetchCerts);

    expect(identity).toEqual({ email: "verified@example.com" });
  });
});
