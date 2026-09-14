"use client";

import Link from "next/link";
import { useMemo } from "react";

import { StepValueChart } from "@/components/shares/HoldingHistoryChart";
import { SharesAccess } from "@/components/shares/SharesAccess";
import { SharesNav } from "@/components/shares/SharesNav";
import { sharesLabel, TRANSACTION_TONES } from "@/components/shares/shares";
import type { ShareTransaction, ShareValuation } from "@/components/shares/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface HistoryEvent {
  key: string;
  at: string;
  kind: "transaction" | "valuation";
  label: string;
  tone: (typeof TRANSACTION_TONES)[keyof typeof TRANSACTION_TONES] | "info";
  reference: string;
  description: string;
  status: string;
  by: string | null;
}

/**
 * Shares → Share History: every share movement and share value change in one timeline, with the company share
 * valuation recorded at each value change.
 */
export default function ShareHistoryPage() {
  const { can } = useAuth();
  const allowed = can("shares.view");
  const { data: transactions, isLoading } = useApi<ShareTransaction[]>(allowed ? "shares/transactions" : null);
  const { data: valuations } = useApi<ShareValuation[]>(allowed ? "shares/valuations" : null);

  const events = useMemo<HistoryEvent[]>(() => {
    const moves = (transactions ?? []).map<HistoryEvent>((row) => ({
      key: `t${row.id}`,
      at: row.transacted_at,
      kind: "transaction",
      label: row.type_label,
      tone: TRANSACTION_TONES[row.type],
      reference: row.reference,
      description: `${sharesLabel(row.shares)} shares ${row.from_share_holder ? `from ${row.from_share_holder} ` : ""}${row.to_share_holder ? `to ${row.to_share_holder}` : "cancelled"} at ${money(row.share_value)} per share`,
      status: row.status,
      by: row.performed_by,
    }));
    const values = (valuations ?? []).map<HistoryEvent>((row) => ({
      key: `v${row.id}`,
      at: `${row.valuation_date} 00:00:00`,
      kind: "valuation",
      label: row.kind === "initial" ? "Initial Share Value" : "Share Value Change",
      tone: "info",
      reference: row.reference,
      description: `${row.previous_value === null ? "" : `${money(row.previous_value)} → `}${money(row.new_value)} per share; ${sharesLabel(row.total_shares)} shares valued at ${money(row.new_total_valuation)} — ${row.reason}`,
      status: row.status,
      by: row.performed_by,
    }));
    return [...moves, ...values].sort((a, b) => b.at.localeCompare(a.at));
  }, [transactions, valuations]);

  const valuationPoints = [...(valuations ?? [])].filter((row) => row.status === "effective").reverse().map((row) => ({ date: row.valuation_date, value: row.new_total_valuation, detail: `${sharesLabel(row.total_shares)} shares × ${money(row.new_value)}` }));

  return (
    <SharesAccess crumbs={["Shares", "Share History"]}>
      <PageHeader crumbs={["Shares", "Share History"]} right={<Link href="/shares/register" className="btn btn-secondary"><i className="icon-calendar" /> Ownership as of a date</Link>} />
      <SharesNav />
      <Card title="Company Share Valuation at Each Value Change">
        <StepValueChart title="Company share valuation (total shares × share value)" points={valuationPoints} />
        <p className="text-muted mb-0"><small>Valuations are memorandum records of ownership value — never cash or bank balances.</small></p>
      </Card>
      <Card title="Share History">
        <DataTable
          rows={events}
          loading={isLoading}
          rowKey={(row) => row.key}
          columns={[
            { key: "at", header: "Date / Time" },
            { key: "label", header: "Event", render: (row) => <Badge tone={row.tone}>{row.label}</Badge> },
            { key: "reference", header: "Reference" },
            { key: "description", header: "Details" },
            { key: "status", header: "Status", render: (row) => row.status.toUpperCase() },
            { key: "by", header: "By", render: (row) => row.by ?? "—" },
          ]}
        />
      </Card>
    </SharesAccess>
  );
}
