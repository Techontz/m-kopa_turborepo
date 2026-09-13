"use client";

import { useState } from "react";

import { FilterModal, HeaderButton, type Filters } from "@/components/hrm/common";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { currentMonth } from "@/components/hrm/common";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Goal {
  id: number;
  title: string;
  metric: string;
  target: number;
  actual: number | null;
  progress: number | null;
}

interface KpiRow {
  employee_id: number;
  employee: string;
  branch: string | null;
  role: string | null;
  new_customers: number;
  loans_count: number;
  disbursement_amount: number;
  collections_amount: number;
  expected_collections: number;
  collection_rate: number | null;
  portfolio_outstanding: number;
  par30: number;
  goals: Goal[];
  latest_review: { period: string; rating: number; discipline: string | null } | null;
}

interface Review {
  id: number;
  employee: string;
  branch: string | null;
  period: string;
  targets: string | null;
  discipline: string | null;
  rating: number;
  remarks: string | null;
  reviewed_by: string | null;
}

const EMPTY = { empl_id: "", period: currentMonth(), targets: "", discipline: "", rating: "3", remarks: "" };

export default function PerformancePage() {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "review" | null>(null);
  const [goals, setGoals] = useState<KpiRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const { data, isLoading } = useApi<{ from: string; to: string; rows: KpiRow[] }>("hrm/performance", { ...filters });
  const { data: reviews } = useApi<Review[]>("hrm/performance/reviews");
  const save = useAction<typeof EMPTY>("post", "hrm/performance/reviews");

  return (
    <>
      <PageHeader crumbs={["HRM", "Performance"]} />

      <Card
        title={`Staff Performance Report ${data ? `/ ${data.from} - ${data.to}` : ""}`}
        actions={
          <>
            <HeaderButton icon="icon-plus" title="Performance review" onClick={() => { setForm(EMPTY); setModal("review"); }} />
            <HeaderButton title="filter" onClick={() => setModal("filter")} />
          </>
        }
      >
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.employee_id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "employee", header: "Officer", className: "text-uppercase" },
            { key: "branch", header: "Branch" },
            { key: "new_customers", header: "Customers registered" },
            { key: "loans_count", header: "Loans disbursed" },
            { key: "disbursement_amount", header: "Disbursed amount", render: (row) => money(row.disbursement_amount) },
            { key: "collections_amount", header: "Collections", render: (row) => money(row.collections_amount) },
            { key: "collection_rate", header: "Collection rate", value: (row) => row.collection_rate ?? -1, render: (row) => (row.collection_rate === null ? "-" : `${row.collection_rate}%`) },
            { key: "portfolio_outstanding", header: "Outstanding", render: (row) => money(row.portfolio_outstanding) },
            { key: "par30", header: "PAR 30", render: (row) => <Badge tone={row.par30 > 10 ? "danger" : row.par30 > 5 ? "warning" : "success"}>{row.par30}%</Badge> },
            { key: "rating", header: "Rating", value: (row) => row.latest_review?.rating ?? 0, render: (row) => (row.latest_review ? `${row.latest_review.rating}/5 (${row.latest_review.period})` : "-") },
            { key: "goals", header: "Goals", sortable: false, render: (row) => <button type="button" className="btn btn-sm btn-primary" disabled={row.goals.length === 0} onClick={() => setGoals(row)}>{row.goals.length}</button> },
          ]}
        />
      </Card>

      <Card title="Performance Reviews">
        <DataTable
          rows={reviews}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "period", header: "Month" },
            { key: "employee", header: "Staff name" },
            { key: "branch", header: "Branch" },
            { key: "targets", header: "Targets" },
            { key: "discipline", header: "Discipline" },
            { key: "rating", header: "Rating", render: (row) => `${row.rating}/5` },
            { key: "remarks", header: "Remaks" },
            { key: "reviewed_by", header: "Reviewed by" },
          ]}
        />
      </Card>

      <Modal open={goals !== null} onClose={() => setGoals(null)} title={`Targets vs achievement — ${goals?.employee ?? ""}`} size="lg">
        <DataTable
          rows={goals?.goals}
          searchable={false}
          rowKey={(row) => row.id}
          columns={[
            { key: "title", header: "Goal" },
            { key: "metric", header: "Metric" },
            { key: "target", header: "Target", render: (row) => money(row.target) },
            { key: "actual", header: "Achieved", render: (row) => (row.actual === null ? "-" : money(row.actual)) },
            { key: "progress", header: "Progress", render: (row) => (row.progress === null ? "-" : <Badge tone={row.progress >= 100 ? "success" : "warning"}>{row.progress}%</Badge>) },
          ]}
        />
      </Modal>

      <Modal open={modal === "review"} onClose={() => setModal(null)} title="Performance Review" size="lg" submitLabel="Save" submitting={save.isPending} onSubmit={() => save.mutate(form, { onSuccess: () => setModal(null) })}>
        <div className="row">
          <Field label="Staff:" className="col-md-6" error={save.fieldError("empl_id")}>
            <SelectBox placeholder="Select Staff" optionsUrl="options/employees" value={form.empl_id} onChange={(value) => setForm({ ...form, empl_id: value ?? "" })} />
          </Field>
          <Field label="Month:" className="col-md-6" error={save.fieldError("period")}>
            <input type="month" className="form-control" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
          </Field>
          <Field label="Targets:" className="col-md-12" error={save.fieldError("targets")}>
            <textarea className="form-control" rows={2} value={form.targets} onChange={(e) => setForm({ ...form, targets: e.target.value })} />
          </Field>
          <Field label="Discipline:" className="col-md-6" error={save.fieldError("discipline")}>
            <select className="form-control" value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              <option value="">Select</option>
              {["Excellent", "Good", "Fair", "Poor"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Performance rating (1-5):" className="col-md-6" error={save.fieldError("rating")}>
            <select className="form-control" value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>
              {[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Remaks:" className="col-md-12" error={save.fieldError("remarks")}>
            <textarea className="form-control" rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />
    </>
  );
}
