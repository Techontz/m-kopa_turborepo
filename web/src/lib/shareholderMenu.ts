/**
 * Shareholder Portal shell: which shell a signed-in account gets, where it must be redirected, and the portal menu.
 *
 * - A shareholder portal login (`account_type: "shareholder"`) always gets the Shareholder shell and only /shareholder pages
 *   (staff routes redirect to the portal — the API refuses them anyway).
 * - An account that must change its temporary password is sent to the Security page first.
 * - A staff member linked to a shareholder keeps the staff shell and reaches the portal from the user menu.
 * Every portal entry carries the shareholder.* permission of the API endpoints it uses.
 */

export type Permission = string | string[];

export interface ShellUser {
  account_type?: string | null;
  must_change_password?: boolean | null;
  role: { key: string } | null;
  shareholder?: { id: number; name: string } | null;
}

export interface ShareholderLink {
  label: string;
  href: string;
  icon: string;
  permission: Permission;
}

export const SHAREHOLDER_ACCOUNT_TYPE = "shareholder";
export const PORTAL_HOME = "/shareholder";
export const SECURITY_PAGE = "/shareholder/security";

export type ShellKind = "shareholder" | "finance" | "staff";

export function isShareholderAccount(user: ShellUser | null | undefined): boolean {
  return user?.account_type === SHAREHOLDER_ACCOUNT_TYPE;
}

export function isPortalPath(pathname: string): boolean {
  return pathname === PORTAL_HOME || pathname.startsWith(`${PORTAL_HOME}/`);
}

/** Shareholder accounts get the portal shell; Finance keeps its top-bar shell; everyone else the sidebar shell. */
export function shellFor(user: ShellUser | null | undefined): ShellKind {
  if (isShareholderAccount(user)) {
    return "shareholder";
  }
  return user?.role?.key === "finance" ? "finance" : "staff";
}

/** Where the account must go instead of `pathname`, or null when it may stay. */
export function redirectFor(user: ShellUser | null | undefined, pathname: string): string | null {
  if (!user) {
    return null;
  }
  if (user.must_change_password) {
    return pathname === SECURITY_PAGE ? null : SECURITY_PAGE;
  }
  if (isShareholderAccount(user) && !isPortalPath(pathname)) {
    return PORTAL_HOME;
  }
  if (!isShareholderAccount(user) && !user.shareholder && isPortalPath(pathname)) {
    return "/dashboard";
  }
  return null;
}

export const shareholderMenu: ShareholderLink[] = [
  { label: "Dashboard", href: "/shareholder", icon: "icon-home", permission: "shareholder.portal" },
  { label: "My Capital", href: "/shareholder/capital", icon: "icon-wallet", permission: "shareholder.capital.view" },
  { label: "Add Capital", href: "/shareholder/capital/add", icon: "icon-plus", permission: "shareholder.capital.submit" },
  { label: "My Shares", href: "/shareholder/shares", icon: "icon-pie-chart", permission: "shareholder.capital.view" },
  { label: "Dividends", href: "/shareholder/dividends", icon: "icon-present", permission: "shareholder.dividends.view" },
  { label: "Reserve Approvals", href: "/shareholder/reserve-approvals", icon: "icon-check", permission: "shareholder.portal" },
  { label: "Statements", href: "/shareholder/statements", icon: "icon-doc", permission: "shareholder.statements" },
  { label: "All Shareholders", href: "/shareholder/directory", icon: "icon-people", permission: "shareholder.directory" },
  { label: "Company Shares", href: "/shareholder/company", icon: "icon-briefcase", permission: "shareholder.directory" },
  { label: "Profile", href: "/shareholder/profile", icon: "icon-user", permission: "shareholder.profile" },
  { label: "Security", href: "/shareholder/security", icon: "icon-lock", permission: [] },
];

type Can = (permission: Permission) => boolean;

/** Entries the account may open (an empty permission list = every signed-in account, e.g. Security). */
export function visibleShareholderMenu(can: Can, menu: ShareholderLink[] = shareholderMenu): ShareholderLink[] {
  return menu.filter((link) => (Array.isArray(link.permission) && link.permission.length === 0) || can(link.permission));
}

/** The single menu entry to highlight (longest matching href). */
export function activeShareholderHref(pathname: string, menu: ShareholderLink[] = shareholderMenu): string | null {
  const matches = menu
    .map((link) => link.href)
    .filter((href) => pathname === href || (href !== PORTAL_HOME && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length);
  return matches[0] ?? null;
}
