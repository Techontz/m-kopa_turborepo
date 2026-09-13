"use client";

import { useEffect, useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

import type { ExpenseRequest } from "./types";

interface AcceptBody {
  id: number;
  req_comment: string;
  req_amount: string;
  from_account?: string;
}

/** Live "Expences Accept Comment" modal (comment + amount); HQ expenses also pick the HQ account that pays. */
export function AcceptExpenseModal({ request, onClose, limit }: { request: ExpenseRequest | null; onClose: () => void; limit?: number }) {
  const [form, setForm] = useState<AcceptBody>({ id: 0, req_comment: "", req_amount: "" });
  const accept = useAction<AcceptBody>("post", (body) => `expenses/requests/${body.id}/accept`);

  useEffect(() => {
    if (request) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({ id: request.id, req_comment: request.comment ?? "", req_amount: String(request.amount), from_account: request.scope === "hq" ? "company_cash" : undefined });
      accept.setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  return (
    <Modal
      open={request !== null}
      onClose={onClose}
      title="Expences Accept Comment"
      submitLabel="Accept"
      submitting={accept.isPending}
      onSubmit={() => accept.mutate(form, { onSuccess: onClose })}
    >
      <div className="row clearfix">
        <Field label="Comment:" className="col-md-12" error={accept.fieldError("req_comment")}>
          <textarea className="form-control" rows={4} value={form.req_comment} onChange={(e) => setForm({ ...form, req_comment: e.target.value })} />
        </Field>
        <Field label="Amount" className="col-md-12" error={accept.fieldError("req_amount")}>
          <input type="number" className="form-control" value={form.req_amount} onChange={(e) => setForm({ ...form, req_amount: e.target.value })} required />
        </Field>
        {request?.scope === "hq" && (
          <Field label="Paid From Account:" className="col-md-12" error={accept.fieldError("from_account")}>
            <SelectBox optionsUrl="hq/options/accounts" query={{ with_company: 1 }} value={form.from_account} onChange={(value) => setForm({ ...form, from_account: value ?? undefined })} />
          </Field>
        )}
        {request?.scope === "branch" && (
          <div className="col-md-12">
            <small className="text-muted">
              Paid from branch INTEREST A/C.{limit !== undefined && ` Above ${money(limit)} requires Admin approval.`}
            </small>
          </div>
        )}
      </div>
    </Modal>
  );
}
