"use client";

import { useState } from "react";

import { ShareTransactionsTable } from "@/components/shares/ShareTransactionsTable";
import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import type { ShareTransaction } from "@/components/shares/types";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FileField } from "@/components/ui/FileField";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";
import { newIdempotencyKey } from "@/lib/idempotency";

const DOCUMENT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

function CancelModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ share_holder_id: "", shares: "", transaction_date: todayIso(), reason: "" });
  const [document, setDocument] = useState<File | null>(null);
  const [key] = useState(() => newIdempotencyKey("share-cancel"));
  const cancel = useAction<FormData>("post", "shares/cancellations");

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancel Shares"
      submitLabel="Cancel Shares"
      submitting={cancel.isPending}
      onSubmit={() => {
        const body = new FormData();
        for (const [field, value] of Object.entries(form)) {
          if (value) {
            body.append(field, value);
          }
        }
        body.append("idempotency_key", key);
        if (document) {
          body.append("document", document);
        }
        cancel.mutate(body, { onSuccess: onClose });
      }}
    >
      <p className="text-muted">Cancelled shares return to unissued, so total issued shares decrease. No ledger entry is posted.</p>
      <div className="row">
        <Field label="Shareholder:" required className="col-md-6" error={cancel.fieldError("share_holder_id")}>
          <SelectBox inputId="cancel-holder" placeholder="Select Shareholder" optionsUrl="shares/options/share-holders" query={{ holding: 1 }} value={form.share_holder_id} onChange={(value) => setForm({ ...form, share_holder_id: value ?? "" })} />
        </Field>
        <Field label="Shares:" required className="col-md-3" error={cancel.fieldError("shares")}>
          <input className="form-control" inputMode="numeric" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} required />
        </Field>
        <Field label="Date:" required className="col-md-3" error={cancel.fieldError("transaction_date")}>
          <input type="date" className="form-control" max={todayIso()} value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} />
        </Field>
        <Field label="Reason:" required className="col-md-12" error={cancel.fieldError("reason")}>
          <textarea className="form-control" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
        </Field>
        <Field label="Supporting Document:" className="col-md-12">
          <FileField file={document} onChange={setDocument} accept={DOCUMENT_ACCEPT} extensions={DOCUMENT_EXTENSIONS} maxMb={5} placeholder="Upload document (PDF / image)" error={cancel.fieldError("document")} />
        </Field>
      </div>
    </Modal>
  );
}

function AdjustModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ share_holder_id: "", direction: "increase", shares: "", reason: "" });
  const [key] = useState(() => newIdempotencyKey("share-adjust"));
  const adjust = useAction<typeof form & { idempotency_key: string }>("post", "shares/adjustments");

  return (
    <Modal open onClose={onClose} title="Adjust Holding" submitLabel="Save Adjustment" submitting={adjust.isPending} onSubmit={() => adjust.mutate({ ...form, idempotency_key: key }, { onSuccess: onClose })}>
      <p className="text-muted">A correction with a reason. Adding shares uses unissued shares (within the authorised limit); removing returns them to unissued. No ledger entry.</p>
      <div className="row">
        <Field label="Shareholder:" required className="col-md-6" error={adjust.fieldError("share_holder_id")}>
          <SelectBox inputId="adjust-holder" placeholder="Select Shareholder" optionsUrl="shares/options/share-holders" value={form.share_holder_id} onChange={(value) => setForm({ ...form, share_holder_id: value ?? "" })} />
        </Field>
        <Field label="Direction:" required className="col-md-3" error={adjust.fieldError("direction")}>
          <select className="form-control" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
            <option value="increase">Add shares</option>
            <option value="decrease">Remove shares</option>
          </select>
        </Field>
        <Field label="Shares:" required className="col-md-3" error={adjust.fieldError("shares")}>
          <input className="form-control" inputMode="numeric" value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} required />
        </Field>
        <Field label="Reason:" required className="col-md-12" error={adjust.fieldError("reason")}>
          <textarea className="form-control" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
        </Field>
      </div>
    </Modal>
  );
}

/** Shares → Share Transactions: the immutable movement ledger with filters; corrections are reversals. */
export default function ShareTransactionsPage() {
  const { can } = useAuth();
  const [filter, setFilter] = useState({ type: "", share_holder_id: "", from: "", to: "" });
  const { data, isLoading } = useApi<ShareTransaction[]>(can("shares.view") ? "shares/transactions" : null, filter);
  const { data: types = [] } = useApi<Option[]>(can("shares.view") ? "shares/options/types" : null);
  const [modal, setModal] = useState<"cancel" | "adjust" | null>(null);

  return (
    <SharesAccess crumbs={["Shares", "Share Transactions"]}>
      <PageHeader
        crumbs={["Shares", "Share Transactions"]}
        right={
          can("shares.manage") && (
            <>
              <button type="button" className="btn btn-danger mr-1" onClick={() => setModal("cancel")}><i className="icon-close" /> Cancel Shares</button>
              <button type="button" className="btn btn-secondary" onClick={() => setModal("adjust")}><i className="icon-wrench" /> Adjust Holding</button>
            </>
          )
        }
      />
      <SharesNav />
      <Card title="Share Transactions">
        <div className="row">
          <Field label="Type:" className="col-lg-3 col-md-6">
            <SelectBox inputId="filter-type" placeholder="All types" isClearable options={types} value={filter.type} onChange={(value) => setFilter({ ...filter, type: value ?? "" })} />
          </Field>
          <Field label="Shareholder:" className="col-lg-3 col-md-6">
            <SelectBox inputId="filter-holder" placeholder="All shareholders" isClearable optionsUrl="shares/options/share-holders" value={filter.share_holder_id} onChange={(value) => setFilter({ ...filter, share_holder_id: value ?? "" })} />
          </Field>
          <Field label="From:" className="col-lg-3 col-md-6">
            <input type="date" className="form-control" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
          </Field>
          <Field label="To:" className="col-lg-3 col-md-6">
            <input type="date" className="form-control" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
          </Field>
        </div>
        <ShareTransactionsTable rows={data} loading={isLoading} />
      </Card>
      {modal === "cancel" && <CancelModal onClose={() => setModal(null)} />}
      {modal === "adjust" && <AdjustModal onClose={() => setModal(null)} />}
    </SharesAccess>
  );
}
