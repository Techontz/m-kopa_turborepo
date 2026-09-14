import { describe, expect, it } from "vitest";

import { groupPermissions, privilegeChanges, privilegeSource, staffRowActions, type Can } from "./staffActions";

const canAll: Can = () => true;
const canOnly = (...held: string[]): Can => (permission) => (Array.isArray(permission) ? permission : [permission]).some((item) => held.includes(item));

describe("All Active Staff row actions", () => {
  it("makes the third (blue) button, after View and Block, link to the privileges page", () => {
    const actions = staffRowActions({ id: 42, status: "active" }, canAll);

    expect(actions.map((action) => action.key)).toEqual(["view", "block", "privileges", "delete", "reject", "reset-password"]);
    expect(actions[2]).toMatchObject({ key: "privileges", tone: "info", icon: "icon-arrow-right", href: "/hrm/staff/42/privileges" });
  });

  it("keeps the privilege action third for blocked staff (Un Block in second place)", () => {
    const actions = staffRowActions({ id: 7, status: "blocked" }, canAll);

    expect(actions[1].key).toBe("unblock");
    expect(actions[2].href).toBe("/hrm/staff/7/privileges");
  });

  it("hides reset password without hrm.staff_reset_password and management actions without users.manage", () => {
    expect(staffRowActions({ id: 1, status: "active" }, canOnly("users.manage", "hrm.staff_privileges")).map((action) => action.key)).not.toContain("reset-password");
    expect(staffRowActions({ id: 1, status: "active" }, canOnly("hrm.manage")).map((action) => action.key)).toEqual(["view", "privileges"]);
    expect(staffRowActions({ id: 1, status: "active" }, canOnly()).map((action) => action.key)).toEqual(["view"]);
  });
});

describe("staff privileges helpers", () => {
  it("groups the catalogue by module in order", () => {
    const groups = groupPermissions([
      { key: "loans.view", label: "View loans", group: "loans" },
      { key: "hrm.manage", label: "HRM", group: "hrm" },
      { key: "loans.apply", label: "Apply", group: "loans" },
    ]);

    expect(groups.map(([group, items]) => [group, items.map((item) => item.key)])).toEqual([["loans", ["loans.view", "loans.apply"]], ["hrm", ["hrm.manage"]]]);
  });

  it("computes pending grants/revocations and the source of each key", () => {
    expect(privilegeChanges(["a", "b"], ["b", "c"])).toEqual({ granted: ["c"], revoked: ["a"] });
    expect(privilegeSource("x", ["x"], [], [])).toBe("role");
    expect(privilegeSource("y", ["x"], ["y"], [])).toBe("granted");
    expect(privilegeSource("x", ["x"], [], ["x"])).toBe("revoked");
    expect(privilegeSource("z", ["x"], [], [])).toBe("none");
  });
});
