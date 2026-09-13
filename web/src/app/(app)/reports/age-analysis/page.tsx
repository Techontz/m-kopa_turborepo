"use client";

import { useState } from "react";

import { SegmentTable, type SegmentRow } from "@/components/reports/SegmentTable";
import { ReportBarChart } from "@/components/reports/ReportChart";
import { cleanQuery, FilterModal, PrintButton, SearchButton, type ReportFilters } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useApi } from "@/lib/hooks";

/** Report → Portfolio & Risk → Age Analysis (Documents: 🎂 AGE ANALYSIS REPORT — 18–25, 26–35, 36–45, 46–60, 60+). */
export default function AgeAnalysisPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<{ rows: SegmentRow[] }>("reports/age-analysis", cleanQuery(filters));

  return (
    <>
      <PageHeader crumbs={["Report", "Age Analysis"]} />

      <Card title="Age Analysis" actions={<><SearchButton onClick={() => setFiltering(true)} /><PrintButton /></>}>
        {isLoading || !data ? (
          <div className="mf-loading">Loading...</div>
        ) : (
          <>
            <div className="row">
              <div className="col-lg-6">
                <h6>Loan Volume</h6>
                <ReportBarChart data={data.rows} xKey="segment" series={[{ key: "disbursed", label: "Loan volume" }]} />
              </div>
              <div className="col-lg-6">
                <h6>Repayment vs Default Rate</h6>
                <ReportBarChart data={data.rows} xKey="segment" series={[{ key: "repayment_rate", label: "Repayment rate %" }, { key: "default_rate", label: "Default rate %" }]} format={(value) => `${value}%`} />
              </div>
            </div>
            <SegmentTable rows={data.rows} heading="Age Group" filename="age-analysis" />
          </>
        )}
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Age Analysis (loans issued)" datesOptional onApply={setFilters} />
    </>
  );
}
