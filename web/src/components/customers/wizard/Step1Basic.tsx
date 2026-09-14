"use client";

import { useApi } from "@/lib/hooks";

import { CUSTOMER_TYPE_LABEL, customerTypeOptions } from "../customerTypes";
import type { CustomerType, GeoRow, MasterData, RegistrationOptions, RequirementProfile } from "../types";
import { Cell, Combo, GroupHeading, type ComboOption } from "./Controls";
import { fieldDomId } from "./errors";
import { RELATIONSHIPS, ageFrom, emptyNextOfKin, setDistrict, setRegion, type NextOfKinRow, type Relationship, type WizardForm } from "./form";
import { NO_AUTOFILL } from "./noAutofill";
import type { Errors } from "./validation";

export type Update = (updater: (form: WizardForm) => WizardForm, touched?: string[]) => void;

interface Step1Props {
  form: WizardForm;
  update: Update;
  errors: Errors;
  profile: RequirementProfile;
  options: RegistrationOptions | undefined;
  types: CustomerType[] | undefined;
  masterData: MasterData | undefined;
  onTypeChange: (typeId: number | null) => void;
}

const toOptions = (rows: Array<{ id: number; name: string }> | undefined): ComboOption[] => (rows ?? []).map((row) => ({ value: String(row.id), label: row.name }));
const toId = (value: string | null) => (value ? Number(value) : null);
const RELATIONSHIP_LABELS: Record<Relationship, string> = { spouse: "Spouse", parent: "Parent", sibling: "Sibling", relative: "Relative", friend: "Friend", colleague: "Colleague", other: "Other" };

function TextInput({ field, value, onChange, placeholder, type = "text", inputMode, invalid, readOnly, min, max }: { field: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; inputMode?: "numeric" | "tel" | "text"; invalid?: boolean; readOnly?: boolean; min?: number; max?: number }) {
  return (
    <input
      id={fieldDomId(field)}
      name={`mfx-${field.replace(/\W/g, "-")}`}
      type={type}
      className={`form-control ${invalid ? "is-invalid" : ""}`}
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      readOnly={readOnly}
      min={min}
      max={max}
      onChange={(event) => onChange(event.target.value)}
      {...NO_AUTOFILL}
    />
  );
}

export { TextInput };

/** Step 1 — Basic Information: Registration, Personal details, Residence and Next of kin groups. */
export function Step1Basic({ form, update, errors, profile, options, types, masterData, onTypeChange }: Step1Props) {
  const { data: regions, isLoading: regionsLoading } = useApi<GeoRow[]>("regions");
  const { data: districts, isLoading: districtsLoading } = useApi<GeoRow[]>(form.regionId ? "districts" : null, { region_id: form.regionId ?? undefined });
  const { data: wards, isLoading: wardsLoading } = useApi<GeoRow[]>(form.districtId ? "wards" : null, { district_id: form.districtId ?? undefined });

  const set = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => update((current) => ({ ...current, [key]: value }), [key as string]);

  const locked = options?.lockedBranchId ?? null;
  const branchOptions = toOptions(options?.branches);
  const officers = options?.officers ?? [];
  const officerOptions = toOptions(officers);
  const currentOfficer = officers.find((officer) => officer.id === (form.employeeId ?? options?.currentEmployeeId));
  const age = ageFrom(form.dob);
  const typeOptions: ComboOption[] = customerTypeOptions(types, { withHints: true });
  const chosenType = types?.find((type) => type.id === form.customerCategoryId);

  const address = profile.requiresAddress;
  const identity = profile.requiresIdentityDocument;
  const wardList = wards ?? [];
  const noWardsOnFile = Boolean(form.districtId) && !wardsLoading && wards !== undefined && wardList.length === 0;
  const typingWard = form.wardMode === "text" || noWardsOnFile;

  const setKin = (index: number, patch: Partial<NextOfKinRow>) =>
    update((current) => ({ ...current, nextOfKin: current.nextOfKin.map((row, position) => (position === index ? { ...row, ...patch } : row)) }), Object.keys(patch).map((key) => `nextOfKin.${index}.${key}`).concat("nextOfKin"));

  return (
    <div className="mf-step">
      <div className="mf-step-head">
        <h5 className="mf-step-title">Basic Information</h5>
        {profile.guidance && <span className="mf-guidance">{profile.guidance}</span>}
      </div>

      <GroupHeading>Registration</GroupHeading>
      <div className="mf-grid mf-grid-3">
        <Cell field="branchId" label="Branch" required error={errors.branchId} help={locked ? <><i className="fa fa-lock" /> Fixed to your branch</> : undefined}>
          <Combo
            field="branchId"
            value={form.branchId}
            options={branchOptions}
            placeholder="Select Branch"
            emptyMessage="No branches are configured."
            isDisabled={Boolean(locked)}
            isClearable={!locked}
            invalid={Boolean(errors.branchId)}
            onChange={(value) => set("branchId", toId(value))}
          />
        </Cell>
        <Cell field="employeeId" label="Assigned Officer" error={errors.employeeId}>
          {options?.canAssignOfficer ? (
            <Combo
              field="employeeId"
              value={form.employeeId ?? options.currentEmployeeId}
              options={officerOptions}
              placeholder="Select officer"
              emptyMessage="No staff are registered."
              isClearable={false}
              invalid={Boolean(errors.employeeId)}
              onChange={(value) => set("employeeId", toId(value))}
            />
          ) : (
            <div className="form-control mf-readonly" id={fieldDomId("employeeId")}>
              <i className="fa fa-lock" /> {currentOfficer?.name ?? "—"}
            </div>
          )}
        </Cell>
        <Cell field="customerCategoryId" label={CUSTOMER_TYPE_LABEL} required={profile.requiresCustomerCategory} error={errors.customerCategoryId} help={chosenType?.requiresExtraApproval ? "Needs extra approval" : undefined}>
          <Combo
            field="customerCategoryId"
            value={form.customerCategoryId}
            options={typeOptions}
            placeholder="Select Customer Type"
            emptyMessage="No customer types are configured. Please contact the Super Administrator."
            invalid={Boolean(errors.customerCategoryId)}
            onChange={(value) => onTypeChange(toId(value))}
          />
        </Cell>
      </div>

      <GroupHeading>Personal Details</GroupHeading>
      <div className="mf-grid mf-grid-4">
        <Cell field="firstName" label="First Name" required error={errors.firstName}>
          <TextInput field="firstName" value={form.firstName} placeholder="First name" invalid={Boolean(errors.firstName)} onChange={(value) => set("firstName", value)} />
        </Cell>
        <Cell field="middleName" label="Middle name" error={errors.middleName}>
          <TextInput field="middleName" value={form.middleName} onChange={(value) => set("middleName", value)} />
        </Cell>
        <Cell field="lastName" label="Last name" required error={errors.lastName}>
          <TextInput field="lastName" value={form.lastName} invalid={Boolean(errors.lastName)} onChange={(value) => set("lastName", value)} />
        </Cell>
        <Cell field="gender" label="Gender" required error={errors.gender}>
          <Combo
            field="gender"
            value={form.gender}
            options={[{ value: "male", label: "Male" }, { value: "female", label: "Female" }]}
            placeholder="Select Gender"
            invalid={Boolean(errors.gender)}
            onChange={(value) => set("gender", value === "male" || value === "female" ? value : "")}
          />
        </Cell>
        <Cell field="dob" label="Date of Birth" required error={errors.dob}>
          <TextInput field="dob" type="date" value={form.dob} invalid={Boolean(errors.dob)} onChange={(value) => set("dob", value)} />
        </Cell>
        <Cell label="Age">
          <input className="form-control" value={age ?? ""} readOnly tabIndex={-1} aria-label="Age" {...NO_AUTOFILL} />
        </Cell>
        <Cell field="phone" label="Phone Number" required error={errors.phone}>
          <TextInput field="phone" value={form.phone} placeholder="0754000000" inputMode="tel" invalid={Boolean(errors.phone)} onChange={(value) => set("phone", value)} />
        </Cell>
        <Cell field="idTypeId" label="ID Type" required={identity} error={errors.idTypeId}>
          <Combo field="idTypeId" value={form.idTypeId} options={toOptions(masterData?.["id-types"])} placeholder="Select ID type" emptyMessage="No ID types are configured. Add them under Administration → Master Data." invalid={Boolean(errors.idTypeId)} onChange={(value) => set("idTypeId", toId(value))} />
        </Cell>
        <Cell field="idNumber" label="ID Number" required={identity} error={errors.idNumber}>
          <TextInput field="idNumber" value={form.idNumber} placeholder="Number shown on the document" invalid={Boolean(errors.idNumber)} onChange={(value) => update((current) => ({ ...current, idNumber: value }), ["idNumber", "idTypeId"])} />
        </Cell>
        <Cell field="maritalStatusId" label="Marital Status" required={profile.requiresMaritalStatus} error={errors.maritalStatusId}>
          <Combo field="maritalStatusId" value={form.maritalStatusId} options={toOptions(masterData?.["marital-statuses"])} placeholder="Select marital status" emptyMessage="No marital statuses are configured. Add them under Administration → Master Data." invalid={Boolean(errors.maritalStatusId)} onChange={(value) => set("maritalStatusId", toId(value))} />
        </Cell>
        <Cell field="dependentsCount" label="Number of Dependents" error={errors.dependentsCount}>
          <TextInput field="dependentsCount" type="number" min={0} max={50} value={form.dependentsCount} placeholder="0" inputMode="numeric" invalid={Boolean(errors.dependentsCount)} onChange={(value) => set("dependentsCount", value)} />
        </Cell>
        <Cell field="residenceType" label="Residence Type" error={errors.residenceType}>
          <Combo
            field="residenceType"
            value={form.residenceType}
            options={[{ value: "owned", label: "Owned" }, { value: "rented", label: "Rented" }]}
            placeholder="Select residence type"
            onChange={(value) => set("residenceType", value === "owned" || value === "rented" ? value : "")}
          />
        </Cell>
      </div>

      <GroupHeading>Residence</GroupHeading>
      <div className="mf-grid mf-grid-4">
        <Cell field="regionId" label="Region" required={address} error={errors.regionId}>
          <Combo
            field="regionId"
            value={form.regionId}
            options={toOptions(regions)}
            isLoading={regionsLoading}
            placeholder="Select region"
            emptyMessage="No regions are on file yet. They are imported under Administration → Geography."
            invalid={Boolean(errors.regionId)}
            onChange={(value) => update((current) => setRegion(current, toId(value)), ["regionId", "districtId", "wardId", "wardName", "streetName"])}
          />
        </Cell>
        <Cell field="districtId" label="District" required={address} error={errors.districtId}>
          <Combo
            field="districtId"
            value={form.districtId}
            options={toOptions(districts)}
            isLoading={Boolean(form.regionId) && districtsLoading}
            isDisabled={!form.regionId}
            placeholder={form.regionId ? "Select district" : "Select a region first"}
            emptyMessage="No districts are on file for this region. They are imported under Administration → Geography."
            invalid={Boolean(errors.districtId)}
            onChange={(value) => update((current) => setDistrict(current, toId(value)), ["districtId", "wardId", "wardName", "streetName"])}
          />
        </Cell>
        <Cell
          field={typingWard ? "wardName" : "wardId"}
          label="Ward"
          required={address}
          error={errors.wardId ?? errors.wardName}
          help={noWardsOnFile ? "No wards are on file for this district — type it. It can be imported later under Administration → Geography." : undefined}
        >
          {!form.districtId ? (
            <div className="form-control mf-readonly mf-disabled" id={fieldDomId("wardId")}>Select a district first</div>
          ) : wardsLoading ? (
            <div className="form-control mf-readonly mf-disabled" id={fieldDomId("wardId")}>Loading wards…</div>
          ) : typingWard ? (
            <>
              <TextInput field="wardName" value={form.wardName} placeholder="Enter ward" onChange={(value) => update((current) => ({ ...current, wardName: value, wardId: null, wardMode: "text" }), ["wardName", "wardId"])} />
              {!noWardsOnFile && (
                <button type="button" className="btn btn-link btn-sm mf-inline-link" onClick={() => update((current) => ({ ...current, wardMode: "select", wardId: null, wardName: "" }), ["wardName", "wardId"])}>
                  Choose from the list instead
                </button>
              )}
            </>
          ) : (
            <>
              <Combo
                field="wardId"
                value={form.wardId}
                options={toOptions(wardList)}
                placeholder="Select ward"
                onChange={(value) => {
                  const id = toId(value);
                  update((current) => ({ ...current, wardId: id, wardName: wardList.find((ward) => ward.id === id)?.name ?? "", wardMode: "select" }), ["wardId", "wardName"]);
                }}
              />
              <button type="button" className="btn btn-link btn-sm mf-inline-link" onClick={() => update((current) => ({ ...current, wardMode: "text", wardId: null, wardName: "" }), ["wardName", "wardId"])}>
                Ward not listed? Type it
              </button>
            </>
          )}
        </Cell>
        <Cell field="streetName" label="Street" required={address} error={errors.streetName}>
          <TextInput field="streetName" value={form.streetName} placeholder="Enter street" onChange={(value) => set("streetName", value)} />
        </Cell>
      </div>

      <GroupHeading required={profile.minNextOfKin > 0}>Next of Kin</GroupHeading>
      <div className="mf-kin-intro" data-error={errors.nextOfKin ? "true" : undefined} data-field="nextOfKin">
        <span>Who should be contacted in case of emergency?</span>
        <button type="button" id={fieldDomId("nextOfKin")} className="btn btn-sm btn-outline-primary" onClick={() => update((current) => ({ ...current, nextOfKin: [...current.nextOfKin, emptyNextOfKin()] }), ["nextOfKin"])}>
          <i className="icon-plus" /> Add Next of Kin
        </button>
      </div>
      {errors.nextOfKin && <div className="field-error mb-2">{errors.nextOfKin}</div>}
      {form.nextOfKin.map((row, index) => (
        <div className="mf-row-box" key={index}>
          <div className="mf-grid mf-grid-2">
            <Cell field={`nextOfKin.${index}.name`} label="Full Name" required error={errors[`nextOfKin.${index}.name`]}>
              <TextInput field={`nextOfKin.${index}.name`} value={row.name} onChange={(value) => setKin(index, { name: value })} />
            </Cell>
            <Cell field={`nextOfKin.${index}.phone`} label="Phone" required error={errors[`nextOfKin.${index}.phone`]}>
              <TextInput field={`nextOfKin.${index}.phone`} value={row.phone} inputMode="tel" onChange={(value) => setKin(index, { phone: value })} />
            </Cell>
            <Cell field={`nextOfKin.${index}.relationship`} label="Relationship" required error={errors[`nextOfKin.${index}.relationship`]}>
              <Combo
                field={`nextOfKin.${index}.relationship`}
                value={row.relationship}
                options={RELATIONSHIPS.map((value) => ({ value, label: RELATIONSHIP_LABELS[value] }))}
                placeholder="Select relationship"
                isClearable={false}
                onChange={(value) => setKin(index, { relationship: (value ?? "spouse") as Relationship })}
              />
            </Cell>
            <Cell field={`nextOfKin.${index}.address`} label="Address (optional)" error={errors[`nextOfKin.${index}.address`]}>
              <TextInput field={`nextOfKin.${index}.address`} value={row.address} onChange={(value) => setKin(index, { address: value })} />
            </Cell>
          </div>
          <button type="button" className="btn btn-sm btn-outline-danger mf-row-remove" aria-label={`Remove next of kin ${index + 1}`} onClick={() => update((current) => ({ ...current, nextOfKin: current.nextOfKin.filter((_, position) => position !== index) }), ["nextOfKin"])}>
            <i className="icon-trash" />
          </button>
        </div>
      ))}
    </div>
  );
}

export { RELATIONSHIP_LABELS, toId, toOptions };
