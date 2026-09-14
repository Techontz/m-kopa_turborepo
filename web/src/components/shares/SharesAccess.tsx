"use client";

import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";

/** Shares pages are shown only to users with the given share permission(s); others see a clear notice. */
export function SharesAccess({ permission = "shares.view", crumbs, children }: { permission?: string | string[]; crumbs: string[]; children: ReactNode }) {
  const { can } = useAuth();

  if (!can(permission)) {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <Card>
          <div className="alert alert-warning mb-0">You do not have permission to view this page.</div>
        </Card>
      </>
    );
  }

  return <>{children}</>;
}
