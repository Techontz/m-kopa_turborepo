"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import type { BadgeTone } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { todayIso } from "@/lib/format";

export type ReportFilters = Record<string, string | undefined>;

export interface Totals {
  [column: string]: number;
}

export interface ReportRows<T> {
  rows: T[];
  totals: Totals;
  filter?: { branch_id: string; from: string | null; to: string | null };
}

/** Loan row shared by the loan-list reports (see OperationalReports::loanRows()). */
export interface LoanReportRow {
  id: number;
  loan_number: string;
  reference_number: string | null;
  branch: string | null;
  customer_id: number;
  customer: string | null;
  phone: string | null;
  employee: string | null;
  amount_approved: number;
  interest_amount: number;
  total_payable: number;
  restoration: number;
  duration: "Daily" | "Weekly" | "Monthly";
  sessions: number;
  paid: number;
  outstanding: { principal: number; penalty: number; interest: number; insurance: number; total: number };
  remain: number;
  penalty: number;
  withdrawal_date: string | null;
  end_date: string | null;
  status: string;
  status_badge: BadgeTone;
  status_value: string;
}

interface FilterModalProps {
  open: boolean;
  onClose: () => void;
  onApply: (filters: ReportFilters) => void;
  initial?: ReportFilters;
  title?: string;
  withBranch?: boolean;
  withAll?: boolean;
  withDates?: boolean;
  datesFirst?: boolean;
  branchPlaceholder?: string;
  /** Portfolio & Risk: dates are optional (empty = whole book). */
  datesOptional?: boolean;
  children?: (form: ReportFilters, setForm: (form: ReportFilters) => void) => ReactNode;
}

/** Live report filter modal: "Select Branch" (incl. ALL) and From / To, plus page-specific fields; Filter / CLOSE. */
export function FilterModal({
  open,
  onClose,
  onApply,
  initial = {},
  title,
  withBranch = true,
  withAll = true,
  withDates = true,
  datesFirst = false,
  branchPlaceholder = "Select Branch",
  datesOptional = false,
  children,
}: FilterModalProps) {
  const [form, setForm] = useState<ReportFilters>(datesOptional ? { ...initial } : { from: todayIso(), to: todayIso(), ...initial });

  const branch = withBranch && (
    <Field label="Select Branch:" className="col-md-12">
      <SelectBox placeholder={branchPlaceholder} optionsUrl="options/branches" query={withAll ? { with_all: 1 } : undefined} value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value ?? "" })} />
    </Field>
  );
  const dates = withDates && (
    <>
      <Field label="From:" className="col-md-6">
        <input type="date" className="form-control" placeholder="From" value={form.from ?? ""} onChange={(e) => setForm({ ...form, from: e.target.value })} required={!datesOptional} />
      </Field>
      <Field label="To:" className="col-md-6">
        <input type="date" className="form-control" placeholder="From" value={form.to ?? ""} onChange={(e) => setForm({ ...form, to: e.target.value })} required={!datesOptional} />
      </Field>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      submitLabel="Filter"
      onSubmit={() => {
        const applied = { ...form };
        if (!withDates) {
          delete applied.from;
          delete applied.to;
        }
        onApply(applied);
        onClose();
      }}
    >
      <div className="row clearfix">
        {datesFirst ? dates : branch}
        {children?.(form, setForm)}
        {datesFirst ? branch : dates}
      </div>
    </Modal>
  );
}

export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-sm btn-primary mf-no-print" onClick={onClick} title="Filter">
      <i className="icon-magnifier" />
    </button>
  );
}

const PRINT_CSS = `@media print {
  #left-sidebar, .navbar-fixed-top, .block-header, .mf-no-print, .mf-table-controls, .mf-table-footer, .mf-modal, .mf-modal-backdrop { display: none !important; }
  #main-content { margin: 0 !important; padding: 0 !important; width: 100% !important; }
  .card { box-shadow: none !important; }
}`;

/** Print button (window.print) with print styles that hide the navigation chrome. */
export function PrintButton() {
  return (
    <>
      <style>{PRINT_CSS}</style>
      <button type="button" className="btn btn-info btn-sm ml-1 mf-no-print" onClick={() => window.print()} title="Print">
        <i className="icon-printer" />
      </button>
    </>
  );
}

type CsvCell = string | number | null | undefined;

/** Client-side CSV export of a report table. */
export function CsvButton({ filename, header, rows }: { filename: string; header: string[]; rows: CsvCell[][] }) {
  const download = () => {
    const escape = (cell: CsvCell) => {
      const text = cell === null || cell === undefined ? "" : String(cell);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" className="btn btn-success btn-sm ml-1 mf-no-print" onClick={download} title="Export CSV">
      <i className="icon-cloud-download" /> CSV
    </button>
  );
}

/** Live pill tab strip on report pages, always followed by "Back" to the dashboard. */
export function ReportTabs<T extends string>({ tabs, value, onChange }: { tabs: Array<[T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div className="card">
      <div className="body">
        <ul className="nav nav-tabs-new profile-tabs">
          {tabs.map(([key, label]) => (
            <li className="nav-item" key={key}>
              <a
                href={`#${key}`}
                className={`nav-link ${value === key ? "active" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  onChange(key);
                }}
              >
                {label}
              </a>
            </li>
          ))}
          <li className="nav-item">
            <Link className="nav-link" href="/dashboard">Back</Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

/** Tab pane card of the live report pages: `<h6>` title with the filter button floated right. */
export function PaneCard({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      <div className="body">
        <h6>{title}</h6>
        {actions && <div className="pull-right">{actions}</div>}
        {children}
      </div>
    </div>
  );
}

/** `<tfoot>` row: first cell "TOTAL", then one cell per column. */
export function TotalsRow({ cells, label = "TOTAL" }: { cells: ReactNode[]; label?: ReactNode }) {
  return (
    <tr>
      <th>{label}</th>
      {cells.map((cell, index) => (
        <th key={index}>{cell}</th>
      ))}
    </tr>
  );
}

export function StatusBadge({ label, tone }: { label: string | null | undefined; tone: BadgeTone | string | null | undefined }) {
  if (!label) {
    return null;
  }
  return <a href="#" onClick={(event) => event.preventDefault()} className={`badge badge-${tone ?? "default"}`}>{label}</a>;
}

/** Summary tile used by the Portfolio & Risk pages (dashboard `.dashboard-stat` look). */
export function Stat({ tone, label, value, className = "col-lg-3 col-md-4 col-sm-6" }: { tone: "success" | "warning" | "primary" | "danger" | "info"; label: string; value: ReactNode; className?: string }) {
  return (
    <div className={`${className} mb-2`}>
      <div className={`body dashboard-stat bg-${tone} text-light`} style={{ borderRadius: 3, padding: "14px 16px" }}>
        <h4 style={{ margin: 0 }}>{value}</h4>
        <span>{label}</span>
      </div>
    </div>
  );
}

/** Query object without empty values. */
export function cleanQuery(filters: ReportFilters): Record<string, string> {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== "" && value !== null)) as Record<string, string>;
}

export function sumBy<T>(rows: T[] | undefined, pick: (row: T) => number | null | undefined): number {
  return (rows ?? []).reduce((total, row) => total + (Number(pick(row)) || 0), 0);
}
