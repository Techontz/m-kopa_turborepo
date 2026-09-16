import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createOneTimeCredentials, credentialsFrom, credentialsText } from "./credentials";
import { defaultStatementRange, ownership, validAmount } from "./portal";

describe("one-time shareholder credentials", () => {
  it("reads the credentials of a create / reset response once", () => {
    const response = { message: "Shareholder Registered successfully", credentials: { login: "0768999001", temporary_password: "Ab3$xyz9QwEr" } };
    expect(credentialsFrom(response, "DEVFLOW-S SHAREHOLDER")).toEqual([{ name: "DEVFLOW-S SHAREHOLDER", login: "0768999001", temporary_password: "Ab3$xyz9QwEr" }]);
  });

  it("shows nothing when no password was issued (linked staff login or a replayed request)", () => {
    expect(credentialsFrom({ credentials: null, account: { outcome: "linked" } }, "X")).toBeNull();
    expect(credentialsFrom({ message: "Shareholder Registered successfully", secrets_redacted: true }, "X")).toBeNull();
    expect(credentialsFrom(null, "X")).toBeNull();
  });

  it("lists every created account of a generate response", () => {
    const response = { data: { created: [{ share_holder_id: 1, name: "A", login: "0768000001", temporary_password: "p1" }, { share_holder_id: 2, name: "B", login: "0768000002", temporary_password: "p2" }], linked: [], skipped: [] } };
    const entries = credentialsFrom(response, "");
    expect(entries?.map((entry) => entry.name)).toEqual(["A", "B"]);
    expect(credentialsText(entries ?? [])).toBe("A\nLogin (phone): 0768000001\nTemporary password: p1\n\nB\nLogin (phone): 0768000002\nTemporary password: p2");
  });

  it("forgets the credentials when the modal closes", () => {
    const holder = createOneTimeCredentials();
    expect(holder.get()).toBeNull();
    holder.show([{ name: "A", login: "1", temporary_password: "secret" }]);
    expect(holder.get()?.[0].temporary_password).toBe("secret");
    holder.clear();
    expect(holder.get()).toBeNull();
    expect(holder.show([])).toBeNull();
  });

  it("never persists credentials in browser storage or logs", () => {
    for (const file of ["credentials.ts", "CredentialsModal.tsx"]) {
      const source = fs.readFileSync(path.resolve(__dirname, file), "utf8");
      expect(source).not.toMatch(/localStorage|sessionStorage|console\.(log|info|debug)|document\.cookie/);
    }
    const modal = fs.readFileSync(path.resolve(__dirname, "CredentialsModal.tsx"), "utf8");
    expect(modal).toContain("will not be shown again");
  });
});

describe("portal helpers", () => {
  it("validates contribution amounts before the confirm step", () => {
    expect(validAmount("1000")).toBe(true);
    expect(validAmount("1,000,000.50")).toBe(true);
    expect(validAmount("0")).toBe(false);
    expect(validAmount("-5")).toBe(false);
    expect(validAmount("10.123")).toBe(false);
    expect(validAmount("abc")).toBe(false);
  });

  it("formats ownership and the default statement range", () => {
    expect(ownership(33.33333)).toBe("33.3333%");
    expect(ownership(25)).toBe("25%");
    expect(defaultStatementRange(new Date("2026-09-15T10:00:00Z"))).toEqual({ from: "2026-01-01", to: "2026-09-15" });
  });
});
