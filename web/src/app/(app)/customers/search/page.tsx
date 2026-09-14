"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { AccessDenied } from "@/components/customers/AccessDenied";
import { CustomerAvatar, CustomerStatusBadges, usePaged } from "@/components/customers/common";
import { CUSTOMER_TYPE_FILTER, CUSTOMER_TYPES_ENDPOINT, customerTypeOptions } from "@/components/customers/customerTypes";
import type { Customer, CustomerType } from "@/components/customers/types";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";

/** Customer → Customer Profile: look a customer up, then open the profile. */
export default function CustomerSearchPage() {
  const { can } = useAuth();
  const allowed = can("customers.view");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searching = search.length >= 2 || typeId !== "";
  const { data, isFetching } = usePaged<Customer>(allowed && searching ? "customers" : null, { search, customer_category_id: typeId || undefined, per_page: 15 });
  const { data: types } = useApi<CustomerType[]>(allowed ? CUSTOMER_TYPES_ENDPOINT : null);

  if (!allowed) {
    return (
      <>
        <PageHeader crumbs={["Customer", "Customer Profile"]} />
        <AccessDenied />
      </>
    );
  }

  const onChange = (value: string) => {
    setText(value);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setSearch(value.trim()), 300);
  };

  const results = searching ? data?.data ?? [] : [];

  return (
    <>
      <PageHeader crumbs={["Customer", "Customer Profile"]} />
      <Card title="Search customer">
        <div className="mf-search-box">
          <p className="text-muted mb-2">Look a customer up to see what the system holds on them.</p>
          <input
            type="search"
            className="form-control"
            placeholder="Search by name, customer number or phone…"
            value={text}
            onChange={(event) => onChange(event.target.value)}
            aria-label="Search customer"
            autoComplete="off"
            autoFocus
          />
          <div className="mt-2">
            <label htmlFor={CUSTOMER_TYPE_FILTER.inputId} className="sr-only">{CUSTOMER_TYPE_FILTER.label}</label>
            <SelectBox inputId={CUSTOMER_TYPE_FILTER.inputId} placeholder={CUSTOMER_TYPE_FILTER.placeholder} options={customerTypeOptions(types)} value={typeId} isClearable onChange={(value) => setTypeId(value ?? "")} />
          </div>
          {searching && (
            <ul className="mf-search-results" aria-busy={isFetching}>
              {results.length === 0 && !isFetching && <li className="text-muted p-2">{search.length >= 2 ? `No customer matches “${search}”.` : "No customer of this customer type."}</li>}
              {results.map((customer) => (
                <li key={customer.id}>
                  <Link href={`/customers/${customer.id}`}>
                    <span className="mf-customer-cell">
                      <CustomerAvatar customer={customer} />
                      <span>
                        {customer.fullName}
                        <small>{[customer.customerNumber, customer.phone, customer.branchName, customer.categoryName].filter(Boolean).join(" · ")}</small>
                      </span>
                    </span>
                    <CustomerStatusBadges customer={customer} showAccount={false} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}
