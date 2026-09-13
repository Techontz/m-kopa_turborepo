"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

interface CustomerRow {
  id: number;
  customer_code: string;
  full_name: string;
  date_of_birth: string | null;
  age: number | null;
  gender: string;
  phone: string;
  branch: string | null;
  status: string;
  status_label: string;
  kyc_status: string;
  category: string | null;
  registration_step: number;
}

const STATUS_TONE: Record<string, "success" | "danger" | "info" | "warning"> = { open: "success", out: "danger", close: "info", pending: "warning" };

export default function AllCustomersPage() {
  const { can } = useAuth();
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState({ branch_id: "", customer_status: "" });
  const [filters, setFilters] = useState({ branch_id: "", customer_status: "" });
  const { data: customers, isLoading } = useApi<CustomerRow[]>("customers", filters);
  const remove = useAction<{ id: number }>("delete", (body) => `customers/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["All Customer"]} />

      <Card
        title="All Customer"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setFilterOpen(true)} title="Filter">
            <i className="icon-magnifier" />
          </button>
        }
      >
        <DataTable
          rows={customers}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer_code", header: "Customer ID" },
            { key: "full_name", header: "customer name", render: (row) => <Link href={`/customers/${row.id}`}>{row.full_name}</Link> },
            { key: "date_of_birth", header: "Date of Birth" },
            { key: "age", header: "Age" },
            { key: "gender", header: "Gender" },
            { key: "phone", header: "Phone number" },
            { key: "branch", header: "Branch" },
            { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <Badge tone={STATUS_TONE[row.status] ?? "default"}>{row.status_label}</Badge> },
            { key: "kyc_status", header: "KYC", render: (row) => (row.kyc_status === "approved" ? <Badge tone="success">Aproved</Badge> : <Badge tone="danger">Pending</Badge>) },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <Link href={`/customers/${row.id}`} className="btn btn-sm btn-icon btn-primary mr-1" title="View"><i className="icon-eye" /></Link>
                  {can("customers.update") && (
                    <button type="button" className="btn btn-sm btn-icon btn-danger" title="Delete" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}>
                      <i className="icon-trash" />
                    </button>
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter"
        submitLabel="Filter"
        onSubmit={() => { setFilters(draft); setFilterOpen(false); }}
      >
        <div className="row">
          <Field label="Branch" className="col-md-12">
            <SelectBox inputId="filter-branch" placeholder="--Select Branch--" optionsUrl="options/branches" query={{ with_all: 1 }} value={draft.branch_id} onChange={(value) => setDraft({ ...draft, branch_id: value ?? "" })} />
          </Field>
          <Field label="Status" className="col-md-12">
            <select className="form-control" value={draft.customer_status} onChange={(e) => setDraft({ ...draft, customer_status: e.target.value })}>
              <option value="">--Select status--</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DEFAULT">DEFAULT</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
