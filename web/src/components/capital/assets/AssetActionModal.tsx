"use client";

import Link from "next/link";
import { useState } from "react";

import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { backendUrl } from "@/lib/api";
import { money, todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

import { SpecificationInput } from "./AssetContributionFields";
import { eventChange, eventLabel, findType, type AssetConfig, type AssetDetail, type AssetRow } from "./assets";

export type AssetAction = "edit" | "transfer" | "status" | "revalue" | "reverse" | "qr" | "history";

interface Props {
  asset: AssetRow | null;
  action: AssetAction | null;
  config: AssetConfig | undefined;
  onClose: () => void;
}

const TITLES: Record<AssetAction, string> = {
  edit: "Edit Asset Details",
  transfer: "Transfer Asset to Branch",
  status: "Change Asset Status",
  revalue: "Revalue Asset",
  reverse: "Reverse Asset Contribution",
  qr: "Asset QR Code",
  history: "Asset History",
};

/** History table of an asset (append-only events). */
export function AssetHistoryTable({ events, loading }: { events: AssetDetail["events"] | undefined; loading?: boolean }) {
  return (
    <DataTable
      rows={events}
      loading={loading}
      searchable={false}
      rowKey={(row) => row.id}
      emptyMessage="No history"
      columns={[
        { key: "occurred_at", header: "Date / Time" },
        { key: "event", header: "Event", render: (row) => eventLabel(row.event), value: (row) => eventLabel(row.event) },
        { key: "change", header: "Change", sortable: false, render: (row) => eventChange(row) || "—" },
        { key: "amount", header: "Value Before → After", sortable: false, render: (row) => (row.amount_before === null && row.amount_after === null ? "—" : `${row.amount_before === null ? "—" : money(row.amount_before)} → ${row.amount_after === null ? "—" : money(row.amount_after)}`) },
        { key: "reason", header: "Reason", render: (row) => row.reason ?? "—" },
        { key: "employee", header: "By", render: (row) => row.employee ?? "—" },
      ]}
    />
  );
}

/**
 * Registry actions, each an explicit audited API call with a reason: descriptive edit, branch transfer, status change,
 * memo revaluation and contribution reversal; plus QR view / download and history.
 */
export function AssetActionModal({ asset, action, config, onClose }: Props) {
  const open = asset !== null && action !== null;
  return open ? <AssetActionBody key={`${asset.id}-${action}`} asset={asset} action={action} config={config} onClose={onClose} /> : null;
}

function AssetActionBody({ asset, action, config, onClose }: { asset: AssetRow; action: AssetAction; config: AssetConfig | undefined; onClose: () => void }) {
  const type = findType(config, asset.asset_type);
  const [values, setValues] = useState<Record<string, string>>({
    to_branch_id: "",
    transfer_date: todayIso(),
    status: "",
    new_value: String(asset.current_value),
    valuation_date: todayIso(),
    valuation_method: "",
    valued_by: "",
    valuation_reference: "",
    reason: "",
    location: asset.location ?? "",
    notes: "",
    condition: asset.condition ?? "",
    description: asset.description,
  });
  const [specifications, setSpecifications] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(asset.specifications ?? {}).map(([key, value]) => [key, String(value)])));
  const { data: detail, isLoading } = useApi<AssetDetail>(action === "history" || action === "edit" ? `capital/assets/${asset.id}` : null);
  const [notesLoaded, setNotesLoaded] = useState(false);
  if (action === "edit" && detail && !notesLoaded) {
    setNotesLoaded(true);
    setValues((current) => ({ ...current, notes: detail.notes ?? "" }));
  }

  const paths: Record<string, string> = {
    edit: `capital/assets/${asset.id}`,
    transfer: `capital/assets/${asset.id}/transfer`,
    status: `capital/assets/${asset.id}/status`,
    revalue: `capital/assets/${asset.id}/revaluations`,
    reverse: `capital/assets/${asset.id}/reverse`,
  };
  const mutation = useAction<Record<string, unknown>>(action === "edit" ? "patch" : "post", paths[action] ?? `capital/assets/${asset.id}`);
  const set = (key: string) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const reason = (
    <Field label="Reason:" required className="col-lg-12" error={mutation.fieldError("reason")}>
      <textarea id="asset-action-reason" className="form-control input-sm" rows={2} value={values.reason} onChange={set("reason")} required maxLength={1000} />
    </Field>
  );

  const submit = () => {
    const pick = (...keys: string[]) => Object.fromEntries(keys.map((key) => [key, values[key] === "" ? null : values[key]]));
    const body: Record<string, Record<string, unknown>> = {
      edit: { ...pick("location", "notes", "description"), ...(type?.condition ? pick("condition") : {}), specifications },
      transfer: pick("to_branch_id", "transfer_date", "reason"),
      status: pick("status", "reason"),
      revalue: pick("new_value", "valuation_date", "valuation_method", "valued_by", "valuation_reference", "reason"),
      reverse: pick("reason"),
    };
    mutation.mutate(body[action], { onSuccess: onClose });
  };

  const header = (
    <p className="mb-2">
      <b>{asset.asset_code}</b> · {asset.name} · {asset.asset_type_label} · {asset.branch} · Contribution value <b>{money(asset.contribution_value)}</b> · Current value <b>{money(asset.current_value)}</b>
    </p>
  );

  if (action === "qr") {
    return (
      <Modal open onClose={onClose} title={`${TITLES.qr} — ${asset.asset_code}`}>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image stream */}
          <img src={backendUrl(asset.qr_endpoint)} alt={`QR code ${asset.asset_code}`} width={220} height={220} className="mb-2" />
          <p className="mb-1"><b>{asset.asset_code}</b> · {asset.name}</p>
          <p className="mb-2"><small className="text-muted">Scanning opens {asset.scan_path} (sign-in with capital access required). The code holds no asset data.</small></p>
          <a href={backendUrl(`${asset.qr_endpoint}?download=1`)} className="btn btn-secondary btn-sm mr-1"><i className="icon-cloud-download" /> Download QR</a>
          <Link href={`/capital/assets/${asset.id}/label`} className="btn btn-info btn-sm"><i className="icon-printer" /> Print Label</Link>
        </div>
      </Modal>
    );
  }

  if (action === "history") {
    return (
      <Modal open onClose={onClose} title={`${TITLES.history} — ${asset.asset_code}`} size="xl">
        {header}
        <AssetHistoryTable events={detail?.events} loading={isLoading} />
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`${TITLES[action]} — ${asset.asset_code}`} size={action === "edit" ? "lg" : undefined} submitLabel={action === "reverse" ? "Reverse" : "Save"} submitting={mutation.isPending} onSubmit={submit}>
      {header}
      <div className="row">
        {action === "transfer" && (
          <>
            <Field label="From Branch:" className="col-lg-6"><input className="form-control input-sm" readOnly value={asset.branch ?? ""} /></Field>
            <Field label="To Branch:" required className="col-lg-6" error={mutation.fieldError("to_branch_id")}>
              <SelectBox inputId="asset-transfer-branch" placeholder="Select Branch" optionsUrl="options/branches" value={values.to_branch_id} onChange={(value) => setValues({ ...values, to_branch_id: value ?? "" })} />
            </Field>
            <Field label="Transfer Date:" required className="col-lg-6" error={mutation.fieldError("transfer_date")}>
              <input id="asset-transfer-date" type="date" max={todayIso()} className="form-control input-sm" value={values.transfer_date} onChange={set("transfer_date")} required />
            </Field>
            {reason}
          </>
        )}
        {action === "status" && (
          <>
            <Field label="Current Status:" className="col-lg-6"><input className="form-control input-sm" readOnly value={asset.status_label} /></Field>
            <Field label="New Status:" required className="col-lg-6" error={mutation.fieldError("status")}>
              <select id="asset-new-status" className="form-control input-sm" value={values.status} onChange={set("status")} required>
                <option value="">Select</option>
                {(config?.statuses ?? []).filter((option) => option.value !== asset.status).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            {reason}
            <p className="col-lg-12 mb-0"><small className="text-muted">Disposed and Written Off are final. Disposal / write-off is recorded as history and status; the ledger keeps the contributed cost.</small></p>
          </>
        )}
        {action === "revalue" && (
          <>
            <Field label="New Current Value (TZS):" required className="col-lg-6" error={mutation.fieldError("new_value")}>
              <input id="asset-new-value" type="number" min={0} step="0.01" className="form-control input-sm" value={values.new_value} onChange={set("new_value")} required />
            </Field>
            <Field label="Valuation Date:" required className="col-lg-6" error={mutation.fieldError("valuation_date")}>
              <input type="date" max={todayIso()} className="form-control input-sm" value={values.valuation_date} onChange={set("valuation_date")} required />
            </Field>
            <Field label="Valuation Method:" required className="col-lg-6" error={mutation.fieldError("valuation_method")}>
              <select id="asset-revalue-method" className="form-control input-sm" value={values.valuation_method} onChange={set("valuation_method")} required>
                <option value="">Select</option>
                {(config?.valuation_methods ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Valued By / Reference:" className="col-lg-6">
              <div className="d-flex">
                <input className="form-control input-sm mr-1" placeholder="Valued by" value={values.valued_by} onChange={set("valued_by")} />
                <input className="form-control input-sm" placeholder="Reference" value={values.valuation_reference} onChange={set("valuation_reference")} />
              </div>
            </Field>
            {reason}
            <p className="col-lg-12 mb-0"><small className="text-muted">Memo revaluation: only the current value and history change. The contribution value ({money(asset.contribution_value)}), contributed capital, ownership and the ledger are unchanged.</small></p>
          </>
        )}
        {action === "reverse" && (
          <>
            {reason}
            <p className="col-lg-12 mb-0"><small className="text-muted">Posts a reversal journal (Cr {asset.ledger_account_label} / Dr CAPITAL ACCOUNT), marks the contribution and asset reversed and removes it from contributed capital. Not allowed while shares issued against it are active.</small></p>
          </>
        )}
        {action === "edit" && (
          <>
            <Field label="Description:" required className="col-lg-12" error={mutation.fieldError("description")}>
              <textarea className="form-control input-sm" rows={2} value={values.description} onChange={set("description")} required />
            </Field>
            <Field label="Location:" required={type?.location_required} className="col-lg-6" error={mutation.fieldError("location")}>
              <input id="asset-edit-location" className="form-control input-sm" value={values.location} onChange={set("location")} required={type?.location_required} />
            </Field>
            {type?.condition && (
              <Field label="Condition:" required className="col-lg-6" error={mutation.fieldError("condition")}>
                <select className="form-control input-sm" value={values.condition} onChange={set("condition")} required>
                  <option value="">Select</option>
                  {(config?.conditions ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
            )}
            <Field label="Notes:" className="col-lg-12" error={mutation.fieldError("notes")}>
              <input className="form-control input-sm" value={values.notes} onChange={set("notes")} />
            </Field>
            {(type?.fields ?? []).map((field) => (
              <Field key={field.key} label={`${field.label}:`} required={field.required} className={field.type === "textarea" ? "col-lg-12" : "col-lg-4 col-md-6"} error={mutation.fieldError(`specifications.${field.key}`)}>
                <SpecificationInput id={`asset-edit-${field.key}`} field={field} value={specifications[field.key] ?? ""} onChange={(value) => setSpecifications({ ...specifications, [field.key]: value })} />
              </Field>
            ))}
            <p className="col-lg-12 mb-0"><small className="text-muted">Contribution value, contributor and date never change here. Use Transfer for the branch, Status for status and Revalue for the current value.</small></p>
          </>
        )}
      </div>
    </Modal>
  );
}
