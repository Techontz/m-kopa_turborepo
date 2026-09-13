"use client";

import { useParams } from "next/navigation";

import { sum } from "@/components/finance/FilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface SalaryRow {
  id: number;
  staff: string | null;
  salary: number;
  salary_advance: number;
  allowance: number;
  deduction: number;
  loan_restoration: number;
  take_home: number;
  phone: string | null;
  account_name: string | null;
  account_number: string | null;
  date: string | null;
}

export default function PayrollPaidPage() {
  const { date } = useParams<{ date: string }>();
  const { data: rows, isLoading } = useApi<SalaryRow[]>(`bank/payroll/${date}`);

  return (
    <>
      <PageHeader crumbs={["Bank", "Payrol paid"]} />
      <Card title={`Payrol paid Date: ${date}`}>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "staff", header: "Staff name" },
            { key: "salary", header: "Sallary Amount", render: (row) => money(row.salary) },
            { key: "salary_advance", header: "Sallary Advance", render: (row) => money(row.salary_advance) },
            { key: "allowance", header: "Allowance", render: (row) => money(row.allowance) },
            { key: "deduction", header: "Deduction", render: (row) => money(row.deduction) },
            { key: "loan_restoration", header: "Loan Restration", render: (row) => money(row.loan_restoration) },
            { key: "take_home", header: "Take Home", render: (row) => money(row.take_home) },
            { key: "phone", header: "Phone no" },
            { key: "account_name", header: "Account name" },
            { key: "account_number", header: "Account no" },
            { key: "date", header: "Date" },
          ]}
          footer={
            <tr>
              <td>TOTAL:</td>
              <td />
              <td><b>{money(sum(rows, (row) => row.salary))}</b></td>
              <td><b>{money(sum(rows, (row) => row.salary_advance))}</b></td>
              <td><b>{money(sum(rows, (row) => row.allowance))}</b></td>
              <td><b>{money(sum(rows, (row) => row.deduction))}</b></td>
              <td><b>{money(sum(rows, (row) => row.loan_restoration))}</b></td>
              <td><b>{money(sum(rows, (row) => row.take_home))}</b></td>
              <td colSpan={4} />
            </tr>
          }
        />
      </Card>
    </>
  );
}
