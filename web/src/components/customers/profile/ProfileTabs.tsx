"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { confirmAction } from "@/components/ui/notify";
import { api, ApiError, backendUrl } from "@/lib/api";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

import { Detail, formatDateTime } from "../common";
import { FaceVerification } from "../face/FaceVerification";
import { QUALITY_CHECKS, POSES } from "../face/liveness";
import { toastError, toastSuccess } from "../toast";
import type { Customer, CustomerType, DocumentResource, FaceScanResource, FieldDef, GuarantorResource, MasterData, MasterRow, NextOfKinResource } from "../types";
import { composeStep2Fields } from "../wizard/composition";
import { RELATIONSHIPS } from "../wizard/form";
import { fetchParented, parentedKey } from "../wizard/Step2Details";
import { KYC_ACCEPT, kycFileProblem } from "../wizard/Step3Kyc";

export interface Overview {
  loans: { total: number; active: number; inPipeline: number; closed: number; totalDisbursed: number; outstanding: number };
  balance: { remain_loan: number; salary_advance: number; penalty: number; loan_fee: number; total: number; remain_cash: number };
  recentLoans: Array<{ id: number; loanNumber: string; product: string | null; amountApplied: number; amountApproved: number; totalPayable: number; status: string | null; statusLabel: string | null; statusBadge: string | null; withdrawnAt: string | null; endDate: string | null }>;
  counts: { documents: number; notes: number; guarantors: number; nextOfKin: number; faceScans: number };
}

const title = (value: string | null | undefined) => (value ? value.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase()) : "");
const nameOf = (rows: MasterRow[] | undefined, id: number | string | null | undefined) => (id === null || id === undefined || id === "" ? "" : rows?.find((row) => String(row.id) === String(id))?.name ?? String(id));

/* ------------------------------------------------------------------ Overview ------------------------------------------------------------------ */

export function OverviewTab({ customer, overview }: { customer: Customer; overview: Overview | undefined }) {
  const stats: Array<[string, string | number]> = overview
    ? [
        ["Loans", overview.loans.total],
        ["Active", overview.loans.active],
        ["In pipeline", overview.loans.inPipeline],
        ["Closed", overview.loans.closed],
        ["Total disbursed", money(overview.loans.totalDisbursed)],
        ["Outstanding", money(overview.loans.outstanding)],
      ]
    : [];

  return (
    <>
      <div className="mf-section-title">Summary</div>
      <dl className="mf-dl">
        <Detail label="Customer number">{customer.customerNumber}</Detail>
        <Detail label="Customer Type">{customer.categoryName}</Detail>
        <Detail label="Branch">{customer.branchName}</Detail>
        <Detail label="Assigned Officer">{customer.employeeName}</Detail>
        <Detail label="KYC">{customer.kycStatus === "completed" ? "Complete" : "Incomplete"}</Detail>
        <Detail label="Face verified">{formatDateTime(customer.faceVerifiedAt)}</Detail>
        <Detail label="Approval">{title(customer.approvalStatus)}</Detail>
        <Detail label="Pays by">{customer.paymentMethod === "mno" ? "Mobile Money" : customer.paymentMethod === "bank" ? "Bank Account" : ""}</Detail>
        <Detail label="Registered">{formatDateTime(customer.createdAt)}</Detail>
      </dl>
      {customer.rejectionReason && <div className="alert alert-danger mt-2 mb-0">Returned: {customer.rejectionReason}</div>}

      <div className="mf-section-title">Loans</div>
      {!overview ? (
        <p className="mf-loading">Loading...</p>
      ) : (
        <>
          <dl className="mf-dl">
            {stats.map(([label, value]) => (
              <Detail key={label} label={label}>{value}</Detail>
            ))}
          </dl>
          <div className="mf-section-title">Balance</div>
          <dl className="mf-dl">
            <Detail label="Remain Loan Amount">{money(overview.balance.remain_loan)}</Detail>
            <Detail label="Salary Advance">{money(overview.balance.salary_advance)}</Detail>
            <Detail label="Penalty Amount">{money(overview.balance.penalty)}</Detail>
            <Detail label="Loan Fee">{money(overview.balance.loan_fee)}</Detail>
            <Detail label="TOTAL">{money(overview.balance.total)}</Detail>
            <Detail label="TAKE HOME">{money(overview.balance.remain_cash)}</Detail>
          </dl>
          <div className="mf-section-title">Recent loans</div>
          <div className="table-responsive">
            <table className="table table-hover table-custom mf-table">
              <thead className="thead-info">
                <tr><th>Loan Ac</th><th>Loan Product</th><th>Applied</th><th>Approved</th><th>Principal + interest</th><th>Status</th><th>Withdrawal Date</th><th>End Date</th></tr>
              </thead>
              <tbody>
                {overview.recentLoans.length === 0 ? (
                  <tr><td colSpan={8} className="text-center">No loans yet.</td></tr>
                ) : (
                  overview.recentLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td><Link href={`/loans/${loan.id}`}>{loan.loanNumber}</Link></td>
                      <td>{loan.product}</td>
                      <td>{money(loan.amountApplied)}</td>
                      <td>{money(loan.amountApproved)}</td>
                      <td>{money(loan.totalPayable)}</td>
                      <td><Badge tone={(loan.statusBadge ?? "default") as BadgeTone}>{loan.statusLabel}</Badge></td>
                      <td>{loan.withdrawnAt}</td>
                      <td>{loan.endDate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Details ------------------------------------------------------------------ */

function TypeAnswers({ customer, fields, masterData }: { customer: Customer; fields: FieldDef[]; masterData: MasterData | undefined }) {
  const valueOf = (field: FieldDef): string => {
    const raw = field.storesIn ? (customer as unknown as Record<string, unknown>)[field.storesIn] : customer.dynamicFormData?.[field.key];
    return raw === null || raw === undefined ? "" : String(raw);
  };
  const parented = fields.filter((field) => field.type === "select" && field.dataSource && field.dependsOn);
  const lookups = useQueries({
    queries: parented.map((field) => {
      const parent = fields.find((item) => item.key === field.dependsOn);
      const parentValue = parent ? valueOf(parent) : "";
      return { queryKey: parentedKey(field.dataSource as string, parentValue), queryFn: () => fetchParented(field.dataSource as string, parentValue), enabled: parentValue !== "", staleTime: 300_000 };
    }),
  });

  const display = (field: FieldDef) => {
    const value = valueOf(field);
    if (value === "") {
      return "";
    }
    if (field.type === "select" && field.dataSource) {
      const index = parented.indexOf(field);
      return nameOf(index >= 0 ? lookups[index]?.data : masterData?.[field.dataSource], value);
    }
    if (field.type === "currency") {
      return money(value);
    }
    if (field.type === "boolean") {
      return ["1", "true", "yes", "ndiyo"].includes(value.toLowerCase()) ? "Yes" : "No";
    }
    return value;
  };

  return (
    <>
      {fields.map((field) => (
        <Detail key={field.key} label={field.label}>{display(field)}</Detail>
      ))}
    </>
  );
}

export function DetailsTab({ customer, types, masterData }: { customer: Customer; types: CustomerType[] | undefined; masterData: MasterData | undefined }) {
  const type = types?.find((item) => item.id === customer.customerCategoryId);
  const composed = composeStep2Fields(type);
  const configured = composed.filter((field) => field.origin === "configured");
  const hasCard = customer.paymentMethod === "bank" || Boolean(customer.cardLastFour);

  return (
    <>
      <div className="mf-section-title">Basic Information</div>
      <dl className="mf-dl">
        <Detail label="Customer number">{customer.customerNumber}</Detail>
        <Detail label="First Name">{customer.firstName}</Detail>
        <Detail label="Middle name">{customer.middleName}</Detail>
        <Detail label="Last name">{customer.lastName}</Detail>
        <Detail label="Gender">{title(customer.gender)}</Detail>
        <Detail label="Date of Birth">{customer.dob}</Detail>
        <Detail label="Age">{customer.age}</Detail>
        <Detail label="Phone Number">{customer.phone}</Detail>
        <Detail label="Branch">{customer.branchName}</Detail>
        <Detail label="Assigned Officer">{customer.employeeName}</Detail>
        <Detail label="Customer Type">{customer.categoryName}</Detail>
      </dl>

      <div className="mf-section-title">Additional Detail</div>
      <dl className="mf-dl">
        <Detail label="Marital Status">{nameOf(masterData?.["marital-statuses"], customer.maritalStatusId) || title(customer.maritalStatus)}</Detail>
        <Detail label="Number of Dependents">{customer.dependentsCount}</Detail>
        <Detail label="Residence Type">{title(customer.residenceType)}</Detail>
        {customer.alternativePhone && <Detail label="Alternative Phone">{customer.alternativePhone}</Detail>}
        {customer.email && <Detail label="Email">{customer.email}</Detail>}
        {customer.nationality && <Detail label="Nationality">{customer.nationality}</Detail>}
        {type && <TypeAnswers customer={customer} fields={configured} masterData={masterData} />}
      </dl>

      <div className="mf-section-title">Employment</div>
      <dl className="mf-dl">
        <TypeAnswers customer={customer} fields={Object.values(STANDARD_DISPLAY)} masterData={masterData} />
        {customer.employer && <Detail label="Employer">{customer.employer}</Detail>}
        {customer.occupation && <Detail label="Occupation">{customer.occupation}</Detail>}
      </dl>

      <div className="mf-section-title">Business</div>
      <dl className="mf-dl">
        <Detail label="Business Name">{customer.businessName}</Detail>
        <Detail label="Business Type">{customer.businessType}</Detail>
        <Detail label="Business Address">{customer.businessAddress}</Detail>
        <Detail label="TIN Number">{customer.tinNumber}</Detail>
      </dl>

      <div className="mf-section-title">Address</div>
      <dl className="mf-dl">
        <Detail label="Region">{customer.regionName}</Detail>
        <Detail label="District">{customer.districtName}</Detail>
        <Detail label="Ward">{customer.wardName}</Detail>
        <Detail label="Street">{customer.streetName}</Detail>
      </dl>

      <div className="mf-section-title">Identity Documents</div>
      <dl className="mf-dl">
        <Detail label="ID Type">{customer.idTypeName ?? nameOf(masterData?.["id-types"], customer.idTypeId)}</Detail>
        <Detail label="ID Number">{customer.idNumber}</Detail>
        {customer.nidaNumber && <Detail label="NIDA Number">{customer.nidaNumber}</Detail>}
        {customer.nationalIdNumber && <Detail label="National ID Number">{customer.nationalIdNumber}</Detail>}
        {customer.voterIdNumber && <Detail label="Voter ID Number">{customer.voterIdNumber}</Detail>}
        {customer.driverLicenceNumber && <Detail label="Driver's Licence Number">{customer.driverLicenceNumber}</Detail>}
        {customer.passportNumber && <Detail label="Passport Number">{customer.passportNumber}</Detail>}
        {customer.workIdNumber && <Detail label="Work ID Number">{customer.workIdNumber}</Detail>}
      </dl>

      <div className="mf-section-title">Bank &amp; Mobile Money</div>
      <dl className="mf-dl">
        <Detail label="Pays by">{customer.paymentMethod === "mno" ? "Mobile Money" : customer.paymentMethod === "bank" ? "Bank Account" : ""}</Detail>
        <Detail label="Bank">{customer.bankName ?? nameOf(masterData?.banks, customer.bankId)}</Detail>
        <Detail label="Bank Branch">{customer.bankBranch}</Detail>
        <Detail label="Account name">{customer.accountName}</Detail>
        <Detail label="Account number">{customer.accountNumber}</Detail>
        <Detail label="MNO Provider">{customer.mobileMoneyProvider ?? nameOf(masterData?.["mobile-money-providers"], customer.mobileMoneyProviderId)}</Detail>
        <Detail label="Phone / Wallet Number">{customer.walletNumber}</Detail>
        {hasCard && customer.cardLastFour && <Detail label="Card">•••• {customer.cardLastFour}</Detail>}
      </dl>
    </>
  );
}

const STANDARD_DISPLAY: Record<string, FieldDef> = {
  place_of_employment: { key: "place_of_employment", label: "Place of Employment", type: "text", storesIn: "placeOfEmployment" },
  check_number: { key: "check_number", label: "Check Number", type: "text", storesIn: "checkNumber" },
  basic_salary: { key: "basic_salary", label: "Basic Salary", type: "currency", storesIn: "basicSalary" },
  take_home: { key: "take_home", label: "Take Home", type: "currency", storesIn: "takeHome" },
  monthly_income: { key: "monthly_income", label: "Monthly Income", type: "currency", storesIn: "monthlyIncome" },
  retirement_date: { key: "retirement_date", label: "Date of Retirement", type: "date", storesIn: "retirementDate" },
};

/* -------------------------------------------------------------------- KYC -------------------------------------------------------------------- */

interface KycStatus {
  kycStatus: string;
  items: Array<{ key: string; label: string; required: boolean; complete: boolean }>;
  outstanding: string[];
}

export function KycTab({ customer }: { customer: Customer }) {
  const { data, isLoading } = useApi<KycStatus>(`customers/${customer.id}/kyc-status`);

  return (
    <>
      <div className="mf-section-title">KYC status</div>
      {isLoading || !data ? (
        <p className="mf-loading">Loading...</p>
      ) : (
        <>
          <p className="mb-2">{data.kycStatus === "completed" ? <Badge tone="success">KYC complete</Badge> : <Badge tone="warning">KYC incomplete</Badge>}</p>
          <div className="table-responsive">
            <table className="table table-custom mf-table">
              <thead className="thead-info"><tr><th>Item</th><th>Required</th><th>On file</th></tr></thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.key}>
                    <td>{item.label}</td>
                    <td>{item.required ? "Required" : "Not required"}</td>
                    <td>{item.complete ? <span className="text-success"><i className="fa fa-check" /> Yes</span> : <span className={item.required ? "text-danger" : "text-muted"}><i className="fa fa-times" /> No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.outstanding.length > 0 && <p className="text-danger mb-0">Outstanding: {data.outstanding.join(", ")}</p>}
        </>
      )}
      <div className="mf-section-title">Verification</div>
      <dl className="mf-dl">
        <Detail label="Face verified">{formatDateTime(customer.faceVerifiedAt)}</Detail>
        <Detail label="NIDA verified">{formatDateTime(customer.nidaVerifiedAt)}</Detail>
        <Detail label="OTP verified">{formatDateTime(customer.otpVerifiedAt)}</Detail>
        <Detail label="Approval">{title(customer.approvalStatus)}</Detail>
        <Detail label="Approved">{formatDateTime(customer.approvedAt)}</Detail>
        <Detail label="Rejection reason">{customer.rejectionReason}</Detail>
      </dl>
    </>
  );
}

/* ------------------------------------------------------------------ Face KYC ------------------------------------------------------------------ */

export function FaceKycTab({ customer, canManage, onVerified }: { customer: Customer; canManage: boolean; onVerified: () => void }) {
  const { data: scans, isLoading } = useApi<FaceScanResource[]>(`customers/${customer.id}/face-scans`);
  const [scanning, setScanning] = useState(false);

  return (
    <>
      <div className="mf-section-title">Face verification</div>
      <p className="mb-2">
        {customer.faceVerifiedAt ? (
          <><Badge tone="success">Verified</Badge> {formatDateTime(customer.faceVerifiedAt)}{customer.faceScannedByName ? ` · by ${customer.faceScannedByName}` : ""}</>
        ) : (
          <Badge tone="warning">Awaiting face verification</Badge>
        )}
      </p>
      {canManage && !scanning && (
        <button type="button" className="btn btn-info mb-2" onClick={() => setScanning(true)}>
          <i className="icon-camera" /> {customer.faceVerifiedAt ? "Run the face scan again" : "Run face verification"}
        </button>
      )}
      {canManage && scanning && (
        <div className="mf-section-box mb-3">
          <FaceVerification
            customerId={customer.id}
            onVerified={() => {
              setScanning(false);
              onVerified();
            }}
          />
        </div>
      )}

      <div className="mf-section-title">Scan history</div>
      {isLoading ? (
        <p className="mf-loading">Loading...</p>
      ) : (scans ?? []).length === 0 ? (
        <p className="text-muted">No face scans are on file.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-custom mf-table">
            <thead className="thead-info">
              <tr><th>Capture</th><th>Result</th><th>Quality</th><th>Checks</th><th>Device</th><th>Scanned</th></tr>
            </thead>
            <tbody>
              {(scans ?? []).map((scan) => {
                const failedChecks = [...QUALITY_CHECKS.map((check) => ({ key: check.key, label: check.label })), ...POSES.map((pose) => ({ key: pose.key, label: pose.instruction }))].filter((check) => !scan.checks?.[check.key]);
                return (
                  <tr key={scan.id}>
                    <td>
                      {scan.imageUrl && (
                        <a href={backendUrl(scan.imageUrl)} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image stream */}
                          <img src={backendUrl(scan.imageUrl)} alt={`Scan ${scan.id}`} className="mf-avatar" style={{ borderRadius: 4, width: 56, height: 42 }} />
                        </a>
                      )}
                    </td>
                    <td>
                      <Badge tone={scan.status === "passed" ? "success" : "danger"}>{scan.status === "passed" ? "Passed" : "Failed"}</Badge> {scan.isActive && <Badge tone="info">Active</Badge>}
                    </td>
                    <td className="text-nowrap">
                      {scan.qualityScore}/100
                      <small className="d-block text-muted">light {scan.brightnessScore} · sharp {scan.blurScore} · distance {scan.distanceScore} · centre {scan.centeringScore} · eyes {scan.eyesOpenScore}</small>
                    </td>
                    <td>{failedChecks.length === 0 ? <span className="text-success">All 11 passed</span> : <small className="text-danger">Not met: {failedChecks.map((check) => check.label).join(", ")}</small>}</td>
                    <td><small>{[scan.captureDevice, scan.captureResolution, scan.scannerVersion].filter(Boolean).join(" · ")}</small></td>
                    <td className="text-nowrap">{formatDateTime(scan.scannedAt)}<small className="d-block text-muted">{scan.scannedByName}</small></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Timeline ------------------------------------------------------------------ */

export function TimelineTab({ customerId }: { customerId: number }) {
  const { data, isLoading } = useApi<Array<{ at: string | null; type: string; title: string; description: string | null; byName: string | null }>>(`customers/${customerId}/timeline`);
  if (isLoading) {
    return <p className="mf-loading">Loading...</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-muted">Nothing has happened on this record yet.</p>;
  }
  return (
    <ul className="mf-timeline">
      {data.map((event, index) => (
        <li key={`${event.type}-${event.at}-${index}`}>
          <b>{event.title}</b>
          {event.description && <span> — {event.description}</span>}
          <small className="d-block">{[formatDateTime(event.at), event.byName].filter(Boolean).join(" · ")}</small>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ Documents ------------------------------------------------------------------ */

export function DocumentsTab({ customerId, canManage, masterData }: { customerId: number; canManage: boolean; masterData: MasterData | undefined }) {
  const client = useQueryClient();
  const { data, isLoading } = useApi<DocumentResource[]>(`customers/${customerId}/documents`);
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const types = masterData?.["document-types"] ?? [];

  const upload = async () => {
    const found: Record<string, string> = {};
    if (!documentType) {
      found.documentType = "Document type is required.";
    }
    if (!file) {
      found.file = "Choose the file to upload.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !file) {
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("documentType", documentType);
      body.append("file", file);
      await api.post(`customers/${customerId}/documents`, body);
      setFile(null);
      setDocumentType("");
      await client.invalidateQueries();
      toastSuccess("Document uploaded.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([key, messages]) => [key, messages[0]])));
      }
      toastError(error instanceof ApiError ? error.firstError : "The document could not be uploaded.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (document: DocumentResource) => {
    if (!(await confirmAction(`Delete ${document.originalName}?`))) {
      return;
    }
    try {
      await api.delete(`customers/${customerId}/documents/${document.id}`);
      await client.invalidateQueries();
      toastSuccess("Document deleted.");
    } catch (error) {
      toastError(error instanceof ApiError ? error.firstError : "The document could not be deleted.");
    }
  };

  return (
    <>
      {canManage && (
        <div className="mf-section-box mb-3">
          <div className="mf-grid mf-grid-3">
            <div className="mf-cell">
              <label className="mf-cell-label" htmlFor="doc-type">Document type</label>
              <select id="doc-type" className="form-control" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
                <option value="">Select document type</option>
                {types.map((type) => (
                  <option key={type.id} value={type.code}>{type.name}</option>
                ))}
              </select>
              {errors.documentType && <div className="field-error">{errors.documentType}</div>}
            </div>
            <div className="mf-cell">
              <label className="mf-cell-label" htmlFor="doc-file">File</label>
              <input
                id="doc-file"
                type="file"
                accept={KYC_ACCEPT}
                className="form-control mf-file-input"
                onChange={(event) => {
                  const chosen = event.target.files?.[0] ?? null;
                  const problem = chosen ? kycFileProblem(chosen) : null;
                  setErrors((current) => ({ ...current, file: problem ?? "" }));
                  setFile(problem ? null : chosen);
                }}
              />
              <div className="mf-cell-help">PDF or image, up to 10 MB.</div>
              {errors.file && <div className="field-error">{errors.file}</div>}
            </div>
            <div className="mf-cell d-flex align-items-end">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void upload()}>
                <i className="icon-cloud-upload" /> {busy ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isLoading ? (
        <p className="mf-loading">Loading...</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover table-custom mf-table">
            <thead className="thead-info"><tr><th>Document</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Action</th></tr></thead>
            <tbody>
              {(data ?? []).length === 0 ? (
                <tr><td colSpan={5} className="text-center">No documents are on file.</td></tr>
              ) : (
                (data ?? []).map((document) => (
                  <tr key={document.id}>
                    <td>
                      <a href={backendUrl(document.downloadUrl ?? `customers/${customerId}/documents/${document.id}/download`)} target="_blank" rel="noreferrer">{document.originalName}</a>
                    </td>
                    <td>{types.find((type) => type.code === document.documentType)?.name ?? document.documentType}</td>
                    <td className="text-nowrap">{document.sizeBytes ? `${Math.max(1, Math.round(document.sizeBytes / 1024))} KB` : ""}</td>
                    <td className="text-nowrap">{formatDateTime(document.createdAt)}<small className="d-block text-muted">{document.uploadedByName}</small></td>
                    <td>
                      {canManage && (
                        <button type="button" className="btn btn-sm btn-icon btn-danger" title="Delete" aria-label={`Delete ${document.originalName}`} onClick={() => void remove(document)}>
                          <i className="icon-trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* -------------------------------------------------------------------- Notes -------------------------------------------------------------------- */

export function NotesTab({ customerId, canManage }: { customerId: number; canManage: boolean }) {
  const client = useQueryClient();
  const { data, isLoading } = useApi<Array<{ id: number; body: string; createdByName: string | null; createdAt: string | null }>>(`customers/${customerId}/notes`);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!body.trim()) {
      setError("Note is required.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`customers/${customerId}/notes`, { body: body.trim() });
      setBody("");
      setError(null);
      await client.invalidateQueries();
      toastSuccess("Note added.");
    } catch (exception) {
      const message = exception instanceof ApiError ? exception.firstError : "The note could not be saved.";
      setError(message);
      toastError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {canManage && (
        <div className="mb-3">
          <textarea className="form-control" rows={3} maxLength={2000} placeholder="Write a note about this customer" value={body} onChange={(event) => setBody(event.target.value)} aria-label="Note" />
          {error && <div className="field-error">{error}</div>}
          <button type="button" className="btn btn-primary btn-sm mt-2" disabled={busy} onClick={() => void add()}>
            {busy ? "Saving..." : "Add note"}
          </button>
        </div>
      )}
      {isLoading ? (
        <p className="mf-loading">Loading...</p>
      ) : (data ?? []).length === 0 ? (
        <p className="text-muted">No notes yet.</p>
      ) : (
        <ul className="mf-timeline">
          {(data ?? []).map((note) => (
            <li key={note.id}>
              <span style={{ whiteSpace: "pre-wrap" }}>{note.body}</span>
              <small className="d-block">{[formatDateTime(note.createdAt), note.createdByName].filter(Boolean).join(" · ")}</small>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* --------------------------------------------------------- Guarantors / Next of kin --------------------------------------------------------- */

const RELATION_LABEL = (value: string | null) => title(value);

function RelationRowsTab<T extends GuarantorResource | NextOfKinResource>({ customerId, canManage, kind }: { customerId: number; canManage: boolean; kind: "guarantors" | "next-of-kin" }) {
  const client = useQueryClient();
  const { data, isLoading } = useApi<T[]>(`customers/${customerId}/${kind}`);
  const guarantor = kind === "guarantors";
  const empty = { name: "", phone: "", relationship: "spouse", address: "", nidaNumber: "", occupation: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const body = guarantor ? form : { name: form.name, phone: form.phone, relationship: form.relationship, address: form.address };
      await api.post(`customers/${customerId}/${kind}`, body);
      setForm(empty);
      setErrors({});
      setOpen(false);
      await client.invalidateQueries();
      toastSuccess(guarantor ? "Guarantor added." : "Next of kin added.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        setErrors(Object.fromEntries(Object.entries(error.errors).map(([key, messages]) => [key, messages[0]])));
      }
      toastError(error instanceof ApiError ? error.firstError : "The record could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: T) => {
    if (!(await confirmAction(`Remove ${row.name}?`))) {
      return;
    }
    try {
      await api.delete(`customers/${customerId}/${kind}/${row.id}`);
      await client.invalidateQueries();
      toastSuccess("Removed.");
    } catch (error) {
      toastError(error instanceof ApiError ? error.firstError : "The record could not be removed.");
    }
  };

  const input = (key: keyof typeof empty, label: string, required = false) => (
    <div className="mf-cell">
      <label className="mf-cell-label" htmlFor={`${kind}-${key}`}>{label}{required && <span className="mf-req"> *</span>}</label>
      <input id={`${kind}-${key}`} className="form-control" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} autoComplete="off" />
      {errors[key] && <div className="field-error">{errors[key]}</div>}
    </div>
  );

  return (
    <>
      {canManage && (
        <div className="mb-2">
          {!open ? (
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setOpen(true)}>
              <i className="icon-plus" /> {guarantor ? "Add Guarantor" : "Add Next of Kin"}
            </button>
          ) : (
            <div className="mf-section-box">
              <div className="mf-grid mf-grid-3">
                {input("name", "Full Name", true)}
                {input("phone", "Phone", true)}
                <div className="mf-cell">
                  <label className="mf-cell-label" htmlFor={`${kind}-relationship`}>Relationship<span className="mf-req"> *</span></label>
                  <select id={`${kind}-relationship`} className="form-control" value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })}>
                    {RELATIONSHIPS.map((value) => (
                      <option key={value} value={value}>{title(value)}</option>
                    ))}
                  </select>
                  {errors.relationship && <div className="field-error">{errors.relationship}</div>}
                </div>
                {input("address", "Address (optional)")}
                {guarantor && input("nidaNumber", "NIDA Number (optional)")}
                {guarantor && input("occupation", "Occupation (optional)")}
              </div>
              <div className="mt-2 d-flex" style={{ gap: 6 }}>
                <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : "Save"}</button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setOpen(false); setErrors({}); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="table-responsive">
        <table className="table table-hover table-custom mf-table">
          <thead className="thead-info">
            <tr>
              <th>Full Name</th>
              <th>Phone</th>
              <th>Relationship</th>
              <th>Address</th>
              {guarantor && <th>NIDA Number</th>}
              {guarantor && <th>Occupation</th>}
              {canManage && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="mf-loading">Loading...</td></tr>
            ) : (data ?? []).length === 0 ? (
              <tr><td colSpan={7} className="text-center">{guarantor ? "No guarantors are on file." : "No next of kin are on file."}</td></tr>
            ) : (
              (data ?? []).map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.phone}</td>
                  <td>{RELATION_LABEL(row.relationship)}</td>
                  <td>{row.address}</td>
                  {guarantor && <td>{(row as GuarantorResource).nidaNumber}</td>}
                  {guarantor && <td>{(row as GuarantorResource).occupation}</td>}
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-sm btn-icon btn-danger" title="Remove" aria-label={`Remove ${row.name}`} onClick={() => void remove(row)}>
                        <i className="icon-trash" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function GuarantorsTab(props: { customerId: number; canManage: boolean }) {
  return <RelationRowsTab<GuarantorResource> {...props} kind="guarantors" />;
}

export function NextOfKinTab(props: { customerId: number; canManage: boolean }) {
  return <RelationRowsTab<NextOfKinResource> {...props} kind="next-of-kin" />;
}

/* -------------------------------------------------------------------- Group -------------------------------------------------------------------- */

export function GroupTab({ customer }: { customer: Customer }) {
  if (!customer.groupId) {
    return <p className="text-muted mb-0">This customer is not in a group.</p>;
  }
  return (
    <dl className="mf-dl">
      <Detail label="Group">
        <Link href={`/groups/${customer.groupId}`}>{customer.groupName ?? `Group ${customer.groupId}`}</Link>
      </Detail>
    </dl>
  );
}

/* ------------------------------------------------------------------ Audit trail ------------------------------------------------------------------ */

function changes(before: unknown, after: unknown): string {
  const left = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const right = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])];
  return keys
    .map((key) => {
      const from = left[key];
      const to = right[key];
      const show = (value: unknown) => (value === null || value === undefined ? "∅" : typeof value === "object" ? JSON.stringify(value) : String(value));
      return key in left && key in right ? `${key}: ${show(from)} → ${show(to)}` : key in right ? `${key}: ${show(to)}` : `${key}: ${show(from)} (removed)`;
    })
    .join("; ");
}

export function AuditTrailTab({ customerId }: { customerId: number }) {
  const { data, isLoading } = useApi<Array<{ id: number; action: string; before: unknown; after: unknown; employeeName: string | null; ipAddress: string | null; createdAt: string | null }>>(`customers/${customerId}/audit-trail`);
  return (
    <div className="table-responsive">
      <table className="table table-custom mf-table">
        <thead className="thead-info"><tr><th>When</th><th>Action</th><th>By</th><th>Changes</th></tr></thead>
        <tbody>
          {isLoading ? (
            <tr><td colSpan={4} className="mf-loading">Loading...</td></tr>
          ) : (data ?? []).length === 0 ? (
            <tr><td colSpan={4} className="text-center">No audit entries.</td></tr>
          ) : (
            (data ?? []).map((log) => (
              <tr key={log.id}>
                <td className="text-nowrap">{formatDateTime(log.createdAt)}</td>
                <td>{log.action}</td>
                <td>{log.employeeName}<small className="d-block text-muted">{log.ipAddress}</small></td>
                <td><small style={{ wordBreak: "break-word" }}>{changes(log.before, log.after)}</small></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
