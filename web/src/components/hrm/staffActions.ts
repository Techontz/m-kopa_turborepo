/**
 * HRM → All Active Staff row actions (live admin/all_employee): View, Block/Un Block, Privilege, Delete, Reject,
 * Reset password — in the live order, filtered by the signed-in user's permissions.
 */

export type StaffRowActionKey = "view" | "block" | "unblock" | "privileges" | "delete" | "reject" | "reset-password";

export interface StaffRowAction {
  key: StaffRowActionKey;
  title: string;
  icon: string;
  tone: "primary" | "success" | "danger" | "info" | "warning";
  /** Navigation target for link actions; button actions have none. */
  href?: string;
}

export type Can = (permission: string | string[]) => boolean;

export function staffPrivilegesHref(id: number): string {
  return `/hrm/staff/${id}/privileges`;
}

export function staffRowActions(row: { id: number; status: string }, can: Can): StaffRowAction[] {
  const actions: StaffRowAction[] = [{ key: "view", title: "View", icon: "icon-eye", tone: "primary", href: `/hrm/staff/${row.id}` }];
  const manageUsers = can("users.manage");

  if (manageUsers) {
    actions.push(row.status === "blocked"
      ? { key: "unblock", title: "Un Block", icon: "icon-key", tone: "success" }
      : { key: "block", title: "Block", icon: "icon-lock", tone: "danger" });
  }
  if (can(["hrm.staff_privileges", "users.manage", "hrm.manage"])) {
    actions.push({ key: "privileges", title: "Privilege", icon: "icon-arrow-right", tone: "info", href: staffPrivilegesHref(row.id) });
  }
  if (manageUsers) {
    actions.push({ key: "delete", title: "Delete", icon: "icon-trash", tone: "danger" });
    actions.push({ key: "reject", title: "Reject", icon: "icon-close", tone: "danger" });
  }
  if (can("hrm.staff_reset_password")) {
    actions.push({ key: "reset-password", title: "Reset password", icon: "icon-key", tone: "warning" });
  }

  return actions;
}

export interface PermissionItem {
  key: string;
  label: string;
  group: string;
}

/** Catalogue grouped by module prefix, in config order (same grouping as Settings → Roles & Permissions). */
export function groupPermissions(catalogue: PermissionItem[]): [string, PermissionItem[]][] {
  const groups = new Map<string, PermissionItem[]>();
  catalogue.forEach((permission) => groups.set(permission.group, [...(groups.get(permission.group) ?? []), permission]));
  return [...groups.entries()];
}

/** Keys added to / removed from the saved effective set. */
export function privilegeChanges(saved: string[], selected: string[]): { granted: string[]; revoked: string[] } {
  return {
    granted: selected.filter((key) => !saved.includes(key)),
    revoked: saved.filter((key) => !selected.includes(key)),
  };
}

export type PrivilegeSource = "role" | "granted" | "revoked" | "none";

/** Where a key's current state comes from: the role, a per-employee grant, a per-employee revocation, or nothing. */
export function privilegeSource(key: string, rolePermissions: string[], granted: string[], revoked: string[]): PrivilegeSource {
  if (granted.includes(key)) return "granted";
  if (revoked.includes(key)) return "revoked";
  return rolePermissions.includes(key) ? "role" : "none";
}
