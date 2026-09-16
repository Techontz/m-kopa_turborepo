"use client";

import { useState, type ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money, todayIso } from "@/lib/format";
import { useApi } from "@/lib/hooks";

import styles from "./report.module.css";

export { styles };

export interface ReportFilter {
  branch_id: string;
  from: string;
  to: string;
}

/** Validated categorical slots (blue, orange, aqua) — fixed order. */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"] as const;

export function monthStartIso(): string {
  return `${todayIso().slice(0, 8)}01`;
}

export function yearStartIso(): string {
  return `${todayIso().slice(0, 4)}-01-01`;
}

/** Compact axis label: 1.2M / 350K. */
export function short(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(Math.round(value));
}

/** Fetch a Reports → Financial endpoint with the current filter. */
export function useFinancialReport<T>(slug: string, filter: ReportFilter) {
  return useApi<T>(`reports/financial/${slug}`, { ...filter });
}

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  value: ReportFilter;
  onApply: (filter: ReportFilter) => void;
  /** "range" = From / To, "asOf" = a single As of date. */
  dates?: "range" | "asOf";
}

/** Live "Filter" modal: branch (ALL / HQ / branches) and From / To (or As of). */
export function FinancialFilterModal({ open, onClose, value, onApply, dates = "range" }: FilterModalProps) {
  const [form, setForm] = useState<ReportFilter>(value);
  const { user } = useAuth();
  const { data: branches = [] } = useApi<Option[]>("options/branches");
  const companyWide = user?.branch_ids === null;
  const options: Option[] = [{ value: "all", label: "ALL" }, ...(companyWide ? [{ value: "hq", label: "HQ (COMPANY)" }] : []), ...branches];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filter"
      submitLabel="Filter"
      onSubmit={() => {
        onApply(form);
        onClose();
      }}
    >
      <div className="row">
        <Field label="Branch:" className="col-md-12" required>
          <SelectBox placeholder="Select Branch" options={options} value={form.branch_id} onChange={(selected) => setForm({ ...form, branch_id: selected ?? "all" })} />
        </Field>
        {dates === "range" ? (
          <>
            <Field label="From:" className="col-md-6" required>
              <input type="date" className="form-control" value={form.from} onChange={(event) => setForm({ ...form, from: event.target.value })} required />
            </Field>
            <Field label="To:" className="col-md-6" required>
              <input type="date" className="form-control" value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} required />
            </Field>
          </>
        ) : (
          <Field label="As of:" className="col-md-12" required>
            <input type="date" className="form-control" value={form.to} onChange={(event) => setForm({ ...form, from: event.target.value, to: event.target.value })} required />
          </Field>
        )}
      </div>
    </Modal>
  );
}

interface ReportFrameProps {
  title: string;
  filter: ReportFilter;
  onFilter: (filter: ReportFilter) => void;
  dates?: "range" | "asOf";
  error?: unknown;
  loading?: boolean;
  children: ReactNode;
}

/**
 * Report page chrome in the live style: breadcrumb "Report / <title>", card titled
 * "<title> / <branch> / <period>", search (filter modal) and print buttons.
 */
export function ReportFrame({ title, filter, onFilter, dates = "range", error, loading, children }: ReportFrameProps) {
  const [open, setOpen] = useState(false);
  const { data: branches = [] } = useApi<Option[]>("options/branches");
  const label = filter.branch_id === "hq" ? "HQ (COMPANY)" : filter.branch_id === "all" ? "ALL" : branches.find((branch) => branch.value === filter.branch_id)?.label ?? "";
  const period = dates === "asOf" ? `As of ${filter.to}` : `${filter.from} - ${filter.to}`;

  return (
    <>
      <PageHeader crumbs={["Report", title]} />
      <Card
        title={`${title} / ${label} / ${period}`}
        actions={
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" title="Filter" onClick={() => setOpen(true)}>
              <i className="icon-magnifier" />
            </button>
            <button type="button" className="btn btn-info" title="print" onClick={() => window.print()}>
              <i className="icon-printer" />
            </button>
          </div>
        }
      >
        {error ? (
          <div className="alert alert-danger">{error instanceof ApiError ? error.firstError : "Unable to load the report."}</div>
        ) : loading ? (
          <Loading />
        ) : (
          children
        )}
      </Card>
      {open && <FinancialFilterModal open={open} onClose={() => setOpen(false)} value={filter} onApply={onFilter} dates={dates} />}
    </>
  );
}

/** Row of headline figures. */
export function SummaryTiles({ items }: { items: Array<{ label: string; value: number | string; tone?: "in" | "out" }> }) {
  return (
    <div className={styles.summary}>
      {items.map((item) => (
        <div key={item.label} className={styles.tile}>
          <span>{item.label}</span>
          <strong className={item.tone ? styles[item.tone] : undefined}>{typeof item.value === "number" ? money(item.value) : item.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function useDefaultFilter(from: string = monthStartIso(), to: string = todayIso()) {
  return useState<ReportFilter>({ branch_id: "all", from, to });
}
