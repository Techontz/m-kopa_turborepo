"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAction, useApi } from "@/lib/hooks";

function ReserveForm({ reserve }: { reserve: number }) {
  const [value, setValue] = useState(String(reserve));
  const update = useAction<{ reserve: string }>("put", "settings/reserve");

  return (
    <form onSubmit={(e) => { e.preventDefault(); update.mutate({ reserve: value }); }}>
      <div className="row">
        <div className="col-md-12 col-12">
          <div className="form-group">
            <span>Reserve Percentage</span>
            <input className="form-control" placeholder="Enter Reserve Percentage % " value={value} onChange={(e) => setValue(e.target.value)} required autoComplete="off" />
            {update.fieldError("reserve") && <div className="field-error">{update.fieldError("reserve")}</div>}
          </div>
        </div>
      </div>
      <div className="text-center m-t-20">
        <button type="submit" className="btn btn-primary" disabled={update.isPending}><i className="icon-drawer" />Update</button>
      </div>
    </form>
  );
}

/** Live admin/reserve_setting — Documents: reserve is cut from interest on every repayment. */
export default function ReserveSettingPage() {
  const { data } = useApi<{ reserve: number }>("settings/reserve");

  return (
    <>
      <PageHeader crumbs={["Reserve Setting"]} />
      <Card title="Reserve Setting">{data ? <ReserveForm key={data.reserve} reserve={data.reserve} /> : <Loading />}</Card>
    </>
  );
}
