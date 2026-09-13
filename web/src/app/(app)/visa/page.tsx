"use client";

import { useState } from "react";

import { FilterModal, HeaderButton, type Filters } from "@/components/finance-b/FilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAction, useApi } from "@/lib/hooks";

interface VisaCustomer {
  id: number;
  branch: string | null;
  customer: string;
  phone: string | null;
  bank_account_name: string | null;
  bank_password: string | null;
}

interface AccountForm {
  ac_name: string;
  ac_password: string;
}

export default function VisaPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const [editing, setEditing] = useState<VisaCustomer | null>(null);
  const [form, setForm] = useState<AccountForm>({ ac_name: "", ac_password: "" });
  const { data: customers, isLoading } = useApi<VisaCustomer[]>("visa/customers", { branch_id: filters.branch_id });
  const update = useAction<AccountForm & { id: number }>("put", (body) => `visa/customers/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Bank Account & password"]} />

      <Card title="Bank Account List" actions={<HeaderButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={customers}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, value: (row) => row.id },
            { key: "branch", header: "Branch", render: (row) => row.branch?.toUpperCase() },
            { key: "customer", header: "Customer name" },
            { key: "phone", header: "Phone Number" },
            { key: "bank_account_name", header: "Acount name" },
            { key: "bank_password", header: "VISA" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => (
                <button
                  type="button"
                  className="btn btn-sm btn-icon btn-primary"
                  title="Edit"
                  onClick={() => {
                    setEditing(row);
                    setForm({ ac_name: row.bank_account_name ?? "", ac_password: row.bank_password ?? "" });
                  }}
                >
                  <i className="icon-pencil" />
                </button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit Account & Password"
        submitLabel="Update"
        submitting={update.isPending}
        onSubmit={() => editing && update.mutate({ ...form, id: editing.id }, { onSuccess: () => setEditing(null) })}
      >
        <div className="row clearfix">
          <Field label="Account Name" className="col-md-6" error={update.fieldError("ac_name")}>
            <input type="text" className="form-control" autoComplete="off" value={form.ac_name} onChange={(e) => setForm({ ...form, ac_name: e.target.value })} />
          </Field>
          <Field label="Password" className="col-md-6" error={update.fieldError("ac_password")}>
            <input type="text" className="form-control" autoComplete="off" value={form.ac_password} onChange={(e) => setForm({ ...form, ac_password: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} branchLabel="Branch" branchPlaceholder="Select branch" submitLabel="filter" dates={false} />
    </>
  );
}
