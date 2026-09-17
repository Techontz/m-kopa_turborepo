import { apiUrl, setToken } from "@/lib/session";

/** Exchanges phone + password for a Laravel Sanctum token kept in an httpOnly cookie. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  let response: Response;
  try {
    response = await fetch(apiUrl("auth/login"), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ phone: body.phone, password: body.password, device: "web" }),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`Login proxy failed reaching ${apiUrl("auth/login")}:`, error);
    return Response.json(
      { message: "Unable to reach the server. Please try again shortly." },
      { status: 502 },
    );
  }

  const payload = await response.json().catch(() => ({ message: "Unable to reach the server" }));

  if (!response.ok) {
    return Response.json(payload, { status: response.status });
  }

  await setToken(payload.token);

  return Response.json({ user: payload.user });
}
