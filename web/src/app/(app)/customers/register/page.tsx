"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AdditionalDetailsForm } from "@/components/customers/AdditionalDetailsForm";
import { CategoryForm } from "@/components/customers/CategoryForm";
import { DocumentsPanel } from "@/components/customers/DocumentsPanel";
import { FaceCapture } from "@/components/customers/FaceCapture";
import { KycChecklist } from "@/components/customers/KycChecklist";
import { NidaStep } from "@/components/customers/NidaStep";
import { backendUrl, type CustomerProfile } from "@/components/customers/types";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";

const STEPS = ["NIDA & OTP", "Face Verification", "Aditinal Detail", "Customer Category", "Documents & KYC"];

function firstIncompleteStep(customer: CustomerProfile): number {
  const done = Object.fromEntries(customer.kyc.checklist.map((item) => [item.key, item.done]));
  if (!done.face) {
    return 1;
  }
  if (!done.details) {
    return 2;
  }
  if (!done.category) {
    return 3;
  }
  return 4;
}

const STEP_KEYS = [["nida", "otp"], ["face"], ["details"], ["category"], ["documents"]];

function stepDone(customer: CustomerProfile, index: number): boolean {
  return STEP_KEYS[index].every((key) => customer.kyc.checklist.some((item) => item.key === key && item.done));
}

function RegisterCustomer() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useAuth();
  const customerId = params.get("customer");
  const { data: customer, refetch } = useApi<CustomerProfile>(customerId ? `customers/${customerId}` : null);
  const [chosenStep, setChosenStep] = useState<number | null>(null);

  const autoStep = customer ? firstIncompleteStep(customer) : 0;
  const step = customerId ? (chosenStep ?? autoStep) : 0;
  const advance = () => {
    setChosenStep(null);
    void refetch();
  };

  return (
    <>
      <PageHeader crumbs={["Customer", "Customer Registration Form"]} />

      <Card>
        <ul className="nav nav-tabs-new">
          {STEPS.map((label, index) => (
            <li className="nav-item" key={label}>
              <a
                href="#"
                className={`nav-link ${index === step ? "active" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  if (customer && index > 0) {
                    setChosenStep(index);
                  }
                }}
              >
                <i className="icon-user" />
                {label}
                {customer && stepDone(customer, index) ? " ✓" : ""}
              </a>
            </li>
          ))}
        </ul>
      </Card>

      {customerId && !customer ? (
        <Card><p className="mf-loading">Loading...</p></Card>
      ) : (
        <Card>
          {customer && (
            <p className="mb-3">
              <b>{customer.full_name}</b> / {customer.customer_code} · NIDA {customer.id_number} · {customer.branch} ·{" "}
              {customer.kyc_status === "approved" ? <span className="badge badge-success">KYC - Aproved</span> : <span className="badge badge-danger">KYC - Pending</span>}
            </p>
          )}

          {step === 0 && !customer && (
            can("customers.register") ? (
              <NidaStep onRegistered={(id) => router.replace(`/customers/register?customer=${id}`)} />
            ) : (
              <p>You do not have permission to register customers.</p>
            )
          )}

          {customer && step === 1 && (
            <>
              <h6>Hatua ya 2 · Uthibitisho wa Uso (Live Capture)</h6>
              <FaceCapture customerId={customer.id} verifiedAt={customer.kyc.face_verified_at} photoUrl={customer.photo_url ? backendUrl(customer.photo_url) : null} onVerified={advance} />
              {customer.kyc.face_verified_at && (
                <div className="text-center m-t-20">
                  <button type="button" className="btn btn-info" onClick={() => setChosenStep(2)}>next <i className="icon-arrow-right" /></button>
                </div>
              )}
            </>
          )}

          {customer && step === 2 && <AdditionalDetailsForm key={`details-${customer.id}`} customer={customer} showLiveFields={false} onSaved={() => { setChosenStep(3); void refetch(); }} />}

          {customer && step === 3 && (
            can("customers.categorize") ? (
              <CategoryForm key={`category-${customer.id}`} customerId={customer.id} currentCategoryId={customer.category?.id} currentAnswers={customer.kyc.category_answers} onSaved={() => { setChosenStep(4); void refetch(); }} />
            ) : (
              <p>Customer category is assigned by a Loan Officer or Branch Manager.</p>
            )
          )}

          {customer && step === 4 && (
            <div className="row">
              <div className="col-lg-8">
                <h6>Hatua ya 5 · Nyaraka Zinazohitajika ({customer.category?.name ?? "-"})</h6>
                <DocumentsPanel customer={customer} />
              </div>
              <div className="col-lg-4">
                <h6>KYC Checklist</h6>
                <KycChecklist items={customer.kyc.checklist} />
                <div className="m-t-20">
                  <Link href={`/customers/${customer.id}`} className="btn btn-primary mr-2">Customer Profile</Link>
                  {customer.kyc_status === "approved" && can("loans.apply") && (
                    <Link href={`/loans/apply?customer_id=${customer.id}`} className="btn btn-info">Loan Application</Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

export default function RegisterCustomerPage() {
  return (
    <Suspense fallback={null}>
      <RegisterCustomer />
    </Suspense>
  );
}
