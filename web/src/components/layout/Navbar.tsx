"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SelectBox } from "@/components/ui/SelectBox";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/lib/auth";

export function Navbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const router = useRouter();
  const { logout, can } = useAuth();

  return (
    <nav className="navbar navbar-fixed-top">
      <div className="navbar-btn">
        <button type="button" className="btn-toggle-offcanvas" onClick={onToggleSidebar}>
          <i className="icon-list" />
        </button>
      </div>
      <div className="navbar-brand">
        <Link href="/dashboard" className="mf-brand-link">
          <span className="mf-brand" aria-label="M-KOPA">M-KOPA</span>
        </Link>
      </div>
      <div className="navbar-right">
        <form id="navbar-search" onSubmit={(event) => event.preventDefault()}>
          {can("customers.view") && (
            <SelectBox
              placeholder="Select customer"
              optionsUrl="options/customers"
              onChange={(value) => value && router.push(`/customers/${value}`)}
              width={300}
            />
          )}
        </form>
        <div id="navbar-menu">
          <ul className="nav navbar-nav">
            <li><a href="#" className="icon-menu d-none d-sm-block d-md-none d-lg-block" onClick={(e) => e.preventDefault()}><i className="icon-calendar" /></a></li>
            <li><Link href="/messages" className="icon-menu d-none d-sm-block"><i className="icon-bubbles" /></Link></li>
            <li><a href="#" className="icon-menu d-none d-sm-block" onClick={(e) => e.preventDefault()}><i className="icon-envelope" /><span className="notification-dot" /></a></li>
            <li><a href="#" className="icon-menu" onClick={(e) => e.preventDefault()}><i className="icon-bell" /><span className="notification-dot" /></a></li>
            <li><ThemeToggle /></li>
            <li><Link href="/settings/company" className="icon-menu d-none d-sm-block"><i className="icon-equalizer" /></Link></li>
            <li>
              <button type="button" className="icon-menu btn btn-link" style={{ padding: 15 }} onClick={logout} title="Logout">
                <i className="icon-login" />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
