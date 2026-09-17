"use client";

import Link from "next/link";

import { Stat } from "@/components/hrm/common";
import { MyPortalHeader, PortalStatus, type MyOverview } from "@/components/hrm/MyPortal";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Employee Portal overview (spec §60): the signed-in staff member's own salary, fund, credit, commission and allowances. */
export default function MyPortalPage() {
  const { data, isLoading } = useApi<MyOverview>("hrm/my/overview");

  return (
    <>
      <MyPortalHeader title="Overview" />
      {isLoading || !data ? (
        <Loading inline />
      ) : (
        <>
          <Card title={data.employee.full_name}>
            <div className="row">
              <div className="col-md-6">
                <div>Empl/ID: <b>{data.employee.employee_number ?? "-"}</b></div>
                <div>Position: {data.employee.position ?? "-"}</div>
                <div>Branch: {data.employee.branch ?? "HQ"}</div>
              </div>
              <div className="col-md-6 text-md-right">
                <div>Salary structure: {data.employee.salary_structure ?? "-"}</div>
                <div>Basic salary: <b>{money(data.employee.basic_salary)}</b></div>
              </div>
            </div>
          </Card>

          <div className="row clearfix">
            <Stat label="Staff Fund benefit record" value={money(data.staff_fund.total_benefit_record)} />
            <Stat label="Staff loan outstanding" value={money(data.staff_loans.outstanding)} />
            <Stat label="Salary advance outstanding" value={money(data.salary_advances.outstanding)} />
            <Stat label="Unpaid net commission" value={money(data.commission.unpaid_net)} />
            <Stat label="Allowances awaiting payroll" value={money(data.allowances.awaiting_payroll_amount)} />
            <Stat label="Negligence outstanding" value={money(data.negligence.outstanding)} />
            <Stat label="Open benefit claims" value={money(data.staff_fund.open_claims)} />
            <Stat label="Pending loan / advance requests" value={data.staff_loans.pending_requests + data.salary_advances.pending_requests} />
          </div>

          <div className="row clearfix">
            <div className="col-lg-6 col-12">
              <Card title="Latest Salary" actions={<Link href="/my/salary" className="btn btn-sm btn-primary">Payslips</Link>}>
                {data.salary.latest ? (
                  <>
                    <h5 className="mb-1">{money(data.salary.latest.net_salary)} <small className="text-muted">net salary</small></h5>
                    <div>{data.salary.latest.period_label} payroll · <PortalStatus status={data.salary.latest.payment_status} label={data.salary.latest.payment_status_label} /></div>
                    {data.salary.latest.paid_on && <small className="text-muted">Paid on {data.salary.latest.paid_on}</small>}
                  </>
                ) : (
                  <p className="mb-0 text-muted">No payroll yet.</p>
                )}
              </Card>
            </div>
            <div className="col-lg-6 col-12">
              <Card title="Latest Commission" actions={<Link href="/my/commission" className="btn btn-sm btn-primary">Commission</Link>}>
                {data.commission.latest ? (
                  <>
                    <h5 className="mb-1">{money(data.commission.latest.net_commission)} <small className="text-muted">net commission</small></h5>
                    <div>{data.commission.latest.period_label} commission · <PortalStatus status={data.commission.latest.status} label={data.commission.latest.status_label} /></div>
                    {data.commission.latest.paid_on && <small className="text-muted">Paid on {data.commission.latest.paid_on}</small>}
                  </>
                ) : (
                  <p className="mb-0 text-muted">No commission calculated yet.</p>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
