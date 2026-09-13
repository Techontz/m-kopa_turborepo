"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

interface CustomerType {
  id: number;
  code: string;
  name: string;
  is_enabled: boolean;
}

/** Live admin/sub_main_watumishi/ent and sub_main_wajasiliamali/ser. */
export default function SubCategoriesPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useApi<{ main_category: { id: number; name: string }; types: CustomerType[] }>(`settings/main-categories/${id}/types`);
  const enable = useAction<{ id: number }>("post", (body) => `settings/customer-types/${body.id}/enable`);
  const disable = useAction<{ id: number }>("delete", (body) => `settings/customer-types/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Loan category"]} />
      <Card
        title={`Sub category Loan / ${data?.main_category.name ?? ""} LOAN`}
        actions={<Link href="/settings/main-categories" className="btn btn-primary"><i className="icon-arrow-left-circle" /></Link>}
      >
        <DataTable
          rows={data?.types}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Sub Category Name" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => <button type="button" className="btn btn-primary btn-sm" onClick={() => enable.mutate({ id: row.id })}><i className="icon-check" /></button>,
            },
          ]}
        />
      </Card>
      <Card title=" ">
        <DataTable
          rows={data?.types.filter((type) => type.is_enabled)}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}`, sortable: false },
            { key: "category", header: "Category Name", value: () => data?.main_category.name ?? "" },
            { key: "name", header: "Sub Category Name" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => <button type="button" className="btn btn-danger btn-sm" onClick={async () => (await confirmAction("Are You Sure?")) && disable.mutate({ id: row.id })}><i className="icon-trash" /></button>,
            },
          ]}
        />
      </Card>
    </>
  );
}
