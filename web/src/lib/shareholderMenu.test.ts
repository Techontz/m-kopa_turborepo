import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { activeShareholderHref, redirectFor, shareholderMenu, shellFor, visibleShareholderMenu, type Permission } from "./shareholderMenu";

const PORTAL = ["shareholder.portal", "shareholder.profile", "shareholder.capital.view", "shareholder.capital.submit", "shareholder.dividends.view", "shareholder.statements", "shareholder.directory"];

const canWith = (granted: string[]) => (permission: Permission) => (Array.isArray(permission) ? permission : [permission]).some((item) => granted.includes(item));

const shareholder = { account_type: "shareholder", must_change_password: false, role: { key: "shareholder" }, shareholder: { id: 7, name: "JOHN SHAREHOLDER" } };
const finance = { account_type: "staff", must_change_password: false, role: { key: "finance" }, shareholder: null };
const linkedAdmin = { account_type: "staff", must_change_password: false, role: { key: "super_admin" }, shareholder: { id: 9, name: "ADMIN HOLDER" } };

const APP_DIR = path.resolve(__dirname, "../app/(app)");

describe("shareholder shell selection", () => {
  it("gives shareholder accounts the portal shell and keeps staff shells unchanged", () => {
    expect(shellFor(shareholder)).toBe("shareholder");
    expect(shellFor(finance)).toBe("finance");
    expect(shellFor(linkedAdmin)).toBe("staff");
    expect(shellFor({ role: { key: "teller" } })).toBe("staff");
    expect(shellFor(null)).toBe("staff");
  });

  it("sends shareholders from staff routes to the portal, never to the staff dashboard", () => {
    for (const staffRoute of ["/dashboard", "/hrm/staff", "/loans/apply", "/accounting/journal", "/capital/share-holders", "/reports/portfolio"]) {
      expect(redirectFor(shareholder, staffRoute)).toBe("/shareholder");
    }
    expect(redirectFor(shareholder, "/shareholder")).toBeNull();
    expect(redirectFor(shareholder, "/shareholder/directory")).toBeNull();
    expect(redirectFor(shareholder, "/shareholderx")).toBe("/shareholder");
  });

  it("forces the password change before anything else", () => {
    const temporary = { ...shareholder, must_change_password: true };
    expect(redirectFor(temporary, "/shareholder")).toBe("/shareholder/security");
    expect(redirectFor(temporary, "/dashboard")).toBe("/shareholder/security");
    expect(redirectFor(temporary, "/shareholder/security")).toBeNull();
    expect(redirectFor({ ...finance, must_change_password: true }, "/dashboard")).toBe("/shareholder/security");
  });

  it("lets linked staff open the portal and keeps unlinked staff out", () => {
    expect(redirectFor(linkedAdmin, "/shareholder")).toBeNull();
    expect(redirectFor(linkedAdmin, "/dashboard")).toBeNull();
    expect(redirectFor(finance, "/shareholder")).toBe("/dashboard");
    expect(redirectFor(finance, "/dashboard")).toBeNull();
  });
});

describe("shareholder menu", () => {
  it("lists the portal sections in order", () => {
    expect(shareholderMenu.map((link) => link.label)).toEqual([
      "Dashboard", "My Capital", "Add Capital", "My Shares", "Dividends", "Reserve Approvals", "Statements", "All Shareholders", "Company Shares", "Profile", "Security",
    ]);
  });

  it("uses only shareholder permissions and links to existing pages", () => {
    for (const link of shareholderMenu) {
      for (const permission of [link.permission].flat()) {
        expect(PORTAL).toContain(permission);
      }
      const page = path.join(APP_DIR, ...link.href.split("/").filter(Boolean), "page.tsx");
      expect(fs.existsSync(page), link.href).toBe(true);
    }
  });

  it("filters entries by the account's permissions", () => {
    expect(visibleShareholderMenu(canWith(PORTAL))).toHaveLength(shareholderMenu.length);

    const readOnly = visibleShareholderMenu(canWith(PORTAL.filter((permission) => permission !== "shareholder.capital.submit" && permission !== "shareholder.directory"))).map((link) => link.label);
    expect(readOnly).not.toContain("Add Capital");
    expect(readOnly).not.toContain("All Shareholders");
    expect(readOnly).not.toContain("Company Shares");
    expect(readOnly).toContain("My Capital");

    // A staff account without a shareholder link holds no portal permission: only Security remains.
    expect(visibleShareholderMenu(canWith(["dashboard.view", "capital.manage", "users.manage"])).map((link) => link.label)).toEqual(["Security"]);
  });

  it("highlights the most specific entry", () => {
    expect(activeShareholderHref("/shareholder")).toBe("/shareholder");
    expect(activeShareholderHref("/shareholder/capital")).toBe("/shareholder/capital");
    expect(activeShareholderHref("/shareholder/capital/add")).toBe("/shareholder/capital/add");
    expect(activeShareholderHref("/shareholder/unknown")).toBeNull();
  });
});
