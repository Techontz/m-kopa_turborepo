"use client";

import { useRef, useState } from "react";

import { Cell } from "./Controls";
import { fieldDomId } from "./errors";
import type { Errors } from "./validation";

export const KYC_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/** Client check of a KYC file, with the server's messages. */
export function kycFileProblem(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!EXTENSIONS.includes(extension)) {
    return "Documents must be a PDF or an image.";
  }
  if (file.size > MAX_BYTES) {
    return "The document must not be larger than 10 MB.";
  }
  return null;
}

/** Step 3 — KYC Attachments: exactly one file input. */
export function Step3Kyc({ file, onChange, errors }: { file: File | null; onChange: (file: File | null) => void; errors: Errors }) {
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const error = problem ?? errors.file ?? Object.entries(errors).find(([key]) => /^(documents|attachments|customerDocuments)/.test(key))?.[1];

  return (
    <div className="mf-step">
      <div className="mf-step-head">
        <h5 className="mf-step-title">KYC Attachments</h5>
      </div>
      <p className="mf-step-sub">Attach the customer&apos;s KYC documents as one file. Anything that needs to be filed separately can be added from their profile afterwards.</p>

      <Cell field="file" label="KYC Attachment:" error={error} className="mf-kyc-cell">
        <input
          ref={input}
          id={fieldDomId("file")}
          name="mfx-kyc-attachment"
          type="file"
          accept={KYC_ACCEPT}
          className="form-control mf-file-input"
          autoComplete="off"
          data-form-type="other"
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = "";
            if (!chosen) {
              return;
            }
            const issue = kycFileProblem(chosen);
            setProblem(issue);
            if (!issue) {
              onChange(chosen);
            }
          }}
        />
        <div className="mf-cell-help">PDF or image, up to 10 MB.</div>
        {file && (
          <div className="mf-attachment">
            <i className="fa fa-file-text-o" />
            <span className="mf-attachment-name">{file.name}</span>
            <span className="text-muted">{Math.max(1, Math.round(file.size / 1024))} KB</span>
            <button type="button" className="btn btn-sm btn-link text-danger" aria-label="Remove the attachment" onClick={() => onChange(null)}>
              <i className="icon-close" />
            </button>
          </div>
        )}
      </Cell>
    </div>
  );
}
