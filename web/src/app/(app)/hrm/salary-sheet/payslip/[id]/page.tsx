"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import type { SalaryPayment } from "@/components/hrm/types";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Payslip extends SalaryPayment {
  company: { name: string; address: string | null; phone: string | null; email: string | null };
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <tr>
      <td>{bold ? <b>{label}</b> : label}</td>
      <td className="text-right">{bold ? <b>{money(value)}</b> : money(value)}</td>
    </tr>
  );
}

export default function PayslipPage() {
  const { id } = useParams<{ id: string }>();
  const { data: slip } = useApi<Payslip>(`hrm/salary-payments/${id}`);

  return (
    <>
      <PageHeader crumbs={["HRM", "Salary Sheet", "Payslip"]} />
      <Card
        title="Staff Payslip"
        actions={
          <>
            <button type="button" className="btn btn-sm btn-info mr-1" onClick={() => window.print()}><i className="icon-printer" /> Print</button>
            <Link href="/hrm/salary-sheet" className="btn btn-sm btn-primary"><i className="icon-arrow-left" /></Link>
          </>
        }
      >
        {slip && (
          <div className="payslip">
            <div className="text-center mb-3">
              <h4 className="mb-0 text-uppercase">{slip.company.name}</h4>
              <small>{[slip.company.address, slip.company.phone, slip.company.email].filter(Boolean).join(" · ")}</small>
              <h6 className="mt-2">SALARY SLIP {slip.period ? `- ${slip.period.toUpperCase()}` : ""}</h6>
            </div>
            <div className="row mb-3">
              <div className="col-md-6">
                <div>Staff name: <b className="text-uppercase">{slip.employee}</b></div>
                <div>Empl/ID: {slip.employee_number}</div>
                <div>Position: {slip.position}</div>
                <div>Branch: {slip.branch ?? "HQ"}</div>
              </div>
              <div className="col-md-6 text-md-right">
                <div>Salary structure: {slip.salary_type_label ?? "-"}</div>
                <div>Account: {slip.account_name} {slip.account_number}</div>
                <div>Paid from: {slip.paid_from_account}</div>
                <div>Date: {slip.paid_on}</div>
              </div>
            </div>
            <div className="row">
              <div className="col-md-6">
                <table className="table table-custom">
                  <thead className="thead-info"><tr><th>Earnings</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    <Line label="Base Salary" value={slip.salary} />
                    <Line label="Commission" value={slip.commission} />
                    <Line label="Allowance" value={slip.allowance} />
                    <Line label="Gross" value={slip.gross} bold />
                  </tbody>
                </table>
              </div>
              <div className="col-md-6">
                <table className="table table-custom">
                  <thead className="thead-info"><tr><th>Deductions</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    <Line label="Staff Fund" value={slip.staff_fund} />
                    <Line label="Salary Advance" value={slip.salary_advance} />
                    <Line label="Deduction" value={slip.deduction} />
                    <Line label="Loan Restoration" value={slip.loan_restoration} />
                    <Line label="Total Deductions" value={slip.total_deductions} bold />
                  </tbody>
                </table>
              </div>
            </div>
            <h5 className="text-right">Take Home: {money(slip.take_home)}</h5>
          </div>
        )}
      </Card>
    </>
  );
}
