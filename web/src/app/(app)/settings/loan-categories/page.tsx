"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { customerTypeFilterOptions, LOAN_CATEGORY_COLUMNS, MAIN_CATEGORY_OPTIONS_ENDPOINT } from "@/components/settings/loanHierarchy";
import { EMPTY_LOAN_CATEGORY, freezeTimeLabel, LoanCategoryFields, type LoanCategory, type LoanCategoryForm } from "@/components/settings/LoanCategoryFields";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

/** Settings → Loan Categories: the loan products, each under one customer type (its main loan category). `?customerType=` preselects the filter. */
function LoanCategoriesList() {
  const params = useSearchParams();
  const [customerType, setCustomerType] = useState(params.get("customerType") ?? "");
  const { data: categories, isLoading } = useApi<LoanCategory[]>("settings/loan-categories");
  const { data: customerTypes } = useApi<Option[]>(MAIN_CATEGORY_OPTIONS_ENDPOINT);
  const rows = categories?.filter((category) => customerType === "" || String(category.main_category_id) === customerType);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<LoanCategoryForm>(EMPTY_LOAN_CATEGORY);
  const [branchesOf, setBranchesOf] = useState<LoanCategory | null>(null);
  const { data: freezeDefault } = useApi<{ loan_freeze_days: number }>("settings/loan-freeze");
  const openCreate = () => {
    setForm({
      ...form,
      freeze_time_days: form.freeze_time_days === "" && freezeDefault ? String(freezeDefault.loan_freeze_days) : form.freeze_time_days,
      main_category_id: form.main_category_id === "" ? customerType : form.main_category_id,
    });
    setCreating(true);
  };

  const create = useAction<LoanCategoryForm>("post", "settings/loan-categories");
  const remove = useAction<{ id: number }>("delete", (body) => `settings/loan-categories/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Setting", "Loan Categories"]} />

      <Card title="Loan Category List" actions={<button type="button" className="btn btn-sm btn-primary" onClick={openCreate}><i className="icon-plus" /></button>}>
        <div className="row mb-2">
          <div className="col-lg-4 col-md-6">
            <label htmlFor="filter-customer-type" className="sr-only">{LOAN_CATEGORY_COLUMNS[1]}</label>
            <SelectBox inputId="filter-customer-type" placeholder="Customer Type: all" options={customerTypeFilterOptions(customerTypes)} value={customerType} isClearable onChange={(value) => setCustomerType(value ?? "")} />
          </div>
        </div>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: LOAN_CATEGORY_COLUMNS[0], render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "main_category", header: LOAN_CATEGORY_COLUMNS[1], className: "text-nowrap", value: (row) => row.customer_type?.name ?? row.main_category ?? "" },
            { key: "name", header: LOAN_CATEGORY_COLUMNS[2], className: "text-nowrap" },
            { key: "level_label", header: LOAN_CATEGORY_COLUMNS[3], className: "text-nowrap", value: (row) => row.amount_from, render: (row) => row.level_label },
            { key: "amount_to", header: LOAN_CATEGORY_COLUMNS[4], className: "text-nowrap", render: (row) => money(row.amount_to) },
            { key: "interest_rate", header: LOAN_CATEGORY_COLUMNS[5], render: (row) => percent(row.interest_rate) },
            { key: "formula", header: LOAN_CATEGORY_COLUMNS[6] },
            { key: "duration_label", header: LOAN_CATEGORY_COLUMNS[7] },
            { key: "repayments", header: LOAN_CATEGORY_COLUMNS[8], className: "text-nowrap", value: (row) => `${row.repayment_from} - ${row.repayment_to}` },
            { key: "fee_deduct", header: LOAN_CATEGORY_COLUMNS[9], value: (row) => (row.fee_deduct ? "YES" : "NO") },
            { key: "has_penalty", header: LOAN_CATEGORY_COLUMNS[10], value: (row) => (row.has_penalty ? "YES" : "NO") },
            { key: "approve_level", header: LOAN_CATEGORY_COLUMNS[11], className: "text-nowrap" },
            { key: "topup_percent", header: LOAN_CATEGORY_COLUMNS[12], render: (row) => percent(row.topup_percent) },
            { key: "take_home_percent", header: LOAN_CATEGORY_COLUMNS[13], render: (row) => percent(row.take_home_percent) },
            {
              key: "requires_mandate",
              header: LOAN_CATEGORY_COLUMNS[14],
              value: (row) => (row.requires_mandate ? "YES" : "NO"),
              render: (row) => <Badge tone={row.requires_mandate ? "info" : "default"}>{row.requires_mandate ? "YES" : "NO"}</Badge>,
            },
            {
              key: "freeze_time_days",
              header: LOAN_CATEGORY_COLUMNS[15],
              className: "text-nowrap",
              value: (row) => row.freeze_time_days,
              render: (row) => <Badge tone={row.freeze_time_days > 0 ? "info" : "default"}>{freezeTimeLabel(row.freeze_time_days)}</Badge>,
            },
            {
              key: "action",
              header: LOAN_CATEGORY_COLUMNS[16],
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

export default function LoanCategoriesPage() {
  return (
    <Suspense fallback={<div className="mf-loading">Loading...</div>}>
      <LoanCategoriesList />
    </Suspense>
  );
}
