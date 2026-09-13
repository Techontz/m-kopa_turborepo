"use client";

import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

interface MainCategory {
  id: number;
  code: string;
  name: string;
  is_enabled: boolean;
}

export default function MainCategoriesPage() {
  const { data: categories, isLoading } = useApi<MainCategory[]>("settings/main-categories");
  const enable = useAction<{ id: number }>("post", (body) => `settings/main-categories/${body.id}/enable`);
  const disable = useAction<{ id: number }>("delete", (body) => `settings/main-categories/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Loan category"]} />
      <Card title="Category List">
        <DataTable
          rows={categories}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Category Name" },
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
          rows={categories?.filter((category) => category.is_enabled)}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}`, sortable: false },
            { key: "name", header: "Category Name" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <Link href={`/settings/main-categories/${row.id}`} className="btn btn-info btn-sm mr-1"><i className="icon-eye" /></Link>
                  <button type="button" className="btn btn-danger btn-sm" onClick={async () => (await confirmAction("Are You Sure?")) && disable.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
