import type { NextRequest } from "next/server";

import { apiUrl, clearToken, getToken, safeFetch } from "@/lib/session";

/**
 * Forwards browser requests to the Laravel API (/api/v1/*), attaching the Sanctum token
 * from the httpOnly cookie. JSON and multipart bodies are passed through unchanged, as is the
 * `Idempotency-Key` header (and the API's `Idempotent-Replayed` answer).
 */
async function forward(request: NextRequest, context: RouteContext<"/api/backend/[...path]">) {
  const { path } = await context.params;
  const token = await getToken();

  if (!token) {
    return Response.json({ message: "Unauthenticated." }, { status: 401 });
  }

  const target = new URL(apiUrl(path.join("/")));
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const headers = new Headers({ Accept: "application/json", Authorization: `Bearer ${token}` });
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const response = await safeFetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
  });

  if (response.status === 401) {
    await clearToken();
  }

  const responseHeaders = new Headers();
  for (const name of ["content-type", "content-disposition", "idempotent-replayed"]) {
    const value = response.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }

  return new Response(response.body, { status: response.status, headers: responseHeaders });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
