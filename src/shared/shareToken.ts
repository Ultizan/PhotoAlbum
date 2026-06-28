import type { ShareTokenPayload } from "./types";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }
  return diff === 0;
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toBase64Url(new Uint8Array(signature));
}

function parsePayload(json: string): ShareTokenPayload {
  const value = JSON.parse(json) as Partial<ShareTokenPayload>;
  if (value.v !== 1) {
    throw new Error("share token version invalid");
  }
  if (typeof value.albumId !== "string" || value.albumId.length === 0) {
    throw new Error("share token albumId invalid");
  }
  if (typeof value.expiresAt !== "string" || Number.isNaN(Date.parse(value.expiresAt))) {
    throw new Error("share token expiresAt invalid");
  }
  return { v: 1, albumId: value.albumId, expiresAt: value.expiresAt };
}

export async function createShareToken(payload: ShareTokenPayload, secret: string): Promise<string> {
  const payloadPart = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signaturePart = await hmac(payloadPart, secret);
  return `${payloadPart}.${signaturePart}`;
}

export async function verifyShareToken(token: string, secret: string, now = new Date()): Promise<ShareTokenPayload> {
  const [payloadPart, signaturePart, extra] = token.split(".");
  if (!payloadPart || !signaturePart || extra !== undefined) {
    throw new Error("share token malformed");
  }

  const expectedSignature = await hmac(payloadPart, secret);
  if (!constantTimeEquals(signaturePart, expectedSignature)) {
    throw new Error("share token signature invalid");
  }

  const payloadJson = new TextDecoder().decode(fromBase64Url(payloadPart));
  const payload = parsePayload(payloadJson);
  if (Date.parse(payload.expiresAt) <= now.getTime()) {
    throw new Error("share token expired");
  }
  return payload;
}
