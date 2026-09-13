"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { SelectBox } from "@/components/ui/SelectBox";
import { notifySuccess } from "@/components/ui/notify";
import { useAction } from "@/lib/hooks";

import type { NidaIdentity } from "./types";

interface LookupResult {
  data: { verification_id: string; identity: NidaIdentity; expires_in: number };
  message: string;
}

/**
 * Step 1 — NIDA integration: fetch identity by NIDA number, OTP sent to the NIDA phone, then assign the
 * customer to a branch and loan officer. NIDA data is displayed read-only ("Data za NIDA hazihaririwi manually").
 */
export function NidaStep({ onRegistered }: { onRegistered: (customerId: number) => void }) {
  const [nidaNumber, setNidaNumber] = useState("");
  const [verification, setVerification] = useState<LookupResult["data"] | null>(null);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const lookup = useAction<{ nida_number: string }, LookupResult>("post", "customers/nida/lookup");
  const resend = useAction<{ verification_id: string }>("post", "customers/nida/resend-otp");
  const verify = useAction<{ verification_id: string; otp: string }>("post", "customers/nida/verify");
  const register = useAction<{ verification_id: string; blanch_id: string; empl_id: string }, { data: { id: number } }>("post", "customers/register");

  const identity = verification?.identity;

  const reset = () => {
    setVerification(null);
    setOtp("");
    setOtpVerified(false);
  };

  return (
    <>
      <h6>Hatua ya 1 · Uthibitisho wa NIDA</h6>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          reset();
          lookup.mutate({ nida_number: nidaNumber.replace(/\D/g, "") }, { onSuccess: (result) => setVerification(result.data) });
        }}
      >
        <Field label="Namba ya NIDA:" required className="col-md-6" error={lookup.fieldError("nida_number")}>
          <input className="form-control" inputMode="numeric" maxLength={23} placeholder="Eg. 19900415123450000113" value={nidaNumber} onChange={(e) => { setNidaNumber(e.target.value); reset(); }} required />
        </Field>
        <div className="col-md-3 mb-2 d-flex align-items-end">
          <button type="submit" className="btn btn-primary" disabled={lookup.isPending}>
            <i className="icon-magnifier" /> {lookup.isPending ? "Inatafuta..." : "Tafuta NIDA"}
          </button>
        </div>
      </form>

      {identity && (
        <>
          <h6 className="m-t-20">Taarifa kutoka NIDA <span className="badge badge-success">NIDA Verified</span></h6>
          <div className="row">
            <Field label="First Name:" className="col-md-4"><input className="form-control" value={identity.first_name} readOnly /></Field>
            <Field label="Middle name:" className="col-md-4"><input className="form-control" value={identity.middle_name} readOnly /></Field>
            <Field label="Last name:" className="col-md-4"><input className="form-control" value={identity.last_name} readOnly /></Field>
            <Field label="Gender:" className="col-md-4"><input className="form-control" value={identity.gender} readOnly /></Field>
            <Field label="Date of Birth:" className="col-md-4"><input className="form-control" value={identity.date_of_birth} readOnly /></Field>
            <Field label="Phone Number (NIDA):" className="col-md-4"><input className="form-control" value={identity.phone} readOnly /></Field>
          </div>

          <h6 className="m-t-20">
            Uthibitisho wa OTP {otpVerified && <span className="badge badge-success">OTP Verified</span>}
          </h6>
          {!otpVerified ? (
            <form
              className="row"
              onSubmit={(event) => {
                event.preventDefault();
                verify.mutate({ verification_id: verification.verification_id, otp }, { onSuccess: () => setOtpVerified(true) });
              }}
            >
              <div className="col-md-12 mb-2">OTP imetumwa kwa namba ya simu iliyosajiliwa NIDA: <b>{identity.phone_masked}</b></div>
              <Field label="OTP Code:" required className="col-md-3" error={verify.fieldError("otp") ?? verify.fieldError("verification_id")}>
                <input className="form-control" inputMode="numeric" maxLength={6} placeholder="XXXXXX" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} required />
              </Field>
              <div className="col-md-6 mb-2 d-flex align-items-end">
                <button type="submit" className="btn btn-primary mr-2" disabled={verify.isPending || otp.length !== 6}>
                  <i className="icon-check" /> Thibitisha OTP
                </button>
                <button type="button" className="btn btn-secondary" disabled={resend.isPending} onClick={() => resend.mutate({ verification_id: verification.verification_id }, { onSuccess: () => notifySuccess("OTP sent again") })}>
                  Tuma OTP Tena
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                register.mutate({ verification_id: verification.verification_id, blanch_id: branchId, empl_id: employeeId }, { onSuccess: (result) => onRegistered(result.data.id) });
              }}
            >
              <div className="row">
                <Field label="Branch:" required className="col-md-4" error={register.fieldError("blanch_id")}>
                  <SelectBox inputId="blanch_id" placeholder="Select Branch" optionsUrl="options/branches" value={branchId} onChange={(value) => { setBranchId(value ?? ""); setEmployeeId(""); }} />
                </Field>
                <Field label="Employee:" required className="col-md-4" error={register.fieldError("empl_id")}>
                  <SelectBox inputId="empl_id" placeholder="Select Employee" optionsUrl="options/employees" query={{ branch_id: branchId }} isDisabled={!branchId} value={employeeId} onChange={(value) => setEmployeeId(value ?? "")} />
                </Field>
              </div>
              {register.fieldError("otp") && <div className="field-error">{register.fieldError("otp")}</div>}
              {register.fieldError("verification_id") && <div className="field-error">{register.fieldError("verification_id")}</div>}
              <div className="text-center m-t-20">
                <button type="submit" className="btn btn-info" disabled={register.isPending || !branchId || !employeeId}>
                  next <i className="icon-arrow-right" />
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </>
  );
}
