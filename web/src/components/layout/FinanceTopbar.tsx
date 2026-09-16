"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { activeFinanceHref, activeFinanceItem, financeMenu, visibleFinanceMenu, visibleUserLinks } from "@/lib/financeMenu";

const USER_MENU = "__user__";

/** Desktop pointer: dropdowns open on hover like the live CSS menu; touch and small screens use click/tap. */
function hoverCapable(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (min-width: 992px)").matches;
}

/**
 * Head Office top bar for the Finance role: red full-width bar, M-KOPA brand on the bar, a horizontal menu with "|" separators
 * and dark dropdown panels, the user item (name with icon) with its own dropdown, and the theme toggle. Collapses to a toggle
 * button below 992px.
 */
export function FinanceTopbar() {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [syncedPath, setSyncedPath] = useState(pathname);
  const barRef = useRef<HTMLElement>(null);

  // Close everything when the route changes.
  if (syncedPath !== pathname) {
    setSyncedPath(pathname);
    setOpenKey(null);
    setMobileOpen(false);
  }

  const items = useMemo(
    () => visibleFinanceMenu(financeMenu, can),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  );
  const userLinks = useMemo(
    () => visibleUserLinks(can),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  );
  const activeItem = activeFinanceItem(items, pathname);
  const activeHref = activeFinanceHref(items, pathname);

  useEffect(() => {
    if (!openKey && !mobileOpen) {
      return;
    }
    const onPointer = (event: globalThis.MouseEvent | TouchEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setOpenKey(null);
        setMobileOpen(false);
      }
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        const key = openKey;
        setOpenKey(null);
        if (key) {
          barRef.current?.querySelector<HTMLElement>(`[data-menu-key="${CSS.escape(key)}"]`)?.focus();
        }
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openKey, mobileOpen]);

  /**
   * A mouse click on a hover-capable desktop always follows the hover that already opened the panel, so it keeps it open
   * (the panel closes on mouse leave, outside click or Escape). Keyboard (detail 0) and touch clicks toggle.
   */
  const closeAll = () => {
    setOpenKey(null);
    setMobileOpen(false);
  };

  const toggle = (key: string, event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail > 0 && hoverCapable()) {
      setOpenKey(key);
      return;
    }
    setOpenKey((current) => (current === key ? null : key));
  };

  const onTriggerKey = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpenKey(key);
      requestAnimationFrame(() => {
        barRef.current?.querySelector<HTMLElement>(`[data-panel-key="${CSS.escape(key)}"] a, [data-panel-key="${CSS.escape(key)}"] button`)?.focus();
      });
    }
  };

  const onPanelKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a, button"));
    const index = links.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? Math.min(links.length - 1, index + 1) : Math.max(0, index - 1);
    links[next]?.focus();
  };

  const hoverProps = (key: string) => ({
    onMouseEnter: () => hoverCapable() && setOpenKey(key),
    onMouseLeave: () => hoverCapable() && setOpenKey((current) => (current === key ? null : current)),
  });

  return (
    <header className="fin-header" ref={barRef} data-testid="finance-header">
      <Link href="/dashboard" className="fin-brand" aria-label="M-KOPA home" onClick={closeAll}>M-KOPA</Link>

      <button
        type="button"
        className="fin-nav-toggle"
        aria-expanded={mobileOpen}
        aria-controls="fin-nav"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        onClick={() => setMobileOpen((open) => !open)}
      >
        <i className={mobileOpen ? "fa fa-times" : "fa fa-bars"} />
      </button>

      <nav id="fin-nav" className={`fin-nav ${mobileOpen ? "is-open" : ""}`} aria-label="Main menu">
        <ul className="fin-menu">
          {items.map((item, index) => {
            const isOpen = openKey === item.label;
            const isActive = activeItem === item.label;
            return (
              <li key={item.label} className="fin-menu-row">
                {index > 0 && <span className="fin-sep" aria-hidden="true">|</span>}
                <div className={`fin-item ${isActive ? "is-active" : ""} ${isOpen ? "is-open" : ""}`} {...(item.children ? hoverProps(item.label) : {})}>
                  {item.href ? (
                    <Link href={item.href} className="fin-link" onClick={closeAll} aria-current={isActive ? "page" : undefined}>{item.label}</Link>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="fin-link"
                        data-menu-key={item.label}
                        aria-haspopup="true"
                        aria-expanded={isOpen}
                        onClick={(event) => toggle(item.label, event)}
                        onKeyDown={(event) => onTriggerKey(event, item.label)}
                      >
                        {item.label}
                        <i className="fa fa-angle-down fin-caret" aria-hidden="true" />
                      </button>
                      <ul className="fin-dropdown" data-panel-key={item.label} hidden={!isOpen} onKeyDown={onPanelKey}>
                        {item.children?.map((child) => (
                          <li key={child.href + child.label}>
                            <Link href={child.href} onClick={closeAll} className={activeHref === child.href && isActive ? "is-current" : ""} aria-current={activeHref === child.href && isActive ? "page" : undefined}>
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </li>
            );
          })}

          <li className="fin-menu-row fin-user-row">
            <span className="fin-sep" aria-hidden="true">|</span>
            <div className={`fin-item fin-user ${openKey === USER_MENU ? "is-open" : ""}`} {...hoverProps(USER_MENU)}>
              <button
                type="button"
                className="fin-link"
                data-menu-key={USER_MENU}
                aria-haspopup="true"
                aria-expanded={openKey === USER_MENU}
                onClick={(event) => toggle(USER_MENU, event)}
                onKeyDown={(event) => onTriggerKey(event, USER_MENU)}
              >
                <i className="icon-user" aria-hidden="true" /> {user?.full_name}
              </button>
              <ul className="fin-dropdown fin-dropdown-user" data-panel-key={USER_MENU} hidden={openKey !== USER_MENU} onKeyDown={onPanelKey}>
                <li className="fin-dropdown-meta">
                  {user?.role?.name}
                  {user?.branch ? ` · ${user.branch.name}` : ""}
                </li>
                {userLinks.map((link) => (
                  <li key={link.href}><Link href={link.href} onClick={closeAll}>{link.label}</Link></li>
                ))}
                <li>
                  <button type="button" onClick={logout}><i className="icon-power" aria-hidden="true" /> Logout</button>
                </li>
              </ul>
            </div>
            <ThemeToggle className="fin-theme-toggle" />
          </li>
        </ul>
      </nav>
    </header>
  );
}
