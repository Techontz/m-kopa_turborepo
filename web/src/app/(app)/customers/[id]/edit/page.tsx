"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { AccessDenied } from "@/components/customers/AccessDenied";
import type { Customer } from "@/components/customers/types";
import { RegisterWizard } from "@/components/customers/wizard/RegisterWizard";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";

/** Customer → Edit: the registration wizard's details steps, filled with the customer's current values (customers.manage or customers.edit). */
export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const allowed = can("customers.manage") || can("customers.edit");
  const { data: customer, isLoading, error } = useApi<Customer>(allowed ? `customers/${id}` : null);
  const crumbs = ["Customer", customer?.fullName ?? `#${id}`, "Edit Details"];
  const back = <Link href={`/customers/${id}`} className="btn btn-secondary"><i className="icon-arrow-left" /> Profile</Link>;

  if (!allowed) {
    return (
      <>
        <PageHeader crumbs={crumbs} />
        <AccessDenied />
      </>
    );
  }

  if (!customer) {
    return (
      <>
        <PageHeader crumbs={crumbs} right={back} />
        <Card>{isLoading ? <Loading inline /> : <p className="mb-0 text-center">{error instanceof ApiError && error.status === 404 ? "Customer not found" : "The customer could not be loaded."}</p>}</Card>
      </>
    );
  }

  if (customer.deletedAt) {
    return (
      <>
        <PageHeader crumbs={crumbs} right={back} />
        <Card><p className="mb-0 text-center">This customer has been deleted and cannot be edited.</p></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader crumbs={crumbs} right={back} />
      {/* Keyed by id so moving between customers starts from the other customer's values. */}
      <RegisterWizard key={customer.id} editing={customer} />
    </>
  );
}
