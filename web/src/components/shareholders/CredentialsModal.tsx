"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";

import { credentialsText, type CredentialEntry } from "./credentials";

/**
 * "Shareholder account created": login phone + temporary password with a copy button and the warning that they are not
 * shown again. Closing the modal discards them (the parent passes null afterwards).
 */
export function CredentialsModal({ entries, onClose, title = "Shareholder account created" }: { entries: CredentialEntry[] | null; onClose: () => void; title?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!entries) {
      return;
    }
    try {
      await navigator.clipboard.writeText(credentialsText(entries));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const close = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Modal open={entries !== null} onClose={close} title={title} cancelLabel="I HAVE SAVED IT — CLOSE">
      <div className="alert alert-warning" role="alert" data-testid="credentials-warning">
        <i className="icon-exclamation" /> Copy these credentials now and hand them to the shareholder securely. The temporary password is
        <b> not stored and will not be shown again</b>. It must be changed at the first login.
      </div>
      <div className="sh-credentials" data-testid="credentials">
        {entries?.map((entry) => (
          <dl key={entry.login} className="sh-credential">
            <dt>Shareholder</dt>
            <dd>{entry.name}</dd>
            <dt>Login (phone)</dt>
            <dd><code>{entry.login}</code></dd>
            <dt>Temporary password</dt>
            <dd><code className="sh-secret">{entry.temporary_password}</code></dd>
          </dl>
        ))}
      </div>
      <button type="button" className="btn btn-info btn-sm" onClick={copy}>
        <i className={copied ? "icon-check" : "icon-docs"} /> {copied ? "Copied" : "Copy credentials"}
      </button>
    </Modal>
  );
}
