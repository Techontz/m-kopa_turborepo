"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FreezeStatus } from "@/components/loans/FreezeStatus";
import { LoanFormFields } from "@/components/loans/LoanFormFields";
import { LoanPreview } from "@/components/loans/LoanPreview";
import { LoanSecurities } from "@/components/loans/LoanSecurities";
import { EMPTY_LOAN_FORM, type CategoryOption, type Eligibility, type Loan, type LoanDetail, type LoanForm } from "@/components/loans/types";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface CategoriesResponse {
  data: CategoryOption[];
  groups: Option[];
  eligibility: Eligibility;
}

/** Loan → Loan Application: Search Customer → Loan Application Form (+ eligibility and formula preview) → Guarantors & Collateral. */
export default function LoanApplicationPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [form, setForm] = useState<LoanForm>(EMPTY_LOAN_FORM);
  const [loanId, setLoanId] = useState<number | null>(null);

  const { data: options, isLoading } = useQuery({
    queryKey: ["loans/categories", customerId],
    queryFn: () => api.get<CategoriesResponse>(`loans/customers/${customerId}/categories`),
    enabled: customerId !== "",
  });
  const { data: detail } = useApi<LoanDetail>(loanId ? `loans/${loanId}` : null);
  const create = useAction<LoanForm & { customer_id: string }, { message: string; data: Loan }>("post", "loans");

  const eligibility = options?.eligibility;

  return (
    <>
      <PageHeader crumbs={["Loan", loanId ? "Loan Sponser" : customerId ? "Loan Application Form" : "Loan Aplication"]} />

      {!loanId && (
        <Card title="Search Customer">
          <div className="row">
            <div className="col-lg-6 col-md-8">
              <SelectBox placeholder="Search Customer" optionsUrl="options/customers" query={{ with_code: 1 }} value={customerId} onChange={(value) => { setCustomerId(value ?? ""); setForm(EMPTY_LOAN_FORM); }} />
            </div>
          </div>
        </Card>
      )}

      {customerId && !loanId && (
        <>
          {eligibility && (
            <Card title="Customer Eligibility">
              <div className="row">
                <div className="col-md-3"><b>KYC:</b> {eligibility.rules.kyc_complete ? <span className="badge badge-success">COMPLETE</span> : <span className="badge badge-danger">NOT VERIFIED</span>}</div>
                <div className="col-md-3"><b>Customer Type:</b> {eligibility.rules.category?.name ?? "—"}</div>
                <div className="col-md-3"><b>Risk level:</b> {eligibility.rules.risk_level ?? "—"}</div>
                <div className="col-md-3"><b>Limit:</b> {eligibility.rules.min_amount !== null || eligibility.rules.max_amount !== null ? `${money(eligibility.rules.min_amount)} - ${eligibility.rules.max_amount !== null ? money(eligibility.rules.max_amount) : "∞"}` : "—"}</div>
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
              <form onSubmit={(e) => { e.preventDefault(); create.mutate({ ...form, customer_id: customerId }, { onSuccess: (result) => setLoanId(result.data.id) }); }}>
                <LoanFormFields form={form} setForm={setForm} categories={options?.data ?? []} groups={options?.groups ?? []} fieldError={(field) => create.fieldError(field) ?? (field === "category_id" ? create.fieldError("customer_id") : undefined)} />
                <div className="text-center m-t-20">
                  <button type="submit" className="btn btn-primary mr-1" disabled={create.isPending || eligibility?.allowed === false}>Next</button>
                  <button type="button" className="btn btn-danger" onClick={() => { setCustomerId(""); setForm(EMPTY_LOAN_FORM); }}>Cancel</button>
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
            <p className="mb-0">Loan application registered with status <span className="badge badge-warning">{detail.loan.status_label}</span>. Add guarantors and collateral, then click Finish.</p>
          </Card>
          <LoanSecurities detail={detail} editable />
        </>
      )}
    </>
  );
}
