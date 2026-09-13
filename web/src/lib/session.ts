import "server-only";

import { cookies } from "next/headers";

export const TOKEN_COOKIE = "mf_token";

/** Laravel API base URL (server-side only; never exposed to the browser). */
export function apiUrl(path: string): string {
  const base = (process.env.API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
  return `${base}/api/v1/${path.replace(/^\//, "")}`;
}

export async function getToken(): Promise<string | undefined> {
  return (await cookies()).get(TOKEN_COOKIE)?.value;
}

export async function setToken(token: string): Promise<void> {
  (await cookies()).set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearToken(): Promise<void> {
  (await cookies()).delete(TOKEN_COOKIE);
}
