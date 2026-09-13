"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { AccessDenied } from "@/components/customers/AccessDenied";
import { CustomerAvatar, CustomerStatusBadges, usePaged } from "@/components/customers/common";
import type { Customer } from "@/components/customers/types";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";

/** Customer → Customer Profile: look a customer up, then open the profile. */
export default function CustomerSearchPage() {
  const { can } = useAuth();
  const allowed = can("customers.view");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data, isFetching } = usePaged<Customer>(allowed && search.length >= 2 ? "customers" : null, { search, per_page: 15 });

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

  const results = search.length >= 2 ? data?.data ?? [] : [];

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
          {search.length >= 2 && (
            <ul className="mf-search-results" aria-busy={isFetching}>
              {results.length === 0 && !isFetching && <li className="text-muted p-2">No customer matches “{search}”.</li>}
              {results.map((customer) => (
                <li key={customer.id}>
                  <Link href={`/customers/${customer.id}`}>
                    <span className="mf-customer-cell">
                      <CustomerAvatar customer={customer} />
                      <span>
                        {customer.fullName}
                        <small>{[customer.customerNumber, customer.phone, customer.branchName].filter(Boolean).join(" · ")}</small>
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
