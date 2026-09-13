import { apiUrl, clearToken, getToken } from "@/lib/session";

export async function POST() {
  const token = await getToken();

  if (token) {
    await fetch(apiUrl("auth/logout"), {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => undefined);
  }

  await clearToken();

  return Response.json({ message: "Logged out" });
}
