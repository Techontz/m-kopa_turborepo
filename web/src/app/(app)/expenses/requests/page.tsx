"use client";

import { useState } from "react";

import { BranchExpensesTable } from "@/components/finance/BranchExpensesTable";
import { FilterModal, HeaderButton, type Filters } from "@/components/finance/FilterModal";
import type { ExpenseRequest } from "@/components/finance/types";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

interface RequestForm {
  scope: "branch";
  blanch_id: string;
  ex_id: string;
  req_amount: string;
  req_description: string;
}

const EMPTY: RequestForm = { scope: "branch", blanch_id: "", ex_id: "", req_amount: "", req_description: "" };

export default function ExpenseRequestsPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [form, setForm] = useState<RequestForm>(EMPTY);
  const { data: rows, isLoading } = useApi<ExpenseRequest[]>("expenses/requests", { scope: "branch", branch_id: filters.branch_id });
  const create = useAction<RequestForm>("post", "expenses/requests");

  return (
    <>
      <PageHeader crumbs={["Recommended Expenses"]} />
      <Card
        title="Request Expenses"
        actions={
          <>
            {can(["expenses.approve_branch", "expenses.approve_hq"]) && <span className="mr-1"><HeaderButton onClick={() => setFiltering(true)} /></span>}
            {can("expenses.request") && <HeaderButton icon="icon-pencil" onClick={() => { setForm(EMPTY); setRequesting(true); }} />}
          </>
        }
      >
        <BranchExpensesTable rows={rows} loading={isLoading} />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} withBranch branchesOnly withDates={false} />

      <Modal open={requesting} onClose={() => setRequesting(false)} title="Request Expenses" submitLabel="Request" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setRequesting(false) })}>
        <div className="row clearfix">
          <Field label="Select Branch:" className="col-lg-12" error={create.fieldError("blanch_id")}>
            <SelectBox placeholder="Select Branch" optionsUrl="options/branches" query={{ branches_only: 1 }} value={form.blanch_id} onChange={(value) => setForm({ ...form, blanch_id: value ?? "" })} />
          </Field>
          <Field label="Select Expenses:" className="col-lg-6" error={create.fieldError("ex_id")}>
            <SelectBox placeholder="Select Expenses" optionsUrl="expenses/options/types" query={{ scope: "branch" }} value={form.ex_id} onChange={(value) => setForm({ ...form, ex_id: value ?? "" })} />
          </Field>
          <Field label="Amount:" className="col-lg-6" error={create.fieldError("req_amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.req_amount} onChange={(e) => setForm({ ...form, req_amount: e.target.value })} required />
          </Field>
          <Field label="Description:" className="col-lg-12" error={create.fieldError("req_description")}>
            <textarea className="form-control" rows={4} placeholder="Description" value={form.req_description} onChange={(e) => setForm({ ...form, req_description: e.target.value })} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
