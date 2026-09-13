"use client";

import { AccessDenied } from "@/components/customers/AccessDenied";
import { RegisterWizard } from "@/components/customers/wizard/RegisterWizard";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";

/** Customer → Register Customer: the 4-step registration wizard (customers.manage). */
export default function RegisterCustomerPage() {
  const { can } = useAuth();

  return (
    <>
      <PageHeader crumbs={["Customer", "Register Customer"]} />
      {can("customers.manage") ? <RegisterWizard /> : <AccessDenied />}
    </>
  );
}
