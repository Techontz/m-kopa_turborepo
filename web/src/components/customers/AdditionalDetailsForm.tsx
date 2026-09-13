"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAction, useApi } from "@/lib/hooks";

import type { CustomerProfile } from "./types";

const OTHER_STREET = "__other__";
const MARITAL_STATUSES = ["Single", "Married", "Divorced", "Widowed"];

export interface AdditionalDetailsValues {
  martial_status: string;
  region_code: string;
  district_code: string;
  ward_code: string;
  street_name: string;
  residence_type: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  check_number: string;
  bank_phone: string;
  kin_first_name: string;
  kin_middle_name: string;
  kin_last_name: string;
  kin_phone: string;
  kin_relationship: string;
  famous_area: string;
  bussiness_type: string;
  place_imployment: string;
  number_dependents: string;
  month_income: string;
}

function initialValues(customer: CustomerProfile): AdditionalDetailsValues {
  return {
    martial_status: customer.marital_status ?? "",
    region_code: customer.residence?.region_code ?? "",
    district_code: customer.residence?.district_code ?? "",
    ward_code: customer.residence?.ward_code ?? "",
    street_name: customer.residence?.street_name ?? "",
    residence_type: customer.residence?.ownership ?? "",
    bank_name: customer.bank?.bank_name ?? "",
    account_number: customer.bank?.account_number ?? customer.account_number ?? "",
    account_name: customer.bank?.account_name ?? customer.full_name,
    check_number: customer.bank?.check_number ?? customer.check_number ?? "",
    bank_phone: customer.bank?.phone ?? customer.phone ?? "",
    kin_first_name: customer.next_of_kin?.first_name ?? "",
    kin_middle_name: customer.next_of_kin?.middle_name ?? "",
    kin_last_name: customer.next_of_kin?.last_name ?? "",
    kin_phone: customer.next_of_kin?.phone ?? "",
    kin_relationship: customer.next_of_kin?.relationship ?? "",
    famous_area: customer.nickname ?? "",
    bussiness_type: customer.business_type ?? "",
    place_imployment: customer.place_of_business ?? "",
    number_dependents: customer.dependents !== null ? String(customer.dependents) : "",
    month_income: customer.monthly_income !== null ? String(customer.monthly_income) : "",
  };
}

interface Props {
  customer: CustomerProfile;
  submitLabel?: string;
  onSaved?: () => void;
  /** Show the live "Aditinal Detail" extra fields (famous area, dependents, income). */
  showLiveFields?: boolean;
}

/**
 * Additional customer data (Documents §3): marital status, residence selected Mkoa → Wilaya → Kata → Mtaa
 * plus owned/rented, bank details and next of kin.
 */
export function AdditionalDetailsForm({ customer, submitLabel = "next", onSaved, showLiveFields = true }: Props) {
  const [form, setForm] = useState<AdditionalDetailsValues>(() => initialValues(customer));
  const [streetMode, setStreetMode] = useState<"select" | "other">("select");
  const save = useAction<AdditionalDetailsValues>("put", `customers/${customer.id}/additional`);
  const { data: banks } = useApi<{ BANKS?: string[] }>("customers/categories/option-trees");
  const { data: streets } = useApi<Array<{ value: string; label: string }>>(form.ward_code ? "customers/locations/streets" : null, { ward: form.ward_code });

  const set = (patch: Partial<AdditionalDetailsValues>) => setForm((current) => ({ ...current, ...patch }));
  const error = save.fieldError;

  const streetOptions = [
    ...(streets ?? []),
    ...(form.street_name && !(streets ?? []).some((option) => option.value === form.street_name) && streetMode === "select" ? [{ value: form.street_name, label: form.street_name }] : []),
    { value: OTHER_STREET, label: "+ Nyingine (andika Mtaa mpya)" },
  ];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(form, { onSuccess: () => onSaved?.() });
      }}
    >
      <h6>Taarifa za Ziada</h6>
      <div className="row">
        <Field label="Marital Status:" required className="col-md-4" error={error("martial_status")}>
          <select className="form-control" value={form.martial_status} onChange={(e) => set({ martial_status: e.target.value })} required>
            <option value="">Select</option>
            {MARITAL_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            {form.martial_status && !MARITAL_STATUSES.includes(form.martial_status) && <option value={form.martial_status}>{form.martial_status}</option>}
          </select>
        </Field>
        {showLiveFields && (
          <>
            <Field label="Famous Name:" className="col-md-4" error={error("famous_area")}>
              <input className="form-control" placeholder="Eg. John Doe" value={form.famous_area} onChange={(e) => set({ famous_area: e.target.value })} />
            </Field>
            <Field label="Number of Dependents:" className="col-md-4" error={error("number_dependents")}>
              <input type="number" min={0} className="form-control" placeholder="Number of Dependents" value={form.number_dependents} onChange={(e) => set({ number_dependents: e.target.value })} />
            </Field>
            <Field label="Busines type:" className="col-md-4" error={error("bussiness_type")}>
              <input className="form-control" placeholder="busines type" value={form.bussiness_type} onChange={(e) => set({ bussiness_type: e.target.value })} />
            </Field>
            <Field label="Place Imployment:" className="col-md-4" error={error("place_imployment")}>
              <input className="form-control" placeholder="Place Imployment" value={form.place_imployment} onChange={(e) => set({ place_imployment: e.target.value })} />
            </Field>
            <Field label="Monthly Income:" className="col-md-4" error={error("month_income")}>
              <input className="form-control" placeholder="Monthly Income" value={form.month_income} onChange={(e) => set({ month_income: e.target.value })} />
            </Field>
          </>
        )}
      </div>

      <h6 className="m-t-20">Makazi ya Sasa</h6>
      <div className="row">
        <Field label="Mkoa:" required className="col-md-4" error={error("region_code")}>
          <SelectBox placeholder="-- Chagua Mkoa --" optionsUrl="customers/locations/regions" value={form.region_code} onChange={(value) => set({ region_code: value ?? "", district_code: "", ward_code: "", street_name: "" })} inputId="region_code" />
        </Field>
        <Field label="Wilaya / Mji:" required className="col-md-4" error={error("district_code")}>
          <SelectBox placeholder={form.region_code ? "-- Chagua Wilaya --" : "-- Chagua Mkoa Kwanza --"} optionsUrl="customers/locations/districts" query={{ region: form.region_code }} isDisabled={!form.region_code} value={form.district_code} onChange={(value) => set({ district_code: value ?? "", ward_code: "", street_name: "" })} inputId="district_code" />
        </Field>
        <Field label="Kata:" required className="col-md-4" error={error("ward_code")}>
          <SelectBox placeholder={form.district_code ? "-- Chagua Kata --" : "-- Chagua Wilaya Kwanza --"} optionsUrl="customers/locations/wards" query={{ district: form.district_code }} isDisabled={!form.district_code} value={form.ward_code} onChange={(value) => { set({ ward_code: value ?? "", street_name: "" }); setStreetMode("select"); }} inputId="ward_code" />
        </Field>
        <Field label="Mtaa:" required className="col-md-4" error={error("street_name")}>
          {streetMode === "select" ? (
            <SelectBox
              placeholder={form.ward_code ? "-- Chagua Mtaa --" : "-- Chagua Kata Kwanza --"}
              options={streetOptions}
              isDisabled={!form.ward_code}
              value={form.street_name}
              onChange={(value) => {
                if (value === OTHER_STREET) {
                  setStreetMode("other");
                  set({ street_name: "" });
                } else {
                  set({ street_name: value ?? "" });
                }
              }}
              inputId="street_name"
            />
          ) : (
            <div className="input-group">
              <input className="form-control" placeholder="Andika jina la Mtaa" value={form.street_name} onChange={(e) => set({ street_name: e.target.value })} required autoFocus />
              <div className="input-group-append">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setStreetMode("select"); set({ street_name: "" }); }}>Orodha</button>
              </div>
            </div>
          )}
        </Field>
        <Field label="Makazi:" required className="col-md-4" error={error("residence_type")}>
          <select className="form-control" value={form.residence_type} onChange={(e) => set({ residence_type: e.target.value })} required>
            <option value="">-- Chagua --</option>
            <option value="owned">Nyumba Yake (Owned)</option>
            <option value="rented">Amepanga (Rented)</option>
          </select>
        </Field>
      </div>

      <h6 className="m-t-20">Taarifa za Benki</h6>
      <div className="row">
        <Field label="Bank Name:" required className="col-md-4" error={error("bank_name")}>
          <SelectBox placeholder="Select Bank" options={(banks?.BANKS ?? []).map((bank) => ({ value: bank, label: bank }))} value={form.bank_name} onChange={(value) => set({ bank_name: value ?? "" })} inputId="bank_name" />
        </Field>
        <Field label="Account Number:" required className="col-md-4" error={error("account_number")}>
          <input className="form-control" placeholder="Account Number" value={form.account_number} onChange={(e) => set({ account_number: e.target.value })} required />
        </Field>
        <Field label="Account Name:" required className="col-md-4" error={error("account_name")}>
          <input className="form-control" placeholder="Account Name" value={form.account_name} onChange={(e) => set({ account_name: e.target.value })} required />
        </Field>
        <Field label="Check Number:" className="col-md-4" error={error("check_number")}>
          <input className="form-control" placeholder="Check Number" value={form.check_number} onChange={(e) => set({ check_number: e.target.value })} />
        </Field>
        <Field label="Phone Number:" className="col-md-4" error={error("bank_phone")}>
          <input type="number" className="form-control" placeholder="Eg.0753(XXXX)34" value={form.bank_phone} onChange={(e) => set({ bank_phone: e.target.value })} />
        </Field>
      </div>

      <h6 className="m-t-20">Ndugu wa Karibu (Next of Kin)</h6>
      <div className="row">
        <Field label="Jina la Kwanza:" required className="col-md-3" error={error("kin_first_name")}>
          <input className="form-control" placeholder="First name" value={form.kin_first_name} onChange={(e) => set({ kin_first_name: e.target.value })} required />
        </Field>
        <Field label="Jina la Kati:" className="col-md-3" error={error("kin_middle_name")}>
          <input className="form-control" placeholder="Middle name" value={form.kin_middle_name} onChange={(e) => set({ kin_middle_name: e.target.value })} />
        </Field>
        <Field label="Jina la Ukoo:" required className="col-md-3" error={error("kin_last_name")}>
          <input className="form-control" placeholder="Last name" value={form.kin_last_name} onChange={(e) => set({ kin_last_name: e.target.value })} required />
        </Field>
        <Field label="Simu ya Ndugu:" required className="col-md-3" error={error("kin_phone")}>
          <input type="number" className="form-control" placeholder="07XXXXXXXX" value={form.kin_phone} onChange={(e) => set({ kin_phone: e.target.value })} required />
        </Field>
        <Field label="Uhusiano:" className="col-md-3" error={error("kin_relationship")}>
          <input className="form-control" placeholder="Relationship" value={form.kin_relationship} onChange={(e) => set({ kin_relationship: e.target.value })} />
        </Field>
      </div>

      <div className="text-center m-t-20">
        <button type="submit" className="btn btn-info" disabled={save.isPending}>
          {save.isPending ? "Please wait..." : submitLabel} <i className="icon-arrow-right" />
        </button>
      </div>
    </form>
  );
}
