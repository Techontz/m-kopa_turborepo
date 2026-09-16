"use client";

import { useState } from "react";

import { DURATIONS, HeaderButton } from "@/components/hrm/common";
import { StaffCreditStatus, StaffCreditTrail } from "@/components/hrm/StaffCreditActions";
import type { StaffAdvance, StaffLoan } from "@/components/hrm/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Categories {
  loan: { id: number; name: string; amount_from: number; amount_to: number; interest_rate: number; duration: string; repayment_from: number; repayment_to: number }[];
  salary_advance: { id: number; name: string; amount_from: number; amount_to: number; fee: number }[];
}

const EMPTY_LOAN = { category_id: "", loan_amount: "", day: "", session: "", reason: "" };
const EMPTY_ADVANCE = { fee: "", advance_amount: "" };

/**
 * Spec §29/§30: a staff member applies for a Staff Loan or a Salary Advance for themselves and follows it through
 * HR (or Admin) → Finance → Fund Account. Repayments are deducted automatically by payroll.
 */
export default function MyStaffCreditPage() {
  const [modal, setModal] = useState<"loan" | "advance" | null>(null);
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN);
  const [advanceForm, setAdvanceForm] = useState(EMPTY_ADVANCE);
  const { data: loans, isLoading: loadingLoans } = useApi<StaffLoan[]>("hrm/my/staff-loans");
  const { data: advances, isLoading: loadingAdvances } = useApi<StaffAdvance[]>("hrm/my/salary-advances");
  const { data: categories } = useApi<Categories>("hrm/my/staff-credit-categories");
  const applyLoan = useAction<typeof EMPTY_LOAN>("post", "hrm/my/staff-loans");
  const applyAdvance = useAction<typeof EMPTY_ADVANCE>("post", "hrm/my/salary-advances");
  const category = categories?.loan.find((item) => String(item.id) === loanForm.category_id);

  return (
    <>
      <PageHeader crumbs={["HRM", "My Loan & Advance Requests"]} />
      <Card title="My Staff Loans" actions={<HeaderButton icon="icon-plus" title="Apply for a staff loan" onClick={() => setModal("loan")} />}>
        <DataTable
          rows={loans}
          loading={loadingLoans}
          rowKey={(row) => row.id}
          columns={[
            { key: "created_at", header: "Date" },
            { key: "category", header: "Category" },
            { key: "amount_applied", header: "Applied", render: (row) => money(row.amount_applied) },
            { key: "total_payable", header: "Loan + interest", render: (row) => money(row.total_payable) },
            { key: "restoration", header: "Monthly deduction", render: (row) => money(row.restoration) },
            { key: "remaining_amount", header: "Remaining", render: (row) => money(row.remaining_amount) },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <StaffCreditStatus row={row} /> },
            { key: "trail", header: "Stages", sortable: false, render: (row) => <StaffCreditTrail row={row} /> },
          ]}
        />
      </Card>

      <Card title="My Salary Advances" actions={<HeaderButton icon="icon-plus" title="Request a salary advance" onClick={() => setModal("advance")} />}>
        <DataTable
          rows={advances}
          loading={loadingAdvances}
          rowKey={(row) => row.id}
          columns={[
            { key: "created_at", header: "Date" },
            { key: "category", header: "Category" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "outstanding_amount", header: "Remaining", render: (row) => money(row.outstanding_amount) },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <StaffCreditStatus row={row} /> },
            { key: "trail", header: "Stages", sortable: false, render: (row) => <StaffCreditTrail row={row} /> },
          ]}
        />
      </Card>

      <Modal open={modal === "loan"} onClose={() => setModal(null)} title="Apply for a Staff Loan" size="lg" submitLabel="Submit" submitting={applyLoan.isPending} onSubmit={() => applyLoan.mutate(loanForm, { onSuccess: () => { setModal(null); setLoanForm(EMPTY_LOAN); } })}>
        <div className="row clearfix">
          <Field label="Loan Category:" className="col-lg-6 col-12" error={applyLoan.fieldError("category_id") ?? applyLoan.fieldError("blanch_id")}>
            <select className="form-control" value={loanForm.category_id} onChange={(e) => setLoanForm({ ...loanForm, category_id: e.target.value, day: "" })} required>
              <option value="">Select Category</option>
              {categories?.loan.map((item) => <option key={item.id} value={item.id}>{item.name} ({money(item.amount_from)} - {money(item.amount_to)})</option>)}
            </select>
          </Field>
          <Field label="Loan Amount:" className="col-lg-6 col-12" error={applyLoan.fieldError("loan_amount")}>
            <input type="number" className="form-control" value={loanForm.loan_amount} onChange={(e) => setLoanForm({ ...loanForm, loan_amount: e.target.value })} required />
          </Field>
          <Field label="Loan Duration:" className="col-lg-6 col-12" error={applyLoan.fieldError("day")}>
            <select className="form-control" value={loanForm.day} onChange={(e) => setLoanForm({ ...loanForm, day: e.target.value })} required>
              <option value="">Select Loan Duration</option>
              {DURATIONS.filter((duration) => !category || duration.value === category.duration).map((duration) => <option key={duration.value} value={duration.value}>{duration.label}</option>)}
            </select>
          </Field>
          <Field label={category ? `Number of Repayments (${category.repayment_from} - ${category.repayment_to}):` : "Number of Repayments:"} className="col-lg-6 col-12" error={applyLoan.fieldError("session")}>
            <input type="number" className="form-control" value={loanForm.session} onChange={(e) => setLoanForm({ ...loanForm, session: e.target.value })} required />
          </Field>
          <Field label="Reason:" className="col-12" error={applyLoan.fieldError("reason")}>
            <textarea className="form-control" rows={3} value={loanForm.reason} onChange={(e) => setLoanForm({ ...loanForm, reason: e.target.value })} required />
          </Field>
        </div>
      </Modal>

      <Modal open={modal === "advance"} onClose={() => setModal(null)} title="Request a Salary Advance" submitLabel="Request" submitting={applyAdvance.isPending} onSubmit={() => applyAdvance.mutate(advanceForm, { onSuccess: () => { setModal(null); setAdvanceForm(EMPTY_ADVANCE); } })}>
        <div className="row clearfix">
          <Field label="Category:" className="col-lg-6 col-12" error={applyAdvance.fieldError("fee") ?? applyAdvance.fieldError("blanch_id")}>
            <select className="form-control" value={advanceForm.fee} onChange={(e) => setAdvanceForm({ ...advanceForm, fee: e.target.value })} required>
              <option value="">Select category</option>
              {categories?.salary_advance.map((item) => <option key={item.id} value={item.id}>{item.name} ({money(item.amount_from)} - {money(item.amount_to)})</option>)}
            </select>
          </Field>
          <Field label="Amount:" className="col-lg-6 col-12" error={applyAdvance.fieldError("advance_amount")}>
            <input type="number" className="form-control" value={advanceForm.advance_amount} onChange={(e) => setAdvanceForm({ ...advanceForm, advance_amount: e.target.value })} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
