"use client";

import Link from "next/link";

import { MAIN_LOAN_CATEGORY_COLUMNS, mainLoanCategoryRows, type MainLoanCategory } from "@/components/settings/loanHierarchy";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

/**
 * Settings → Main Loan Categories: one loan group per customer type (created with the customer type, named after it — no
 * free-text rename). Its loan categories are managed under Settings → Loan Categories.
 */
export default function MainCategoriesPage() {
  const { data: categories, isLoading } = useApi<MainLoanCategory[]>("settings/main-categories");
  const enable = useAction<{ id: number }>("post", (body) => `settings/main-categories/${body.id}/enable`);
  const disable = useAction<{ id: number }>("delete", (body) => `settings/main-categories/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Setting", "Main Loan Categories"]} />
      <Card title="Main Loan Category List">
        <p className="text-muted mb-2">Each customer type has one main loan category. Add customer types under Settings → Customer Types.</p>
        <DataTable
          rows={isLoading ? undefined : mainLoanCategoryRows(categories)}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: MAIN_LOAN_CATEGORY_COLUMNS[0], render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customerType", header: MAIN_LOAN_CATEGORY_COLUMNS[1], className: "text-nowrap" },
            { key: "loanCategories", header: MAIN_LOAN_CATEGORY_COLUMNS[2] },
            { key: "activeLoanCategories", header: MAIN_LOAN_CATEGORY_COLUMNS[3] },
            {
              key: "status",
              header: MAIN_LOAN_CATEGORY_COLUMNS[4],
              render: (row) => <Badge tone={row.enabled ? "success" : "danger"}>{row.status}</Badge>,
            },
            {
              key: "action",
              header: MAIN_LOAN_CATEGORY_COLUMNS[5],
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <Link href={`/settings/loan-categories?customerType=${row.id}`} className="btn btn-info btn-sm mr-1" title="View loan categories"><i className="icon-eye" /></Link>
                  <Link href={`/settings/main-categories/${row.id}`} className="btn btn-primary btn-sm mr-1" title="Sub categories"><i className="icon-list" /></Link>
                  {row.enabled ? (
                    <button type="button" className="btn btn-danger btn-sm" title="Disable" onClick={async () => (await confirmAction("Disable this main loan category?", "Its loan categories can no longer be applied for.")) && disable.mutate({ id: row.id })}>
                      <i className="icon-ban" />
                    </button>
                  ) : (
                    <button type="button" className="btn btn-success btn-sm" title="Enable" onClick={() => enable.mutate({ id: row.id })}><i className="icon-check" /></button>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
