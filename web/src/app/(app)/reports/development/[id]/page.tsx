"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { StatusBadge } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Development {
  customer: { id: number; name: string; customer_code: string; phone: string; photo_url: string | null; is_marked: boolean };
  summary: {
    phone: string;
    withdrawal_date: string | null;
    end_date: string | null;
    total_payable: number;
    restoration: number;
    paid: number;
    remain: number;
    salary_advance: number;
    penalty: number;
    recovery: number;
    status: string | null;
    status_badge: string | null;
  };
  loans: Array<{
    id: number;
    loan_number: string;
    product: string | null;
    interest_rate: number;
    amount: number;
    total_payable: number;
    duration: string;
    sessions: number;
    restoration: number;
    status: string;
    status_badge: string;
    withdrawal_date: string | null;
    end_date: string | null;
  }>;
}

/** Customer Development for one marked customer (live admin/view_customer_development/{customer}). */
export default function CustomerDevelopmentShowPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { data, isLoading } = useApi<Development>(`reports/development/${id}`);
  const unmark = useAction<Record<string, never>>("post", `customers/${id}/mark`);

  const summary = data?.summary;

  return (
    <>
      <PageHeader crumbs={["Teller", "Customer Development"]} />

      <div className="card">
        <div className="body text-center">
          {data?.customer.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.customer.photo_url} className="img-thumbnail" alt="customer image" style={{ width: 135, height: 135, objectFit: "cover" }} />
          ) : (
            <div className="img-thumbnail d-inline-flex align-items-center justify-content-center" style={{ width: 135, height: 135 }}><i className="icon-user" style={{ fontSize: 48 }} /></div>
          )}
          <small style={{ display: "block", marginTop: 8, fontSize: 10 }}>{data?.customer.name}</small>
        </div>
      </div>

      <div className="card">
        <div className="body">
          <div className="text-right mb-2">
            {data?.customer.is_marked && can("customers.manage") && (
              <button type="button" className="btn btn-success mr-1" onClick={async () => (await confirmAction("Are you sure to Un mark?")) && unmark.mutate({}, { onSuccess: () => router.push("/reports/development") })}>
                <i className="icon-trash" /> Un- mark
              </button>
            )}
            <Link href="/reports/development" className="btn btn-primary btn-sm"><i className="icon-arrow-left" /></Link>
          </div>
          <div className="table-responsive">
            <table className="table table-hover dataTable table-custom mf-table">
              <thead className="thead-info">
                <tr>
                  {["Phone Number", "Withdrawal Date", "End Date", "Loan Amount", "Restoration", "Amount Paid", "Remaining debt", "Salary Advance", "Penalty", "Recovery Amount", "Loan Status"].map((header) => <th key={header}>{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {isLoading || !summary ? (
                  <tr><td colSpan={11} className="mf-loading">Loading...</td></tr>
                ) : (
                  <tr>
                    <td>{summary.phone}</td>
                    <td>{summary.withdrawal_date}</td>
                    <td>{summary.end_date}</td>
                    <td>{money(summary.total_payable)}</td>
                    <td>{money(summary.restoration)}</td>
                    <td>{money(summary.paid)}</td>
                    <td>{money(summary.remain)}</td>
                    <td>{money(summary.salary_advance)}</td>
                    <td>{money(summary.penalty)}</td>
                    <td>{money(summary.recovery)}</td>
                    <td><StatusBadge label={summary.status} tone={summary.status_badge} /></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Card title="All Loans">
        <DataTable
          rows={data?.loans}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "loan_number", header: "Loan Ac" },
            { key: "product", header: "Loan Product" },
            { key: "interest_rate", header: "Loan Interest", render: (row) => `${row.interest_rate}%` },
            { key: "amount", header: "Loan Withdrawal", render: (row) => money(row.amount) },
            { key: "total_payable", header: "Principal + interest", render: (row) => money(row.total_payable) },
            { key: "duration", header: "Duration Type" },
            { key: "sessions", header: "Number of Repayment" },
            { key: "restoration", header: "Restoration", render: (row) => money(row.restoration) },
            { key: "status", header: "Status", render: (row) => <StatusBadge label={row.status} tone={row.status_badge} /> },
            { key: "withdrawal_date", header: "Withdrawal Date" },
            { key: "end_date", header: "End Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => (
                <Link href={`/reports/statement?customer_id=${data?.customer.id}&loan_id=${row.id}`} target="_blank" className="btn btn-sm btn-primary"><i className="icon-printer" /></Link>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
