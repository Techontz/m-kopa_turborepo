"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { AllocationActions } from "@/components/dividends/AllocationActions";
import { DividendPaymentsTable } from "@/components/dividends/DividendPaymentsTable";
import { PayAllDividendsModal } from "@/components/dividends/PayAllDividendsModal";
import { PayDividendModal } from "@/components/dividends/PayDividendModal";
import {
  ALLOCATION_COLUMNS,
  allocationBadge,
  currentMonth,
  declarationBadge,
  loadState,
  mapPreview,
  outstandingTile,
  payAllEnabled,
  periodLabel,
  profitSourceLabel,
  shortDate,
  toCents,
  tzs,
} from "@/components/dividends/dividends";
import dividendStyles from "@/components/dividends/dividends.module.css";
import type { DividendAllocation, DividendDeclaration, DividendPayment, DividendPreview, DividendSummary, PayAllPreview } from "@/components/dividends/types";
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
  const badge = allocationBadge(allocation.status);

  return (
    <Modal open onClose={onClose} size="xl" title={`Payment History / ${allocation.share_holder ?? ""}`}>
      <SummaryTiles
        items={[
          { label: "Dividend Entitlement", value: tzs(allocation.entitlement) },
          { label: "Amount Paid", value: tzs(allocation.paid_amount) },
          { label: "Remaining Balance", value: tzs(allocation.balance) },
          { label: "Status", value: badge.label },
          { label: "Last Payment", value: shortDate(allocation.last_payment_date) },
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

interface AllocationsCardProps {
  declarationId: number;
  declaration: DividendDeclaration | undefined;
  declarations: DividendDeclaration[];
  totals: PayAllPreview | undefined;
  canManage: boolean;
  onSelect: (id: number) => void;
}

function AllocationsCard({ declarationId, declaration, declarations, totals, canManage, onSelect }: AllocationsCardProps) {
  const { data, isLoading, error } = useApi<DividendAllocation[]>(`capital/dividends/${declarationId}/allocations`);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [payAll, setPayAll] = useState(false);
  const status = loadState({ isLoading, error, count: data?.length }, "No allocations");
  const label = declaration?.period_label ?? totals?.period_label ?? "";
  // Modals read the latest row after every refetch, so balances shown there are never stale.
  const paying = data?.find((row) => row.id === payingId) ?? null;
  const history = data?.find((row) => row.id === historyId) ?? null;
  const sum = (pick: (row: DividendAllocation) => number | null) => (data ?? []).reduce((total, row) => total + toCents(pick(row) ?? 0), 0) / 100;
  const cell: Record<string, (row: DividendAllocation, index: number) => ReactNode> = {
    serial: (_row, index) => `${index + 1}.`,
    share_holder: (row) => row.share_holder ?? "-",
    shares_held: (row) => (row.shares_held === null ? "-" : sharesLabel(row.shares_held)),
    ownership_percent: (row) => percent(row.ownership_percent),
    contribution_total: (row) => (row.contribution_total === null ? "-" : tzs(row.contribution_total)),
    entitlement: (row) => tzs(row.entitlement),
    paid_amount: (row) => tzs(row.paid_amount),
    balance: (row) => <b>{tzs(row.balance)}</b>,
    status: (row) => <Badge tone={allocationBadge(row.status).tone}>{allocationBadge(row.status).label}</Badge>,
    last_payment_date: (row) => <span className="text-nowrap">{shortDate(row.last_payment_date)}</span>,
    actions: (row) => <AllocationActions row={row} canManage={canManage} onPay={() => setPayingId(row.id)} onHistory={() => setHistoryId(row.id)} />,
  };
  const money = new Set(["shares_held", "ownership_percent", "contribution_total", "entitlement", "paid_amount", "balance"]);

  return (
    <div id="dividend-allocations">
      <Card
        title={`Shareholder Dividend Allocation — ${label}`}
        actions={
          <div className={dividendStyles.selector}>
            <label htmlFor="dividend-declaration" className="mb-0 small text-muted">Declaration:</label>
            <select id="dividend-declaration" className="form-control form-control-sm" value={declarationId} onChange={(e) => onSelect(Number(e.target.value))}>
              {declarations.map((item) => (
                <option key={item.id} value={item.id}>{item.period_label}</option>
              ))}
            </select>
            {canManage && (
              <button type="button" className="btn btn-sm btn-primary" disabled={!payAllEnabled(totals, canManage)} onClick={() => setPayAll(true)} title={payAllEnabled(totals, canManage) ? undefined : "Nothing outstanding"}>
                <i className="icon-wallet" /> PAY ALL OUTSTANDING
              </button>
            )}
          </div>
        }
      >
        {status.state === "error" ? (
          <div className="alert alert-danger mb-0">{status.message}</div>
        ) : (
          <div className={dividendStyles.compact}>
          <DataTable
            rows={data}
            loading={isLoading}
            rowKey={(row) => row.id}
            searchable={false}
            pageSize={100}
            columns={ALLOCATION_COLUMNS.map((column) => ({
              key: column.key,
              header: column.header,
              sortable: column.key !== "serial" && column.key !== "actions",
              className: money.has(column.key) ? dividendStyles.money : undefined,
              render: cell[column.key],
            }))}
            footer={
              data && data.length > 0 && (
                <tr>
                  <th colSpan={2}>TOTAL — {label}</th>
                  <th className={dividendStyles.money}>{sharesLabel(data.reduce((total, row) => total + (row.shares_held ?? 0), 0))}</th>
                  <th className={dividendStyles.money}>{percent(Math.round(data.reduce((total, row) => total + row.ownership_percent, 0) * 100) / 100)}</th>
                  <th className={dividendStyles.money}>{tzs(sum((row) => row.contribution_total))}</th>
                  <th className={dividendStyles.money}>{tzs(totals?.total_entitlement ?? sum((row) => row.entitlement))}</th>
                  <th className={dividendStyles.money}>{tzs(totals?.total_paid ?? sum((row) => row.paid_amount))}</th>
                  <th className={dividendStyles.money}>{tzs(totals?.total_outstanding ?? sum((row) => row.balance))}</th>
                  <th colSpan={3} />
                </tr>
              )
            }
          />
          </div>
        )}
        {paying && <PayDividendModal key={paying.id} allocation={paying} onClose={() => setPayingId(null)} />}
        {history && <AllocationHistoryModal allocation={history} onClose={() => setHistoryId(null)} />}
        {payAll && <PayAllDividendsModal declarationId={declarationId} periodLabel={label} onClose={() => setPayAll(false)} />}
      </Card>
    </div>
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
  const selectedTotals = useApi<PayAllPreview>(canView && declarationId !== null ? `capital/dividends/${declarationId}/pay-all/preview` : null);
  const tile = outstandingTile(selectedTotals.data);
  const viewAllocations = (id: number) => {
    setSelected(id);
    window.requestAnimationFrame(() => document.getElementById("dividend-allocations")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

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
        {declarationId !== null && (
          <div className={`${dividendStyles.outstanding} ${tile.settled ? dividendStyles.settled : ""}`} role="status" aria-label="Selected declaration outstanding">
            <div>
              <span>
                {tile.label} · {shown?.period_label ?? selectedTotals.data?.period_label ?? ""}
              </span>
              <strong>{selectedTotals.error ? "—" : tile.value}</strong>
              <small>{tile.caption}</small>
            </div>
            {selectedTotals.data && (
              <div className="text-right">
                <small>Declared {tzs(selectedTotals.data.total_entitlement)}</small>
                <small>Paid {tzs(selectedTotals.data.total_paid)}</small>
                {data && <small>All periods outstanding {tzs(data.total_outstanding)}</small>}
              </div>
            )}
          </div>
        )}
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
                label: "Total Declared (All Periods)",
                value: data ? tzs(data.total_declared) : "…",
              },
              { label: "Total Paid (All Periods)", value: data ? tzs(data.total_paid) : "…" },
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
        onView={viewAllocations}
      />

      {declarationId !== null && (
        <>
          {shown && (
            <p className={`${styles.note} mb-2`}>
              Showing <b>{shown.period_label}</b>: profit {tzs(shown.profit_amount)}, pool {tzs(shown.dividend_amount)} ({percent(shown.dividend_percent)}), ownership as of {shortDate(shown.as_of_date)}.
            </p>
          )}
          <AllocationsCard
            key={declarationId}
            declarationId={declarationId}
            declaration={shown}
            declarations={declarations.data ?? []}
            totals={selectedTotals.data}
            canManage={canManage}
            onSelect={setSelected}
          />
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
                    {shortDate(row.declared_at)}
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
                  <button type="button" className={`btn btn-sm ${row.id === declarationId ? "btn-info" : "btn-outline-info"}`} onClick={() => viewAllocations(row.id)}>
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
