"use client";

import { useState } from "react";

import { FilterModal, HeaderButton, Stat, type Filters } from "@/components/hrm/common";
import { StaffBenefitClaims } from "@/components/hrm/StaffBenefitClaims";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { type Option } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

/**
 * Spec §25: users without payroll.pay / reports.financial (HR) receive only `contributions`, `total_benefit_record` and
 * `members` — the Fund Account cash, statement and movements are Finance's and are hidden for them.
 */
interface FundReport {
  balance?: number;
  liability?: number;
  contributions: number;
  total_benefit_record?: number;
  withdrawals?: number;
  loans_issued?: number;
  advances_issued?: number;
  repayments?: number;
  income?: number;
  opening_balance?: number;
  statement?: { date: string; reference: string; description: string; inflow: number; outflow: number; balance: number }[];
  members: { employee_id: number; employee: string; branch: string | null; contributions: number; withdrawals: number; balance: number }[];
}

export default function StaffFundPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "settings" | null>(null);
  const [percentForm, setPercentForm] = useState("");
  const { data: report, isLoading } = useApi<FundReport>("hrm/staff-fund", { from: filters.from, to: filters.to });
  const { data: settings } = useApi<{ staff_fund_percent: number }>("hrm/settings");
  const save = useAction<{ staff_fund_percent: string }>("put", "hrm/settings");

  const seesFundAccount = report === undefined || report.balance !== undefined;
  const members: Option[] = (report?.members ?? []).filter((member) => member.balance > 0).map((member) => ({ value: String(member.employee_id), label: `${member.employee} (${money(member.balance)})` }));

  return (
    <>
      <PageHeader crumbs={["HRM", "Staff Fund"]} />

      <div className="row clearfix">
        {seesFundAccount && <Stat label="STAFF FUND A/C balance" value={money(report?.balance)} />}
        <Stat label="Contributions" value={money(report?.contributions)} />
        {seesFundAccount ? (
          <>
            <Stat label="Loans issued" value={money(report?.loans_issued)} />
            <Stat label="Advances issued" value={money(report?.advances_issued)} />
          </>
        ) : (
          <Stat label="Total benefit record" value={money(report?.total_benefit_record)} />
        )}
      </div>

      {seesFundAccount && (
      <Card
        title={`Staff Fund Statement (contribution ${percent(settings?.staff_fund_percent)} of salary)`}
        actions={
          <>
            {can("payroll.approve") && <HeaderButton icon="icon-settings" title="Contribution %" onClick={() => { setPercentForm(String(settings?.staff_fund_percent ?? "")); setModal("settings"); }} />}
            <HeaderButton title="filter" onClick={() => setModal("filter")} />
          </>
        }
      >
        <p className="mb-2">Opening balance: <b>{money(report?.opening_balance)}</b> · Fund income (interest &amp; charges): <b>{money(report?.income)}</b> · Owed to members: <b>{money(report?.liability)}</b></p>
        <DataTable
          rows={report?.statement}
          loading={isLoading}
          rowKey={(row, index) => `${row.reference}-${index}`}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "date", header: "Date" },
            { key: "reference", header: "Ref" },
            { key: "description", header: "Description" },
            { key: "inflow", header: "Inflow", render: (row) => money(row.inflow) },
            { key: "outflow", header: "Outflow", render: (row) => money(row.outflow) },
            { key: "balance", header: "Balance", render: (row) => money(row.balance) },
          ]}
        />
      </Card>
      )}

      <Card
        title="Staff Fund Members"
        actions={!seesFundAccount && can("payroll.approve") && <HeaderButton icon="icon-settings" title="Contribution %" onClick={() => { setPercentForm(String(settings?.staff_fund_percent ?? "")); setModal("settings"); }} />}
      >
        <DataTable
          rows={report?.members}
          rowKey={(row) => row.employee_id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "employee", header: "Staff name" },
            { key: "branch", header: "Branch" },
            { key: "contributions", header: "Contributions", render: (row) => money(row.contributions) },
            { key: "withdrawals", header: "Withdrawals", render: (row) => money(row.withdrawals) },
            { key: "balance", header: "Balance", render: (row) => money(row.balance) },
          ]}
        />
      </Card>

      <StaffBenefitClaims members={members} />

      <Modal open={modal === "settings"} onClose={() => setModal(null)} title="Staff Fund Contribution" submitLabel="Save" submitting={save.isPending} onSubmit={() => save.mutate({ staff_fund_percent: percentForm }, { onSuccess: () => setModal(null) })}>
        <Field label="Contribution (% of base salary):" className="col-12 px-0" error={save.fieldError("staff_fund_percent")}>
          <input type="number" step="0.01" className="form-control" value={percentForm} onChange={(e) => setPercentForm(e.target.value)} required />
        </Field>
      </Modal>

      <FilterModal open={modal === "filter"} withBranch={false} onClose={() => setModal(null)} onApply={setFilters} />
    </>
  );
}
