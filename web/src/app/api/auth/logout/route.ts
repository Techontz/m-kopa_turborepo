import { apiUrl, clearToken, getToken, safeFetch } from "@/lib/session";

export async function POST() {
  const token = await getToken();

  if (token) {
    await safeFetch(apiUrl("auth/logout"), {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
  }

  await clearToken();

  return Response.json({ message: "Logged out" });
}
