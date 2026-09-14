"use client";

import Link from "next/link";
import { useState } from "react";

import { DividendPaymentsTable } from "@/components/dividends/DividendPaymentsTable";
import { PayDividendModal } from "@/components/dividends/PayDividendModal";
import { allocationBadge, currentMonth, declarationBadge, loadState, mapPreview, periodLabel, profitSourceLabel, tzs } from "@/components/dividends/dividends";
import type { DividendAllocation, DividendDeclaration, DividendPayment, DividendPreview, DividendSummary } from "@/components/dividends/types";
import { SummaryTiles, styles } from "@/components/financial-reports/ReportShell";
import { sharesLabel } from "@/components/shares/shares";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

function ErrorOrLoading({ isLoading, error }: { isLoading: boolean; error: unknown }) {
  const status = loadState({ isLoading, error });
  if (status.state === "loading") {
    return <div className="mf-loading">{status.message}</div>;
  }
  return status.state === "error" ? <div className="alert alert-danger mb-0">{status.message}</div> : null;
}

function AllocationHistoryModal({ allocation, onClose }: { allocation: DividendAllocation; onClose: () => void }) {
  const { data, isLoading, error } = useApi<DividendPayment[]>(`capital/dividends/allocations/${allocation.id}/payments`);

  return (
    <Modal open onClose={onClose} size="xl" title={`Payment History / ${allocation.share_holder ?? ""}`}>
      <SummaryTiles
        items={[
          { label: "Dividend Entitlement", value: tzs(allocation.entitlement) },
          { label: "Amount Paid", value: tzs(allocation.paid_amount) },
          { label: "Outstanding Balance", value: tzs(allocation.balance) },
          {
            label: "Payment Status",
            value: allocationBadge(allocation.status).label,
          },
        ]}
      />
      <DividendPaymentsTable rows={data} isLoading={isLoading} error={error} single pageSize={25} />
    </Modal>
  );
}

function DeclareDividendCard({ period, onPeriod, canManage, canSettings, onView }: { period: string; onPeriod: (value: string) => void; canManage: boolean; canSettings: boolean; onView: (id: number) => void }) {
  const { data: preview, isLoading, error } = useApi<DividendPreview>("capital/dividends/preview", { period });
  const declare = useAction<{ period: string }, { data: { id: number } }>("post", "capital/dividends");
  const mapped = mapPreview(preview);

  return (
    <Card
      title="Declare Dividend"
      actions={
        canSettings && (
          <Link href="/settings/dividends" className="btn btn-sm btn-outline-secondary">
            <i className="icon-settings" /> Dividend Settings
          </Link>
        )
      }
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!preview?.can_declare) {
            return;
          }
          const confirmed = await confirmAction(
            `Declare dividends for ${preview.period_label}?`,
            `Profit ${tzs(preview.profit_available)}: Shareholder Dividend Pool ${tzs(preview.dividend_pool)} (${percent(preview.dividend_percent)}) to ${preview.rows.length} shareholder(s), Principal Reinvestment ${tzs(preview.reinvestment_amount)} (${percent(preview.reinvest_percent)}). This posts to the ledger and cannot be edited.`,
          );
          if (confirmed) {
            declare.mutate({ period }, { onSuccess: (result) => onView(result.data.id) });
          }
        }}
      >
        <div className="row">
          <Field label="Period:" required className="col-lg-3 col-md-6" error={declare.fieldError("period")}>
            <input type="month" className="form-control" value={period} max={currentMonth()} onChange={(e) => e.target.value && onPeriod(e.target.value)} required />
          </Field>
          <Field label="Profit Available:" className="col-lg-3 col-md-6">
            <input className="form-control" value={preview ? tzs(preview.profit_available) : ""} readOnly aria-label="Profit Available" />
          </Field>
          <Field label={`Shareholder Dividend (${percent(preview?.dividend_percent ?? 0)}):`} className="col-lg-3 col-md-6">
            <input className="form-control" value={preview ? tzs(preview.dividend_pool) : ""} readOnly />
          </Field>
          <Field label={`Principal Reinvestment (${percent(preview?.reinvest_percent ?? 0)}):`} className="col-lg-3 col-md-6">
            <input className="form-control" value={preview ? tzs(preview.reinvestment_amount) : ""} readOnly />
          </Field>
        </div>

        <ErrorOrLoading isLoading={isLoading} error={error} />

        {preview && (
          <>
            <p className={styles.note}>
              Source: {profitSourceLabel(preview.profit_source)}. {preview.profit_note} Profit Account balance: {tzs(preview.profit_account_balance)}. The split comes from Dividend Settings
              {canSettings ? "" : " (ask an administrator to change it)"}. Ownership is taken from the share register on {preview.as_of_date} ({sharesLabel(preview.total_shares)} shares).
            </p>

            {preview.already_declared && (
              <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between">
                <span>Dividends for {preview.period_label} have already been declared.</span>
                {preview.declaration_id !== null && (
                  <button type="button" className="btn btn-sm btn-info" onClick={() => onView(preview.declaration_id as number)}>
                    View allocations
                  </button>
                )}
              </div>
            )}
            {!preview.already_declared && preview.blocking_reason && <div className="alert alert-warning">{preview.blocking_reason}</div>}

            {!preview.already_declared && (
              <>
                <DataTable
                  rows={mapped.rows}
                  rowKey={(row) => row.share_holder_id}
                  searchable={false}
                  pageSize={100}
                  emptyMessage="No shareholder holds shares in the share register"
                  columns={[
                    {
                      key: "serial",
                      header: "S/No.",
                      render: (row) => `${row.serial}.`,
                    },
                    { key: "name", header: "Shareholder" },
                    {
                      key: "shares",
                      header: "Shares",
                      className: "text-right",
                      render: (row) => sharesLabel(row.shares),
                    },
                    {
                      key: "ownership_percent",
                      header: "Ownership %",
                      className: "text-right",
                      render: (row) => percent(row.ownership_percent),
                    },
                    {
                      key: "contribution_total",
                      header: "Contributions",
                      className: "text-right",
                      render: (row) => tzs(row.contribution_total),
                    },
                    {
                      key: "entitlement",
                      header: "Dividend Entitlement",
                      className: "text-right",
                      render: (row) => tzs(row.entitlement),
                    },
                  ]}
                  footer={
                    mapped.rows.length > 0 && (
                      <tr>
                        <th colSpan={2}>TOTAL</th>
                        <th className="text-right">{sharesLabel(mapped.totalShares)}</th>
                        <th className="text-right">{percent(mapped.totalPercent)}</th>
                        <th />
                        <th className="text-right">{tzs(mapped.totalEntitlement)}</th>
                      </tr>
                    )
                  }
                />

                {canManage && (
                  <div className="text-center m-t-20">
                    <button type="submit" className="btn btn-primary" disabled={!preview.can_declare || declare.isPending}>
                      <i className="icon-drawer" /> {declare.isPending ? "Please wait..." : "Declare Dividend"}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </form>
    </Card>
  );
}

function AllocationsCard({ declarationId, canManage }: { declarationId: number; canManage: boolean }) {
  const { data, isLoading, error } = useApi<DividendAllocation[]>(`capital/dividends/${declarationId}/allocations`);
  const [paying, setPaying] = useState<DividendAllocation | null>(null);
  const [history, setHistory] = useState<DividendAllocation | null>(null);
  const status = loadState({ isLoading, error, count: data?.length }, "No allocations");

  return (
    <Card title="Shareholder Dividend Allocation">
      {status.state === "error" ? (
        <div className="alert alert-danger mb-0">{status.message}</div>
      ) : (
        <DataTable
          rows={data}
          loading={isLoading}
          rowKey={(row) => row.id}
          searchable={false}
          pageSize={100}
          columns={[
            {
              key: "serial",
              header: "S/No.",
              sortable: false,
              render: (_row, index) => `${index + 1}.`,
            },
            { key: "share_holder", header: "Shareholder" },
            {
              key: "shares_held",
              header: "Shares",
              className: "text-right",
              render: (row) => (row.shares_held === null ? "-" : sharesLabel(row.shares_held)),
            },
            {
              key: "ownership_percent",
              header: "Ownership %",
              className: "text-right",
              render: (row) => percent(row.ownership_percent),
            },
            {
              key: "entitlement",
              header: "Dividend Entitlement",
              className: "text-right",
              render: (row) => tzs(row.entitlement),
            },
            {
              key: "paid_amount",
              header: "Amount Paid",
              className: "text-right",
              render: (row) => (
                <button type="button" className="btn btn-link btn-sm p-0" title="Payment history" onClick={() => setHistory(row)}>
                  {tzs(row.paid_amount)}
                </button>
              ),
            },
            {
              key: "balance",
              header: "Outstanding Balance",
              className: "text-right",
              render: (row) => tzs(row.balance),
            },
            {
              key: "status",
              header: "Payment Status",
              render: (row) => <Badge tone={allocationBadge(row.status).tone}>{allocationBadge(row.status).label}</Badge>,
            },
            {
              key: "last_payment_date",
              header: "Last Payment Date",
              render: (row) => row.last_payment_date ?? "-",
            },
            {
              key: "actions",
              header: "Action",
              sortable: false,
              render: (row) => (
                <div className="text-nowrap">
                  {canManage && row.balance > 0 && (
                    <button type="button" className="btn btn-sm btn-success mr-1" onClick={() => setPaying(row)}>
                      <i className="icon-wallet" /> PAY
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setHistory(row)}>
                    <i className="icon-list" /> History
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}
      {paying && <PayDividendModal allocation={paying} onClose={() => setPaying(null)} />}
      {history && <AllocationHistoryModal allocation={history} onClose={() => setHistory(null)} />}
    </Card>
  );
}

/**
 * Capital → Dividends. Documents: ACCOUNT OVERVIEW "Dividend Account" — Profit → Dividend, split into Principal
 * Reinvestment and the Shareholder Dividend Pool by Dividend Settings (default 70 / 30); the pool is split by
 * share-register ownership; entitlements are paid by Cash or Bank in full or in parts. All figures come from the API.
 */
export default function DividendsPage() {
  const { can } = useAuth();
  const canView = can(["capital.manage", "capital.view"]);
  const canManage = can("capital.manage");
  const [period, setPeriod] = useState(currentMonth());
  const [selected, setSelected] = useState<number | null>(null);

  const summary = useApi<DividendSummary>(canView ? "capital/dividends/summary" : null, { period });
  const declarations = useApi<DividendDeclaration[]>(canView ? "capital/dividends" : null);
  const payments = useApi<DividendPayment[]>(canView ? "capital/dividends/payments" : null);

  const declarationId = selected ?? summary.data?.declaration_id ?? declarations.data?.[0]?.id ?? null;
  const shown = declarations.data?.find((declaration) => declaration.id === declarationId);

  if (!canView) {
    return (
      <>
        <PageHeader crumbs={["Capital", "Dividends"]} />
        <Card>
          <div className="alert alert-warning mb-0">You do not have permission to view dividends.</div>
        </Card>
      </>
    );
  }

  const data = summary.data;
  const declaredForPeriod = data?.declaration_id ? declarations.data?.find((declaration) => declaration.id === data.declaration_id) : undefined;

  return (
    <>
      <PageHeader crumbs={["Capital", "Dividends"]} />

      <Card title={`Dividends — ${data?.period_label ?? periodLabel(period)}`}>
        {summary.error ? (
          <ErrorOrLoading isLoading={false} error={summary.error} />
        ) : (
          <SummaryTiles
            items={[
              ...(declaredForPeriod
                ? [
                    {
                      label: "Declared Profit",
                      value: tzs(declaredForPeriod.profit_amount),
                    },
                    {
                      label: `Shareholder Dividend Pool (${percent(declaredForPeriod.dividend_percent)})`,
                      value: tzs(declaredForPeriod.dividend_amount),
                    },
                    {
                      label: `Principal Reinvestment (${percent(declaredForPeriod.reinvest_percent)})`,
                      value: tzs(declaredForPeriod.reinvest_amount),
                    },
                  ]
                : [
                    {
                      label: "Profit Available",
                      value: data ? tzs(data.profit_available) : "…",
                    },
                    {
                      label: `Shareholder Dividend Pool (${percent(data?.dividend_percent ?? 0)})`,
                      value: data ? tzs(data.dividend_pool) : "…",
                    },
                    {
                      label: `Principal Reinvestment (${percent(data?.reinvest_percent ?? 0)})`,
                      value: data ? tzs(data.reinvestment_amount) : "…",
                    },
                  ]),
              {
                label: "Total Declared",
                value: data ? tzs(data.total_declared) : "…",
              },
              { label: "Total Paid", value: data ? tzs(data.total_paid) : "…" },
              {
                label: "Total Outstanding",
                value: data ? tzs(data.total_outstanding) : "…",
              },
            ]}
          />
        )}
      </Card>

      <DeclareDividendCard
        period={period}
        onPeriod={(value) => {
          setPeriod(value);
          setSelected(null);
        }}
        canManage={canManage}
        canSettings={can("settings.manage")}
        onView={setSelected}
      />

      {declarationId !== null && (
        <>
          {shown && (
            <p className={`${styles.note} mb-2`}>
              Showing <b>{shown.period_label}</b>: profit {tzs(shown.profit_amount)}, pool {tzs(shown.dividend_amount)} ({percent(shown.dividend_percent)}), ownership as of {shown.as_of_date ?? "-"}.
            </p>
          )}
          <AllocationsCard key={declarationId} declarationId={declarationId} canManage={canManage} />
        </>
      )}

      <Card title="Dividend Declaration History">
        {declarations.error ? (
          <ErrorOrLoading isLoading={false} error={declarations.error} />
        ) : (
          <DataTable
            rows={declarations.data}
            loading={declarations.isLoading}
            rowKey={(row) => row.id}
            emptyMessage="No dividends have been declared yet"
            columns={[
              {
                key: "period",
                header: "Period",
                render: (row) => <b>{row.period_label}</b>,
              },
              {
                key: "profit_amount",
                header: "Profit",
                className: "text-right",
                render: (row) => tzs(row.profit_amount),
              },
              {
                key: "dividend_percent",
                header: "Dividend %",
                className: "text-right",
                render: (row) => percent(row.dividend_percent),
              },
              {
                key: "dividend_amount",
                header: "Dividend Pool",
                className: "text-right",
                render: (row) => tzs(row.dividend_amount),
              },
              {
                key: "reinvest_percent",
                header: "Reinvestment %",
                className: "text-right",
                render: (row) => percent(row.reinvest_percent),
              },
              {
                key: "reinvest_amount",
                header: "Reinvestment Amount",
                className: "text-right",
                render: (row) => tzs(row.reinvest_amount),
              },
              {
                key: "declared_at",
                header: "Declared Date",
                render: (row) => (
                  <>
                    {row.declared_at?.slice(0, 10) ?? "-"}
                    <div className="text-muted small">{row.declared_by ?? ""}</div>
                  </>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (row) => (
                  <>
                    <Badge tone={declarationBadge(row.status).tone}>{declarationBadge(row.status).label}</Badge>
                    <div className="text-muted small">Outstanding {tzs(row.outstanding_amount)}</div>
                  </>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                sortable: false,
                render: (row) => (
                  <button type="button" className={`btn btn-sm ${row.id === declarationId ? "btn-info" : "btn-outline-info"}`} onClick={() => setSelected(row.id)}>
                    <i className="icon-eye" /> View allocations
                  </button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Card title="Payment History">
        <DividendPaymentsTable rows={payments.data} isLoading={payments.isLoading} error={payments.error} />
      </Card>
    </>
  );
}
