"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";

import { FaceVerification } from "../face/FaceVerification";
import { CUSTOMER_TYPES_ENDPOINT } from "../customerTypes";
import { toastError, toastInfo, toastSuccess } from "../toast";
import type { Customer, CustomerType, DraftResource, FieldDef, MasterData, MasterRow, RegistrationOptions, RequirementProfile } from "../types";
import { composeStep2Fields } from "./composition";
import { errorToast, fieldDomId, firstErrorStep, flattenServerErrors } from "./errors";
import { buildRegistrationPayload, changeCustomerType, changedPayload, draftLabel, emptyForm, errorsForChanges, formFromCustomer, repairDraftPayload, resumeStep, type WizardForm } from "./form";
import { resolveProfile } from "./profile";
import { SavedRegistrations } from "./SavedRegistrations";
import { Step1Basic, type Update } from "./Step1Basic";
import { Step2Details, parentedKey } from "./Step2Details";
import { Step3Kyc } from "./Step3Kyc";
import { validateStep1, validateStep2, validateStep3, type Errors } from "./validation";

export const STEPS = ["Basic Information", "Customer Details", "KYC Attachments", "Face Verification"] as const;
const STORAGE_VERSION = 1;
const storageKey = (userId: number) => `mf.customer-registration.v${STORAGE_VERSION}.${userId}`;

interface BrowserCopy {
  version: number;
  form: unknown;
  step: number;
  draftId: number | null;
  savedAt: string;
}

function readBrowserCopy(userId: number | undefined): BrowserCopy | null {
  if (typeof window === "undefined" || !userId) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) {
      return null;
    }
    const copy = JSON.parse(raw) as BrowserCopy;
    if (copy?.version !== STORAGE_VERSION) {
      return null;
    }
    const form = repairDraftPayload(copy.form);
    const empty = emptyForm();
    const meaningful = Object.entries(form).some(([key, value]) => !["branchId", "employeeId", "paymentMethod", "wardMode"].includes(key) && JSON.stringify(value) !== JSON.stringify(empty[key as keyof WizardForm]));
    return meaningful ? copy : null;
  } catch {
    return null;
  }
}

function clearBrowserCopy(userId: number | undefined) {
  if (userId) {
    try {
      window.localStorage.removeItem(storageKey(userId));
    } catch {
      // Storage unavailable.
    }
  }
}

/**
 * The 4-step Register Customer wizard (CUSTOMER_MODULE_SPEC §2–§8). Given `editing`, the same Basic Information and
 * Customer Details steps edit that customer instead: no drafts, no KYC upload or face scan, and only the changed
 * fields are saved (PUT /customers/{id}).
 */
export function RegisterWizard({ editing }: { editing?: Customer } = {}) {
  const { user, can } = useAuth();
  const client = useQueryClient();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const touchedRef = useRef(false);

  const { data: loadedOptions } = useApi<RegistrationOptions>("customers/registration-options");
  // Staff who may only correct details (customers.edit) see the customer's branch and officer, locked.
  const options = useMemo<RegistrationOptions | undefined>(
    () =>
      editing && loadedOptions && !can("customers.manage")
        ? { ...loadedOptions, lockedBranchId: editing.branchId, canAssignOfficer: false, officers: editing.employeeId ? [{ id: editing.employeeId, name: editing.employeeName ?? "—", branchId: editing.branchId }] : [] }
        : loadedOptions,
    [editing, loadedOptions, can],
  );
  const { data: types } = useApi<CustomerType[]>(CUSTOMER_TYPES_ENDPOINT);
  const { data: masterData } = useApi<MasterData>("master-data");
  const { data: requirements } = useApi<{ profiles: RequirementProfile[] }>("registration/requirements");
  const { data: drafts } = useApi<DraftResource[]>(editing ? null : "customer-drafts");

  const [initialForm] = useState<WizardForm>(() => (editing ? formFromCustomer(editing) : emptyForm()));
  const [form, setForm] = useState<WizardForm>(initialForm);
  const [step, setStep] = useState(0);
  const [passed, setPassed] = useState(editing ? [true, true, false] : [false, false, false]);
  const [errors, setErrors] = useState<Errors>({});
  const [file, setFile] = useState<File | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [savedCustomer, setSavedCustomer] = useState<Customer | null>(null);
  const [faceDone, setFaceDone] = useState(false);
  const [busy, setBusy] = useState<"draft" | "complete" | "update" | null>(null);
  const [draftBusyId, setDraftBusyId] = useState<number | null>(null);
  const [draftsHidden, setDraftsHidden] = useState(false);
  const [browserCopy, setBrowserCopy] = useState<BrowserCopy | null>(() => (editing ? null : readBrowserCopy(user?.id)));
  const [focusTick, setFocusTick] = useState(0);

  // A new registration defaults to the signed-in branch and officer; an edit keeps exactly what the customer has.
  const effective: WizardForm = useMemo(
    () => (editing ? form : { ...form, branchId: form.branchId ?? options?.lockedBranchId ?? null, employeeId: form.employeeId ?? options?.currentEmployeeId ?? null }),
    [editing, form, options],
  );
  const type = types?.find((item) => item.id === effective.customerCategoryId);
  const profile = useMemo(() => resolveProfile(requirements?.profiles, effective.customerCategoryId), [requirements, effective.customerCategoryId]);
  const fields = useMemo(() => composeStep2Fields(type, profile), [type, profile]);
  const initialFields = useMemo(
    () => composeStep2Fields(types?.find((item) => item.id === initialForm.customerCategoryId), resolveProfile(requirements?.profiles, initialForm.customerCategoryId)),
    [types, requirements, initialForm],
  );

  // Browser copy of the whole form state, written on every change (never applied silently).
  useEffect(() => {
    if (editing || !touchedRef.current || !user?.id || savedCustomer) {
      return;
    }
    try {
      const copy: BrowserCopy = { version: STORAGE_VERSION, form, step: Math.min(step, 2), draftId, savedAt: new Date().toISOString() };
      window.localStorage.setItem(storageKey(user.id), JSON.stringify(copy));
    } catch {
      // Storage full or unavailable.
    }
  }, [form, step, draftId, user?.id, savedCustomer, editing]);

  // Focus the first failing field after errors are shown.
  useEffect(() => {
    if (focusTick === 0) {
      return;
    }
    const cell = rootRef.current?.querySelector<HTMLElement>('[data-error="true"]');
    if (!cell) {
      return;
    }
    const target = cell.querySelector<HTMLElement>("input:not([type=hidden]):not([tabindex='-1']), textarea, button, [id^='cr-']") ?? cell;
    cell.scrollIntoView({ block: "center", behavior: "smooth" });
    target.focus({ preventScroll: true });
  }, [focusTick]);

  const update: Update = (updater, touched = []) => {
    touchedRef.current = true;
    setForm((current) => updater(current));
    if (touched.length > 0) {
      setErrors((current) => {
        const keys = Object.keys(current).filter((key) => touched.some((name) => key === name || key.startsWith(`${name}.`)));
        if (keys.length === 0) {
          return current;
        }
        const next = { ...current };
        keys.forEach((key) => delete next[key]);
        return next;
      });
    }
  };

  const codeOf = (field: FieldDef, value: string): string | null => {
    if (!field.dataSource) {
      return null;
    }
    let rows: MasterRow[] | undefined;
    if (field.dependsOn) {
      const parent = fields.find((item) => item.key === field.dependsOn);
      const parentValue = parent ? (parent.storesIn ? String((effective as Record<string, unknown>)[parent.storesIn] ?? "") : effective.dynamicFormData[parent.key] ?? "") : "";
      rows = client.getQueryData<MasterRow[]>(parentedKey(field.dataSource, parentValue));
    } else {
      rows = masterData?.[field.dataSource];
    }
    return rows?.find((row) => String(row.id) === value)?.code ?? null;
  };

  const showErrors = (found: Errors, targetStep: number) => {
    setErrors(found);
    setStep(targetStep);
    setFocusTick((tick) => tick + 1);
    toastError(errorToast(found, fields));
  };

  const saveDraft = async (nextStep: number, silent: boolean): Promise<void> => {
    if (!effective.branchId) {
      if (!silent) {
        toastError("Select a branch before saving a draft.");
      }
      return;
    }
    try {
      const response = await api.post<{ data: DraftResource }>("customer-drafts", {
        ...(draftId ? { id: draftId } : {}),
        branchId: effective.branchId,
        label: draftLabel(effective),
        phone: effective.phone.trim() || null,
        step: Math.min(nextStep, 2),
        payload: effective,
      });
      if (response?.data?.id) {
        setDraftId(response.data.id);
      }
      void client.invalidateQueries({ queryKey: ["customer-drafts"] });
      if (!silent) {
        toastSuccess("Draft saved. You can resume it from any device.");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403 && draftId) {
        // Another officer's draft: keep working on a copy of our own.
        setDraftId(null);
      }
      if (!silent) {
        toastError(error instanceof ApiError ? error.firstError : "The draft could not be saved.");
      }
    }
  };

  const onSaveDraft = async () => {
    setBusy("draft");
    await saveDraft(step, false);
    setBusy(null);
  };

  /** Edit mode: what the form changes, as the PUT body. */
  const editChanges = () => changedPayload(buildRegistrationPayload(initialForm, initialFields), buildRegistrationPayload(effective, fields));

  const onSaveChanges = async () => {
    if (!editing) {
      return;
    }
    const changes = editChanges();
    if (Object.keys(changes).length === 0) {
      toastInfo("Nothing has changed.");
      return;
    }
    const found = errorsForChanges({ ...validateStep1(effective, profile), ...validateStep2(effective, fields, profile, codeOf) }, changes);
    if (Object.keys(found).length > 0) {
      showErrors(found, firstErrorStep(found) ?? step);
      return;
    }
    setBusy("update");
    try {
      await api.put(`customers/${editing.id}`, changes);
    } catch (error) {
      setBusy(null);
      if (error instanceof ApiError && error.status === 422 && Object.keys(error.errors).length > 0) {
        const serverErrors = flattenServerErrors(error.errors);
        showErrors(serverErrors, firstErrorStep(serverErrors) ?? step);
      } else {
        toastError(error instanceof ApiError ? error.firstError : "The changes could not be saved.");
      }
      return;
    }
    await client.invalidateQueries();
    toastSuccess(`${effective.firstName} ${effective.lastName}'s details were updated.`);
    router.push(`/customers/${editing.id}`);
  };

  const onSaveAndContinue = () => {
    const all = step === 0 ? validateStep1(effective, profile) : validateStep2(effective, fields, profile, codeOf);
    const found = editing ? errorsForChanges(all, editChanges()) : all;
    if (Object.keys(found).length > 0) {
      showErrors(found, step);
      return;
    }
    setErrors({});
    setPassed((current) => current.map((value, index) => (index === step ? true : value)));
    const next = step + 1;
    setStep(next);
    rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    if (!editing) {
      void saveDraft(next, true);
    }
  };

  const onComplete = async () => {
    const found: Errors = { ...validateStep1(effective, profile), ...validateStep2(effective, fields, profile, codeOf), ...validateStep3(file) };
    if (Object.keys(found).length > 0) {
      showErrors(found, firstErrorStep(found) ?? 2);
      return;
    }
    if (!file) {
      return;
    }
    setBusy("complete");
    let customer: Customer;
    try {
      const response = await api.post<{ data: Customer }>("customers", buildRegistrationPayload(effective, fields));
      customer = response.data;
    } catch (error) {
      setBusy(null);
      if (error instanceof ApiError && error.status === 422 && Object.keys(error.errors).length > 0) {
        const serverErrors = flattenServerErrors(error.errors);
        showErrors(serverErrors, firstErrorStep(serverErrors) ?? 1);
      } else {
        toastError(error instanceof ApiError ? error.firstError : "The customer could not be saved.");
      }
      return;
    }

    let uploadFailed = false;
    try {
      const body = new FormData();
      body.append("documentType", "kyc_attachment");
      body.append("file", file);
      await api.post(`customers/${customer.id}/documents`, body);
    } catch {
      uploadFailed = true;
    }
    if (draftId) {
      await api.post(`customer-drafts/${draftId}/submitted`, { customerId: customer.id }).catch(() => undefined);
    }
    clearBrowserCopy(user?.id);
    touchedRef.current = false;
    setBrowserCopy(null);
    void client.invalidateQueries();

    setSavedCustomer(customer);
    setPassed([true, true, true]);
    setErrors({});
    setStep(3);
    setBusy(null);
    rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    if (uploadFailed) {
      toastError(`Customer saved, but 1 document(s) did not upload: ${file.name}. Add it from the customer's profile.`);
    } else {
      toastSuccess(`Saved as ${customer.customerNumber}. Face verification completes the registration.`);
    }
  };

  const applyResume = (payload: unknown, savedStep: unknown, id: number | null) => {
    const repaired = repairDraftPayload(payload);
    const target = resumeStep(savedStep);
    touchedRef.current = true;
    setForm(repaired);
    setStep(target);
    setPassed([0, 1, 2].map((index) => index < target));
    setErrors({});
    setFile(null);
    setDraftId(id);
  };

  const onResumeDraft = async (draft: DraftResource) => {
    setDraftBusyId(draft.id);
    try {
      const response = await api.get<{ data: DraftResource }>(`customer-drafts/${draft.id}`);
      const full = response.data;
      const own = full.isOwn ?? full.createdById === (options?.currentEmployeeId ?? user?.id);
      applyResume(full.payload, full.step, own ? full.id : null);
      toastInfo(`Resumed "${full.label}".`);
    } catch (error) {
      toastError(error instanceof ApiError ? error.firstError : "The draft could not be opened.");
    } finally {
      setDraftBusyId(null);
    }
  };

  const onDiscardDraft = async (draft: DraftResource) => {
    setDraftBusyId(draft.id);
    try {
      await api.delete(`customer-drafts/${draft.id}`);
      if (draftId === draft.id) {
        setDraftId(null);
      }
      await client.invalidateQueries({ queryKey: ["customer-drafts"] });
      toastSuccess("Draft discarded.");
    } catch (error) {
      toastError(error instanceof ApiError ? error.firstError : "The draft could not be discarded.");
    } finally {
      setDraftBusyId(null);
    }
  };

  const onTypeChange = (typeId: number | null) => {
    update((current) => changeCustomerType(current, fields, typeId), ["customerCategoryId", "dynamicFormData", ...fields.map((field) => field.storesIn ?? "").filter(Boolean)]);
  };

  const registerAnother = () => {
    touchedRef.current = false;
    setForm(emptyForm());
    setStep(0);
    setPassed([false, false, false]);
    setErrors({});
    setFile(null);
    setDraftId(null);
    setSavedCustomer(null);
    setFaceDone(false);
    rootRef.current?.scrollIntoView({ block: "start" });
  };

  const openDrafts = (drafts ?? []).filter((draft) => !draft.submittedAt);
  const copyName = browserCopy ? draftLabel(repairDraftPayload(browserCopy.form)) : "";
  const stepDone = (index: number) => (index === 3 ? faceDone : passed[index]);
  const canOpenStep = (index: number) => (editing ? index <= 1 : !savedCustomer && index <= 2 && passed.slice(0, index).every(Boolean));
  const steps = editing ? STEPS.slice(0, 2) : STEPS;

  return (
    <div ref={rootRef} className="mf-wizard">
      {browserCopy && !savedCustomer && (
        <div className="mf-status-bar" role="status">
          <span>
            This browser has an unsaved registration{copyName && copyName !== "Unnamed registration" ? ` for ${copyName}` : ""}. The form below is otherwise empty.
          </span>
          <span className="mf-status-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => { applyResume(browserCopy.form, browserCopy.step, browserCopy.draftId ?? null); setBrowserCopy(null); }}>
              Resume it
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { clearBrowserCopy(user?.id); setBrowserCopy(null); }}>
              Discard
            </button>
          </span>
        </div>
      )}

      {!editing && !savedCustomer && !draftsHidden && openDrafts.length > 0 && (
        <SavedRegistrations drafts={openDrafts} currentEmployeeId={options?.currentEmployeeId ?? user?.id ?? null} busyId={draftBusyId} onResume={(draft) => void onResumeDraft(draft)} onDiscard={(draft) => void onDiscardDraft(draft)} onNotNow={() => setDraftsHidden(true)} />
      )}

      <div className="card mf-wizard-card">
        <div className="body">
          <ol className="mf-stepper">
            {steps.map((label, index) => {
              const clickable = canOpenStep(index) && index !== step;
              return (
                <li key={label} className={`${index === step ? "current" : ""} ${stepDone(index) ? "done" : ""}`}>
                  <button type="button" disabled={!clickable} onClick={() => clickable && setStep(index)} aria-current={index === step ? "step" : undefined}>
                    <span className="mf-stepper-dot">{stepDone(index) ? <i className="fa fa-check" /> : index + 1}</span>
                    <span className="mf-stepper-label">{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {savedCustomer && !faceDone && (
            <div className="alert alert-info mf-saved-banner">
              Saved as {savedCustomer.customerNumber} — awaiting face verification.
            </div>
          )}

          <form autoComplete="off" onSubmit={(event) => event.preventDefault()} noValidate>
            {step === 0 && <Step1Basic form={effective} update={update} errors={errors} profile={profile} options={options} types={types} masterData={masterData} onTypeChange={onTypeChange} />}
            {step === 1 && <Step2Details form={effective} update={update} errors={errors} profile={profile} type={type} fields={fields} masterData={masterData} />}
            {step === 2 && <Step3Kyc file={file} onChange={(chosen) => { setFile(chosen); setErrors((current) => { const next = { ...current }; delete next.file; return next; }); }} errors={errors} />}
          </form>

          {step === 3 && savedCustomer && (
            <div className="mf-step">
              <div className="mf-step-head">
                <h5 className="mf-step-title">Face Verification</h5>
              </div>
              {faceDone ? (
                <div className="mf-complete-panel">
                  <h6><i className="fa fa-check-circle" /> Face verification complete</h6>
                  <p>{savedCustomer.fullName} has passed the liveness check. Their KYC is complete and they can now start a loan application.</p>
                  <div className="mf-complete-actions">
                    <Link href={`/customers/${savedCustomer.id}`} className="btn btn-primary">Open customer profile</Link>
                    <button type="button" className="btn btn-outline-primary" onClick={registerAnother}>Register another customer</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mf-step-sub">{savedCustomer.fullName} is saved. This is the last step, and the registration is not complete until the scan passes.</p>
                  <div className="mf-note">
                    <b>This desk needs a camera.</b> {savedCustomer.fullName} is saved and reads <b>Awaiting face verification</b> until this passes. If this machine has no camera, the same scan is on their profile and can be run by anyone signed in who may manage them.
                  </div>
                  <FaceVerification customerId={savedCustomer.id} onVerified={(customer) => { setFaceDone(true); if (customer) { setSavedCustomer({ ...savedCustomer, ...customer }); } }} />
                </>
              )}
            </div>
          )}

          {editing && (
            <div className="mf-wizard-actions">
              <button type="button" className="btn btn-outline-secondary" disabled={step === 0 || busy !== null} onClick={() => { setErrors({}); setStep(step - 1); }}>
                <i className="icon-arrow-left" /> Back
              </button>
              <span className="mf-wizard-actions-right">
                <Link href={`/customers/${editing.id}`} className="btn btn-outline-secondary">Cancel</Link>
                {step === 0 && (
                  <button type="button" className="btn btn-outline-primary" disabled={busy !== null} onClick={onSaveAndContinue}>
                    Next <i className="icon-arrow-right" />
                  </button>
                )}
                <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void onSaveChanges()}>
                  {busy === "update" ? "Saving..." : "Save changes"}
                </button>
              </span>
            </div>
          )}

          {!editing && step <= 2 && (
            <div className="mf-wizard-actions">
              <button type="button" className="btn btn-outline-secondary" disabled={step === 0 || Boolean(savedCustomer) || busy !== null} onClick={() => { setErrors({}); setStep(step - 1); }}>
                <i className="icon-arrow-left" /> Back
              </button>
              <span className="mf-wizard-actions-right">
                <button type="button" className="btn btn-outline-primary" disabled={busy !== null} onClick={() => void onSaveDraft()}>
                  {busy === "draft" ? "Saving..." : "Save draft"}
                </button>
                {step < 2 ? (
                  <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={onSaveAndContinue}>
                    Save &amp; Continue
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" id={fieldDomId("complete")} disabled={busy !== null} onClick={() => void onComplete()}>
                    {busy === "complete" ? "Saving..." : "Complete Registration"}
                  </button>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
