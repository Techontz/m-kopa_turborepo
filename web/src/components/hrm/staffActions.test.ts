import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  applyPrivilegeChange,
  assignedPrivilegeRows,
  groupPermissions,
  PRIVILEGE_MESSAGES,
  privilegeChanges,
  privilegeItemSource,
  privilegeItemStatus,
  privilegeKeysNotHeld,
  privilegeRows,
  privilegeSource,
  staffPrivilegesHref,
  staffRowActions,
  withPrivilegeItem,
  type Can,
  type PrivilegeGroup,
} from "./staffActions";

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

/** Shape returned by GET hrm/staff/{id}/privileges (privilege_groups). */
const GROUPS: PrivilegeGroup[] = [
  {
    key: "main",
    label: "Privilege List",
    items: [
      { key: "apply", label: "APPLY LOAN", permissions: ["loans.apply"] },
      { key: "customer", label: "CUSTOMER", permissions: ["customers.view", "customers.manage"] },
      { key: "group", label: "GROUP", permissions: ["groups.view", "groups.manage"] },
      { key: "report", label: "REPORTS", permissions: ["reports.view"] },
      { key: "teller", label: "TELLER", permissions: ["payments.cash"] },
    ],
  },
  { key: "general", label: "General", items: [{ key: "dashboard", label: "DASHBOARD", permissions: ["dashboard.view"] }] },
];

const TELLER = ["dashboard.view", "payments.cash", "customers.view"];

describe("staff privileges page", () => {
  it("links the third staff action to the privileges page of that staff member (no fixed id)", () => {
    expect(staffPrivilegesHref(166)).toBe("/hrm/staff/166/privileges");
    expect(staffRowActions({ id: 3, status: "active" }, canAll)[2].href).toBe("/hrm/staff/3/privileges");
  });

  it("lists every item in API order and shows the held ones (full or partial) as assigned", () => {
    expect(privilegeRows(GROUPS).map((row) => `${row.group}:${row.key}`)).toEqual(["main:apply", "main:customer", "main:group", "main:report", "main:teller", "general:dashboard"]);

    const assigned = assignedPrivilegeRows(GROUPS, TELLER);
    expect(assigned.map((row) => row.key)).toEqual(["customer", "teller", "dashboard"]);
    expect(privilegeItemStatus(GROUPS[0].items[1], TELLER)).toEqual({ status: "partial", held: 1, total: 2 });
    expect(privilegeItemStatus(GROUPS[0].items[4], TELLER).status).toBe("full");
    expect(privilegeItemStatus(GROUPS[0].items[2], TELLER).status).toBe("none");
  });

  it("adding grants every key of the item and removing revokes every key", () => {
    const group = GROUPS[0].items[2];
    const added = withPrivilegeItem(TELLER, group, true);
    expect(added).toEqual([...TELLER, "groups.view", "groups.manage"]);
    expect(withPrivilegeItem(added, group, false)).toEqual(TELLER);
    expect(withPrivilegeItem(TELLER, GROUPS[0].items[1], true)).toEqual([...TELLER, "customers.manage"]);
    expect(privilegeChanges(TELLER, withPrivilegeItem(TELLER, GROUPS[0].items[4], false))).toEqual({ granted: [], revoked: ["payments.cash"] });
  });

  it("flags keys the administrator does not hold and tells role defaults from added privileges", () => {
    expect(privilegeKeysNotHeld(TELLER, GROUPS[0].items[2], true, ["groups.view"])).toEqual(["groups.manage"]);
    expect(privilegeKeysNotHeld(TELLER, GROUPS[0].items[4], false, ["payments.cash"])).toEqual([]);

    const role = ["dashboard.view", "payments.cash"];
    expect(privilegeItemSource(GROUPS[0].items[4], TELLER, role, [])).toBe("role");
    expect(privilegeItemSource(GROUPS[0].items[1], TELLER, role, ["customers.view"])).toBe("granted");
    expect(privilegeItemSource(GROUPS[0].items[1], ["customers.view", "customers.manage"], ["customers.view"], ["customers.manage"])).toBe("mixed");
  });

  it("saves the complete set in one request, then shows success and the server state", async () => {
    const states: string[][] = [];
    const send = vi.fn(async (permissions: string[]) => [...permissions].sort());
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const ok = await applyPrivilegeChange(TELLER, GROUPS[0].items[3], true, { send, setPermissions: (next) => states.push(next), onSuccess, onError });

    expect(ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith([...TELLER, "reports.view"]);
    expect(states).toEqual([[...TELLER, "reports.view"], [...TELLER, "reports.view"].sort()]);
    expect(onSuccess).toHaveBeenCalledWith(PRIVILEGE_MESSAGES.added);
    expect(onError).not.toHaveBeenCalled();
  });

  it("restores the previous privileges and shows the error when the save fails", async () => {
    const states: string[][] = [];
    const failure = new Error("You cannot grant or revoke privileges you do not hold: payments.cash.");
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const ok = await applyPrivilegeChange(TELLER, GROUPS[0].items[4], false, { send: () => Promise.reject(failure), setPermissions: (next) => states.push(next), onSuccess, onError });

    expect(ok).toBe(false);
    expect(states).toEqual([["dashboard.view", "customers.view"], TELLER]);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("renders with theme tokens and component classes only (no hard-coded light colours)", () => {
    const page = readFileSync(path.resolve(__dirname, "../../app/(app)/hrm/staff/[id]/privileges/page.tsx"), "utf8");
    const css = readFileSync(path.resolve(__dirname, "../../styles/app.css"), "utf8");
    const pageCss = css.slice(css.indexOf("/* Staff privileges"));

    expect(page).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|bg-white|bg-light|text-dark|table-light|style=\{\{/i);
    expect(page).toMatch(/className="btn btn-(primary|danger) btn-sm"/);
    expect(page).not.toContain("166");
    expect(page).toMatch(/<Card title="Privilege List"/);
    expect(pageCss).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
});
