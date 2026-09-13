"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { AdditionalDetailsForm } from "@/components/customers/AdditionalDetailsForm";
import { CategoryForm } from "@/components/customers/CategoryForm";
import { DocumentsPanel } from "@/components/customers/DocumentsPanel";
import { FaceCapture } from "@/components/customers/FaceCapture";
import { KycChecklist } from "@/components/customers/KycChecklist";
import { backendUrl, type CustomerProfile, type GuarantorRow } from "@/components/customers/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

type Tab = "basic" | "additional" | "category" | "documents" | "guarantors" | "loans" | "kyc";

interface BasicForm {
  f_name: string;
  m_name: string;
  l_name: string;
  blanch_id: string;
  empl_id: string;
  gender: string;
  date_birth: string;
  phone_no: string;
  region_id: string;
  district: string;
  ward: string;
  street: string;
}

interface GuarantorForm {
  first_name: string;
  middle_name: string;
  last_name: string;
  phone: string;
  gender: string;
  marital_status: string;
  id_number: string;
  relationship: string;
  region_id: string;
  district: string;
  ward: string;
  street: string;
}

const EMPTY_GUARANTOR: GuarantorForm = { first_name: "", middle_name: "", last_name: "", phone: "", gender: "", marital_status: "", id_number: "", relationship: "", region_id: "", district: "", ward: "", street: "" };

interface Balance {
  remain_loan: number;
  salary_advance: number;
  penalty: number;
  loan_fee: number;
  total: number;
  remain_cash: number;
}

function basicForm(customer: CustomerProfile): BasicForm {
  return {
    f_name: customer.first_name,
    m_name: customer.middle_name,
    l_name: customer.last_name,
    blanch_id: String(customer.branch_id),
    empl_id: customer.employee_id ? String(customer.employee_id) : "",
    gender: customer.gender,
    date_birth: customer.date_of_birth ?? "",
    phone_no: customer.phone,
    region_id: customer.region_id ? String(customer.region_id) : "",
    district: customer.district,
    ward: customer.ward,
    street: customer.street,
  };
}

function BasicTab({ customer, canEdit }: { customer: CustomerProfile; canEdit: boolean }) {
  const [form, setForm] = useState<BasicForm>(() => basicForm(customer));
  const update = useAction<BasicForm>("put", `customers/${customer.id}`);
  const locked = customer.kyc.state !== "legacy";
  const set = (patch: Partial<BasicForm>) => setForm((current) => ({ ...current, ...patch }));
  const error = update.fieldError;
  const age = form.date_birth ? new Date().getFullYear() - Number(form.date_birth.slice(0, 4)) : "";

  return (
    <form onSubmit={(event) => { event.preventDefault(); update.mutate(form); }}>
      <h6>Basic Information {locked && <small className="text-muted">(NIDA data — haihaririwi)</small>}</h6>
      <div className="row">
        <Field label="First Name:" className="col-md-4" error={error("f_name")}><input className="form-control" placeholder="First name" value={form.f_name} readOnly={locked} onChange={(e) => set({ f_name: e.target.value })} /></Field>
        <Field label="Middle name:" className="col-md-4" error={error("m_name")}><input className="form-control" placeholder="Middle name" value={form.m_name} readOnly={locked} onChange={(e) => set({ m_name: e.target.value })} /></Field>
        <Field label="Last name:" className="col-md-4" error={error("l_name")}><input className="form-control" placeholder="Last name" value={form.l_name} readOnly={locked} onChange={(e) => set({ l_name: e.target.value })} /></Field>
        <Field label="Branch:" className="col-md-4" error={error("blanch_id")}>
          <SelectBox inputId="basic-branch" optionsUrl="options/branches" value={form.blanch_id} isDisabled={!canEdit} onChange={(value) => set({ blanch_id: value ?? "", empl_id: "" })} />
        </Field>
        <Field label="Employee:" className="col-md-4" error={error("empl_id")}>
          <SelectBox inputId="basic-employee" placeholder="Select Employee" optionsUrl="options/employees" query={{ branch_id: form.blanch_id }} value={form.empl_id} isDisabled={!canEdit} onChange={(value) => set({ empl_id: value ?? "" })} />
        </Field>
        <Field label="Gender:" className="col-md-4" error={error("gender")}>
          <select className="form-control" value={form.gender} disabled={locked} onChange={(e) => set({ gender: e.target.value })}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field label="Date of Birth:" className="col-md-3" error={error("date_birth")}><input type="date" className="form-control" value={form.date_birth} readOnly={locked} onChange={(e) => set({ date_birth: e.target.value })} /></Field>
        <Field label="Year:" className="col-md-2"><input className="form-control" value={age} readOnly /></Field>
        <Field label="Phone Number:" className="col-md-3" error={error("phone_no")}><input type="number" className="form-control" placeholder="Eg.0753(XXXX)34" value={form.phone_no} readOnly={locked} onChange={(e) => set({ phone_no: e.target.value })} /></Field>
        <Field label="NIDA:" className="col-md-4"><input className="form-control" value={customer.id_number ?? ""} readOnly /></Field>
        {locked ? (
          <>
            <Field label="Region:" className="col-md-3"><input className="form-control" value={customer.region ?? ""} readOnly /></Field>
            <Field label="District:" className="col-md-3"><input className="form-control" value={customer.district} readOnly /></Field>
            <Field label="Ward:" className="col-md-3"><input className="form-control" value={customer.ward} readOnly /></Field>
            <Field label="Street:" className="col-md-3"><input className="form-control" value={customer.street} readOnly /></Field>
          </>
        ) : (
          <>
            <Field label="Region:" className="col-md-3" error={error("region_id")}>
              <SelectBox inputId="basic-region" placeholder="Select region" optionsUrl="options/regions" value={form.region_id} onChange={(value) => set({ region_id: value ?? "" })} />
            </Field>
            <Field label="District:" className="col-md-3" error={error("district")}><input className="form-control" placeholder="district" value={form.district} onChange={(e) => set({ district: e.target.value })} /></Field>
            <Field label="Ward:" className="col-md-3" error={error("ward")}><input className="form-control" placeholder="Ward" value={form.ward} onChange={(e) => set({ ward: e.target.value })} /></Field>
            <Field label="Street:" className="col-md-3" error={error("street")}><input className="form-control" placeholder="street" value={form.street} onChange={(e) => set({ street: e.target.value })} /></Field>
          </>
        )}
      </div>
      {canEdit && (
        <div className="text-center m-t-20">
          <button type="submit" className="btn btn-primary" disabled={update.isPending}>Update</button>
        </div>
      )}
    </form>
  );
}

function GuarantorFields({ form, setForm, fieldError }: { form: GuarantorForm; setForm: (form: GuarantorForm) => void; fieldError: (field: string) => string | undefined }) {
  const input = (key: keyof GuarantorForm, label: string, required = false, type = "text") => (
    <Field label={`${label}:`} required={required} className="col-md-4" error={fieldError(key)}>
      <input type={type} className="form-control" placeholder={label} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={required} />
    </Field>
  );
  return (
    <div className="row">
      {input("first_name", "First Name", true)}
      {input("middle_name", "Middle Name")}
      {input("last_name", "Last Name", true)}
      {input("phone", "Phone Number", true, "number")}
      <Field label="Gender:" className="col-md-4" error={fieldError("gender")}>
        <select className="form-control" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </Field>
      <Field label="Martial status:" className="col-md-4" error={fieldError("marital_status")}>
        <select className="form-control" value={form.marital_status} onChange={(e) => setForm({ ...form, marital_status: e.target.value })}>
          <option value="">Select</option>
          {["Married", "Single", "Widow", "Separated", "Devorced"].map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </Field>
      {input("id_number", "Identification No")}
      {input("relationship", "Relationship", true)}
      <Field label="Region:" className="col-md-4" error={fieldError("region_id")}>
        <SelectBox inputId="guarantor-region" placeholder="Select region" optionsUrl="options/regions" value={form.region_id} onChange={(value) => setForm({ ...form, region_id: value ?? "" })} />
      </Field>
      {input("district", "District")}
      {input("ward", "Ward")}
      {input("street", "Street")}
    </div>
  );
}

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const { data: customer, isLoading, refetch } = useApi<CustomerProfile>(`customers/${id}`);
  const [tab, setTab] = useState<Tab>("basic");
  const [statementOpen, setStatementOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [guarantorOpen, setGuarantorOpen] = useState(false);
  const [editingGuarantor, setEditingGuarantor] = useState<GuarantorRow | null>(null);
  const [guarantorForm, setGuarantorForm] = useState<GuarantorForm>(EMPTY_GUARANTOR);
  const { data: balance } = useApi<Balance>(balanceOpen ? `customers/${id}/balance` : null);

  const mark = useAction("post", `customers/${id}/mark`);
  const approveKyc = useAction("post", `customers/${id}/kyc/approve`);
  const sendSms = useAction<{ message: string }>("post", `customers/${id}/sms`);
  const addGuarantor = useAction<GuarantorForm>("post", `customers/${id}/guarantors`);
  const updateGuarantor = useAction<GuarantorForm & { id: number }>("put", (body) => `customers/guarantors/${body.id}`);
  const removeGuarantor = useAction<{ id: number }>("delete", (body) => `customers/guarantors/${body.id}`);

  if (isLoading || !customer) {
    return (
      <>
        <PageHeader crumbs={["Customer", "Customer Profile"]} />
        <Card><p className="mf-loading">{isLoading ? "Loading..." : "Customer not found"}</p></Card>
      </>
    );
  }

  const canUpdate = can("customers.update");
  const canRegister = can("customers.register") || canUpdate;
  const tabLink = (key: Tab, label: string) => (
    <li className="nav-item">
      <a href="#" className={`nav-link ${tab === key ? "active" : ""}`} onClick={(event) => { event.preventDefault(); setTab(key); }}>{label}</a>
    </li>
  );
  const guarantorActive = guarantorOpen ? addGuarantor : updateGuarantor;
  const photo = customer.photo_url ? backendUrl(customer.photo_url) : "/assets/img/male.jpeg";
  const residence = customer.residence;

  return (
    <>
      <PageHeader crumbs={["Customer", "Customer Profile"]} />

      <div className="card profile-header">
        <div className="body">
          <div className="row">
            <div className="col-sm-4">
              <div className="media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="" className="mr-2" />
                <div className="media-body">
                  <b style={{ fontSize: 16 }}>{customer.short_name}</b>
                  <div>{customer.customer_code}</div>
                </div>
              </div>
            </div>
            <div className="col-sm-4">
              {customer.kyc_status === "approved" ? <Badge tone="success">KYC - Aproved</Badge> : <Badge tone="danger">KYC - Pending</Badge>}
              {customer.category && <Badge tone="info">{customer.category.icon} {customer.category.name}</Badge>}
            </div>
            <div className="col-sm-4 position-relative">
              <button type="button" className="btn btn-info dropdown-toggle" onClick={() => setStatementOpen(!statementOpen)}>Statement</button>
              {statementOpen && (
                <div className="dropdown-menu show" style={{ position: "absolute" }}>
                  <Link className="dropdown-item" href={`/reports/statement?customer_id=${customer.id}`}>Customer Statement</Link>
                  <a className="dropdown-item" href="#" onClick={(event) => { event.preventDefault(); setStatementOpen(false); setBalanceOpen(true); }}>Balance</a>
                  <a className="dropdown-item" href="#" onClick={(event) => { event.preventDefault(); setStatementOpen(false); window.print(); }}>Local Government Letter</a>
                </div>
              )}
            </div>
          </div>
          <hr />
          <div className="row profile-summary">
            <div className="col-sm-4">
              <p><b>Create Date:</b> {customer.created_at}</p>
              <p><b>Monthly Income:</b> {money(customer.monthly_income)}</p>
              <p><b>Position:</b> {(customer.business_type ?? "").toUpperCase()}</p>
              <p><b>Age:</b> {customer.age}</p>
              <p><b>Gender:</b> {customer.gender}</p>
              <p><b>Customer status:</b> <Badge tone="info">{customer.status_label}</Badge></p>
            </div>
            <div className="col-sm-4">
              <p><b>Region:</b> {customer.region}</p>
              <p><b>District:</b> {customer.district}</p>
              <p><b>Ward:</b> {customer.ward}</p>
              <p><b>Street:</b> {customer.street} {residence && <small>({residence.ownership === "owned" ? "Owned" : "Rented"})</small>}</p>
              <p><b>Place of bussiness:</b> {customer.place_of_business}</p>
              <p><a href="#" onClick={(event) => event.preventDefault()}>(NIDA)</a> - {customer.id_number}</p>
            </div>
            <div className="col-sm-4">
              <p><b>Phone number:</b> {customer.phone}</p>
              {canUpdate && <p><a href="#" style={{ background: "#dd4b39", color: "#fff", padding: "1px 3px" }} onClick={(event) => { event.preventDefault(); setSmsOpen(true); }}>Send SMS</a></p>}
              <p><b>Loan Officer:</b> {customer.employee} ({customer.branch})</p>
              <p><b>Bank:</b> {customer.bank ? `${customer.bank.bank_name} - ${customer.bank.account_number}` : "-"}</p>
              <p><b>Next of kin:</b> {customer.next_of_kin ? `${customer.next_of_kin.first_name} ${customer.next_of_kin.last_name} (${customer.next_of_kin.phone})` : "-"}</p>
              <p><b>Attachment:</b> {customer.documents.length} document(s)</p>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <ul className="nav nav-tabs-new profile-tabs">
          {tabLink("basic", "Basic")}
          {tabLink("additional", "Aditional Details")}
          {tabLink("category", "Customer Category")}
          {tabLink("documents", "Documents")}
          {tabLink("guarantors", "Guarantors")}
          {tabLink("loans", "All Loans")}
          {canUpdate && (
            <li className="nav-item"><a href="#" className="nav-link" onClick={(event) => { event.preventDefault(); mark.mutate(undefined); }}>{customer.is_marked ? "Unmark" : "Mark"}</a></li>
          )}
          <li className="nav-item"><a href="#" className="nav-link" onClick={(event) => { event.preventDefault(); setBalanceOpen(true); }}>Balance</a></li>
          {tabLink("kyc", "KYC status")}
          <li className="nav-item"><a href="#" className="nav-link" onClick={(event) => { event.preventDefault(); router.push("/customers"); }}>Back</a></li>
        </ul>
      </Card>

      {tab === "basic" && <Card><BasicTab key={customer.id} customer={customer} canEdit={canUpdate} /></Card>}

      {tab === "additional" && (
        <Card>
          <AdditionalDetailsForm key={`additional-${customer.id}`} customer={customer} submitLabel="Update" />
        </Card>
      )}

      {tab === "category" && (
        <Card>
          {customer.kyc.state === "legacy" ? (
            <p>Mteja huyu alisajiliwa kabla ya uthibitisho wa NIDA. Kundi linapangwa baada ya usajili mpya wa NIDA.</p>
          ) : (
            <CategoryForm key={`category-${customer.id}`} customerId={customer.id} currentCategoryId={customer.category?.id} currentAnswers={customer.kyc.category_answers} submitLabel="Update" readOnly={!can("customers.categorize")} />
          )}
        </Card>
      )}

      {tab === "documents" && (
        <Card title="Documents">
          <DocumentsPanel customer={customer} canEdit={canRegister} />
        </Card>
      )}

      {tab === "guarantors" && (
        <Card
          title="Gualantors List"
          actions={canRegister && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setGuarantorForm(EMPTY_GUARANTOR); setGuarantorOpen(true); }}><i className="icon-plus" /></button>
          )}
        >
          <DataTable
            rows={customer.guarantors}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "first_name", header: "First Name" },
              { key: "middle_name", header: "Middle Name" },
              { key: "last_name", header: "Last Name" },
              { key: "phone", header: "Phone Number" },
              { key: "relationship", header: "Relationship" },
              { key: "region", header: "Region" },
              { key: "district", header: "District" },
              { key: "ward", header: "Ward" },
              { key: "street", header: "Street" },
              {
                key: "action",
                header: "Action",
                sortable: false,
                className: "text-nowrap",
                render: (row) => (
                  <>
                    {canRegister && (
                      <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" onClick={() => { setEditingGuarantor(row); setGuarantorForm(Object.fromEntries(Object.keys(EMPTY_GUARANTOR).map((key) => [key, String(row[key as keyof GuarantorRow] ?? "")])) as unknown as GuarantorForm); }}>
                        <i className="icon-pencil" />
                      </button>
                    )}
                    {canUpdate && (
                      <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction()) && removeGuarantor.mutate({ id: row.id })}><i className="icon-trash" /></button>
                    )}
                  </>
                ),
              },
            ]}
          />
        </Card>
      )}

      {tab === "loans" && (
        <Card title="All Loans">
          <DataTable
            rows={customer.loans}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "loan_number", header: "Loan Ac", render: (row) => <Link href={`/loans/${row.id}`}>{row.loan_number}</Link> },
              { key: "product", header: "Loan Product" },
              { key: "interest_rate", header: "Loan Interest", render: (row) => percent(row.interest_rate) },
              { key: "amount_withdrawn", header: "Loan Withdrawal", render: (row) => money(row.amount_withdrawn) },
              { key: "total_payable", header: "Principal + interest", render: (row) => money(row.total_payable) },
              { key: "duration", header: "Duration Type" },
              { key: "sessions", header: "Number of Repayment" },
              { key: "restoration", header: "Restoration", render: (row) => money(row.restoration) },
              { key: "status", header: "Status", render: (row) => <Badge tone={(row.status_badge ?? "default") as BadgeTone}>{row.status}</Badge> },
              { key: "withdrawn_at", header: "Withdrawal Date" },
              { key: "end_date", header: "End Date" },
            ]}
          />
        </Card>
      )}

      {tab === "kyc" && (
        <Card title="KYC status">
          {customer.kyc.state === "legacy" ? (
            <>
              <p>Mteja alisajiliwa kwenye mfumo wa zamani (bila NIDA / uso). KYC: {customer.kyc_status === "approved" ? <Badge tone="success">Aproved</Badge> : <Badge tone="danger">Pending</Badge>}</p>
              {canUpdate && customer.kyc_status !== "approved" && (
                <button type="button" className="btn btn-primary" onClick={async () => (await confirmAction("Are you sure to aprove customer KYC")) && approveKyc.mutate(undefined)}>Aprove KYC</button>
              )}
            </>
          ) : (
            <div className="row">
              <div className="col-md-4">
                <h6>KYC Checklist</h6>
                <KycChecklist items={customer.kyc.checklist} />
                <p className="m-t-20 mb-1"><b>NIDA verified:</b> {customer.kyc.nida_verified_at}</p>
                <p className="mb-1"><b>OTP verified:</b> {customer.kyc.otp_verified_at}</p>
                <p className="mb-1"><b>Face verified:</b> {customer.kyc.face_verified_at ?? "-"} {customer.kyc.face_liveness_score !== null && `(liveness ${Math.round(customer.kyc.face_liveness_score * 100)}%)`}</p>
                <p className="mb-1"><b>KYC completed:</b> {customer.kyc.completed_at ?? "-"}</p>
                {customer.kyc.state === "pending" && canRegister && (
                  <Link href={`/customers/register?customer=${customer.id}`} className="btn btn-info m-t-20">Continue registration</Link>
                )}
              </div>
              <div className="col-md-8">
                {canRegister ? (
                  <FaceCapture customerId={customer.id} verifiedAt={customer.kyc.face_verified_at} photoUrl={customer.photo_url ? backendUrl(customer.photo_url) : null} onVerified={() => void refetch()} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  customer.photo_url && <img src={photo} alt="Face" style={{ maxWidth: 320 }} />
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      <Modal open={balanceOpen} onClose={() => setBalanceOpen(false)} title="Customer Balance">
        <table className="table table-hover table-custom">
          <thead className="thead-info"><tr><th>S/no</th><th>Description</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>1.</td><td>Remain Loan Amount</td><td>{money(balance?.remain_loan)}</td></tr>
            <tr><td>2.</td><td>Salary Advance</td><td>{money(balance?.salary_advance)}</td></tr>
            <tr><td>3.</td><td>Penalty Amount</td><td>{money(balance?.penalty)}</td></tr>
            <tr><td>4.</td><td>Loan Fee</td><td>{money(balance?.loan_fee)}</td></tr>
            <tr><th /><th>TOTAL</th><th>{money(balance?.total)}</th></tr>
            <tr><th /><th>TAKE HOME</th><th>{money(balance?.remain_cash)}</th></tr>
          </tbody>
        </table>
      </Modal>

      <Modal open={smsOpen} onClose={() => setSmsOpen(false)} title="Send SMS" submitLabel="Send" submitting={sendSms.isPending} onSubmit={() => sendSms.mutate({ message: smsText }, { onSuccess: () => { setSmsOpen(false); setSmsText(""); } })}>
        <span>Phone number: {customer.phone}</span>
        <textarea className="form-control" rows={4} placeholder="Enter message" value={smsText} onChange={(e) => setSmsText(e.target.value)} required />
        {sendSms.fieldError("message") && <div className="field-error">{sendSms.fieldError("message")}</div>}
      </Modal>

      <Modal
        open={guarantorOpen || editingGuarantor !== null}
        onClose={() => { setGuarantorOpen(false); setEditingGuarantor(null); }}
        title={editingGuarantor ? "Edit Guarantor" : "Register Guarantor"}
        size="lg"
        submitLabel={editingGuarantor ? "Update" : "Save"}
        submitting={guarantorActive.isPending}
        onSubmit={() => {
          const close = { onSuccess: () => { setGuarantorOpen(false); setEditingGuarantor(null); } };
          if (editingGuarantor) {
            updateGuarantor.mutate({ ...guarantorForm, id: editingGuarantor.id }, close);
          } else {
            addGuarantor.mutate(guarantorForm, close);
          }
        }}
      >
        <GuarantorFields form={guarantorForm} setForm={setGuarantorForm} fieldError={guarantorActive.fieldError} />
      </Modal>
    </>
  );
}
