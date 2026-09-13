"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { SALARY_TYPES, statusTone } from "@/components/hrm/common";
import { StaffForm, staffToForm, type StaffFormValues } from "@/components/hrm/StaffForm";
import type { AmountItem, StaffDetail } from "@/components/hrm/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

const TABS = [
  ["Basic", "Basic"],
  ["Salary", "Salary"],
  ["allowance", "Allowance"],
  ["advance", "Salary Advance"],
  ["loans", "Loans"],
  ["deduction", "Deduction"],
  ["slip", "Salary Slip"],
] as const;

interface SalaryForm {
  salary: string;
  account_name: string;
  account_number: string;
  fee_salary: string;
  salary_type: string;
  commission_eligible: boolean;
  payment_method: string;
}

function AmountTable({ rows }: { rows: AmountItem[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.id}
      columns={[
        { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
        { key: "amount", header: "Amount", render: (row) => money(row.amount) },
        { key: "description", header: "Description" },
        { key: "status", header: "Status", render: (row) => <Badge tone={row.status === "active" ? "success" : "info"}>{row.status}</Badge> },
        { key: "created_at", header: "Date" },
      ]}
    />
  );
}

export default function StaffProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: staff } = useApi<StaffDetail>(`hrm/staff/${id}`);
  const [tab, setTab] = useState<string>("Basic");
  const [form, setForm] = useState<StaffFormValues | null>(null);
  const [passwords, setPasswords] = useState({ oldpass: "", newpass: "", passconf: "" });
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salary, setSalary] = useState<SalaryForm>({ salary: "", account_name: "", account_number: "", fee_salary: "0", salary_type: "branch", commission_eligible: true, payment_method: "bank" });

  const update = useAction<StaffFormValues>("put", `hrm/staff/${id}`);
  const password = useAction<typeof passwords>("put", `hrm/staff/${id}/password`);
  const saveSalary = useAction<SalaryForm>("put", `hrm/staff/${id}/salary`);
  const photo = useAction<FormData>("post", `hrm/staff/${id}/photo`);

  const basic = form ?? (staff ? staffToForm(staff) : null);

  const openSalary = () => {
    const info = staff?.salary_info;
    setSalary(info
      ? { salary: String(info.salary), account_name: info.account_name, account_number: info.account_number, fee_salary: String(info.fee), salary_type: info.salary_type, commission_eligible: info.commission_eligible, payment_method: info.payment_method }
      : { salary: "", account_name: "", account_number: "", fee_salary: "0", salary_type: staff?.role?.scope === "company" ? "hq" : staff?.role?.scope === "zone" ? "zone_manager" : "branch", commission_eligible: staff?.role?.scope !== "company", payment_method: "bank" });
    setSalaryOpen(true);
  };

  return (
    <>
      <PageHeader crumbs={["Employee", "Employee Profile"]} />

      <div className="card">
        <div className="row profile_state">
          <div className="col-lg-6 col-6">
            <div className="body">
              <div className="profile-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {staff && <img src={staff.photo_url} className="img-thumbnail" alt="employee" style={{ width: 135, height: 135, objectFit: "cover" }} />}
              </div>
              {staff && (
                <div className="m-t-10">
                  <strong className="text-uppercase">{staff.full_name}</strong> <Badge tone={statusTone(staff.status)}>{staff.status.toUpperCase()}</Badge>
                  <div className="text-muted">{staff.employee_number} · {staff.role?.name ?? staff.position}{staff.branch ? ` · ${staff.branch}` : ""}{staff.zone ? ` · ${staff.zone}` : ""}</div>
                </div>
              )}
            </div>
          </div>
          <div className="col-lg-6 col-6">
            <div className="body text-center">
              <span>Upload Passport</span>
              <div className="profile-image">
                <br />
                <br />
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  disabled={photo.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const data = new FormData();
                      data.append("image", file);
                      photo.mutate(data);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="body">
          <ul className="nav nav-tabs-new profile-tabs">
            {TABS.map(([key, label]) => (
              <li className="nav-item" key={key}>
                <a href="#" className={`nav-link ${tab === key ? "active" : ""}`} onClick={(e) => { e.preventDefault(); setTab(key); }}>{label}</a>
              </li>
            ))}
            <li className="nav-item"><Link className="nav-link" href="/hrm/staff">Back</Link></li>
          </ul>
        </div>
      </div>

      {tab === "Basic" && basic && (
        <>
          <div className="card" id="role">
            <div className="body">
              <h6>Basic Information</h6>
              <form onSubmit={(e) => { e.preventDefault(); update.mutate(basic); }}>
                <StaffForm form={basic} setForm={setForm} fieldError={update.fieldError} />
                <br />
                <div className="text-center">
                  <button type="submit" className="btn btn-primary" disabled={update.isPending}>Update</button>
                </div>
              </form>
            </div>
          </div>
          <Card title="Change Password">
            <form onSubmit={(e) => { e.preventDefault(); password.mutate(passwords, { onSuccess: () => setPasswords({ oldpass: "", newpass: "", passconf: "" }) }); }}>
              <div className="row">
                <Field label="Old Password:" className="col-lg-4 col-12" error={password.fieldError("oldpass")}>
                  <input type="password" className="form-control input-sm" placeholder="******" value={passwords.oldpass} onChange={(e) => setPasswords({ ...passwords, oldpass: e.target.value })} required />
                </Field>
                <Field label="New Password:" className="col-lg-4 col-12" error={password.fieldError("newpass")}>
                  <input type="password" className="form-control input-sm" placeholder="******" value={passwords.newpass} onChange={(e) => setPasswords({ ...passwords, newpass: e.target.value })} required />
                </Field>
                <Field label="Confirm Password:" className="col-lg-4 col-12" error={password.fieldError("passconf")}>
                  <input type="password" className="form-control input-sm" placeholder="******" value={passwords.passconf} onChange={(e) => setPasswords({ ...passwords, passconf: e.target.value })} required />
                </Field>
              </div>
              <br />
              <div className="text-center">
                <button type="submit" className="btn btn-primary" disabled={password.isPending}><i className="icon-key" /> Change password</button>
              </div>
            </form>
          </Card>
        </>
      )}

      {tab === "Salary" && staff && (
        <Card title="Salary & Bank Account" actions={!staff.salary_info && <button type="button" className="btn btn-sm btn-primary" onClick={openSalary}><i className="icon-plus" /></button>}>
          <DataTable
            rows={staff.salary_info ? [staff.salary_info] : []}
            searchable={false}
            columns={[
              { key: "account_name", header: "Account Name" },
              { key: "account_number", header: "Account Number" },
              { key: "salary", header: "Amount", render: (row) => money(row.salary) },
              { key: "fee", header: "Fee", render: (row) => money(row.fee) },
              { key: "salary_type_label", header: "Salary Structure" },
              { key: "commission_eligible", header: "Commission", render: (row) => (row.commission_eligible ? "Yes" : "No") },
              { key: "payment_method", header: "Payment Method", className: "text-capitalize" },
              { key: "action", header: "Action", sortable: false, render: () => <button type="button" className="btn btn-sm btn-primary" title="Edit" onClick={openSalary}><i className="icon-pencil" /></button> },
            ]}
          />
          <p className="m-t-10 mb-0">Staff Fund balance: <strong>{money(staff.staff_fund_balance)}</strong></p>
        </Card>
      )}

      {tab === "allowance" && staff && <Card title="Allowance List"><AmountTable rows={staff.allowances} /></Card>}
      {tab === "deduction" && staff && <Card title="Deduction"><AmountTable rows={staff.deductions} /></Card>}

      {tab === "advance" && staff && (
        <Card title="Salary Advance List">
          <DataTable
            rows={staff.salary_advances}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "amount", header: "Amount", render: (row) => money(row.amount) },
              { key: "status", header: "status", render: (row) => <Badge tone={row.status === "pending" ? "danger" : row.status === "rejected" ? "warning" : "success"}>{row.status}</Badge> },
              { key: "created_at", header: "Date" },
            ]}
          />
        </Card>
      )}

      {tab === "loans" && staff && (
        <Card title="All Loans">
          <DataTable
            rows={staff.staff_loans}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "amount_applied", header: "How loan", render: (row) => money(row.amount_applied) },
              { key: "amount_approved", header: "Loan Approved", render: (row) => money(row.amount_approved) },
              { key: "sessions", header: "No.Repayment", render: (row) => `${row.duration.charAt(0).toUpperCase()}${row.duration.slice(1)} / ${row.sessions}` },
              { key: "total_payable", header: "Loan + interest", render: (row) => money(row.total_payable) },
              { key: "restoration", header: "Restoration", render: (row) => money(row.restoration) },
              { key: "paid_amount", header: "Paid Amount", render: (row) => money(row.paid_amount) },
              { key: "remaining_amount", header: "Remain Amount", render: (row) => money(row.remaining_amount) },
              { key: "status", header: "Status", render: (row) => <Badge tone="success">{row.status === "active" ? "Approved" : row.status}</Badge> },
              { key: "created_at", header: "Date" },
            ]}
          />
        </Card>
      )}

      {tab === "slip" && staff && (
        <Card title="Salary slip">
          <DataTable
            rows={staff.salary_payments}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "salary", header: "Salary Amount", render: (row) => money(row.salary) },
              { key: "commission", header: "Commission", render: (row) => money(row.commission) },
              { key: "salary_advance", header: "Salary Advance", render: (row) => money(row.salary_advance) },
              { key: "allowance", header: "Allowance", render: (row) => money(row.allowance) },
              { key: "staff_fund", header: "Staff Fund", render: (row) => money(row.staff_fund) },
              { key: "deduction", header: "Deduction", render: (row) => money(row.deduction) },
              { key: "loan_restoration", header: "Loan Restoration", render: (row) => money(row.loan_restoration) },
              { key: "take_home", header: "Take Home", render: (row) => money(row.take_home) },
              { key: "phone", header: "Phone no" },
              { key: "account_name", header: "Account name" },
              { key: "account_number", header: "Account no" },
              { key: "created_at", header: "Date" },
              { key: "action", header: "Action", sortable: false, render: (row) => <Link href={`/hrm/salary-sheet/payslip/${row.id}`} className="btn btn-sm btn-primary" title="Print"><i className="icon-printer" /></Link> },
            ]}
          />
        </Card>
      )}

      <Modal
        open={salaryOpen}
        onClose={() => setSalaryOpen(false)}
        title="Add Salary Information"
        size="lg"
        submitLabel={staff?.salary_info ? "update" : "Save"}
        submitting={saveSalary.isPending}
        onSubmit={() => saveSalary.mutate(salary, { onSuccess: () => setSalaryOpen(false) })}
      >
        <div className="row clearfix">
          <Field label="Salary Amount:" className="col-lg-6 col-6" error={saveSalary.fieldError("salary")}>
            <input className="form-control input-sm" placeholder="Enter Amount" value={salary.salary} onChange={(e) => setSalary({ ...salary, salary: e.target.value })} required />
          </Field>
          <Field label="Account Name:" className="col-lg-6 col-6" error={saveSalary.fieldError("account_name")}>
            <input className="form-control input-sm" placeholder="Enter Account Name" value={salary.account_name} onChange={(e) => setSalary({ ...salary, account_name: e.target.value })} required />
          </Field>
          <Field label="*Account Number:" className="col-lg-6 col-6" error={saveSalary.fieldError("account_number")}>
            <input className="form-control input-sm" placeholder="Enter Account Number" value={salary.account_number} onChange={(e) => setSalary({ ...salary, account_number: e.target.value })} required />
          </Field>
          <Field label="*Fee:" className="col-lg-6 col-6" error={saveSalary.fieldError("fee_salary")}>
            <input className="form-control input-sm" placeholder="Enter Fee" value={salary.fee_salary} onChange={(e) => setSalary({ ...salary, fee_salary: e.target.value })} required />
          </Field>
          <Field label="Salary Structure:" className="col-lg-6 col-12" error={saveSalary.fieldError("salary_type")}>
            <select className="form-control" value={salary.salary_type} onChange={(e) => setSalary({ ...salary, salary_type: e.target.value, commission_eligible: e.target.value !== "hq" })}>
              {SALARY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </Field>
          <Field label="Commission Eligibility:" className="col-lg-3 col-6">
            <select className="form-control" value={salary.commission_eligible ? "1" : "0"} disabled={salary.salary_type === "hq"} onChange={(e) => setSalary({ ...salary, commission_eligible: e.target.value === "1" })}>
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </Field>
          <Field label="Payment Method:" className="col-lg-3 col-6">
            <select className="form-control" value={salary.payment_method} onChange={(e) => setSalary({ ...salary, payment_method: e.target.value })}>
              <option value="bank">Bank</option>
              <option value="mobile">Mobile</option>
            </select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
