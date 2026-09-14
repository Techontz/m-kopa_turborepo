"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AssetActionModal, AssetHistoryTable, type AssetAction } from "@/components/capital/assets/AssetActionModal";
import { findType, isTerminal, statusTone, type AssetConfig, type AssetDetail } from "@/components/capital/assets/assets";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { FileField } from "@/components/ui/FileField";
import { PageHeader } from "@/components/ui/PageHeader";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

const DOCUMENT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

/** Capital → Assets → asset: details, valuation snapshot, accounting link, QR, documents and full history. */
export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canView = can("capital.view") || can("capital.manage");
  const canManage = can("capital.manage");
  const { data: asset, isLoading } = useApi<AssetDetail>(canView ? `capital/assets/${id}` : null);
  const { data: config } = useApi<AssetConfig>(canView ? "capital/assets/config" : null);
  const [action, setAction] = useState<AssetAction | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const upload = useAction<FormData>("post", `capital/assets/${id}/documents`);
  const remove = useAction<number>("delete", (documentId) => `capital/assets/${id}/documents/${documentId}`);
  const type = findType(config, asset?.asset_type ?? "");

  if (!canView) {
    return (
      <>
        <PageHeader crumbs={["Capital", "Assets"]} />
        <Card><p className="mb-0">You do not have permission to view the asset registry.</p></Card>
      </>
    );
  }

  const specificationRows = (type?.fields ?? []).filter((field) => asset?.specifications[field.key] !== undefined).map((field) => {
    const raw = String(asset?.specifications[field.key]);
    return { label: field.label, value: field.options?.find((option) => option.value === raw)?.label ?? raw };
  });

  return (
    <>
      <PageHeader crumbs={["Capital", "Assets", asset?.asset_code ?? "Asset"]} right={<Link href="/capital/assets" className="btn btn-secondary"><i className="icon-arrow-left" /> Asset Registry</Link>} />
      {isLoading && <Card><div className="mf-loading">Loading...</div></Card>}
      {asset && (
        <>
          <div className="row clearfix">
            <div className="col-lg-8">
              <Card
                title={<>{asset.asset_code} — {asset.name} <Badge tone={statusTone(asset.status)}>{asset.status_label.toUpperCase()}</Badge></>}
                actions={
                  canManage && !isTerminal(asset.status) && (
                    <div className="text-nowrap">
                      <button type="button" className="btn btn-sm btn-primary mr-1" onClick={() => setAction("edit")}><i className="icon-pencil" /> Edit</button>
                      <button type="button" className="btn btn-sm btn-primary mr-1" onClick={() => setAction("transfer")}><i className="icon-shuffle" /> Transfer</button>
                      <button type="button" className="btn btn-sm btn-warning mr-1" onClick={() => setAction("status")}><i className="icon-flag" /> Status</button>
                      <button type="button" className="btn btn-sm btn-success mr-1" onClick={() => setAction("revalue")}><i className="icon-graph" /> Revalue</button>
                      {!asset.share_transaction_reference && <button type="button" className="btn btn-sm btn-danger" onClick={() => setAction("reverse")}><i className="icon-action-undo" /> Reverse</button>}
                    </div>
                  )
                }
              >
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <tbody>
                      <tr><th>Asset Type</th><td>{asset.asset_type_label}</td><th>Contributor</th><td>{asset.share_holder}</td></tr>
                      <tr><th>Description</th><td colSpan={3}>{asset.description}</td></tr>
                      <tr><th>Quantity × Unit Value</th><td>{asset.quantity.toLocaleString("en-US")} × {money(asset.unit_value)}</td><th>Contribution Value</th><td><b>{money(asset.contribution_value)}</b></td></tr>
                      <tr><th>Current Value</th><td><b>{money(asset.current_value)}</b></td><th>Contribution Date</th><td>{asset.contributed_on}</td></tr>
                      <tr><th>Branch</th><td>{asset.branch}</td><th>Location</th><td>{asset.location ?? "—"}</td></tr>
                      <tr><th>Condition</th><td>{asset.condition_label ?? "—"}</td><th>Recorded By</th><td>{asset.recorded_by ?? "—"} <small className="text-muted">{asset.created_at}</small></td></tr>
                      {specificationRows.map((row, index) => index % 2 === 0 && (
                        <tr key={row.label}>
                          <th>{row.label}</th><td>{row.value}</td>
                          {specificationRows[index + 1] ? <><th>{specificationRows[index + 1].label}</th><td>{specificationRows[index + 1].value}</td></> : <td colSpan={2} />}
                        </tr>
                      ))}
                      <tr><th>Notes</th><td colSpan={3}>{asset.notes ?? "—"}</td></tr>
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="row clearfix">
                <div className="col-lg-6">
                  <Card title="Valuation Snapshot (at contribution)">
                    <table className="table table-sm mb-0">
                      <tbody>
                        <tr><th>Method</th><td>{asset.valuation.method_label}</td></tr>
                        <tr><th>Valuation Date</th><td>{asset.valuation.date}</td></tr>
                        <tr><th>Valued By / Reference</th><td>{asset.valuation.valued_by ?? "—"} / {asset.valuation.reference ?? "—"}</td></tr>
                        <tr><th>Notes</th><td>{asset.valuation.notes ?? "—"}</td></tr>
                        <tr><th>Contributed Capital</th><td><b>{money(asset.valuation.contribution_value)}</b></td></tr>
                      </tbody>
                    </table>
                  </Card>
                </div>
                <div className="col-lg-6">
                  <Card title="Capital & Accounting">
                    <table className="table table-sm mb-0">
                      <tbody>
                        <tr><th>Posting</th><td>Dr {asset.ledger_account_label} / Cr CAPITAL ACCOUNT</td></tr>
                        <tr><th>Journal Ref</th><td>{asset.journal_reference ? <Link href="/accounting/journal">{asset.journal_reference}</Link> : "—"}</td></tr>
                        <tr><th>Shares Issued Against</th><td>{asset.share_transaction_reference ?? "Not linked (Shares → Issue Shares → linked contribution)"}</td></tr>
                        {asset.contribution_reversed && <tr><th>Reversed</th><td><Badge tone="danger">REVERSED</Badge> {asset.reversal_reason}</td></tr>}
                      </tbody>
                    </table>
                  </Card>
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <Card title="QR Code">
                <div className="text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image stream */}
                  <img src={backendUrl(asset.qr_endpoint)} alt={`QR code ${asset.asset_code}`} width={200} height={200} className="mb-2" />
                  <p className="mb-2"><small className="text-muted">Opens {asset.scan_path}</small></p>
                  <Link href={`/capital/assets/${asset.id}/label`} className="btn btn-info btn-sm mr-1"><i className="icon-printer" /> Print Label</Link>
                  <a href={backendUrl(`${asset.qr_endpoint}?download=1`)} className="btn btn-secondary btn-sm"><i className="icon-cloud-download" /> Download QR</a>
                </div>
              </Card>
              <Card title="Documents & Photos">
                {canManage && (
                  <form
                    className="mb-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!file) {
                        upload.setErrors({ file: ["Choose a file to upload"] });
                        return;
                      }
                      const body = new FormData();
                      body.append("document_type", documentType);
                      body.append("file", file);
                      upload.mutate(body, { onSuccess: () => { setFile(null); setDocumentType(""); setFileKey((key) => key + 1); } });
                    }}
                  >
                    <div className="row">
                      <Field label="Document Type:" required className="col-12" error={upload.fieldError("document_type")}>
                        <select id="asset-document-type" className="form-control input-sm" value={documentType} onChange={(event) => setDocumentType(event.target.value)} required>
                          <option value="">Select</option>
                          {asset.document_types.map((item) => <option key={item.key} value={item.key}>{item.label}{item.required ? " *" : ""}</option>)}
                        </select>
                      </Field>
                      <Field label="File (PDF / image, max 10 MB):" required className="col-12">
                        <FileField key={fileKey} file={file} onChange={setFile} accept={DOCUMENT_ACCEPT} extensions={config?.document_mimes ?? ["pdf", "jpg", "jpeg", "png", "webp"]} maxMb={(config?.document_max_kb ?? 10240) / 1024} placeholder="Upload photo or document" error={upload.fieldError("file")} />
                      </Field>
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={upload.isPending}><i className="icon-cloud-upload" /> Upload</button>
                  </form>
                )}
                <DataTable
                  rows={asset.documents}
                  searchable={false}
                  rowKey={(row) => row.id}
                  emptyMessage="No documents"
                  columns={[
                    { key: "document_type", header: "Type", render: (row) => asset.document_types.find((item) => item.key === row.document_type)?.label ?? row.document_type },
                    { key: "original_name", header: "File", render: (row) => <a href={backendUrl(row.endpoint)} target="_blank" rel="noopener noreferrer" title={`${row.uploaded_by ?? ""} ${row.uploaded_at ?? ""}`}>{row.original_name}</a> },
                    {
                      key: "actions",
                      header: "",
                      sortable: false,
                      render: (row) => (
                        <span className="text-nowrap">
                          <a href={backendUrl(`${row.endpoint}?download=1`)} className="btn btn-sm btn-icon btn-secondary mr-1" title="Download"><i className="icon-cloud-download" /></a>
                          {canManage && <button type="button" className="btn btn-sm btn-icon btn-danger" title="Delete" disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete ${row.original_name}?`)) { remove.mutate(row.id); } }}><i className="icon-trash" /></button>}
                        </span>
                      ),
                    },
                  ]}
                />
              </Card>
            </div>
          </div>
          <Card title="Asset History">
            <AssetHistoryTable events={asset.events} />
          </Card>
        </>
      )}
      <AssetActionModal asset={asset && action ? asset : null} action={action} config={config} onClose={() => setAction(null)} />
    </>
  );
}
