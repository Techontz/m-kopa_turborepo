"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { api, backendUrl, type Query } from "@/lib/api";

import type { Customer, PageMeta } from "./types";

/** Server-paginated GET returning `{ data, meta: { currentPage, lastPage, perPage, total } }`. */
export function usePaged<T>(path: string | null, query: Query) {
  return useQuery({
    queryKey: [path, query],
    queryFn: () => api.get<{ data: T[]; meta: PageMeta }>(path as string, query),
    enabled: path !== null,
    placeholderData: keepPreviousData,
  });
}

const ACCOUNT_TONE: Record<string, BadgeTone> = { active: "success", suspended: "warning", frozen: "danger" };
const APPROVAL: Record<string, { tone: BadgeTone; label: string }> = {
  pending: { tone: "warning", label: "Pending approval" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
};

const title = (value: string) => value.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());

/** Account status, KYC state and approval state as compact badges. */
export function CustomerStatusBadges({ customer, showAccount = true }: { customer: Pick<Customer, "status" | "kycStatus" | "faceVerifiedAt" | "approvalStatus" | "deletedAt">; showAccount?: boolean }) {
  const approval = APPROVAL[customer.approvalStatus];
  return (
    <span className="d-inline-flex flex-wrap" style={{ gap: 4 }}>
      {customer.deletedAt && <Badge tone="dark">Deleted</Badge>}
      {showAccount && customer.status && <Badge tone={ACCOUNT_TONE[customer.status] ?? "default"}>{title(customer.status)}</Badge>}
      {customer.kycStatus === "completed" ? (
        <Badge tone="success">KYC complete</Badge>
      ) : !customer.faceVerifiedAt ? (
        <Badge tone="warning">Awaiting face verification</Badge>
      ) : (
        <Badge tone="danger">KYC incomplete</Badge>
      )}
      {approval && <Badge tone={approval.tone}>{approval.label}</Badge>}
    </span>
  );
}

/** Round avatar from the active face capture, or an icon. */
export function CustomerAvatar({ customer, className = "mf-avatar" }: { customer: Pick<Customer, "photoUrl" | "fullName">; className?: string }) {
  if (customer.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- authorised API image stream
    return <img src={backendUrl(customer.photoUrl)} alt={customer.fullName} className={className} />;
  }
  return (
    <span className={className} aria-hidden="true">
      <i className="icon-user" />
    </span>
  );
}

/** Previous / page numbers / Next for server pagination. */
export function Pager({ meta, onPage, perPage, onPerPage }: { meta: PageMeta | undefined; onPage: (page: number) => void; perPage?: number; onPerPage?: (size: number) => void }) {
  if (!meta) {
    return null;
  }
  const { currentPage, lastPage, total } = meta;
  const from = total === 0 ? 0 : (currentPage - 1) * meta.perPage + 1;
  const to = Math.min(currentPage * meta.perPage, total);
  const pages = Array.from({ length: lastPage }, (_, index) => index + 1).filter((page) => page === 1 || page === lastPage || Math.abs(page - currentPage) <= 2);

  return (
    <div className="mf-pager">
      <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
        <span>
          Showing {from} to {to} of {total} entries
        </span>
        {onPerPage && (
          <select className="form-control form-control-sm" style={{ width: 80 }} value={perPage} aria-label="Rows per page" onChange={(event) => onPerPage(Number(event.target.value))}>
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        )}
      </div>
      <ul className="pagination">
        <li className={`page-item ${currentPage <= 1 ? "disabled" : ""}`}>
          <button type="button" className="page-link" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)}>Previous</button>
        </li>
        {pages.map((page, index) => (
          <li key={page} className={`page-item ${page === currentPage ? "active" : ""}`}>
            {index > 0 && page - pages[index - 1] > 1 ? <span className="page-link">…</span> : null}
            <button type="button" className="page-link" onClick={() => onPage(page)}>{page}</button>
          </li>
        ))}
        <li className={`page-item ${currentPage >= lastPage ? "disabled" : ""}`}>
          <button type="button" className="page-link" disabled={currentPage >= lastPage} onClick={() => onPage(currentPage + 1)}>Next</button>
        </li>
      </ul>
    </div>
  );
}

/** Definition list row that hides nothing: empty values read "—". */
export function Detail({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div>
      <dt>{label}</dt>
      <dd>{empty ? "—" : children}</dd>
    </div>
  );
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
