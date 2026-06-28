export type AccessJwk = JsonWebKey & {
  kid: string;
};

export type AccessJwtIdentity = {
  email: string;
  sub?: string;
};

type AccessJwtOptions = {
  audience: string;
  issuer: string;
  keys: AccessJwk[];
  now?: number;
};

type JwtHeader = {
  alg?: unknown;
  kid?: unknown;
};

type JwtPayload = {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iss?: unknown;
  nbf?: unknown;
  sub?: unknown;
};

type Fetcher = (url: string) => Promise<Response>;

type CacheEntry = {
  expiresAt: number;
  keys: AccessJwk[];
};

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const jwksCache = new Map<string, CacheEntry>();

function normalizeIssuer(issuer: string): string {
  return issuer.replace(/\/+$/, "");
}

function certsUrl(issuer: string): string {
  return `${normalizeIssuer(issuer)}/cdn-cgi/access/certs`;
}

function base64UrlDecode(value: string): ArrayBuffer {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function parseJwtPart<T>(value: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(value))) as T;
  } catch {
    throw new Error("access token malformed");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAccessJwk(value: unknown): value is AccessJwk {
  return isRecord(value) && typeof value.kid === "string" && value.kty === "RSA";
}

function audienceMatches(aud: unknown, expected: string): boolean {
  return aud === expected || (Array.isArray(aud) && aud.includes(expected));
}

async function importVerificationKey(jwk: AccessJwk): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

export function tokenKeyId(token: string): string | undefined {
  const [encodedHeader] = token.split(".");
  if (!encodedHeader) {
    return undefined;
  }

  try {
    const header = parseJwtPart<JwtHeader>(encodedHeader);
    return typeof header.kid === "string" && header.kid.length > 0 ? header.kid : undefined;
  } catch {
    return undefined;
  }
}

export async function fetchAccessJwks(
  issuer: string,
  fetcher: Fetcher = fetch,
  now: number = Date.now(),
  forceRefresh = false
): Promise<AccessJwk[]> {
  const normalizedIssuer = normalizeIssuer(issuer);
  const cached = jwksCache.get(normalizedIssuer);
  if (!forceRefresh && cached && now < cached.expiresAt) {
    return cached.keys;
  }

  const response = await fetcher(certsUrl(normalizedIssuer));
  if (!response.ok) {
    throw new Error("access signing keys unavailable");
  }

  const body = (await response.json()) as { keys?: unknown };
  if (!Array.isArray(body.keys)) {
    throw new Error("access signing keys malformed");
  }

  const keys = body.keys.filter(isAccessJwk);
  if (keys.length > 0) {
    jwksCache.set(normalizedIssuer, { keys, expiresAt: now + JWKS_CACHE_TTL_MS });
  }
  return keys;
}

export async function verifyAccessJwt(token: string, options: AccessJwtOptions): Promise<AccessJwtIdentity> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("access token malformed");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJwtPart<JwtHeader>(encodedHeader);
  if (header.alg !== "RS256") {
    throw new Error("access token algorithm invalid");
  }
  if (typeof header.kid !== "string" || header.kid.length === 0) {
    throw new Error("access token key not found");
  }

  const payload = parseJwtPart<JwtPayload>(encodedPayload);
  if (payload.iss !== normalizeIssuer(options.issuer)) {
    throw new Error("access token issuer invalid");
  }
  if (!audienceMatches(payload.aud, options.audience)) {
    throw new Error("access token audience invalid");
  }

  const now = options.now ?? Date.now();
  if (typeof payload.exp !== "number" || now >= payload.exp * 1000) {
    throw new Error("access token expired");
  }
  if (typeof payload.nbf === "number" && now < payload.nbf * 1000) {
    throw new Error("access token not active");
  }
  if (typeof payload.email !== "string" || payload.email.length === 0) {
    throw new Error("access token email missing");
  }

  const jwk = options.keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    throw new Error("access token key not found");
  }

  const verified = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    await importVerificationKey(jwk),
    base64UrlDecode(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!verified) {
    throw new Error("access token signature invalid");
  }

  return {
    email: payload.email,
    ...(typeof payload.sub === "string" && payload.sub.length > 0 ? { sub: payload.sub } : {})
  };
}
