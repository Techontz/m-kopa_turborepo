"use client";

import { useState } from "react";

import { changedPolicies, type ApprovalPolicyRow } from "@/components/finance/pendingApprovals";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { useAction, useApi } from "@/lib/hooks";

function PolicyForm({ policies }: { policies: ApprovalPolicyRow[] }) {
  const [edited, setEdited] = useState<Record<string, boolean>>({});
  const update = useAction<{ policies: { workflow: string; allow_self_approval: boolean }[] }>("put", "settings/approval-policies");
  const changes = changedPolicies(policies, edited);

  return (
    <form onSubmit={(event) => { event.preventDefault(); if (changes.length > 0) { update.mutate({ policies: changes }, { onSuccess: () => setEdited({}) }); } }}>
      <div className="table-responsive">
        <table className="table table-custom table-sm">
          <thead className="thead-info">
            <tr><th>Workflow</th><th>Approval</th><th>Allow Self-Approval</th><th>Last Changed</th></tr>
          </thead>
          <tbody>
            {policies.map((policy) => {
              const checked = edited[policy.workflow] ?? policy.allow_self_approval;
              return (
                <tr key={policy.workflow}>
                  <td>{policy.label}<div className="small text-muted">{policy.workflow}</div></td>
                  <td>REQUIRED (another user approves)</td>
                  <td>
                    <label className="mb-0">
                      <input type="checkbox" className="mr-1" checked={checked} onChange={(event) => setEdited({ ...edited, [policy.workflow]: event.target.checked })} aria-label={`Allow self-approval: ${policy.label}`} />
                      {checked ? "Allowed" : "Not allowed"}
                    </label>
                  </td>
                  <td className="small">{policy.updated_by ? `${policy.updated_by} · ${policy.updated_at ?? ""}` : "Default"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {update.fieldError("policies") && <div className="field-error">{update.fieldError("policies")}</div>}
      <p className="text-muted small">
        Maker/checker is mandatory: the user who initiates a transaction cannot approve it. Allowing self-approval for a workflow lets an initiator approve
        their own item only when that user ALSO holds the explicit privilege &quot;Approve own financial transactions&quot; (never implied, Super Admin included).
        Every change is recorded in the audit trail.
      </p>
      <div className="text-center m-t-20">
        <button type="submit" className="btn btn-primary" disabled={changes.length === 0 || update.isPending}><i className="icon-drawer" /> Update</button>
      </div>
    </form>
  );
}

/** Settings → Approval Policy (C6): per workflow, whether the company allows self-approval. */
export default function ApprovalPolicyPage() {
  const { can } = useAuth();
  const { data, error } = useApi<ApprovalPolicyRow[]>(can("settings.manage") ? "settings/approval-policies" : null);

  return (
    <>
      <PageHeader crumbs={["Settings", "Approval Policy"]} />
      <Card title="Approval Policy">
        {!can("settings.manage") ? (
          <div className="alert alert-warning mb-0">You do not have permission to manage settings.</div>
        ) : error ? (
          <div className="alert alert-danger mb-0">{error instanceof Error ? error.message : "The approval policy could not be loaded."}</div>
        ) : data ? (
          <PolicyForm key={data.map((row) => `${row.workflow}:${row.allow_self_approval}`).join("|")} policies={data} />
        ) : (
          <Loading />
        )}
      </Card>
    </>
  );
}
