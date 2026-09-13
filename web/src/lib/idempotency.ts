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
