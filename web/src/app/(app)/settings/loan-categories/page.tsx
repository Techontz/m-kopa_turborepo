"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import type { CustomerType } from "@/components/customers/types";
import { CUSTOMER_TYPE_OPTIONS_ENDPOINT, customerTypeFilterOptions, LOAN_CATEGORY_COLUMNS } from "@/components/settings/loanHierarchy";
import { EMPTY_LOAN_CATEGORY, freezeTimeLabel, LoanCategoryFields, type LoanCategory, type LoanCategoryForm } from "@/components/settings/LoanCategoryFields";
import { Badge } from "@/components/ui/Badge";
import { Loading } from "@/components/ui/Loading";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

const yesNo = (value: boolean) => <Badge tone={value ? "success" : "default"}>{value ? "YES" : "NO"}</Badge>;

/** Truncated text cell with the full value as tooltip. */
const clipped = (text: string) => <span className="mf-cell-clip" title={text}>{text}</span>;

/**
 * Settings → Loan Categories: the loan products, each belonging to exactly one customer type. The Customer Type filter is sent
 * to the API (`?customer_type_id=`); `?customerType=` in the page URL preselects it.
 */
function LoanCategoriesList() {
  const params = useSearchParams();
  const [customerType, setCustomerType] = useState(params.get("customerType") ?? "");
  const { data: categories, isLoading } = useApi<LoanCategory[]>("settings/loan-categories", customerType === "" ? undefined : { customer_type_id: customerType });
  const { data: customerTypes } = useApi<CustomerType[]>(CUSTOMER_TYPE_OPTIONS_ENDPOINT);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<LoanCategoryForm>(EMPTY_LOAN_CATEGORY);
  const [branchesOf, setBranchesOf] = useState<LoanCategory | null>(null);
  const { data: freezeDefault } = useApi<{ loan_freeze_days: number }>("settings/loan-freeze");
  const openCreate = () => {
    setForm({
      ...form,
      freeze_time_days: form.freeze_time_days === "" && freezeDefault ? String(freezeDefault.loan_freeze_days) : form.freeze_time_days,
      customer_type_id: form.customer_type_id === "" ? customerType : form.customer_type_id,
    });
    setCreating(true);
  };

  const create = useAction<LoanCategoryForm>("post", "settings/loan-categories");
  const remove = useAction<{ id: number }>("delete", (body) => `settings/loan-categories/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Setting", "Loan Categories"]} />

      <Card title="Loan Category List" actions={<button type="button" className="btn btn-sm btn-primary" title="Create Loan Category" onClick={openCreate}><i className="icon-plus" /></button>}>
        <div className="row mb-2">
          <div className="col-lg-4 col-md-6">
            <label htmlFor="filter-customer-type" className="sr-only">{LOAN_CATEGORY_COLUMNS[1]}</label>
            <SelectBox inputId="filter-customer-type" placeholder="Customer Type: all" options={customerTypeFilterOptions(customerTypes)} value={customerType} isClearable onChange={(value) => setCustomerType(value ?? "")} />
          </div>
        </div>
        <div className="mf-loan-category-table">
          <DataTable
            rows={categories}
            loading={isLoading}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: LOAN_CATEGORY_COLUMNS[0], className: "mf-num", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "customer_type", header: LOAN_CATEGORY_COLUMNS[1], value: (row) => row.customer_type?.name ?? "", render: (row) => clipped(row.customer_type?.name ?? "") },
              { key: "name", header: LOAN_CATEGORY_COLUMNS[2], render: (row) => clipped(row.name) },
              { key: "level_label", header: LOAN_CATEGORY_COLUMNS[3], className: "mf-num", value: (row) => row.amount_from, render: (row) => row.level_label },
              { key: "interest_rate", header: LOAN_CATEGORY_COLUMNS[4], className: "mf-num", render: (row) => percent(row.interest_rate) },
              { key: "formula", header: LOAN_CATEGORY_COLUMNS[5] },
              { key: "duration_label", header: LOAN_CATEGORY_COLUMNS[6] },
              { key: "repayments", header: LOAN_CATEGORY_COLUMNS[7], className: "mf-num", value: (row) => `${row.repayment_from} - ${row.repayment_to}` },
              { key: "fee_deduct", header: LOAN_CATEGORY_COLUMNS[8], value: (row) => (row.fee_deduct ? "YES" : "NO"), render: (row) => yesNo(row.fee_deduct) },
              { key: "has_penalty", header: LOAN_CATEGORY_COLUMNS[9], value: (row) => (row.has_penalty ? "YES" : "NO"), render: (row) => yesNo(row.has_penalty) },
              { key: "approve_level", header: LOAN_CATEGORY_COLUMNS[10] },
              { key: "topup_percent", header: LOAN_CATEGORY_COLUMNS[11], className: "mf-num", render: (row) => percent(row.topup_percent) },
              {
                key: "freeze_time_days",
                header: LOAN_CATEGORY_COLUMNS[12],
                value: (row) => row.freeze_time_days,
                render: (row) => <Badge tone={row.freeze_time_days > 0 ? "info" : "default"}>{freezeTimeLabel(row.freeze_time_days)}</Badge>,
              },
              { key: "take_home_percent", header: LOAN_CATEGORY_COLUMNS[13], className: "mf-num", render: (row) => percent(row.take_home_percent) },
              {
                key: "requires_mandate",
                header: LOAN_CATEGORY_COLUMNS[14],
                value: (row) => (row.requires_mandate ? "YES" : "NO"),
                render: (row) => <Badge tone={row.requires_mandate ? "info" : "default"}>{row.requires_mandate ? "YES" : "NO"}</Badge>,
              },
              {
                key: "action",
                header: LOAN_CATEGORY_COLUMNS[15],
                sortable: false,
                render: (row) => (
                  <div className="mf-row-actions">
                    <button type="button" className="btn btn-sm btn-primary" title="Branches" aria-label="Branches" onClick={() => setBranchesOf(row)}><i className="icon-list" /></button>
                    <Link href={`/settings/loan-categories/${row.id}/edit`} className="btn btn-sm btn-primary" title="Edit" aria-label="Edit"><i className="icon-pencil" /></Link>
                    <Link href={`/settings/loan-categories/${row.id}/branches`} className="btn btn-success btn-sm" title="Assign Branch" aria-label="Assign Branch"><i className="icon-arrow-right" /></Link>
                    <button type="button" className="btn btn-sm btn-danger" title="Delete" aria-label="Delete" onClick={async () => (await confirmAction("Are You Sure?")) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                  </div>
                ),
              },
            ]}
          />
        </div>
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
    <Suspense fallback={<Loading />}>
      <LoanCategoriesList />
    </Suspense>
  );
}
