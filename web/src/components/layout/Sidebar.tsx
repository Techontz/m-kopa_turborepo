"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/auth";
import { menu, type MenuItem, type MenuLink } from "@/lib/menu";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, can, logout } = useAuth();

  const allowed = (entry: MenuItem | MenuLink) => !entry.permission || can(entry.permission);

  const tabs = useMemo(
    () =>
      menu
        .map((tab) => ({
          ...tab,
          items: tab.items
            .map((item) => (item.children ? { ...item, children: item.children.filter(allowed) } : item))
            .filter((item) => allowed(item) && (!item.children || item.children.length > 0)),
        }))
        .filter((tab) => tab.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  );

  const tabForPath =
    tabs.find((tab) => tab.items.some((item) => (item.href && isActive(pathname, item.href)) || item.children?.some((child) => isActive(pathname, child.href))))?.key ??
    tabs[0]?.key;

  const [activeTab, setActiveTab] = useState<string | undefined>(tabForPath);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    setActiveTab(tabForPath);
    const group = tabs.flatMap((tab) => tab.items).find((item) => item.children?.some((child) => isActive(pathname, child.href)));
    setOpenGroup(group?.label ?? null);
  }, [pathname, tabForPath, tabs]);

  return (
    <div id="left-sidebar" className="sidebar">
      <div className="sidebar-scroll">
        <div className="user-account">
          <div className={`dropdown ${accountMenuOpen ? "show" : ""}`}>
            <a href="#" className="dropdown-toggle user-name" onClick={(e) => { e.preventDefault(); setAccountMenuOpen(!accountMenuOpen); }}>
              <strong>{user?.company.name.toUpperCase()}</strong>
            </a>
            <ul className={`dropdown-menu account list-unstyled ${accountMenuOpen ? "show" : ""}`}>
              <li><a href="#" onClick={(e) => e.preventDefault()}><i className="icon-user" />{user?.full_name}</a></li>
              <li><a href="#" onClick={(e) => e.preventDefault()}><i className="icon-badge" />{user?.role?.name}{user?.branch ? ` · ${user.branch.name}` : ""}</a></li>
              <li><Link href="/settings/company"><i className="icon-settings" />Settings</Link></li>
              <li className="divider" />
              <li><a href="#" onClick={(e) => { e.preventDefault(); logout(); }}><i className="icon-power" />Logout</a></li>
            </ul>
          </div>
        </div>

        <ul className="nav nav-tabs">
          {tabs.map((tab) => (
            <li className="nav-item" key={tab.key}>
              <a href="#" className={`nav-link ${activeTab === tab.key ? "active" : ""}`} onClick={(e) => { e.preventDefault(); setActiveTab(tab.key); }}>
                {tab.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="tab-content p-l-0 p-r-0">
          {tabs.map((tab) => (
            <div className={`tab-pane ${activeTab === tab.key ? "active" : ""}`} key={tab.key} style={{ display: activeTab === tab.key ? "block" : "none" }}>
              <nav className="sidebar-nav">
                <ul className="metismenu">
                  {tab.items.map((item) =>
                    item.children ? (
                      <li key={item.label} className={`${openGroup === item.label ? "open" : ""} ${item.children.some((child) => isActive(pathname, child.href)) ? "active" : ""}`}>
                        <a href="#" className="has-arrow" onClick={(e) => { e.preventDefault(); setOpenGroup(openGroup === item.label ? null : item.label); }}>
                          <i className={item.icon} /> <span>{item.label}</span>
                        </a>
                        <ul className="collapse">
                          {item.children.map((child) => (
                            <li key={child.href} className={isActive(pathname, child.href) ? "active" : ""}>
                              <Link href={child.href}>{child.label}</Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ) : (
                      <li key={item.label} className={item.href && isActive(pathname, item.href) ? "active" : ""}>
                        <Link href={item.href ?? "#"}>
                          <i className={item.icon} /> <span>{item.label}</span>
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </nav>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
