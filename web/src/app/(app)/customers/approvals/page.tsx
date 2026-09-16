"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { AccessDenied } from "@/components/customers/AccessDenied";
import { CustomerAvatar, CustomerStatusBadges, Pager, formatDateTime, usePaged } from "@/components/customers/common";
import { toastError, toastSuccess } from "@/components/customers/toast";
import type { Customer } from "@/components/customers/types";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Customer registration approvals (customers.approve): approve or reject registrations awaiting a decision. */
export default function CustomerApprovalsPage() {
  const { can } = useAuth();
  const client = useQueryClient();
  const allowed = can("customers.approve");
  const [page, setPage] = useState(1);
  const [branchId, setBranchId] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const { data, isLoading } = usePaged<Customer>(allowed ? "customers/pending-approval" : null, { page, per_page: 20, branch_id: branchId || undefined });

  if (!allowed) {
    return (
      <>
        <PageHeader crumbs={["Customer", "Registration approvals"]} />
        <AccessDenied />
      </>
    );
  }

  const decide = async (customer: Customer, decision: "approve" | "reject") => {
    let body: { reason?: string } = {};
    if (decision === "approve") {
      if (!(await confirmAction(`Approve the registration of ${customer.fullName}?`))) {
        return;
      }
    } else {
      const reason = await promptReason(`Reason for rejecting ${customer.fullName}`);
      if (!reason) {
        return;
      }
      body = { reason };
    }
    setBusyId(customer.id);
    try {
      await api.post(`customers/${customer.id}/${decision}`, body);
      await client.invalidateQueries();
      toastSuccess(decision === "approve" ? `${customer.fullName} approved.` : `${customer.fullName} returned to the officer.`);
    } catch (error) {
      toastError(error instanceof ApiError ? error.firstError : "The decision could not be saved.");
    } finally {
      setBusyId(null);
    }
  };

  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader crumbs={["Customer", "Registration approvals"]} right={<Link href="/customers" className="btn btn-sm btn-outline-primary"><i className="icon-arrow-left" /> All Customer</Link>} />
      <Card title="Registration approvals">
        <div className="mf-filters">
          <SelectBox inputId="approvals-branch" placeholder="Branch: all" optionsUrl="options/branches" value={branchId} isClearable onChange={(value) => { setBranchId(value ?? ""); setPage(1); }} />
        </div>
        <div className="table-responsive">
          <table className="table table-hover table-custom mf-table">
            <thead className="thead-info">
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Branch</th>
                <th>Customer Type</th>
                <th>Registered</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="mf-loading"><Loading inline /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="text-center">No registrations are waiting for approval.</td></tr>
              ) : (
                rows.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="mf-customer-cell">
                        <CustomerAvatar customer={customer} />
                        <div>
                          <Link href={`/customers/${customer.id}`}>{customer.fullName}</Link>
                          <small>{customer.customerNumber}</small>
                        </div>
                      </div>
                    </td>
                    <td className="text-nowrap">{customer.phone}</td>
                    <td>{customer.branchName}</td>
                    <td>{customer.categoryName}</td>
                    <td className="text-nowrap">{formatDateTime(customer.createdAt)}</td>
                    <td><CustomerStatusBadges customer={customer} showAccount={false} /></td>
                    <td className="text-nowrap">
                      <button type="button" className="btn btn-sm btn-success mr-1" disabled={busyId === customer.id} onClick={() => void decide(customer, "approve")}>
                        <i className="icon-check" /> Approve
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-danger" disabled={busyId === customer.id} onClick={() => void decide(customer, "reject")}>
                        <i className="icon-close" /> Reject
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager meta={data?.meta} onPage={setPage} />
      </Card>
    </>
  );
}
