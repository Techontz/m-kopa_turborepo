"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

interface PassportPhotoFieldProps {
  /** Newly chosen file (null = keep current / none). */
  file: File | null;
  onChange: (file: File | null) => void;
  /** Image URL of the photo already stored (edit mode). */
  currentUrl?: string | null;
  error?: string;
  required?: boolean;
}

/**
 * Passport-size photo picker: a 35×45 portrait frame with preview, choose / change / remove actions and
 * client-side type and size checks (the API validates again).
 */
export function PassportPhotoField({ file, onChange, currentUrl, error, required }: PassportPhotoFieldProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
  }, [preview]);

  const pick = (chosen: File | undefined) => {
    if (!chosen) {
      return;
    }
    if (!ACCEPT.includes(chosen.type)) {
      setLocalError("Choose a JPG, PNG or WEBP image");
      return;
    }
    if (chosen.size > MAX_BYTES) {
      setLocalError("The image may not be larger than 2 MB");
      return;
    }
    setLocalError(null);
    onChange(chosen);
  };

  const shown = file ? preview : currentUrl;

  return (
    <div className="mf-passport">
      <label htmlFor={inputId} className={`mf-passport-frame ${shown ? "has-photo" : ""}`} title="Passport size image">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- authorised API image stream, not a static asset
          <img src={shown} alt="Passport size" />
        ) : (
          <span className="mf-passport-empty"><i className="icon-user" /><small>35 × 45</small></span>
        )}
      </label>
      <div className="mf-passport-meta">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPT.join(",")}
          className="d-none"
          required={required && !currentUrl && !file}
          onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ""; }}
        />
        <button type="button" className="btn btn-sm btn-outline-primary mr-1" onClick={() => input.current?.click()}>
          <i className="icon-camera" /> {shown ? "Change photo" : "Upload photo"}
        </button>
        {file && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onChange(null)}>
            <i className="icon-close" /> {currentUrl ? "Keep current" : "Remove"}
          </button>
        )}
        <div className="mf-file-hint">Passport size (35×45 mm), plain background. JPG, PNG or WEBP, max 2 MB.</div>
        {file && <div className="mf-file-name">{file.name}</div>}
        {(localError || error) && <div className="field-error">{localError ?? error}</div>}
      </div>
    </div>
  );
}
