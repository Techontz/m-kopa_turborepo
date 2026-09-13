"use client";

import { useState } from "react";

import { BranchStaffFields, FilterModal, HeaderButton, statusTone, sum, type Filters } from "@/components/hrm/common";
import type { StaffAdvance } from "@/components/hrm/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Lists {
  pending: StaffAdvance[];
  approved: StaffAdvance[];
  disbursed: StaffAdvance[];
}

interface Category {
  id: number;
  name: string;
  amount_from: number;
  amount_to: number;
}

const EMPTY = { blanch_id: "", empl_id: "", fee: "", advance_amount: "" };
const SOURCES: Option[] = [
  { value: "staff_fund_cash", label: "STAFF FUND A/C" },
  { value: "company_cash", label: "COMPANY ACCOUNT (HQ)" },
];

export default function StaffSalaryAdvancePage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"request" | "approved" | "filter" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [disbursing, setDisbursing] = useState<StaffAdvance | null>(null);
  const [source, setSource] = useState("staff_fund_cash");
  const { data, isLoading } = useApi<Lists>("hrm/salary-advances", { ...filters });
  const { data: categories = [] } = useApi<Category[]>("hrm/staff-salary-advance-categories");

  const create = useAction<typeof EMPTY>("post", "hrm/salary-advances");
  const act = useAction<{ id: number; action: string }>("post", (body) => `hrm/salary-advances/${body.id}/${body.action}`);
  const disburse = useAction<{ id: number; ac_id: string }>("post", (body) => `hrm/salary-advances/${body.id}/disburse`);
  const hr = can(["hrm.manage", "payroll.approve"]);
  const finance = can("payroll.pay");

  const waiting = [...(data?.pending ?? []), ...(data?.approved ?? [])];

  return (
    <>
      <PageHeader crumbs={["HRM", "Salary Advance"]} />
      <Card
        title="Salary Advance"
        actions={
          <>
            {can("hrm.manage") && <HeaderButton icon="icon-pencil" title="Request" onClick={() => setModal("request")} />}
            <HeaderButton icon="icon-list" title="Approved List" onClick={() => setModal("approved")} />
            <HeaderButton title="filter" onClick={() => setModal("filter")} />
          </>
        }
      >
        <DataTable
          rows={waiting}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch" },
            { key: "employee", header: "Staff name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "created_at", header: "Date" },
            { key: "status", header: "status", render: (row) => <Badge tone={row.status === "pending" ? "danger" : "info"}>{row.status.toUpperCase()}</Badge> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  {row.status === "pending" && hr && (
                    <button type="button" className="btn btn-sm btn-icon btn-success mr-1" title="Approve" onClick={async () => (await confirmAction("Are You Sure?")) && act.mutate({ id: row.id, action: "approve" })}><i className="icon-like" /></button>
                  )}
                  {row.status === "approved" && finance && (
                    <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Disburse" onClick={() => setDisbursing(row)}><i className="icon-wallet" /></button>
                  )}
                  {hr && (
                    <button type="button" className="btn btn-sm btn-icon btn-danger" title="Delete" onClick={async () => (await confirmAction("Are You Sure?")) && act.mutate({ id: row.id, action: "reject" })}><i className="icon-trash" /></button>
                  )}
                </>
              ),
            },
          ]}
          footer={<tr><td>TOTAL</td><td /><td /><td>{money(sum(waiting, (row) => row.amount))}</td><td /><td /><td /></tr>}
        />
      </Card>

      <Modal open={modal === "request"} onClose={() => setModal(null)} title="Request Salary Advance" size="lg" submitLabel="Request" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => { setModal(null); setForm(EMPTY); } })}>
        <div className="row clearfix">
          <BranchStaffFields branchId={form.blanch_id} employeeId={form.empl_id} onChange={(value) => setForm({ ...form, ...value })} errors={create.fieldError} />
          <Field label="Category:" className="col-lg-6 col-6" error={create.fieldError("fee")}>
            <select className="form-control" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} required>
              <option value="">Select category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}/ {category.amount_from} - {category.amount_to}</option>)}
            </select>
          </Field>
          <Field label="Amount:" className="col-lg-6 col-6" error={create.fieldError("advance_amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.advance_amount} onChange={(e) => setForm({ ...form, advance_amount: e.target.value })} required />
          </Field>
        </div>
      </Modal>

      <Modal open={modal === "approved"} onClose={() => setModal(null)} title="Approved Salary Advance" size="xl">
        <DataTable
          rows={data?.disbursed}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch" },
            { key: "employee", header: "Staff name" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "created_at", header: "Date" },
            { key: "status", header: "status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            { key: "fee", header: "Fee", render: (row) => money(row.fee) },
            { key: "outstanding_amount", header: "Remain to recover", render: (row) => money(row.outstanding_amount) },
            { key: "source_account", header: "Paid from", render: (row) => (row.source_account === "company_cash" ? "COMPANY ACCOUNT" : "STAFF FUND A/C") },
          ]}
        />
      </Modal>

      <Modal open={disbursing !== null} onClose={() => setDisbursing(null)} title="Disburse Salary Advance" submitLabel="Disburse" submitting={disburse.isPending} onSubmit={() => disbursing && disburse.mutate({ id: disbursing.id, ac_id: source }, { onSuccess: () => setDisbursing(null) })}>
        <p>{disbursing?.employee}: <strong>{money(disbursing?.amount)}</strong> (charger {money(disbursing?.fee)})</p>
        <Field label="Account:" className="col-12 px-0" error={disburse.fieldError("amount") ?? disburse.fieldError("ac_id")}>
          <SelectBox options={SOURCES} value={source} onChange={(value) => setSource(value ?? "staff_fund_cash")} />
        </Field>
      </Modal>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />
    </>
  );
}
