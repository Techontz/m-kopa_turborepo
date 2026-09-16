/**
 * One key per financial form submission: the API records the first request under the key and answers a retry
 * (double click, network retry) with the same record instead of posting a second ledger entry.
 */
export function newIdempotencyKey(prefix = "web"): string {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`.slice(0, 100);
}

/** API answer when a key is re-sent with a different request (EnsureIdempotentRequest::MISMATCH_MESSAGE). */
export const IDEMPOTENCY_MISMATCH_MESSAGE = "This request key was already used for a different request.";

/**
 * Stable description of a mutating request: method, path and body (FormData entries with files by name and size).
 * Two submits of the same form produce the same fingerprint; a different row, amount or field produces another.
 */
export function requestFingerprint(method: string, path: string, body?: unknown): string {
  let payload: unknown = body ?? null;
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    payload = Array.from(body.entries()).map(([name, value]) =>
      typeof value === "string" ? [name, value] : [name, { file: (value as File).name ?? "blob", size: value.size }],
    );
  }
  return `${method.toUpperCase()} ${path} ${JSON.stringify(payload)}`;
}

export interface IdempotencyTracker {
  /** Send a request under the tracker's key: identical concurrent submits share one request and one key. */
  run<T>(fingerprint: string, send: (key: string) => Promise<T>): Promise<T>;
  /** The key the next submit with this fingerprint would use (for tests / diagnostics). */
  peek(): { key: string; fingerprint: string } | null;
}

function isKeyMismatch(error: unknown): boolean {
  const failure = error as { status?: number; message?: string } | null;
  return failure?.status === 422 && failure.message === IDEMPOTENCY_MISMATCH_MESSAGE;
}

/**
 * One Idempotency-Key per action (hook instance). The key is kept across retries of the same request (double click,
 * network retry, a failed attempt re-submitted unchanged) and rotated after a success, after the API reports the key
 * was used for a different request, or when the next submit is a different request.
 */
export function createIdempotencyTracker(generate: () => string = () => newIdempotencyKey("action")): IdempotencyTracker {
  let current: { key: string; fingerprint: string } | null = null;
  const inFlight = new Map<string, Promise<unknown>>();

  return {
    run<T>(fingerprint: string, send: (key: string) => Promise<T>): Promise<T> {
      const pending = inFlight.get(fingerprint);
      if (pending) {
        return pending as Promise<T>;
      }

      if (current === null || current.fingerprint !== fingerprint) {
        current = { key: generate(), fingerprint };
      }
      const used = current;

      const promise = send(used.key)
        .then(
          (result) => {
            if (current === used) {
              current = null;
            }
            return result;
          },
          (error: unknown) => {
            if (isKeyMismatch(error) && current === used) {
              current = null;
            }
            throw error;
          },
        )
        .finally(() => inFlight.delete(fingerprint));

      inFlight.set(fingerprint, promise);
      return promise;
    },
    peek: () => current,
  };
}
