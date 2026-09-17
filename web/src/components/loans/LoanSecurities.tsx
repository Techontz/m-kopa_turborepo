"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

import type { LoanDetail } from "./types";

const EMPTY_GUARANTOR = { first_name: "", middle_name: "", last_name: "", phone: "", gender: "", relationship: "", id_number: "", region_id: "", district: "", ward: "", street: "" };
const EMPTY_COLLATERAL = { colateral_name: "", colateral_type: "", colateral_location: "", colateral_value: "" };

/** Guarantors List + Collateral List (live loan_sponser / view_Dataloan), editable while the application is pending. */
export function LoanSecurities({ detail, editable }: { detail: LoanDetail; editable: boolean }) {
  const loanId = detail.loan.id;
  const [guarantorMode, setGuarantorMode] = useState<"import" | "add" | null>(null);
  const [guarantor, setGuarantor] = useState(EMPTY_GUARANTOR);
  const [existing, setExisting] = useState("");
  const [collateral, setCollateral] = useState(EMPTY_COLLATERAL);
  const [attachment, setAttachment] = useState<File | null>(null);

  const addGuarantor = useAction<Record<string, string>>("post", `loans/${loanId}/guarantors`);
  const removeGuarantor = useAction<{ id: number }>("delete", (body) => `loans/${loanId}/guarantors/${body.id}`);
  const addCollateral = useAction<FormData>("post", `loans/${loanId}/collaterals`);
  const removeCollateral = useAction<{ id: number }>("delete", (body) => `loans/${loanId}/collaterals/${body.id}`);

  const set = (key: keyof typeof EMPTY_GUARANTOR, value: string) => setGuarantor({ ...guarantor, [key]: value });

  return (
    <>
      <Card title="Guarantors List" actions={editable && (
        <>
          <button type="button" className="btn btn-sm btn-info mr-1" onClick={() => setGuarantorMode("import")}><i className="icon-cloud-download" /> Import Guarantor</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setGuarantorMode("add")}><i className="icon-plus" /> Add Guarantor</button>
        </>
      )}>
        <DataTable
          rows={detail.guarantors}
          searchable={false}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/N", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "full_name", header: "Full Name" },
            { key: "phone", header: "Phone Number" },
            { key: "relationship", header: "Relationship" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => editable && (
                <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction()) && removeGuarantor.mutate({ id: row.id })}><i className="icon-trash" /></button>
              ),
            },
          ]}
        />
      </Card>

      <Card title="Collateral List">
        {editable && (
          <form
            className="mb-3"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData();
              Object.entries(collateral).forEach(([key, value]) => data.append(key, value));
              if (attachment) {
                data.append("attachment", attachment);
              }
              addCollateral.mutate(data, { onSuccess: () => { setCollateral(EMPTY_COLLATERAL); setAttachment(null); } });
            }}
          >
            <div className="row">
              <Field label="Collateral name:" required className="col-md-3" error={addCollateral.fieldError("colateral_name")}>
                <input className="form-control" placeholder="Collateral name" value={collateral.colateral_name} onChange={(e) => setCollateral({ ...collateral, colateral_name: e.target.value })} required />
              </Field>
              <Field label="Collateral Type:" required className="col-md-3" error={addCollateral.fieldError("colateral_type")}>
                <input className="form-control" placeholder="Collateral Type" value={collateral.colateral_type} onChange={(e) => setCollateral({ ...collateral, colateral_type: e.target.value })} required />
              </Field>
              <Field label="Collateral Location:" required className="col-md-2" error={addCollateral.fieldError("colateral_location")}>
                <input className="form-control" placeholder="Collateral Location" value={collateral.colateral_location} onChange={(e) => setCollateral({ ...collateral, colateral_location: e.target.value })} required />
              </Field>
              <Field label="Collateral Value:" required className="col-md-2" error={addCollateral.fieldError("colateral_value")}>
                <input type="number" className="form-control" placeholder="Collateral Value" value={collateral.colateral_value} onChange={(e) => setCollateral({ ...collateral, colateral_value: e.target.value })} required />
              </Field>
              <Field label="Attachment (PDF):" className="col-md-2" error={addCollateral.fieldError("attachment")}>
                <input type="file" accept="application/pdf" className="form-control" onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} />
              </Field>
            </div>
            <div className="text-center"><button type="submit" className="btn btn-primary btn-sm" disabled={addCollateral.isPending}>Save</button></div>
          </form>
        )}
        <DataTable
          rows={detail.collaterals}
          searchable={false}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/N", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Collateral Name" },
            { key: "type", header: "Collateral type" },
            { key: "value", header: "Collateral Value", render: (row) => money(row.value) },
            { key: "location", header: "Collateral Location" },
            {
              key: "action",
              header: "",
              sortable: false,
              render: (row) => editable && (
                <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction()) && removeCollateral.mutate({ id: row.id })}><i className="icon-trash" /></button>
              ),
            },
          ]}
        />
        <p className="mb-0"><b>General collateral Attachment: </b>{detail.collateral_attachment ? <a href={detail.collateral_attachment} target="_blank" rel="noreferrer">View attachment</a> : "—"}</p>
      </Card>

      <Modal
        open={guarantorMode !== null}
        onClose={() => setGuarantorMode(null)}
        title={guarantorMode === "import" ? "Import Guarantor" : "Add Guarantor"}
        size="lg"
        submitLabel={guarantorMode === "import" ? (detail.available_guarantors.length > 0 ? "Import" : undefined) : "Save"}
        submitting={addGuarantor.isPending}
        onSubmit={() => {
          const body = guarantorMode === "import" ? { guarantor_id: existing } : Object.fromEntries(Object.entries(guarantor).filter(([, value]) => value !== ""));
          addGuarantor.mutate(body, { onSuccess: () => { setGuarantorMode(null); setGuarantor(EMPTY_GUARANTOR); setExisting(""); } });
        }}
      >
        <div className="row">
          {guarantorMode === "import" && (
            detail.available_guarantors.length > 0 ? (
              <Field label="Guarantor of the customer (profile or previous loans):" required className="col-md-12" error={addGuarantor.fieldError("guarantor_id")}>
                <SelectBox placeholder="Select guarantor" options={detail.available_guarantors} value={existing} isClearable onChange={(value) => setExisting(value ?? "")} />
              </Field>
            ) : (
              <p className="col-md-12 mb-0">This customer has no saved guarantors to import. Use <b>Add Guarantor</b> to register a new one.</p>
            )
          )}
          {guarantorMode === "add" && (
            <>
              <Field label="First name:" required className="col-md-4" error={addGuarantor.fieldError("first_name")}><input className="form-control" value={guarantor.first_name} onChange={(e) => set("first_name", e.target.value)} /></Field>
              <Field label="Middle name:" className="col-md-4" error={addGuarantor.fieldError("middle_name")}><input className="form-control" value={guarantor.middle_name} onChange={(e) => set("middle_name", e.target.value)} /></Field>
              <Field label="Last name:" required className="col-md-4" error={addGuarantor.fieldError("last_name")}><input className="form-control" value={guarantor.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
              <Field label="Phone number:" required className="col-md-4" error={addGuarantor.fieldError("phone")}><input type="number" className="form-control" placeholder="255XXXXXXXXX" value={guarantor.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Gender:" className="col-md-4" error={addGuarantor.fieldError("gender")}>
                <select className="form-control" value={guarantor.gender} onChange={(e) => set("gender", e.target.value)}><option value="">Select</option><option value="male">male</option><option value="female">female</option></select>
              </Field>
              <Field label="Relationship:" required className="col-md-4" error={addGuarantor.fieldError("relationship")}><input className="form-control" value={guarantor.relationship} onChange={(e) => set("relationship", e.target.value)} /></Field>
              <Field label="Identification No:" className="col-md-4" error={addGuarantor.fieldError("id_number")}><input className="form-control" value={guarantor.id_number} onChange={(e) => set("id_number", e.target.value)} /></Field>
              <Field label="Region:" className="col-md-4" error={addGuarantor.fieldError("region_id")}>
                <SelectBox placeholder="Select Region" optionsUrl="options/regions" value={guarantor.region_id} onChange={(value) => set("region_id", value ?? "")} />
              </Field>
              <Field label="District:" className="col-md-4"><input className="form-control" value={guarantor.district} onChange={(e) => set("district", e.target.value)} /></Field>
              <Field label="Ward:" className="col-md-6"><input className="form-control" value={guarantor.ward} onChange={(e) => set("ward", e.target.value)} /></Field>
              <Field label="Street:" className="col-md-6"><input className="form-control" value={guarantor.street} onChange={(e) => set("street", e.target.value)} /></Field>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
