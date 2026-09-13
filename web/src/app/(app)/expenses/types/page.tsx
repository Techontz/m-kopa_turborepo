"use client";

import { useEffect, useState } from "react";

import { ExpenseTypesRegister } from "@/components/finance/ExpenseTypesRegister";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

/** Company setting from the Documents: branch expenses up to the limit are approved by Finance, above it by Admin. */
function ApprovalLimitCard() {
  const { data } = useApi<{ expense_approval_limit: number }>("expenses/settings");
  const [limit, setLimit] = useState("");
  const save = useAction<{ expense_approval_limit: string }>("put", "expenses/settings");

  useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLimit(String(data.expense_approval_limit));
    }
  }, [data]);

  return (
    <Card title="Expenses Approval Limit">
      <form className="row" onSubmit={(e) => { e.preventDefault(); save.mutate({ expense_approval_limit: limit }); }}>
        <Field label="Branch expenses approved by Finance up to (above: Admin):" required className="col-md-6" error={save.fieldError("expense_approval_limit")}>
          <input type="number" min={0} className="form-control" value={limit} onChange={(e) => setLimit(e.target.value)} required />
        </Field>
        <div className="col-md-6 d-flex align-items-end mb-2">
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>Update</button>
          <span className="ml-3 text-muted">Current: {money(data?.expense_approval_limit)}</span>
        </div>
      </form>
    </Card>
  );
}

export default function BranchExpenseTypesPage() {
  const { can } = useAuth();

  return (
    <ExpenseTypesRegister scope="branch" crumbs={["Expenses"]} title="Expenses" field="ex_name" managePermission={["expenses.request", "settings.manage"]}>
      {can("settings.manage") && <ApprovalLimitCard />}
    </ExpenseTypesRegister>
  );
}
