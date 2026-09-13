"use client";

import { useId, useRef, useState } from "react";

interface FileFieldProps {
  file: File | null;
  onChange: (file: File | null) => void;
  /** MIME types / extensions for the file dialog, e.g. "application/pdf,image/*". */
  accept: string;
  /** Allowed extensions, checked before upload (the API validates again). */
  extensions: string[];
  maxMb: number;
  placeholder?: string;
  error?: string;
}

/** Document upload control styled like the live form inputs: chosen file name, browse and clear buttons. */
export function FileField({ file, onChange, accept, extensions, maxMb, placeholder = "No file chosen", error }: FileFieldProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const pick = (chosen: File | undefined) => {
    if (!chosen) {
      return;
    }
    const extension = chosen.name.split(".").pop()?.toLowerCase() ?? "";
    if (!extensions.includes(extension)) {
      setLocalError(`Allowed files: ${extensions.join(", ").toUpperCase()}`);
      return;
    }
    if (chosen.size > maxMb * 1024 * 1024) {
      setLocalError(`The file may not be larger than ${maxMb} MB`);
      return;
    }
    setLocalError(null);
    onChange(chosen);
  };

  return (
    <>
      <div className="input-group mf-file">
        <label htmlFor={inputId} className={`form-control mf-file-label ${file ? "" : "text-muted"}`}>
          <i className={file ? "fa fa-file-text-o" : "icon-cloud-upload"} /> {file ? `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)` : placeholder}
        </label>
        <div className="input-group-append">
          {file && (
            <button type="button" className="btn btn-outline-secondary" title="Clear" onClick={() => onChange(null)}><i className="icon-close" /></button>
          )}
          <button type="button" className="btn btn-outline-primary" onClick={() => input.current?.click()}>Browse</button>
        </div>
        <input ref={input} id={inputId} type="file" accept={accept} className="d-none" onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }} />
      </div>
      <div className="mf-file-hint">{extensions.join(", ").toUpperCase()} — max {maxMb} MB</div>
      {(localError || error) && <div className="field-error">{localError ?? error}</div>}
    </>
  );
}
