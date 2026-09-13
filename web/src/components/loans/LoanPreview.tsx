"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { money } from "@/lib/format";

import type { LoanForm } from "./types";

interface Preview {
  principal: number;
  interest_rate: number;
  interest: number;
  total: number;
  insurance: number;
  restoration: number;
  loan_fee: number;
  take_home: number;
  duration_label: string;
  end_date: string;
  schedule: { session: number; due_date: string; amount: number }[];
  errors: string[];
}

/** Formula preview (LoanCalculator) shown next to the application form. */
export function LoanPreview({ form }: { form: LoanForm }) {
  const ready = Boolean(form.category_id && Number(form.how_loan) > 0 && Number(form.session) > 0 && form.rate);
  const body = { category_id: form.category_id, how_loan: form.how_loan, session: form.session, rate: form.rate, fee_status: form.fee_status || "YES" };
  const { data } = useQuery({
    queryKey: ["loan-preview", body],
    queryFn: () => api.post<{ data: Preview }>("loans/preview", body).then((response) => response.data),
    enabled: ready,
  });

  if (!ready || !data) {
    return <p className="text-muted mb-0">Fill loan category, amount, repayments and formula to preview the loan calculation.</p>;
  }

  return (
    <>
      {data.errors.map((error) => <div key={error} className="alert alert-warning py-1 mb-2">{error}</div>)}
      <div className="table-responsive">
        <table className="table table-bordered table-sm mb-2">
          <tbody>
            <tr><th>Loan Amount</th><td>{money(data.principal)}</td><th>Loan Interest</th><td>{data.interest_rate}%</td></tr>
            <tr><th>Interest</th><td>{money(data.interest)}</td><th>Loan + interest</th><td>{money(data.total)}</td></tr>
            <tr><th>Restration</th><td>{money(data.restoration)}</td><th>Insurence</th><td>{money(data.insurance)}</td></tr>
            <tr><th>Loan Fee</th><td>{money(data.loan_fee)}</td><th>Take Home</th><td>{money(data.take_home)}</td></tr>
            <tr><th>Restoration Type</th><td>{data.duration_label}</td><th>End Date</th><td>{data.end_date}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
