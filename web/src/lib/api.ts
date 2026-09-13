/**
 * Browser-side client for the Laravel API, routed through /api/backend (see app/api/backend).
 */

export type ValidationErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: ValidationErrors = {},
  ) {
    super(message);
  }

  /** First validation message, or the general message. */
  get firstError(): string {
    const first = Object.values(this.errors)[0]?.[0];
    return first ?? this.message;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
  links?: Record<string, string | null>;
}

/** Browser URL for an API path (e.g. a protected file stream) routed through the authenticated proxy. */
export function backendUrl(path: string): string {
  return `/api/backend/${path.replace(/^\//, "")}`;
}

function buildUrl(path: string, query?: Query): string {
  const url = `/api/backend/${path.replace(/^\//, "")}`;
  if (!query) {
    return url;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const response = await fetch(buildUrl(path, query), {
    method,
    headers: isForm ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    credentials: "same-origin",
  });

  if (response.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(payload?.message ?? `Request failed (${response.status})`, response.status, payload?.errors ?? {});
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};
