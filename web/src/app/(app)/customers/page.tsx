"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { AccessDenied } from "@/components/customers/AccessDenied";
import { CustomerAvatar, CustomerStatusBadges, Pager, usePaged } from "@/components/customers/common";
import { CUSTOMER_TYPE_FILTER, CUSTOMER_TYPE_LABEL, CUSTOMER_TYPES_ENDPOINT, customerTypeOptions } from "@/components/customers/customerTypes";
import type { Customer, CustomerType } from "@/components/customers/types";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

interface Filters {
  search: string;
  kyc_status: string;
  status: string;
  approval_status: string;
  loan_eligible: string;
  branch_id: string;
  customer_category_id: string;
  include_deleted: boolean;
}

const EMPTY: Filters = { search: "", kyc_status: "", status: "", approval_status: "", loan_eligible: "", branch_id: "", customer_category_id: "", include_deleted: false };

/** Customer → All Customer: server-paginated, searchable, branch-scoped list (CUSTOMER_MODULE_SPEC §1.2). */
export default function AllCustomersPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allowed = can("customers.view");

  const { data, isLoading, isFetching } = usePaged<Customer>(allowed ? "customers" : null, { ...filters, include_deleted: filters.include_deleted ? 1 : undefined, page, per_page: perPage });
  const { data: types } = useApi<CustomerType[]>(allowed ? CUSTOMER_TYPES_ENDPOINT : null);
  const remove = useAction<{ id: number }>("delete", (body) => `customers/${body.id}`);

  if (!allowed) {
    return (
      <>
        <PageHeader crumbs={["Customer", "All Customer"]} />
        <AccessDenied />
      </>
    );
  }

  const setFilter = (patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const onSearch = (value: string) => {
    setSearchText(value);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setFilter({ search: value.trim() }), 350);
  };

  const rows = data?.data ?? [];

  return (
    <>
      <PageHeader crumbs={["Customer", "All Customer"]} />

      <Card
        title="All Customer"
        actions={
          <span className="d-inline-flex flex-wrap" style={{ gap: 6 }}>
            {can("customers.approve") && (
              <Link href="/customers/approvals" className="btn btn-sm btn-outline-primary">
                <i className="icon-check" /> Registration approvals
              </Link>
            )}
            {can("customers.manage") && (
              <Link href="/customers/register" className="btn btn-sm btn-primary">
                <i className="icon-user-follow" /> Register Customer
              </Link>
            )}
          </span>
        }
      >
        <div className="mf-filters">
          <input type="search" className="form-control" placeholder="Search by name, customer number or phone…" value={searchText} onChange={(event) => onSearch(event.target.value)} aria-label="Search" />
          <select className="form-control" value={filters.kyc_status} onChange={(event) => setFilter({ kyc_status: event.target.value })} aria-label="KYC status">
            <option value="">KYC: all</option>
            <option value="completed">KYC complete</option>
            <option value="incomplete">KYC incomplete</option>
          </select>
          <select className="form-control" value={filters.status} onChange={(event) => setFilter({ status: event.target.value })} aria-label="Status">
            <option value="">Status: all</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="frozen">Frozen</option>
          </select>
          <select className="form-control" value={filters.approval_status} onChange={(event) => setFilter({ approval_status: event.target.value })} aria-label="Approval status">
            <option value="">Approval: all</option>
            <option value="pending">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="not_required">Not required</option>
          </select>
          <select className="form-control" value={filters.loan_eligible} onChange={(event) => setFilter({ loan_eligible: event.target.value })} aria-label="Loan eligibility">
            <option value="">Loan eligibility: all</option>
            <option value="1">Loan eligible</option>
            <option value="0">Not loan eligible</option>
          </select>
          <SelectBox inputId="filter-branch" placeholder="Branch: all" optionsUrl="options/branches" value={filters.branch_id} isClearable onChange={(value) => setFilter({ branch_id: value ?? "" })} />
          <label htmlFor={CUSTOMER_TYPE_FILTER.inputId} className="sr-only">{CUSTOMER_TYPE_FILTER.label}</label>
          <SelectBox
            inputId={CUSTOMER_TYPE_FILTER.inputId}
            placeholder={CUSTOMER_TYPE_FILTER.placeholder}
            options={customerTypeOptions(types)}
            value={filters.customer_category_id}
            isClearable
            onChange={(value) => setFilter({ customer_category_id: value ?? "" })}
          />
          <label className="d-flex align-items-center mb-0" style={{ gap: 6 }}>
            <input type="checkbox" checked={filters.include_deleted} onChange={(event) => setFilter({ include_deleted: event.target.checked })} /> Include deleted
          </label>
        </div>

        <div className="table-responsive">
          <table className="table table-hover table-custom mf-table">
            <thead className="thead-info">
              <tr>
                <th>Customer</th>
                <th>Date of Birth</th>
                <th>Age</th>
                <th>Gender</th>
                <th>{CUSTOMER_TYPE_LABEL}</th>
                <th>Phone</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="mf-loading">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9} className="text-center">No customers match these filters.</td></tr>
              ) : (
                rows.map((customer) => (
                  <tr key={customer.id} style={{ opacity: isFetching ? 0.7 : 1 }}>
                    <td>
                      <div className="mf-customer-cell">
                        <CustomerAvatar customer={customer} />
                        <div>
                          <Link href={`/customers/${customer.id}`}>{customer.fullName}</Link>
                          <small>{customer.customerNumber}</small>
                        </div>
                      </div>
                    </td>
                    <td className="text-nowrap">{customer.dob ?? ""}</td>
                    <td>{customer.age ?? ""}</td>
                    <td className="text-capitalize">{customer.gender ?? ""}</td>
                    <td>{customer.categoryName ?? ""}</td>
                    <td className="text-nowrap">{customer.phone}</td>
                    <td>{customer.branchName ?? ""}</td>
                    <td><CustomerStatusBadges customer={customer} /></td>
                    <td className="text-nowrap">
                      <Link href={`/customers/${customer.id}`} className="btn btn-sm btn-icon btn-primary mr-1" title="View" aria-label={`View ${customer.fullName}`}><i className="icon-eye" /></Link>
                      {can("customers.manage") && !customer.deletedAt && (
                        <button type="button" className="btn btn-sm btn-icon btn-danger" title="Delete" aria-label={`Delete ${customer.fullName}`} onClick={async () => (await confirmAction()) && remove.mutate({ id: customer.id })}>
                          <i className="icon-trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager meta={data?.meta} onPage={setPage} perPage={perPage} onPerPage={(size) => { setPerPage(size); setPage(1); }} />
      </Card>
    </>
  );
}
