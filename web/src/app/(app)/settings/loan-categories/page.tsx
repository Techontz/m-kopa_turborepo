"use client";

import Link from "next/link";
import { useState } from "react";

import { EMPTY_LOAN_CATEGORY, LoanCategoryFields, type LoanCategory, type LoanCategoryForm } from "@/components/settings/LoanCategoryFields";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

export default function LoanCategoriesPage() {
  const { data: categories, isLoading } = useApi<LoanCategory[]>("settings/loan-categories");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<LoanCategoryForm>(EMPTY_LOAN_CATEGORY);
  const [branchesOf, setBranchesOf] = useState<LoanCategory | null>(null);

  const create = useAction<LoanCategoryForm>("post", "settings/loan-categories");
  const remove = useAction<{ id: number }>("delete", (body) => `settings/loan-categories/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Loan Category"]} />

      <Card title="Loan Category List" actions={<button type="button" className="btn btn-sm btn-primary" onClick={() => setCreating(true)}><i className="icon-plus" /></button>}>
        <DataTable
          rows={categories}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "main_category", header: "Loan Type", className: "text-nowrap" },
            { key: "name", header: "Loan Category name", className: "text-nowrap" },
            { key: "level_label", header: "Loan level", className: "text-nowrap", value: (row) => row.amount_from, render: (row) => row.level_label },
            { key: "interest_rate", header: "Loan Interest", render: (row) => percent(row.interest_rate) },
            { key: "formula", header: "Interest Formular" },
            { key: "duration_label", header: "Duration" },
            { key: "repayments", header: "Number Of Repayment", className: "text-nowrap", value: (row) => `${row.repayment_from} - ${row.repayment_to}` },
            { key: "fee_deduct", header: "Deduction", value: (row) => (row.fee_deduct ? "YES" : "NO") },
            { key: "has_penalty", header: "Penarty", value: (row) => (row.has_penalty ? "YES" : "NO") },
            { key: "approve_level", header: "Aprove status", className: "text-nowrap" },
            { key: "topup_percent", header: "Topup percent", render: (row) => percent(row.topup_percent) },
            { key: "take_home_percent", header: "Take home percent", render: (row) => percent(row.take_home_percent) },
            {
              key: "requires_mandate",
              header: "E-Mandate",
              value: (row) => (row.requires_mandate ? "YES" : "NO"),
              render: (row) => <Badge tone={row.requires_mandate ? "info" : "default"}>{row.requires_mandate ? "YES" : "NO"}</Badge>,
            },
            {
              key: "customer_categories",
              header: "Customer Categories",
              className: "text-nowrap",
              value: (row) => (row.customer_categories ?? []).map((item) => item.name).join(", "),
            },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-primary mr-1" onClick={() => setBranchesOf(row)}><i className="icon-list" /></button>
                  <Link href={`/settings/loan-categories/${row.id}/edit`} className="btn btn-sm btn-primary mr-1"><i className="icon-pencil" /></Link>
                  <Link href={`/settings/loan-categories/${row.id}/branches`} className="btn btn-success btn-sm mr-1" title="Assign Branch"><i className="icon-arrow-right" /></Link>
                  <button type="button" className="btn btn-sm btn-danger" onClick={async () => (await confirmAction("Are You Sure?")) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create Loan Category"
        size="xl"
        submitLabel="Save"
        submitting={create.isPending}
        onSubmit={() => create.mutate(form, { onSuccess: () => { setForm(EMPTY_LOAN_CATEGORY); setCreating(false); } })}
      >
        <LoanCategoryFields form={form} setForm={setForm} fieldError={create.fieldError} creating />
      </Modal>

      <Modal open={branchesOf !== null} onClose={() => setBranchesOf(null)} size="lg">
        <table className="table table-hover dataTable table-custom">
          <thead className="thead-primary">
            <tr><th>S/NO.</th><th>Branch Name</th></tr>
          </thead>
          <tbody>
            {(branchesOf?.branches ?? []).map((branch, index) => (
              <tr key={branch.id}><td>{index + 1}.</td><td className="c">{branch.name}</td></tr>
            ))}
          </tbody>
        </table>
      </Modal>
    </>
  );
}
