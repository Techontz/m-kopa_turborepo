"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import type { LoanCategory } from "@/components/settings/LoanCategoryFields";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

interface Branch {
  id: number;
  name: string;
}

/** Live admin/loan_category_blanch/:id — assign the product to branches. */
export default function LoanCategoryBranchesPage() {
  const { id } = useParams<{ id: string }>();
  const { data: category } = useApi<LoanCategory>(`settings/loan-categories/${id}`);
  const { data: branches, isLoading } = useApi<Branch[]>("settings/branches");
  const attach = useAction<{ branch: number }>("post", (body) => `settings/loan-categories/${id}/branches/${body.branch}`);
  const detach = useAction<{ branch: number }>("delete", (body) => `settings/loan-categories/${id}/branches/${body.branch}`);

  return (
    <>
      <PageHeader crumbs={["Loan Category Assign"]} />
      <div className="row clearfix">
        <div className="col-lg-6">
          <Card title={category?.name ?? ""} actions={<Link href="/settings/loan-categories" className="btn btn-primary"><i className="icon-arrow-left-circle" /></Link>}>
            <DataTable
              rows={branches}
              loading={isLoading}
              rowKey={(row) => row.id}
              columns={[
                { key: "sn", header: "S/NO.", render: (_, index) => `${index + 1}.`, sortable: false },
                { key: "name", header: "Branch Name", render: (row) => row.name.toUpperCase() },
                {
                  key: "action",
                  header: "Action",
                  sortable: false,
                  render: (row) => <button type="button" className="btn btn-sm btn-primary" onClick={() => attach.mutate({ branch: row.id })}><i className="icon-plus" /></button>,
                },
              ]}
            />
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Branch List Loan Category">
            <DataTable
              rows={category?.branches}
              loading={!category}
              rowKey={(row) => row.id}
              columns={[
                { key: "sn", header: "S/NO.", render: (_, index) => `${index + 1}.`, sortable: false },
                { key: "category", header: "Loan Category", value: () => category?.name ?? "" },
                { key: "name", header: "Branch" },
                {
                  key: "action",
                  header: "Action",
                  sortable: false,
                  render: (row) => <button type="button" className="btn btn-sm btn-danger" onClick={async () => (await confirmAction()) && detach.mutate({ branch: row.id })}><i className="icon-trash" /></button>,
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
