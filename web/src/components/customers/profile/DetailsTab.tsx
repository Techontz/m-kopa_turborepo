"use client";

import { useQueries } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { backendUrl } from "@/lib/api";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

import { Detail, formatDateTime } from "../common";
import type { Customer, CustomerType, FaceScanResource, FieldDef, MasterData } from "../types";
import { fetchParented, parentedKey } from "../wizard/Step2Details";
import { buildDetailSections, featuredScan, nameOf, rawFieldValue, type DetailItem, type DetailSection } from "./detailSections";

/** Titled card holding a label/value grid (2–3 columns, 1 on phones). */
export function DetailCard({ title, compact = false, action, children, className = "" }: { title: ReactNode; compact?: boolean; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mf-detail-card ${compact ? "is-compact" : ""} ${className}`}>
      <header className="mf-detail-card-head">
        <h3 className="mf-detail-card-title">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Display text for Step 2 fields: select labels (incl. parented lookups), money, yes/no. */
function useFieldDisplay(customer: Customer, fields: FieldDef[], masterData: MasterData | undefined) {
  const parented = fields.filter((field) => field.type === "select" && field.dataSource && field.dependsOn);
  const lookups = useQueries({
    queries: parented.map((field) => {
      const parent = fields.find((item) => item.key === field.dependsOn);
      const parentValue = parent ? rawFieldValue(customer, parent) : "";
      return { queryKey: parentedKey(field.dataSource as string, parentValue), queryFn: () => fetchParented(field.dataSource as string, parentValue), enabled: parentValue !== "", staleTime: 300_000 };
    }),
  });

  return (field: FieldDef): string => {
    const value = rawFieldValue(customer, field);
    if (value === "") {
      return "";
    }
    if (field.type === "select" && field.dataSource) {
      const index = parented.indexOf(field);
      return nameOf(index >= 0 ? lookups[index]?.data : masterData?.[field.dataSource], value);
    }
    if (field.type === "currency") {
      return money(value);
    }
    if (field.type === "boolean") {
      return ["1", "true", "yes", "ndiyo"].includes(value.toLowerCase()) ? "Yes" : "No";
    }
    return value;
  };
}

export function DetailsTab({ customer, types, masterData, onOpenFace }: { customer: Customer; types: CustomerType[] | undefined; masterData: MasterData | undefined; onOpenFace?: () => void }) {
  const type = types?.find((item) => item.id === customer.customerCategoryId);
  const { data: scans } = useApi<FaceScanResource[]>(customer.faceScanId ? `customers/${customer.id}/face-scans` : null);
  const sections = buildDetailSections(customer, type, { masterData, activeScan: featuredScan(scans) });
  const fields = sections.flatMap((section) => section.items.flatMap((item) => (item.kind === "field" ? [item.field] : [])));
  const display = useFieldDisplay(customer, fields, masterData);

  const render = (item: DetailItem) => {
    switch (item.kind) {
      case "field":
        return display(item.field);
      case "badge":
        return <Badge tone={item.tone}>{item.value}</Badge>;
      case "link":
        return (
          <a href={backendUrl(item.href)} target="_blank" rel="noreferrer" className="mf-detail-link">
            <i className="fa fa-paperclip" /> {item.value}
          </a>
        );
      default:
        return item.format === "datetime" ? formatDateTime(item.value as string | null) : item.value;
    }
  };

  const card = (section: DetailSection) => (
    <DetailCard
      key={section.key}
      title={section.title}
      compact={section.compact}
      action={
        section.key === "face" && onOpenFace ? (
          <button type="button" className="btn btn-link btn-sm mf-detail-card-action" onClick={onOpenFace}>
            Open Face KYC <i className="fa fa-angle-right" />
          </button>
        ) : undefined
      }
    >
      <dl className="mf-dl mf-detail-dl">
        {section.items.map((item) => (
          <Detail key={item.key} label={item.label}>{render(item)}</Detail>
        ))}
      </dl>
    </DetailCard>
  );

  return <div className="mf-detail-cards">{sections.map(card)}</div>;
}
