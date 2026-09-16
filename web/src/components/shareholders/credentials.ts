/**
 * One-time shareholder login credentials returned by the API (create shareholder, generate accounts, reset password).
 * They live only in component memory: shown once in a modal, never cached, stored or logged, and dropped when it closes.
 */

export interface LoginCredentials {
  login: string;
  temporary_password: string;
}

export interface GeneratedAccount extends LoginCredentials {
  share_holder_id: number;
  name: string;
}

export interface CredentialEntry extends LoginCredentials {
  name: string;
}

/** Credentials from an API response, or null when none were issued (e.g. a linked staff login or a replayed request). */
export function credentialsFrom(response: unknown, name: string): CredentialEntry[] | null {
  if (typeof response !== "object" || response === null) {
    return null;
  }
  const payload = response as { credentials?: LoginCredentials | null; data?: { created?: GeneratedAccount[] } };
  if (payload.credentials?.login && payload.credentials.temporary_password) {
    return [{ name, login: payload.credentials.login, temporary_password: payload.credentials.temporary_password }];
  }
  const created = payload.data?.created ?? [];
  const entries = created.filter((row) => row.login && row.temporary_password).map((row) => ({ name: row.name, login: row.login, temporary_password: row.temporary_password }));
  return entries.length > 0 ? entries : null;
}

/** Plain text handed to the clipboard. */
export function credentialsText(entries: CredentialEntry[]): string {
  return entries.map((entry) => `${entry.name}\nLogin (phone): ${entry.login}\nTemporary password: ${entry.temporary_password}`).join("\n\n");
}

/**
 * Holder for credentials that may be read while the modal is open and are wiped on close: after `clear()` nothing can
 * show them again.
 */
export function createOneTimeCredentials() {
  let current: CredentialEntry[] | null = null;
  return {
    show(entries: CredentialEntry[] | null) {
      current = entries && entries.length > 0 ? entries : null;
      return current;
    },
    get(): CredentialEntry[] | null {
      return current;
    },
    clear() {
      current = null;
    },
  };
}
