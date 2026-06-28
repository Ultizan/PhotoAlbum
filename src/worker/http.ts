export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "bad_gateway"
  | "bad_request";

export function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(value), { ...init, headers });
}

export function errorResponse(status: number, code: ApiErrorCode, message: string): Response {
  return jsonResponse({ error: { code, message } }, { status });
}

export function withCacheHeaders(response: Response, cacheControl: string): Response {
  const next = new Response(response.body, response);
  next.headers.set("cache-control", cacheControl);
  return next;
}
