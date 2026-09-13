"use client";

import { useRef, useState } from "react";

import { confirmAction } from "@/components/ui/notify";
import { useAction } from "@/lib/hooks";

import { backendUrl, type CustomerProfile } from "./types";

/**
 * Required documents of the customer's category (rule engine "Required documents"): one upload per document type.
 */
export function DocumentsPanel({ customer, canEdit = true }: { customer: CustomerProfile; canEdit?: boolean }) {
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const upload = useAction<FormData>("post", `customers/${customer.id}/documents`);
  const remove = useAction<{ id: number }>("delete", (body) => `customers/${customer.id}/documents/${body.id}`);

  const required = customer.category?.required_documents ?? [];

  if (!customer.category) {
    return <p className="text-muted">Chagua kundi la mteja (Customer Category) kwanza ili kuona nyaraka zinazohitajika.</p>;
  }

  const send = (type: string) => {
    const file = files[type];
    if (!file) {
      return;
    }
    const body = new FormData();
    body.append("document_type", type);
    body.append("file", file);
    upload.mutate(body, {
      onSuccess: () => {
        setFiles((current) => ({ ...current, [type]: null }));
        if (inputs.current[type]) {
          inputs.current[type]!.value = "";
        }
      },
    });
  };

  return (
    <div className="table-responsive">
      <table className="table table-hover table-custom">
        <thead className="thead-info">
          <tr>
            <th>S/No.</th>
            <th>Document</th>
            <th>Uploaded file</th>
            <th>Status</th>
            {canEdit && <th>Upload (PDF / JPG / PNG)</th>}
          </tr>
        </thead>
        <tbody>
          {required.map((type, index) => {
            const uploaded = customer.documents.filter((document) => document.document_type === type);
            return (
              <tr key={type}>
                <td>{index + 1}.</td>
                <td>{type}</td>
                <td>
                  {uploaded.map((document) => (
                    <div key={document.id} className="text-nowrap">
                      <a href={backendUrl(document.url)} target="_blank" rel="noreferrer">{document.original_name}</a> <small className="text-muted">{document.uploaded_at}</small>
                      {canEdit && (
                        <button type="button" className="btn btn-sm btn-link text-danger" title="Delete" onClick={async () => (await confirmAction()) && remove.mutate({ id: document.id })}>
                          <i className="icon-trash" />
                        </button>
                      )}
                    </div>
                  ))}
                </td>
                <td>{uploaded.length > 0 ? <span className="badge badge-success">Uploaded</span> : <span className="badge badge-danger">Missing</span>}</td>
                {canEdit && (
                  <td className="text-nowrap">
                    <input
                      ref={(element) => { inputs.current[type] = element; }}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(event) => setFiles((current) => ({ ...current, [type]: event.target.files?.[0] ?? null }))}
                      style={{ maxWidth: 220 }}
                    />
                    <button type="button" className="btn btn-sm btn-primary" disabled={!files[type] || upload.isPending} onClick={() => send(type)}>
                      <i className="icon-cloud-upload" /> Save
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {upload.fieldError("file") && <div className="field-error">{upload.fieldError("file")}</div>}
    </div>
  );
}
