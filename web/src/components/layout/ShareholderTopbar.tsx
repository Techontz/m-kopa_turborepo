"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { activeShareholderHref, visibleShareholderMenu } from "@/lib/shareholderMenu";

/**
 * Shareholder Portal top bar (same bar design as the Head Office shell): brand, the portal links the account may open,
 * the shareholder's name, theme toggle and logout. Collapses to a menu button below 992px.
 */
export function ShareholderTopbar() {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [syncedPath, setSyncedPath] = useState(pathname);

  if (syncedPath !== pathname) {
    setSyncedPath(pathname);
    setOpen(false);
  }

  const links = useMemo(
    () => (user?.must_change_password ? visibleShareholderMenu(can).filter((link) => link.href === "/shareholder/security") : visibleShareholderMenu(can)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  );
  const active = activeShareholderHref(pathname, links);

  return (
    <header className="fin-header sh-header" data-testid="shareholder-header">
      <Link href="/shareholder" className="fin-brand" aria-label="Shareholder portal home">M-KOPA <small className="sh-brand-sub">Shareholders</small></Link>

      <button type="button" className="fin-nav-toggle" aria-expanded={open} aria-controls="sh-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((value) => !value)}>
        <i className={open ? "fa fa-times" : "fa fa-bars"} />
      </button>

      <nav id="sh-nav" className={`fin-nav ${open ? "is-open" : ""}`} aria-label="Shareholder menu">
        <ul className="fin-menu">
          {links.map((link, index) => (
            <li key={link.href} className="fin-menu-row">
              {index > 0 && <span className="fin-sep" aria-hidden="true">|</span>}
              <div className={`fin-item ${active === link.href ? "is-active" : ""}`}>
                <Link href={link.href} className="fin-link" aria-current={active === link.href ? "page" : undefined}>
                  <i className={`${link.icon} sh-link-icon`} aria-hidden="true" /> {link.label}
                </Link>
              </div>
            </li>
          ))}
          <li className="fin-menu-row fin-user-row">
            <span className="fin-sep" aria-hidden="true">|</span>
            <div className="fin-item">
              <span className="sh-user" title={user?.full_name}><i className="icon-user" aria-hidden="true" /> {user?.shareholder?.name ?? user?.full_name}</span>
            </div>
            <div className="fin-item">
              <button type="button" className="fin-link" onClick={logout}><i className="icon-power" aria-hidden="true" /> Logout</button>
            </div>
            <ThemeToggle className="fin-theme-toggle" />
          </li>
        </ul>
      </nav>
    </header>
  );
}
