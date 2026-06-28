export type B2SignInput = {
  endpoint: string;
  region: string;
  bucketName: string;
  key: string;
  keyId: string;
  applicationKey: string;
  now?: Date;
};

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toArrayBuffer(key: ArrayBuffer | Uint8Array): ArrayBuffer {
  if ("buffer" in key) {
    return key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  }
  return key;
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hmacBytes(key: ArrayBuffer | Uint8Array, value: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
}

function yyyymmdd(date: Date): string {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function amzDate(date: Date): string {
  return date.toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function encodeKeyPath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

export async function buildSignedB2GetRequest(input: B2SignInput): Promise<Request> {
  const now = input.now ?? new Date();
  const date = yyyymmdd(now);
  const timestamp = amzDate(now);
  const endpoint = new URL(input.endpoint);
  const canonicalUri = `/${encodeURIComponent(input.bucketName)}/${encodeKeyPath(input.key)}`;
  const url = new URL(canonicalUri, endpoint);
  const host = url.host;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${timestamp}`
  ].join("\n") + "\n";
  const canonicalRequest = ["GET", canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${date}/${input.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    timestamp,
    credentialScope,
    await sha256(canonicalRequest)
  ].join("\n");

  const kDate = await hmacBytes(new TextEncoder().encode(`AWS4${input.applicationKey}`), date);
  const kRegion = await hmacBytes(kDate, input.region);
  const kService = await hmacBytes(kRegion, "s3");
  const kSigning = await hmacBytes(kService, "aws4_request");
  const signature = toHex(await hmacBytes(kSigning, stringToSign));

  return new Request(url.toString(), {
    method: "GET",
    headers: {
      authorization: `AWS4-HMAC-SHA256 Credential=${input.keyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": timestamp
    }
  });
}
