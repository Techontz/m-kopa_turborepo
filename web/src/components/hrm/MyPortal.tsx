"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { BadgeTone } from "@/components/ui/Badge";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * Employee Portal (spec §60): shared navigation and API shapes of the `hrm/my/*` endpoints. Every figure is the signed-in
 * employee's own; the API never returns central balances.
 */

export const MY_PORTAL_TABS: { href: string; label: string }[] = [
  { href: "/my", label: "Overview" },
  { href: "/my/salary", label: "Salary & Payslips" },
  { href: "/my/staff-fund", label: "Staff Fund" },
  { href: "/my/loans", label: "Loans & Advances" },
  { href: "/my/commission", label: "Commission" },
  { href: "/my/allowances", label: "Allowances & Deductions" },
];

/** Breadcrumb + tab row of every portal page (live profile tabs). */
export function MyPortalHeader({ title }: { title: string }) {
  const pathname = usePathname();

  return (
    <>
      <PageHeader crumbs={["My Portal", title]} />
      <div className="card">
        <div className="body">
          <ul className="nav nav-tabs-new profile-tabs">
            {MY_PORTAL_TABS.map((tab) => (
              <li className="nav-item" key={tab.href}>
                <Link className={`nav-link ${pathname === tab.href ? "active" : ""}`} href={tab.href}>{tab.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

const TONES: Record<string, BadgeTone> = {
  paid: "success",
  recovered: "success",
  completed: "success",
  awaiting_payment: "info",
  approved: "info",
  active: "info",
  finance_approved: "primary",
  finance_review: "primary",
  requested: "danger",
  recovering: "warning",
  repaying: "warning",
  disbursed: "warning",
  calculated: "warning",
  awaiting_request: "info",
  pending: "warning",
  prepared: "warning",
  submitted: "warning",
  rejected: "dark",
  stopped: "dark",
  due: "warning",
  partly_paid: "info",
};

export function PortalStatus({ status, label }: { status: string; label?: string | null }) {
  return <Badge tone={TONES[status] ?? "default"}>{(label ?? status.replace(/_/g, " ")).toUpperCase()}</Badge>;
}

export interface MyOverview {
  employee: { id: number; full_name: string; employee_number: string | null; position: string | null; branch: string | null; salary_structure: string | null; basic_salary: number };
  salary: { latest: Pick<MyPayslip, "payslip_id" | "period_label" | "net_salary" | "payment_status" | "payment_status_label" | "paid_on"> | null; awaiting_payment_count: number };
  staff_fund: { staff_contribution: number; total_benefit_record: number; open_claims: number };
  staff_loans: { active_count: number; outstanding: number; pending_requests: number };
  salary_advances: { active_count: number; outstanding: number; pending_requests: number };
  commission: { latest: Pick<MyCommission, "period_label" | "net_commission" | "status" | "status_label" | "paid_on"> | null; unpaid_net: number };
  allowances: { awaiting_payroll_count: number; awaiting_payroll_amount: number; pending_approval_count: number };
  negligence: { outstanding: number };
}

export interface MyPayslip {
  payslip_id: number | null;
  payroll_period: string | null;
  period_label: string | null;
  basic_salary: number;
  allowance: number;
  commission: number;
  gross: number;
  staff_fund: number;
  salary_advance: number;
  loan_restoration: number;
  other_deductions: number;
  negligence: number;
  total_deductions: number;
  net_salary: number;
  payment_status: "paid" | "awaiting_payment";
  payment_status_label: string;
  paid_on: string | null;
}

export interface MyStaffFund {
  summary: { contribution_percent: number; total_contributions: number; benefits_paid: number; staff_contribution: number; total_benefit_record: number; open_claims: number; claimable: number };
  contributions: { payslip_id: number; payroll_period: string | null; period_label: string | null; basic_salary: number; staff_contribution: number; paid_on: string | null }[];
  claims: { id: number; amount: number; reason: string; status: string; status_label: string; prepared_at: string | null; reviewed_at: string | null; approved_at: string | null; rejected_at: string | null; rejection_reason: string | null; paid_at: string | null; created_at: string | null }[];
}

export interface MyCommission {
  id: number;
  period: string | null;
  period_label: string | null;
  closing_date: string | null;
  branch: string | null;
  kind: string;
  kind_label: string;
  share_percent: number;
  calculated_amount: number;
  zone_deduction: number | null;
  negligence_deduction: number;
  negligence_expected: boolean;
  net_commission: number;
  status: string;
  status_label: string;
  requested_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
  paid_on: string | null;
}

export interface MyAllowances {
  summary: { awaiting_payroll_count: number; awaiting_payroll_amount: number; pending_approval_count: number; paid_amount: number };
  allowances: { id: number; reason: string; reason_label: string; description: string | null; amount: number; payroll_period: string | null; payroll_period_label: string | null; recurring: boolean; status: string; status_label: string; approved_at: string | null; rejection_reason: string | null; paid_in_payroll?: string | null; paid_at: string | null; created_at: string | null }[];
  deductions: { id: number; description: string | null; amount: number; instalments: number; instalment_amount: number; paid_amount: number; outstanding_amount: number; status: string; created_at: string | null }[];
}

export interface MyNegligence {
  summary: { total: number; recovered: number; outstanding: number };
  deductions: { id: number; reason: string; amount: number; recovered_amount: number; outstanding_amount: number; status: string; status_label: string; approved_at: string | null; created_at: string | null; recoveries: { period: string | null; period_label: string | null; commission: number; amount: number; outstanding_after: number; recovered_on: string | null }[] }[];
}

export interface MyRepayments {
  staff_loans: {
    id: number;
    category: string | null;
    amount_applied: number;
    amount_approved: number;
    total_payable: number;
    instalment: number;
    sessions: number;
    paid_amount: number;
    outstanding: number;
    status: string;
    status_label: string;
    disbursed_at: string | null;
    schedule: { number: number; amount: number; paid: number; balance: number; status: string }[];
    deductions: { amount: number; paid_on: string | null }[];
  }[];
  salary_advances: { id: number; category: string | null; amount: number; fee: number; recovered_amount: number; outstanding: number; status: string; status_label: string; disbursed_at: string | null }[];
  salary_advance_deductions: { payslip_id: number; period_label: string | null; amount: number; paid_on: string | null }[];
}
