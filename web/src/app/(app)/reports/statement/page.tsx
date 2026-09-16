"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { PrintButton, TotalsRow } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface StatementRow {
  id: number;
  /** "deposit" / "withdrawal" loan transactions, or "recovery" (money recovered after write-off). */
  type?: string;
  date: string;
  loan_number: string | null;
  description: string;
  receipt_number: string | null;
  deposit: number;
  withdrawal: number;
  principal: number;
  penalty: number;
  interest: number;
  insurance: number;
  balance: number;
  remain_debit: number;
}

interface Statement {
  customer: { id: number; name: string; customer_code: string; phone: string; branch: string | null } | null;
  loans: Option[];
  loan: {
    loan_number: string;
    product: string | null;
    branch: string | null;
    amount: number;
    total_payable: number;
    duration: string;
    sessions: number;
    restoration: number;
    withdrawal_date: string | null;
    end_date: string | null;
    status: string;
    outstanding: { principal: number; penalty: number; interest: number; insurance: number; total: number };
  } | null;
  rows: StatementRow[];
  totals: Record<string, number>;
}

function StatementReport() {
  const router = useRouter();
  const params = useSearchParams();
  const appliedCustomer = params.get("customer_id") ?? "";
  const appliedLoan = params.get("loan_id") ?? "";
  const [customerId, setCustomerId] = useState(appliedCustomer);
  const [loanId, setLoanId] = useState(appliedLoan);

  const { data: draft } = useApi<Statement>(customerId ? "reports/statement" : null, { customer_id: customerId });
  const { data, isLoading } = useApi<Statement>(appliedCustomer ? "reports/statement" : null, { customer_id: appliedCustomer, loan_id: appliedLoan || undefined });

  const search = () => {
    const query = new URLSearchParams({ customer_id: customerId, ...(loanId ? { loan_id: loanId } : {}) });
    router.replace(`/reports/statement?${query.toString()}`);
  };

  return (
    <>
      <PageHeader crumbs={["Report", "Customer statement"]} />

      <Card title="Search Customer">
        <form onSubmit={(event) => { event.preventDefault(); if (customerId) { search(); } }}>
          <div className="row">
            <div className="col-lg-2 col-12" />
            <div className="col-lg-4 col-6">
              <span>Customer</span>
              <SelectBox placeholder="Search Customer" optionsUrl="options/customers" query={{ with_code: 1 }} value={customerId} onChange={(value) => { setCustomerId(value ?? ""); setLoanId(""); }} />
            </div>
            <div className="col-lg-4 col-6">
              <span>Loan</span>
              <SelectBox placeholder="select loan" options={draft?.loans ?? []} value={loanId} onChange={(value) => setLoanId(value ?? "")} isClearable />
            </div>
            <div className="col-lg-2 col-12" />
          </div>
          <div className="text-center m-t-20">
            <button type="submit" className="btn btn-primary" disabled={!customerId}><i className="icon-magnifier" />Search</button>
          </div>
        </form>
      </Card>

      {appliedCustomer && (
        <Card title="Customer Account Statement" actions={<PrintButton />}>
          {data?.customer && (
            <div className="table-responsive">
              <table className="table table-bordered table-sm">
                <tbody>
                  <tr>
                    <td><b>Customer Name:</b> {data.customer.name}</td>
                    <td><b>Customer ID:</b> {data.customer.customer_code}</td>
                    <td><b>Phone Number:</b> {data.customer.phone}</td>
                    <td><b>Branch:</b> {data.loan?.branch ?? data.customer.branch}</td>
                  </tr>
                  {data.loan && (
                    <>
                      <tr>
                        <td><b>Loan Ac:</b> {data.loan.loan_number}</td>
                        <td><b>Loan Product:</b> {data.loan.product}</td>
                        <td><b>Loan Amount:</b> {money(data.loan.amount)}</td>
                        <td><b>Principal + Interest:</b> {money(data.loan.total_payable)}</td>
                      </tr>
                      <tr>
                        <td><b>Duration Type:</b> {data.loan.duration} / {data.loan.sessions}</td>
                        <td><b>Restoration:</b> {money(data.loan.restoration)}</td>
                        <td><b>Withdrawal Date:</b> {data.loan.withdrawal_date}</td>
                        <td><b>End Date:</b> {data.loan.end_date}</td>
                      </tr>
                      <tr>
                        <td><b>Outstanding Principal:</b> {money(data.loan.outstanding.principal)}</td>
                        <td><b>Outstanding Penalty:</b> {money(data.loan.outstanding.penalty)}</td>
                        <td><b>Outstanding Interest:</b> {money(data.loan.outstanding.interest)}</td>
                        <td><b>Total Outstanding:</b> {money(data.loan.outstanding.total)} ({data.loan.status})</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <DataTable
            rows={data?.rows}
            loading={isLoading}
            rowKey={(row) => `${row.type ?? "transaction"}-${row.id}`}
            pageSize={100}
            columns={[
              { key: "date", header: "Date" },
              ...(data?.loan ? [] : [{ key: "loan_number", header: "Loan Ac" }]),
              { key: "description", header: "Description" },
              { key: "receipt_number", header: "Receipt" },
              { key: "deposit", header: "Deposit", render: (row) => money(row.deposit) },
              { key: "withdrawal", header: "Withdrawal", render: (row) => money(row.withdrawal) },
              { key: "principal", header: "Principal", render: (row) => money(row.principal) },
              { key: "penalty", header: "Penalty", render: (row) => money(row.penalty) },
              { key: "interest", header: "Interest", render: (row) => money(row.interest) },
              { key: "insurance", header: "Insurance", render: (row) => money(row.insurance) },
              { key: "balance", header: "Balance", render: (row) => money(row.balance) },
              { key: "remain_debit", header: "Remaining Debt", render: (row) => money(row.remain_debit) },
            ]}
            footer={
              data && (
                <TotalsRow
                  cells={[
                    ...(data.loan ? [] : [""]),
                    "",
                    "",
                    money(data.totals.deposit),
                    money(data.totals.withdrawal),
                    money(data.totals.principal),
                    money(data.totals.penalty),
                    money(data.totals.interest),
                    money(data.totals.insurance),
                    "",
                    "",
                  ]}
                />
              )
            }
          />
        </Card>
      )}
    </>
  );
}

/**
 * Report → Customer statement (live admin/customer_account_statement). Uses the Payments statement: every repayment with
 * its Principal → Penalty → Interest (→ Insurance) split, receipt and remaining debit. Linked from the customer profile
 * with ?customer_id= (all loans of the customer until a loan is chosen).
 */
export default function CustomerStatementPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StatementReport />
    </Suspense>
  );
}
