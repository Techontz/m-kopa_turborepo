"use client";

import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useApi } from "@/lib/hooks";

interface MarkedCustomer {
  id: number;
  customer_code: string;
  name: string;
  age: number | null;
  gender: string | null;
  phone: string;
  branch: string | null;
}

/** Report → Customer Development (live admin/marked_customer_list): marked customers. */
export default function CustomerDevelopmentPage() {
  const { data, isLoading } = useApi<MarkedCustomer[]>("reports/development");

  return (
    <>
      <PageHeader crumbs={["All Customer"]} />

      <Card title="Customer List">
        <DataTable
          rows={data}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer_code", header: "Customer ID" },
            { key: "name", header: "customer name", render: (row) => <Link href={`/reports/development/${row.id}`}>{row.name}</Link> },
            { key: "age", header: "Age" },
            { key: "gender", header: "Gender" },
            { key: "phone", header: "Phone number" },
            { key: "branch", header: "Branch" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => <Link href={`/reports/development/${row.id}`} className="btn btn-sm btn-icon btn-pure btn-primary on-default m-r-5 button-edit"><i className="icon-eye" /></Link>,
            },
          ]}
        />
      </Card>
    </>
  );
}
