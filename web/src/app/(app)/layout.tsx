"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ShareholderTopbar } from "@/components/layout/ShareholderTopbar";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { redirectFor, shellFor } from "@/lib/shareholderMenu";
import { Loading } from "@/components/ui/Loading";

/** Pages that use the live system's orange frame and Ubuntu font (dashboard and teller screens). */
const ORANGE_THEME = ["/dashboard", "/teller/"];

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPath, setSidebarPath] = useState(pathname);
  const shareholder = shellFor(user) === "shareholder";
  const redirect = redirectFor(user, pathname);

  if (sidebarPath !== pathname) {
    setSidebarPath(pathname);
    setSidebarOpen(false);
  }

  useEffect(() => {
    if (redirect) {
      router.replace(redirect);
    }
  }, [redirect, router]);

  useEffect(() => {
    const orange = !shareholder && ORANGE_THEME.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
    document.body.classList.toggle("theme-orange", orange);
    document.body.classList.toggle("font-ubuntu", orange);
    document.body.classList.toggle("offcanvas-active", !shareholder && sidebarOpen);
    if (shareholder) {
      document.body.dataset.shell = "shareholder";
    } else {
      delete document.body.dataset.shell;
    }
  }, [pathname, sidebarOpen, shareholder]);

  if (isLoading || !user || redirect) {
    return <Loading />;
  }

  if (shareholder) {
    return (
      <div id="sh-wrapper" data-shell="shareholder">
        <ShareholderTopbar />
        <main id="sh-main">
          <div className="container-fluid">{children}</div>
        </main>
      </div>
    );
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
