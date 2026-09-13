"use client";

import Link from "next/link";

import { sum } from "@/components/finance/FilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface PayrollRow {
  date: string;
  from_account: string | null;
  amount: number;
}

export default function PayrollPage() {
  const { can } = useAuth();
  const { data: rows, isLoading } = useApi<PayrollRow[]>("bank/payroll");

  return (
    <>
      <PageHeader crumbs={["Bank", "Payroll"]} />
      <Card
        title="Payroll List"
        actions={
          can("payroll.pay") && (
            <Link href="/hrm/salary-sheet" className="btn btn-primary">
              <i className="icon-wallet" /> Pay Payroll
            </Link>
          )
        }
      >
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.date}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "from_account", header: "From Account" },
            { key: "date", header: "Date" },
            { key: "action", header: "Action", sortable: false, render: (row) => <Link href={`/bank/payroll/${row.date}`} className="btn btn-primary"><i className="icon-eye" /></Link> },
          ]}
          footer={
            <tr>
              <td>TOTAL:</td>
              <td><b>{money(sum(rows, (row) => row.amount))}</b></td>
              <td colSpan={3} />
            </tr>
          }
        />
      </Card>
    </>
  );
}
