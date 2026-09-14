"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/auth";

interface SharesNavLink {
  label: string;
  href: string;
  permission: string;
  /** Other path prefixes that belong to this tab. */
  matches?: string[];
}

export const SHARES_NAV: SharesNavLink[] = [
  { label: "Overview", href: "/shares", permission: "shares.view", matches: ["/shares/setup"] },
  { label: "Shareholders", href: "/shares/share-holders", permission: "shares.view" },
  { label: "Share Register", href: "/shares/register", permission: "shares.view" },
  { label: "Share Transactions", href: "/shares/transactions", permission: "shares.view" },
  { label: "Share Valuations", href: "/shares/valuations", permission: "shares.view" },
  { label: "Issue Shares", href: "/shares/issue", permission: "shares.issue" },
  { label: "Transfer Shares", href: "/shares/transfer", permission: "shares.transfer" },
  { label: "Share History", href: "/shares/history", permission: "shares.view" },
  { label: "Share Reports", href: "/reports/shares/ownership", permission: "shares.view", matches: ["/reports/shares"] },
];

/** Whether a Shares tab is the current page (Overview only on /shares itself; others also on their sub-pages). */
export function isSharesTabActive(pathname: string, link: Pick<SharesNavLink, "href" | "matches">): boolean {
  if (pathname === link.href || (link.matches ?? []).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }
  return link.href !== "/shares" && pathname.startsWith(`${link.href}/`);
}

/** Sub-navigation shown at the top of every Shares page (the sidebar has one "Shares" link under Capital). */
export function SharesNav() {
  const pathname = usePathname();
  const { can } = useAuth();

  return (
    <div className="card">
      <div className="body py-2">
        <ul className="nav nav-tabs-new profile-tabs" aria-label="Shares">
          {SHARES_NAV.filter((link) => can(link.permission)).map((link) => {
            const active = isSharesTabActive(pathname, link);
            return (
              <li className="nav-item my-1" key={link.href}>
                <Link href={link.href} className={`nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
