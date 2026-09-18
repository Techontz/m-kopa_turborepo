"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox, type OptionGroup } from "@/components/ui/SelectBox";
import { api } from "@/lib/api";

const EMPTY_GUARANTOR = { first_name: "", middle_name: "", last_name: "", phone: "", gender: "", relationship: "", id_number: "", region_id: "", district: "", ward: "", street: "" };

/** What the API takes for one guarantor: `guarantor_id`, `customer_id` + `relationship`, or the full form. */
export type GuarantorEntry = Record<string, string>;

/** How a picked guarantor is shown in a list before the API has stored it. */
export interface GuarantorDisplay {
  full_name: string;
  phone: string;
  relationship: string;
}

interface GuarantorModalProps {
  mode: "import" | "add";
  onClose: () => void;
  /** API path returning `{ data: OptionGroup[] }` — saved guarantors ("g:<id>") and branch customers ("c:<id>"). */
  candidatesUrl: string;
  /** Option values already picked (not yet saved), hidden from Import. */
  exclude?: string[];
  submitting?: boolean;
  fieldError?: (field: string) => string | undefined;
  onSubmit: (entry: GuarantorEntry, display: GuarantorDisplay, pickedValue: string | null) => void;
}

/**
 * Import Guarantor / Add Guarantor. Used on the first application form (guarantors kept until the application is sent)
 * and on the Loan Sponser step of a registered application. Render it only while open, so every opening starts empty.
 */
export function GuarantorModal({ mode, onClose, candidatesUrl, exclude = [], submitting, fieldError: apiError = () => undefined, onSubmit }: GuarantorModalProps) {
  const [guarantor, setGuarantor] = useState(EMPTY_GUARANTOR);
  /** "g:<guarantor id>" for a saved guarantor, "c:<customer id>" for another customer of the branch. */
  const [picked, setPicked] = useState("");
  const [relationship, setRelationship] = useState("");
  /** Required-field check done here, because on the application form nothing reaches the API until it is sent. */
  const [missing, setMissing] = useState<string[]>([]);

  const candidates = useQuery({
    queryKey: ["guarantor-candidates", candidatesUrl],
    queryFn: () => api.get<{ data: OptionGroup[] }>(candidatesUrl).then((response) => response.data),
    enabled: mode === "import",
  });
  const groups = (candidates.data ?? [])
    .map((group) => ({ ...group, options: group.options.filter((option) => !exclude.includes(option.value)) }))
    .filter((group) => group.options.length > 0);
  const options = groups.flatMap((group) => group.options);
  const importingCustomer = picked.startsWith("c:");

  const fieldError = (field: string) => (missing.includes(field) ? "This field is required" : apiError(field));

  const set = (key: keyof typeof EMPTY_GUARANTOR, value: string) => setGuarantor({ ...guarantor, [key]: value });

  const submit = () => {
    const required = mode === "add"
      ? (["first_name", "last_name", "phone", "relationship"] as const).filter((key) => guarantor[key].trim() === "")
      : [...(picked === "" ? ["guarantor_id"] : []), ...(picked.startsWith("c:") && relationship.trim() === "" ? ["relationship"] : [])];
    setMissing(required);
    if (required.length > 0) {
      return;
    }

    if (mode === "add") {
      const entry = Object.fromEntries(Object.entries(guarantor).filter(([, value]) => value !== ""));
      onSubmit(entry, { full_name: [guarantor.first_name, guarantor.middle_name, guarantor.last_name].filter(Boolean).join(" "), phone: guarantor.phone, relationship: guarantor.relationship }, null);
      return;
    }

    const [kind, id = ""] = picked.split(":");
    const label = options.find((option) => option.value === picked)?.label ?? "";
    const [fullName = "", phone = ""] = label.split(" / ");
    const entry: GuarantorEntry = kind === "c" ? { customer_id: id, relationship } : { guarantor_id: id };
    onSubmit(entry, { full_name: fullName, phone, relationship: kind === "c" ? relationship : "—" }, picked);
  };

  const importError = fieldError("guarantor_id") ?? fieldError("customer_id");

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "import" ? "Import Guarantor" : "Add Guarantor"}
      size="lg"
      submitLabel={mode === "import" ? (options.length > 0 ? "Import" : undefined) : "Save"}
      submitting={submitting}
      onSubmit={submit}
    >
      <div className="row">
        {mode === "import" && (
          candidates.isLoading ? (
            <p className="col-md-12 mb-0">Loading…</p>
          ) : options.length > 0 ? (
            <>
              <Field label="Guarantor (saved guarantor or a customer of this branch):" required className={importingCustomer ? "col-md-8" : "col-md-12"} error={importError}>
                <SelectBox placeholder="Select guarantor" options={groups} value={picked} isClearable onChange={(value) => setPicked(value ?? "")} />
              </Field>
              {importingCustomer && (
                <Field label="Relationship:" required className="col-md-4" error={fieldError("relationship")}>
                  <input className="form-control" value={relationship} onChange={(e) => setRelationship(e.target.value)} />
                </Field>
              )}
            </>
          ) : (
            <p className="col-md-12 mb-0">There is nobody in this branch to import. Use <b>Add Guarantor</b> to register a new one.</p>
          )
        )}
        {mode === "add" && (
          <>
            <Field label="First name:" required className="col-md-4" error={fieldError("first_name")}><input className="form-control" value={guarantor.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
            <Field label="Middle name:" className="col-md-4" error={fieldError("middle_name")}><input className="form-control" value={guarantor.middle_name} onChange={(e) => set("middle_name", e.target.value)} /></Field>
            <Field label="Last name:" required className="col-md-4" error={fieldError("last_name")}><input className="form-control" value={guarantor.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
            <Field label="Phone number:" required className="col-md-4" error={fieldError("phone")}><input type="number" className="form-control" placeholder="255XXXXXXXXX" value={guarantor.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Gender:" className="col-md-4" error={fieldError("gender")}>
              <select className="form-control" value={guarantor.gender} onChange={(e) => set("gender", e.target.value)}><option value="">Select</option><option value="male">male</option><option value="female">female</option></select>
            </Field>
            <Field label="Relationship:" required className="col-md-4" error={fieldError("relationship")}><input className="form-control" value={guarantor.relationship} onChange={(e) => set("relationship", e.target.value)} /></Field>
            <Field label="Identification No:" className="col-md-4" error={fieldError("id_number")}><input className="form-control" value={guarantor.id_number} onChange={(e) => set("id_number", e.target.value)} /></Field>
            <Field label="Region:" className="col-md-4" error={fieldError("region_id")}>
              <SelectBox placeholder="Select Region" optionsUrl="options/regions" value={guarantor.region_id} onChange={(value) => set("region_id", value ?? "")} />
            </Field>
            <Field label="District:" className="col-md-4"><input className="form-control" value={guarantor.district} onChange={(e) => set("district", e.target.value)} /></Field>
            <Field label="Ward:" className="col-md-6"><input className="form-control" value={guarantor.ward} onChange={(e) => set("ward", e.target.value)} /></Field>
            <Field label="Street:" className="col-md-6"><input className="form-control" value={guarantor.street} onChange={(e) => set("street", e.target.value)} /></Field>
          </>
        )}
      </div>
    </Modal>
  );
}
