"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FreezeStatus } from "@/components/loans/FreezeStatus";
import { GuarantorModal, type GuarantorDisplay, type GuarantorEntry } from "@/components/loans/GuarantorModal";
import { applicationCategoryEmptyState } from "@/components/settings/loanHierarchy";
import { LoanFormFields } from "@/components/loans/LoanFormFields";
import { LoanPreview } from "@/components/loans/LoanPreview";
import { LoanSecurities } from "@/components/loans/LoanSecurities";
import { EMPTY_LOAN_FORM, type CategoryOption, type Eligibility, type Loan, type LoanDetail, type LoanForm } from "@/components/loans/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface CategoriesResponse {
  /** Only the active loan categories of the customer's customer type (API-filtered). */
  data: CategoryOption[];
  customer_type: { id: number; code: string | null; name: string } | null;
  groups: Option[];
  eligibility: Eligibility;
}

/** A guarantor picked on the first form: kept here and sent with the application. */
interface PendingGuarantor {
  key: number;
  entry: GuarantorEntry;
  display: GuarantorDisplay;
  /** The Import option value ("g:…" / "c:…"), so the same person is not offered twice. */
  picked: string | null;
}

/** Loan → Loan Application: Search Customer → Guarantors → Loan Application Form (+ eligibility and formula preview) → Collateral. */
export default function LoanApplicationPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [form, setForm] = useState<LoanForm>(EMPTY_LOAN_FORM);
  const [loanId, setLoanId] = useState<number | null>(null);
  const [guarantors, setGuarantors] = useState<PendingGuarantor[]>([]);
  const [guarantorMode, setGuarantorMode] = useState<"import" | "add" | null>(null);

  const { data: options, isLoading } = useQuery({
    queryKey: ["loans/categories", customerId],
    queryFn: () => api.get<CategoriesResponse>(`loans/customers/${customerId}/categories`),
    enabled: customerId !== "",
  });
  const { data: detail } = useApi<LoanDetail>(loanId ? `loans/${loanId}` : null);
  const create = useAction<LoanForm & { customer_id: string; guarantors: GuarantorEntry[] }, { message: string; data: Loan }>("post", "loans");
  // The API reports a bad guarantor as "guarantors.<row>.<field>".
  const guarantorErrors = Object.entries(create.errors)
    .filter(([field]) => field.startsWith("guarantors."))
    .map(([field, messages]) => {
      const row = guarantors[Number(field.split(".")[1])];
      return `${row ? `${row.display.full_name}: ` : ""}${messages[0]}`;
    });
  const resetCustomer = (value: string) => { setCustomerId(value); setForm(EMPTY_LOAN_FORM); setGuarantors([]); };

  const eligibility = options?.eligibility;
  const emptyMessage = options ? applicationCategoryEmptyState(options.customer_type, options.data.length) : null;

  return (
    <>
      <PageHeader crumbs={["Loan", loanId ? "Loan Sponser" : customerId ? "Loan Application Form" : "Loan Aplication"]} />

      {!loanId && (
        <Card title="Search Customer">
          <div className="row">
            <div className="col-lg-6 col-md-8">
              <SelectBox placeholder="Search Customer" optionsUrl="options/customers" query={{ with_code: 1 }} value={customerId} onChange={(value) => resetCustomer(value ?? "")} />
            </div>
          </div>
        </Card>
      )}

      {customerId && !loanId && (
        <>
          <Card title="Guarantors List" actions={(
            <>
              <button type="button" className="btn btn-sm btn-info mr-1" onClick={() => setGuarantorMode("import")}><i className="icon-cloud-download" /> Import Guarantor</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setGuarantorMode("add")}><i className="icon-plus" /> Add Guarantor</button>
            </>
          )}>
            {guarantorErrors.map((message) => <div key={message} className="alert alert-danger py-1">{message}</div>)}
            <DataTable
              rows={guarantors}
              searchable={false}
              rowKey={(row) => row.key}
              columns={[
                { key: "sn", header: "S/N", render: (_, index) => `${index + 1}.`, sortable: false },
                { key: "full_name", header: "Full Name", render: (row) => row.display.full_name },
                { key: "phone", header: "Phone Number", render: (row) => row.display.phone },
                { key: "relationship", header: "Relationship", render: (row) => row.display.relationship },
                {
                  key: "action",
                  header: "Action",
                  sortable: false,
                  render: (row) => (
                    <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={() => setGuarantors(guarantors.filter((g) => g.key !== row.key))}><i className="icon-trash" /></button>
                  ),
                },
              ]}
            />
            <p className="mb-0 mt-2 text-muted">Guarantors are saved together with the application when you click <b>Next</b>.</p>
          </Card>

          {guarantorMode && (
            <GuarantorModal
              mode={guarantorMode}
              onClose={() => setGuarantorMode(null)}
              candidatesUrl={`loans/customers/${customerId}/guarantor-candidates`}
              exclude={guarantors.flatMap((g) => (g.picked ? [g.picked] : []))}
              onSubmit={(entry, display, picked) => {
                setGuarantors([...guarantors, { key: Date.now(), entry, display, picked }]);
                setGuarantorMode(null);
              }}
            />
          )}

          {eligibility && (
            <Card title="Customer Eligibility">
              <div className="row">
                <div className="col-md-3"><b>KYC:</b> {eligibility.rules.kyc_complete ? <span className="badge badge-success">COMPLETE</span> : <span className="badge badge-danger">NOT VERIFIED</span>}</div>
                <div className="col-md-3"><b>Customer Type:</b> {options?.customer_type?.name ?? <span className="badge badge-warning">NOT ASSIGNED</span>}</div>
                <div className="col-md-3"><b>Risk level:</b> {eligibility.rules.risk_level ?? "—"}</div>
                <div className="col-md-3"><b>Loan categories:</b> {options?.data.length ?? 0}</div>
              </div>
              {eligibility.topup && (
                <p className="mt-2 mb-0"><b>Top-up of {eligibility.topup.loan_number}:</b> paid {eligibility.topup.paid_percent}% of required {eligibility.topup.required_percent}% · outstanding {money(eligibility.topup.outstanding)} {eligibility.topup.eligible ? <span className="badge badge-success">ELIGIBLE</span> : <span className="badge badge-danger">NOT ELIGIBLE</span>}</p>
              )}
              <div className="mt-2"><FreezeStatus freeze={eligibility.freeze} eligible={eligibility.eligible} /></div>
              {eligibility.eligibility_reasons.map((reason) => <div key={reason} className="alert alert-danger py-1 mt-2 mb-0">{reason}</div>)}
            </Card>
          )}

          <Card title="Loan Application Form">
            {isLoading ? <p>Loading...</p> : (
              <form onSubmit={(e) => { e.preventDefault(); create.mutate({ ...form, customer_id: customerId, guarantors: guarantors.map((g) => g.entry) }, { onSuccess: (result) => setLoanId(result.data.id) }); }}>
                {emptyMessage && options?.customer_type && <div className="alert alert-warning py-1">{emptyMessage}</div>}
                <LoanFormFields form={form} setForm={setForm} categories={options?.data ?? []} emptyMessage={emptyMessage} groups={options?.groups ?? []} fieldError={(field) => create.fieldError(field) ?? (field === "category_id" ? create.fieldError("customer_id") : undefined)} />
                <div className="text-center m-t-20">
                  <button type="submit" className="btn btn-primary mr-1" disabled={create.isPending || eligibility?.allowed === false}>Next</button>
                  <button type="button" className="btn btn-danger" onClick={() => resetCustomer("")}>Cancel</button>
                </div>
              </form>
            )}
          </Card>

          <Card title="Loan Calculation Preview">
            <LoanPreview form={form} />
          </Card>
        </>
      )}

      {loanId && detail && (
        <>
          <Card title={`Loan ${detail.loan.loan_number} — ${detail.customer.full_name}`} actions={<button type="button" className="btn btn-sm btn-success" onClick={() => router.push(`/loans/${loanId}`)}>Finish</button>}>
            <p className="mb-0">Loan application registered with status <span className="badge badge-warning">{detail.loan.status_label}</span>. Add collateral (and any further guarantors), then click Finish.</p>
          </Card>
          <LoanSecurities detail={detail} editable />
        </>
      )}
    </>
  );
}
