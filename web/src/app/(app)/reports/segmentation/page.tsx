"use client";

import { useState } from "react";

import { SegmentTable, type SegmentRow } from "@/components/reports/SegmentTable";
import { ReportBarChart } from "@/components/reports/ReportChart";
import { cleanQuery, FilterModal, PrintButton, ReportTabs, SearchButton, type ReportFilters } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useApi } from "@/lib/hooks";

type Dimension = "gender" | "age" | "occupation" | "category" | "region" | "branch" | "loan_size";

const TABS: Array<[Dimension, string]> = [
  ["gender", "Gender"],
  ["age", "Age Group"],
  ["occupation", "Occupation"],
  ["category", "Customer Type"],
  ["region", "Location (Mkoa)"],
  ["branch", "Branch"],
  ["loan_size", "Loan Size"],
];

/** Report → Portfolio & Risk → Customer Segmentation (Documents: 📊 SEGMENTATION TYPES). */
export default function SegmentationPage() {
  const [dimension, setDimension] = useState<Dimension>("gender");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<{ dimensions: Record<Dimension, SegmentRow[]> }>("reports/segmentation", cleanQuery(filters));
  const label = TABS.find(([key]) => key === dimension)?.[1] ?? "Segment";
  const rows = data?.dimensions[dimension];

  return (
    <>
      <PageHeader crumbs={["Report", "Customer Segmentation"]} />
      <ReportTabs tabs={TABS} value={dimension} onChange={setDimension} />

      <Card title={`Customer Segmentation / ${label}`} actions={<><SearchButton onClick={() => setFiltering(true)} /><PrintButton /></>}>
        {isLoading || !rows ? (
          <div className="mf-loading">Loading...</div>
        ) : (
          <>
            <ReportBarChart data={rows} xKey="segment" series={[{ key: "repayment_rate", label: "Repayment rate %" }, { key: "default_rate", label: "Default rate %" }]} format={(value) => `${value}%`} />
            <SegmentTable key={dimension} rows={rows} heading={label} filename={`segmentation-${dimension === "category" ? "customer-type" : dimension}`} />
          </>
        )}
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Segmentation (loans issued)" datesOptional onApply={setFilters} />
    </>
  );
}
