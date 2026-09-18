"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AccessDenied } from "@/components/customers/AccessDenied";
import { CustomerAvatar, CustomerStatusBadges } from "@/components/customers/common";
import {
  AuditTrailTab,
  DetailsTab,
  DocumentsTab,
  FaceKycTab,
  GroupTab,
  GuarantorsTab,
  KycTab,
  NextOfKinTab,
  NotesTab,
  OverviewTab,
  TimelineTab,
  type Overview,
} from "@/components/customers/profile/ProfileTabs";
import { toastError, toastSuccess } from "@/components/customers/toast";
import type { Customer, CustomerType, MasterData } from "@/components/customers/types";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction, promptReason } from "@/components/ui/notify";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

type Tab = "overview" | "details" | "kyc" | "face" | "timeline" | "documents" | "notes" | "guarantors" | "next-of-kin" | "group" | "audit";

/** Customer Profile with its tabs (CUSTOMER_MODULE_SPEC §1.3). */
export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const client = useQueryClient();
  const allowed = can("customers.view");
  const { data: customer, isLoading, error } = useApi<Customer>(allowed ? `customers/${id}` : null);
  const { data: overview } = useApi<Overview>(allowed ? `customers/${id}/overview` : null);
  const { data: types } = useApi<CustomerType[]>(allowed ? "customer-categories" : null);
  const { data: masterData } = useApi<MasterData>(allowed ? "master-data" : null);
  const [tab, setTab] = useState<Tab>("overview");
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsText, setSmsText] = useState("");
  const [busy, setBusy] = useState(false);
  const sendSms = useAction<{ message: string }>("post", `customers/${id}/sms`);
  const mark = useAction("post", `customers/${id}/mark`);

  if (!allowed) {
    return (
      <>
        <PageHeader crumbs={["Customer", "Customer Profile"]} />
        <AccessDenied />
      </>
    );
  }

  if (isLoading || !customer) {
    return (
      <>
        <PageHeader crumbs={["Customer", "Customer Profile"]} />
        <Card>{isLoading ? <Loading inline /> : <p className="mb-0 text-center">{error instanceof ApiError && error.status === 404 ? "Customer not found" : "The customer could not be loaded."}</p>}</Card>
      </>
    );
  }

  const canManage = can("customers.manage") && !customer.deletedAt;
  const canEdit = (can("customers.manage") || can("customers.edit")) && !customer.deletedAt;
  const canApprove = can("customers.approve") && customer.approvalStatus === "pending";
  const counts = overview?.counts;

  const decide = async (action: "approve" | "reject" | "resubmit") => {
    let body: { reason?: string } = {};
    if (action === "reject") {
      const reason = await promptReason("Reason for rejecting this registration");
      if (!reason) {
        return;
      }
      body = { reason };
    } else if (!(await confirmAction(action === "approve" ? "Approve this registration?" : "Resubmit this registration for approval?"))) {
      return;
    }
    setBusy(true);
    try {
      await api.post(`customers/${customer.id}/${action}`, body);
      await client.invalidateQueries();
      toastSuccess(action === "approve" ? "Registration approved." : action === "reject" ? "Registration returned to the officer." : "Registration resubmitted for approval.");
    } catch (exception) {
      toastError(exception instanceof ApiError ? exception.firstError : "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "overview", label: "Overview" },
    { key: "details", label: "Details" },
    { key: "kyc", label: "KYC" },
    { key: "face", label: "Face KYC" },
    { key: "timeline", label: "Timeline" },
    { key: "documents", label: "Documents", count: counts?.documents },
    { key: "notes", label: "Notes", count: counts?.notes },
    { key: "guarantors", label: "Guarantors", count: counts?.guarantors },
    { key: "next-of-kin", label: "Next of Kin", count: counts?.nextOfKin },
    { key: "group", label: "Group" },
    { key: "audit", label: "Audit Trail" },
  ];

  return (
    <>
      <PageHeader crumbs={["Customer", "Customer Profile"]} right={<Link href="/customers/search" className="btn btn-sm btn-outline-primary"><i className="icon-magnifier" /> Search customer</Link>} />

      <Card>
        <div className="mf-profile-head">
          <CustomerAvatar customer={customer} className="mf-profile-photo" />
          <div>
            <h4 className="mf-profile-name">{customer.fullName}</h4>
            <div className="mf-profile-sub">{[customer.customerNumber, customer.phone, customer.branchName, customer.categoryName].filter(Boolean).join(" · ")}</div>
            <div className="mf-profile-badges"><CustomerStatusBadges customer={customer} /></div>
          </div>
          <div className="mf-profile-actions">
            {customer.kycStatus === "completed" && can("loans.apply") && (
              <Link href={`/loans/apply?customer_id=${customer.id}`} className="btn btn-sm btn-info">Loan Application</Link>
            )}
            {can("reports.view") && <Link href={`/reports/statement?customer_id=${customer.id}`} className="btn btn-sm btn-outline-primary">Statement</Link>}
            {canEdit && (
              <Link href={`/customers/${customer.id}/edit`} className="btn btn-sm btn-primary">
                <i className="icon-pencil" /> Edit
              </Link>
            )}
            {canManage && !customer.faceVerifiedAt && (
              <button type="button" className="btn btn-sm btn-warning" onClick={() => setTab("face")}>
                <i className="icon-camera" /> Run face verification
              </button>
            )}
            {(can("customers.manage") || can("messages.use")) && (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSmsOpen(true)}>Send SMS</button>
            )}
            {canManage && (
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={mark.isPending} onClick={() => mark.mutate(undefined)}>
                {customer.isMarked ? "Unmark" : "Mark"}
              </button>
            )}
            {canApprove && (
              <>
                <button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={() => void decide("approve")}>Approve</button>
                <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => void decide("reject")}>Reject</button>
              </>
            )}
            {canManage && customer.approvalStatus === "rejected" && (
              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void decide("resubmit")}>Resubmit</button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <ul className="mf-tabs" role="tablist">
          {tabs.map((item) => (
            <li key={item.key} role="presentation">
              <button type="button" role="tab" aria-selected={tab === item.key} className={tab === item.key ? "active" : ""} onClick={() => setTab(item.key)}>
                {item.label}
                {item.count !== undefined && <span className="count">{item.count}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="pt-3" role="tabpanel">
          {tab === "overview" && <OverviewTab customer={customer} overview={overview} />}
          {tab === "details" && <DetailsTab customer={customer} types={types} masterData={masterData} onOpenFace={() => setTab("face")} />}
          {tab === "kyc" && <KycTab customer={customer} />}
          {tab === "face" && <FaceKycTab customer={customer} canManage={canManage} onVerified={() => void client.invalidateQueries()} />}
          {tab === "timeline" && <TimelineTab customerId={customer.id} />}
          {tab === "documents" && <DocumentsTab customerId={customer.id} canManage={canManage} masterData={masterData} />}
          {tab === "notes" && <NotesTab customerId={customer.id} canManage={canManage} />}
          {tab === "guarantors" && <GuarantorsTab customerId={customer.id} canManage={canManage} />}
          {tab === "next-of-kin" && <NextOfKinTab customerId={customer.id} canManage={canManage} />}
          {tab === "group" && <GroupTab customer={customer} />}
          {tab === "audit" && <AuditTrailTab customerId={customer.id} />}
        </div>
      </Card>

      <Modal open={smsOpen} onClose={() => setSmsOpen(false)} title="Send SMS" submitLabel="Send" submitting={sendSms.isPending} onSubmit={() => sendSms.mutate({ message: smsText }, { onSuccess: () => { setSmsOpen(false); setSmsText(""); } })}>
        <span>Phone number: {customer.phone}</span>
        <textarea className="form-control" rows={4} placeholder="Enter message" value={smsText} onChange={(event) => setSmsText(event.target.value)} required />
        {sendSms.fieldError("message") && <div className="field-error">{sendSms.fieldError("message")}</div>}
      </Modal>
    </>
  );
}
