import "server-only";

import { cookies } from "next/headers";

export const TOKEN_COOKIE = "mf_token";

/**
 * Laravel API base. Vercel sets NEXT_PUBLIC_API_URL (with or without the /api/v1 suffix);
 * API_URL is still honoured for older local setups.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "https://api.m-kopatz.co.tz/api/v1";

/** Absolute URL for an API path, always under /api/v1 (server-side only; never exposed to the browser). */
export function apiUrl(path: string): string {
  const base = API_BASE.trim().replace(/\/+$/, "");
  const root = /\/api\/v1$/.test(base) ? base : `${base}/api/v1`;
  return `${root}/${path.replace(/^\//, "")}`;
}

/**
 * fetch that never throws: a DNS/connection failure comes back as a 502 JSON response instead of
 * escaping the route handler, which would answer the browser with an empty 500 body.
 */
export async function safeFetch(target: string | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(target, { cache: "no-store", ...init });
  } catch (error) {
    const reason = error instanceof Error ? (error.cause instanceof Error ? error.cause.message : error.message) : "unknown error";
    return Response.json({ message: `Cannot reach the API server (${reason}).`, error_code: "API_UNREACHABLE" }, { status: 502 });
  }
}

/** Parsed JSON body, or null when the response is empty or not JSON (an HTML error page, say). */
export async function readJson<T = Record<string, unknown>>(response: Response): Promise<T | null> {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function getToken(): Promise<string | undefined> {
  return (await cookies()).get(TOKEN_COOKIE)?.value;
}

/** remember = false ("Keep me signed in" unticked) keeps the cookie only until the browser closes. */
export async function setToken(token: string, remember = true): Promise<void> {
  (await cookies()).set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: 60 * 60 * 12 } : {}),
  });
}

export async function clearToken(): Promise<void> {
  (await cookies()).delete(TOKEN_COOKIE);
}
