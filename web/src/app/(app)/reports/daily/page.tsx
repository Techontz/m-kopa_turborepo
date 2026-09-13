"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, SearchButton, type ReportFilters } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface DailyReport {
  in: Record<string, number>;
  out: Record<string, number>;
  total_in: number;
  total_out: number;
  opening: number;
  closing: number;
  heading: string;
}

const spacer = (
  <tr>
    <td style={{ border: "none" }}>&nbsp;</td>
    <td style={{ border: "none" }} />
  </tr>
);

/** Report → Daily Report (live admin/daily_report): opening, money in, money out and closing cash position. */
export default function DailyReportPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<DailyReport>("reports/daily", cleanQuery(filters));

  return (
    <>
      <PageHeader crumbs={["Daily Report"]} />

      <Card title={`Daily Report / ${data?.heading ?? ""}`} actions={<SearchButton onClick={() => setFiltering(true)} />}>
        <div className="table-responsive">
          <table className="table table-hover dataTable table-custom mf-table">
            <thead className="thead-info">
              <tr>
                <th>DESCRIPTION</th>
                <th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || !data ? (
                <tr><td colSpan={2} className="mf-loading">Loading...</td></tr>
              ) : (
                <>
                  <tr><td><b>OPENING</b></td><td><b>{money(data.opening)}</b></td></tr>
                  {Object.entries(data.in).map(([label, amount]) => (
                    <tr key={`in-${label}`}><td>{label}</td><td>{money(amount)}</td></tr>
                  ))}
                  <tr><td><b style={{ color: "green" }}>TOTAL</b></td><td><b style={{ color: "green" }}>{money(data.total_in)}</b></td></tr>
                  {spacer}
                  {Object.entries(data.out).map(([label, amount]) => (
                    <tr key={`out-${label}`}><td>{label}</td><td>{money(amount)}</td></tr>
                  ))}
                  <tr><td><b style={{ color: "red" }}>TOTAL</b></td><td><b style={{ color: "red" }}>{money(data.total_out)}</b></td></tr>
                  {spacer}
                  <tr><td><b>CLOSING</b></td><td><b>{money(data.closing)}</b></td></tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Daily Report" branchPlaceholder="---Select Branch---" onApply={setFilters} />
    </>
  );
}
