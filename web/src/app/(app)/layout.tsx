"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";

/** Pages that use the live system's orange frame and Ubuntu font (dashboard and teller screens). */
const ORANGE_THEME = ["/dashboard", "/teller/"];

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoading, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPath, setSidebarPath] = useState(pathname);

  if (sidebarPath !== pathname) {
    setSidebarPath(pathname);
    setSidebarOpen(false);
  }

  useEffect(() => {
    const orange = ORANGE_THEME.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
    document.body.classList.toggle("theme-orange", orange);
    document.body.classList.toggle("font-ubuntu", orange);
    document.body.classList.toggle("offcanvas-active", sidebarOpen);
  }, [pathname, sidebarOpen]);

  if (isLoading || !user) {
    return <div className="mf-loading" style={{ marginTop: 120 }}>Loading...</div>;
  }

  return (
    <div id="wrapper">
      <Navbar onToggleSidebar={() => setSidebarOpen((open) => !open)} />
      <Sidebar />
      <div id="main-content">
        <div className="container-fluid">{children}</div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}
