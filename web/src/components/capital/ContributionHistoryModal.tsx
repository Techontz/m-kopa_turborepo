"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { backendUrl } from "@/lib/api";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

import { ownershipLabel, payMethodTone, type ContributionHistory } from "./contributions";

/** Contribution history of one shareholder: every contribution with its receiving account and ledger reference. */
export function ContributionHistoryModal({ shareHolderId, onClose }: { shareHolderId: number | null; onClose: () => void }) {
  const { data, isLoading } = useApi<ContributionHistory>(shareHolderId ? `capital/share-holders/${shareHolderId}/contributions` : null);
  const loaded = data?.share_holder.id === shareHolderId ? data : undefined;

  return (
    <Modal open={shareHolderId !== null} onClose={onClose} title={`Contribution History${loaded ? ` — ${loaded.share_holder.name}` : ""}`} size="xl">
      {loaded && (
        <p className="mb-2">
          Total Contributed Capital <b>{money(loaded.total_contributed)}</b> of all shareholders&apos; <b>{money(loaded.company_total_contributed)}</b> (Cash <b>{money(loaded.cash_contributed)}</b> · Bank <b>{money(loaded.bank_contributed)}</b> · Asset <b>{money(loaded.asset_contributed)}</b>) · Share register: <b>{loaded.shares.toLocaleString("en-US")}</b> shares, ownership <b>{ownershipLabel(loaded.ownership_percent)}</b>
        </p>
      )}
      <DataTable
        rows={loaded?.contributions}
        loading={isLoading || (shareHolderId !== null && !loaded)}
        searchable={false}
        rowKey={(row) => row.id}
        emptyMessage="No contributions yet"
        columns={[
          { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
          { key: "contributed_at", header: "Date / Time" },
          { key: "amount", header: "Amount", render: (row) => money(row.amount) },
          {
            key: "pay_method",
            header: "Pay Method",
            render: (row) => (
              <>
                <Badge tone={payMethodTone(row.pay_method)}>{row.pay_method}</Badge>
                {row.asset_id && <> <Link href={`/capital/assets/${row.asset_id}`} title={row.asset_name ?? ""}>{row.asset_code}</Link></>}
                {row.reversed && <> <Badge tone="danger">REVERSED</Badge></>}
              </>
            ),
          },
          { key: "receiving_account_label", header: "Receiving Account", render: (row) => row.receiving_account_label ?? "—" },
          { key: "receipt_number", header: "Receipt No", render: (row) => row.receipt_number || "-" },
          { key: "cheque_number", header: "Cheque No", render: (row) => row.cheque_number || "-" },
          { key: "recorded_by", header: "Recorded By", render: (row) => row.recorded_by ?? "—" },
          { key: "journal_reference", header: "Journal Ref", render: (row) => row.journal_reference ?? "—" },
          {
            key: "receipt",
            header: "Receipt",
            sortable: false,
            render: (row) => (row.receipt_endpoint ? <a href={backendUrl(row.receipt_endpoint)} target="_blank" rel="noopener noreferrer" title={row.receipt_file_name ?? "Receipt"}><i className="icon-doc" /></a> : "-"),
          },
        ]}
      />
    </Modal>
  );
}
