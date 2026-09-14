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

/* ---------------------------------------------------------------------------------------------------------------------
 * Privilege page (live admin/privillage/{id}): "Privilege List" with Add buttons and "Privileges For (name)" with
 * remove buttons. The structure (groups → items → permission keys) comes from the API (config/permissions.php).
 * ------------------------------------------------------------------------------------------------------------------ */

export interface PrivilegeItem {
  key: string;
  label: string;
  permissions: string[];
}

export interface PrivilegeGroup {
  key: string;
  label: string;
  items: PrivilegeItem[];
}

export type PrivilegeItemStatus = "full" | "partial" | "none";

/** Whether the employee holds all, some or none of an item's permission keys. */
export function privilegeItemStatus(item: PrivilegeItem, permissions: string[]): { status: PrivilegeItemStatus; held: number; total: number } {
  const held = item.permissions.filter((key) => permissions.includes(key)).length;
  const total = item.permissions.length;
  return { status: held === 0 ? "none" : held === total ? "full" : "partial", held, total };
}

export interface PrivilegeRow extends PrivilegeItem {
  group: string;
  groupLabel: string;
}

/** Every item of every group, in the configured order (the live list first). */
export function privilegeRows(groups: PrivilegeGroup[]): PrivilegeRow[] {
  return groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.key, groupLabel: group.label })));
}

/** Items the employee holds at least partly — the "Privileges For (name)" table. */
export function assignedPrivilegeRows(groups: PrivilegeGroup[], permissions: string[]): PrivilegeRow[] {
  return privilegeRows(groups).filter((item) => privilegeItemStatus(item, permissions).status !== "none");
}

/** The effective permission set after adding (all keys) or removing (all keys) one item. */
export function withPrivilegeItem(permissions: string[], item: PrivilegeItem, add: boolean): string[] {
  return add ? [...permissions, ...item.permissions.filter((key) => !permissions.includes(key))] : permissions.filter((key) => !item.permissions.includes(key));
}

/** Keys this change would grant or revoke that the signed-in administrator does not hold (the API refuses those). */
export function privilegeKeysNotHeld(permissions: string[], item: PrivilegeItem, add: boolean, actorPermissions: string[]): string[] {
  const next = withPrivilegeItem(permissions, item, add);
  const { granted, revoked } = privilegeChanges(permissions, next);
  return [...granted, ...revoked].filter((key) => !actorPermissions.includes(key));
}

export type PrivilegeItemSource = "role" | "granted" | "mixed";

/** Where the held part of an item comes from: the role, per-employee grants, or both. */
export function privilegeItemSource(item: PrivilegeItem, permissions: string[], rolePermissions: string[], granted: string[]): PrivilegeItemSource {
  const sources = new Set(item.permissions.filter((key) => permissions.includes(key)).map((key) => (granted.includes(key) || !rolePermissions.includes(key) ? "granted" : "role")));
  return sources.size > 1 ? "mixed" : sources.has("granted") ? "granted" : "role";
}

export const PRIVILEGE_MESSAGES = {
  added: "Privilege Added successfully",
  removed: "Privilege Removed successfully",
  confirmRemove: "Are you sure?",
} as const;

export interface PrivilegeChangeDeps {
  /** PUT the complete effective set; resolves with the server's saved set. */
  send: (permissions: string[]) => Promise<string[]>;
  /** Local selection setter (optimistic update, then server state or the previous state on error). */
  setPermissions: (permissions: string[]) => void;
  onSuccess: (message: string) => void;
  onError: (error: unknown) => void;
}

/**
 * Add or remove one item: optimistic update, one atomic PUT of the whole set, then the server's saved set on success
 * or the previous set (and an error alert) on failure.
 */
export async function applyPrivilegeChange(saved: string[], item: PrivilegeItem, add: boolean, deps: PrivilegeChangeDeps): Promise<boolean> {
  const next = withPrivilegeItem(saved, item, add);
  deps.setPermissions(next);
  try {
    deps.setPermissions(await deps.send(next));
    deps.onSuccess(add ? PRIVILEGE_MESSAGES.added : PRIVILEGE_MESSAGES.removed);
    return true;
  } catch (error) {
    deps.setPermissions(saved);
    deps.onError(error);
    return false;
  }
}
