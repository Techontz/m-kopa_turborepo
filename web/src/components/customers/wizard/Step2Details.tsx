"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

import type { CustomerType, FieldDef, MasterData, MasterRow, RequirementProfile } from "../types";
import { Cell, Combo, GroupHeading, type ComboOption } from "./Controls";
import { fieldDomId } from "./errors";
import { RELATIONSHIPS, answerOf, emptyGuarantor, setAnswer, switchPaymentMethod, type GuarantorRow, type PaymentChoice, type Relationship, type WizardForm } from "./form";
import { NO_AUTOFILL } from "./noAutofill";
import { RELATIONSHIP_LABELS, TextInput, toId, toOptions, type Update } from "./Step1Basic";
import { fieldErrorKey, requiredWhenHolds, type Errors } from "./validation";

/** Query key of a parented master-data list (shared with the wizard's requiredWhen code lookup). */
export const parentedKey = (slug: string, parentId: string) => ["master-data-parented", slug, parentId] as const;

export function fetchParented(slug: string, parentId: string): Promise<MasterRow[]> {
  return api.get<{ data: MasterRow[] }>(`master-data/parented/${slug}`, { parent_id: parentId }).then((response) => response.data ?? []);
}

function DynamicField({ field, fields, form, update, errors, masterData }: { field: FieldDef; fields: FieldDef[]; form: WizardForm; update: Update; errors: Errors; masterData: MasterData | undefined }) {
  const errorKey = fieldErrorKey(field);
  const error = errors[errorKey];
  const value = answerOf(form, field);
  const parent = field.dependsOn ? fields.find((item) => item.key === field.dependsOn) : undefined;
  const parentValue = parent ? answerOf(form, parent) : "";
  const parented = Boolean(field.dataSource && field.dependsOn);
  const required = Boolean(field.required) || requiredWhenHolds(field, form, fields);

  const { data: childRows, isLoading } = useQuery({
    queryKey: parentedKey(field.dataSource ?? "", parentValue),
    queryFn: () => fetchParented(field.dataSource as string, parentValue),
    enabled: parented && parentValue !== "",
    staleTime: 5 * 60 * 1000,
  });

  const change = (next: string) => update((current) => setAnswer(current, fields, field.key, next), [errorKey, ...fields.filter((item) => item.dependsOn).map(fieldErrorKey)]);

  let control;
  if (field.type === "select") {
    let options: ComboOption[] = [];
    if (field.options && field.options.length > 0) {
      options = field.options.map((option) => ({ value: option, label: option }));
    } else if (field.dataSource) {
      options = toOptions(parented ? childRows : masterData?.[field.dataSource]);
    }
    const waiting = Boolean(parent) && parentValue === "";
    control = (
      <Combo
        field={errorKey}
        value={value}
        options={options}
        isDisabled={waiting}
        isLoading={parented && !waiting && isLoading}
        placeholder={waiting ? `Select ${parent?.label} first` : field.placeholder ?? `Select ${field.label}`}
        emptyMessage="Nothing is configured for this list yet. Add it under Administration → Master Data."
        invalid={Boolean(error)}
        onChange={(next) => change(next ?? "")}
      />
    );
  } else if (field.type === "textarea") {
    control = <textarea id={fieldDomId(errorKey)} name={`mfx-${field.key}`} className={`form-control ${error ? "is-invalid" : ""}`} rows={2} value={value} placeholder={field.placeholder} onChange={(event) => change(event.target.value)} {...NO_AUTOFILL} />;
  } else if (field.type === "boolean") {
    control = (
      <Combo field={errorKey} value={value} options={[{ value: "1", label: "Yes" }, { value: "0", label: "No" }]} placeholder={field.placeholder ?? "Select"} invalid={Boolean(error)} onChange={(next) => change(next ?? "")} />
    );
  } else {
    const numeric = field.type === "number" || field.type === "currency";
    control = (
      <TextInput
        field={errorKey}
        type={field.type === "date" ? "date" : numeric ? "number" : "text"}
        inputMode={numeric ? "numeric" : undefined}
        min={numeric ? 0 : undefined}
        value={value}
        placeholder={field.placeholder}
        invalid={Boolean(error)}
        onChange={change}
      />
    );
  }

  return (
    <Cell field={errorKey} label={field.label} required={required} error={error} help={field.helpText} className={field.type === "textarea" ? "mf-span-2" : ""}>
      {control}
    </Cell>
  );
}

interface Step2Props {
  form: WizardForm;
  update: Update;
  errors: Errors;
  profile: RequirementProfile;
  type: CustomerType | undefined;
  fields: FieldDef[];
  masterData: MasterData | undefined;
}

/** Step 2 — Customer Details: the type's card, the Account Number section and, when required, guarantors. */
export function Step2Details({ form, update, errors, profile, type, fields, masterData }: Step2Props) {
  const providers = masterData?.["mobile-money-providers"] ?? [];
  const banks = masterData?.["banks"] ?? [];
  const extraErrors = ["employer", "workType", "takeHome", "businessName", "businessType", "cardNumber"].filter((key) => errors[key] && !fields.some((field) => fieldErrorKey(field) === key));

  const setGuarantor = (index: number, patch: Partial<GuarantorRow>) =>
    update((current) => ({ ...current, guarantors: current.guarantors.map((row, position) => (position === index ? { ...row, ...patch } : row)) }), Object.keys(patch).map((key) => `guarantors.${index}.${key}`).concat("guarantors"));

  const chooserError = errors.paymentMethod ?? (form.paymentMethod === "none" ? errors["bankDetails.accountNumber"] ?? errors.walletNumber : undefined);

  return (
    <div className="mf-step">
      <div className="mf-step-head">
        <h5 className="mf-step-title">Customer Details</h5>
      </div>
      <p className="mf-step-sub">{type ? `What a ${type.name} customer is asked for, and where their money goes.` : "What is asked here depends on the customer type."}</p>

      {type && (
        <section className="mf-type-card">
          <div className="mf-type-card-title">{(type.formTitle || type.name).toUpperCase()}</div>
          {fields.length === 0 ? (
            <p className="mf-info-line mb-0"><i className="icon-info" /> This customer type asks nothing beyond Basic Information and the Account Number below.</p>
          ) : (
            <div className="mf-grid mf-grid-2">
              {fields.map((field) => (
                <DynamicField key={field.key} field={field} fields={fields} form={form} update={update} errors={errors} masterData={masterData} />
              ))}
            </div>
          )}
          {extraErrors.map((key) => (
            <div key={key} className="field-error" data-error="true" data-field={key}>{errors[key]}</div>
          ))}
        </section>
      )}
      {!type && extraErrors.map((key) => <div key={key} className="field-error" data-error="true" data-field={key}>{errors[key]}</div>)}

      <section className="mf-section-box">
        <GroupHeading required={profile.requiresBankAccount}>Account Number</GroupHeading>
        <p className="mf-step-sub">{profile.requiresBankAccount ? "This account type requires a mobile money wallet or a bank account." : "How this customer receives a disbursement and makes repayments."}</p>
        <div className="mf-grid mf-grid-2">
          <Cell field="paymentMethod" label="Account Number" required={profile.requiresBankAccount} error={chooserError}>
            <Combo
              field="paymentMethod"
              value={form.paymentMethod === "none" ? null : form.paymentMethod}
              options={[
                { value: "mno", label: "Mobile Money (MNO)", hint: "A wallet held with a mobile network operator." },
                { value: "bank", label: "Bank Account", hint: "An account held with a bank." },
              ]}
              placeholder="Select payment account type"
              invalid={Boolean(chooserError)}
              onChange={(value) =>
                update((current) => switchPaymentMethod(current, value as PaymentChoice | null), [
                  "paymentMethod",
                  "mobileMoneyProviderId",
                  "walletNumber",
                  "bankId",
                  "accountName",
                  "bankBranch",
                  "bankDetails.accountNumber",
                  "bankDetails.accountName",
                ])
              }
            />
          </Cell>
        </div>

        {form.paymentMethod === "mno" && (
          <div className="mf-grid mf-grid-2">
            <Cell field="mobileMoneyProviderId" label="MNO Provider" required error={errors.mobileMoneyProviderId ?? errors.mobileMoneyProvider}>
              <Combo
                field="mobileMoneyProviderId"
                value={form.mobileMoneyProviderId}
                options={toOptions(providers)}
                placeholder="Select provider"
                emptyMessage="No mobile money providers are configured. Add them under Administration → Master Data."
                invalid={Boolean(errors.mobileMoneyProviderId)}
                onChange={(value) => {
                  const id = toId(value);
                  update((current) => ({ ...current, mobileMoneyProviderId: id, mobileMoneyProvider: providers.find((row) => row.id === id)?.name ?? "" }), ["mobileMoneyProviderId", "mobileMoneyProvider"]);
                }}
              />
            </Cell>
            <Cell field="walletNumber" label="Phone / Wallet Number" required error={errors.walletNumber}>
              <TextInput field="walletNumber" value={form.walletNumber} placeholder="0754000000" inputMode="tel" invalid={Boolean(errors.walletNumber)} onChange={(value) => update((current) => ({ ...current, walletNumber: value }), ["walletNumber", "paymentMethod"])} />
            </Cell>
          </div>
        )}

        {form.paymentMethod === "bank" && (
          <div className="mf-grid mf-grid-2">
            <Cell field="bankId" label="Bank" required error={errors.bankId ?? errors["bankDetails.bankName"]}>
              <Combo
                field="bankId"
                value={form.bankId}
                options={toOptions(banks)}
                placeholder="Select bank"
                emptyMessage="No banks are configured. Add them under Administration → Master Data."
                invalid={Boolean(errors.bankId)}
                onChange={(value) => {
                  const id = toId(value);
                  update((current) => ({ ...current, bankId: id, bankName: banks.find((row) => row.id === id)?.name ?? "" }), ["bankId", "bankDetails.bankName"]);
                }}
              />
            </Cell>
            <Cell field="bankBranch" label="Bank Branch" error={errors.bankBranch} help="Where the account is held.">
              <TextInput field="bankBranch" value={form.bankBranch} placeholder="Branch name" onChange={(value) => update((current) => ({ ...current, bankBranch: value }), ["bankBranch"])} />
            </Cell>
            <Cell field="accountName" label="Account Name" required error={errors.accountName ?? errors["bankDetails.accountName"]}>
              <TextInput field="accountName" value={form.accountName} placeholder="Name the account is held in" invalid={Boolean(errors.accountName)} onChange={(value) => update((current) => ({ ...current, accountName: value }), ["accountName", "bankDetails.accountName"])} />
            </Cell>
            <Cell field="bankDetails.accountNumber" label="Account Number" required error={errors["bankDetails.accountNumber"]}>
              <TextInput field="bankDetails.accountNumber" value={form.accountNumber} placeholder="Account number" inputMode="numeric" invalid={Boolean(errors["bankDetails.accountNumber"])} onChange={(value) => update((current) => ({ ...current, accountNumber: value }), ["bankDetails.accountNumber", "paymentMethod"])} />
            </Cell>
          </div>
        )}
      </section>

      {profile.minGuarantors > 0 && (
        <section className="mf-section-box">
          <GroupHeading required>{`Guarantors (at least ${profile.minGuarantors})`}</GroupHeading>
          <div className="mf-kin-intro" data-error={errors.guarantors ? "true" : undefined} data-field="guarantors">
            <span />
            <button type="button" id={fieldDomId("guarantors")} className="btn btn-sm btn-outline-primary" onClick={() => update((current) => ({ ...current, guarantors: [...current.guarantors, emptyGuarantor()] }), ["guarantors"])}>
              <i className="icon-plus" /> Add Guarantor
            </button>
          </div>
          {errors.guarantors && <div className="field-error mb-2">{errors.guarantors}</div>}
          {form.guarantors.map((row, index) => (
            <div className="mf-row-box" key={index}>
              <div className="mf-grid mf-grid-2">
                <Cell field={`guarantors.${index}.name`} label="Full Name" required error={errors[`guarantors.${index}.name`]}>
                  <TextInput field={`guarantors.${index}.name`} value={row.name} onChange={(value) => setGuarantor(index, { name: value })} />
                </Cell>
                <Cell field={`guarantors.${index}.phone`} label="Phone" required error={errors[`guarantors.${index}.phone`]}>
                  <TextInput field={`guarantors.${index}.phone`} value={row.phone} inputMode="tel" onChange={(value) => setGuarantor(index, { phone: value })} />
                </Cell>
                <Cell field={`guarantors.${index}.relationship`} label="Relationship" required error={errors[`guarantors.${index}.relationship`]}>
                  <Combo field={`guarantors.${index}.relationship`} value={row.relationship} options={RELATIONSHIPS.map((value) => ({ value, label: RELATIONSHIP_LABELS[value] }))} placeholder="Select relationship" isClearable={false} onChange={(value) => setGuarantor(index, { relationship: (value ?? "spouse") as Relationship })} />
                </Cell>
                <Cell field={`guarantors.${index}.nidaNumber`} label="NIDA Number (optional)" error={errors[`guarantors.${index}.nidaNumber`]}>
                  <TextInput field={`guarantors.${index}.nidaNumber`} value={row.nidaNumber} onChange={(value) => setGuarantor(index, { nidaNumber: value })} />
                </Cell>
                <Cell field={`guarantors.${index}.occupation`} label="Occupation (optional)" error={errors[`guarantors.${index}.occupation`]}>
                  <TextInput field={`guarantors.${index}.occupation`} value={row.occupation} onChange={(value) => setGuarantor(index, { occupation: value })} />
                </Cell>
                <Cell field={`guarantors.${index}.address`} label="Address (optional)" error={errors[`guarantors.${index}.address`]}>
                  <TextInput field={`guarantors.${index}.address`} value={row.address} onChange={(value) => setGuarantor(index, { address: value })} />
                </Cell>
              </div>
              <button type="button" className="btn btn-sm btn-outline-danger mf-row-remove" aria-label={`Remove guarantor ${index + 1}`} onClick={() => update((current) => ({ ...current, guarantors: current.guarantors.filter((_, position) => position !== index) }), ["guarantors"])}>
                <i className="icon-trash" />
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
