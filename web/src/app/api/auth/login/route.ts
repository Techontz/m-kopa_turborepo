import { apiUrl, readJson, safeFetch, setToken } from "@/lib/session";

interface LoginPayload {
  token?: string;
  user?: unknown;
  message?: string;
  errors?: Record<string, string[]>;
}

/** Exchanges phone + password for a Laravel Sanctum token kept in an httpOnly cookie. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string; password?: string; remember?: boolean };

  const response = await safeFetch(apiUrl("auth/login"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ phone: body.phone, password: body.password, device: "web" }),
  });

  const payload = await readJson<LoginPayload>(response);

  if (!response.ok) {
    return Response.json(payload ?? { message: `The API server answered ${response.status}.` }, { status: response.status });
  }

  if (!payload?.token) {
    return Response.json({ message: "The API server did not return a sign-in token." }, { status: 502 });
  }

  await setToken(payload.token, body.remember !== false);

  return Response.json({ user: payload.user });
}
