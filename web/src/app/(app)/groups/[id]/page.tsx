"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { api } from "@/lib/api";
import { money } from "@/lib/format";

interface GroupLoanRow {
  id: number;
  customer_id: number;
  branch: string;
  customer_name: string | null;
  phone: string | null;
  gender: string | null;
  total_loan: number;
  paid_amount: number;
  remain: number;
  restoration: number;
  write_off: number;
  status: string | null;
  status_badge: string | null;
}

interface GroupShow {
  group: { id: number; name: string };
  data: GroupLoanRow[];
}

/** Group customer list (live admin/view_customer_group/{id}) with branch Filter. */
export default function GroupCustomersPage() {
  const { id } = useParams<{ id: string }>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftBranch, setDraftBranch] = useState("");
  const [branch, setBranch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: [`groups/${id}`, { branch_id: branch }],
    queryFn: () => api.get<GroupShow>(`groups/${id}`, { branch_id: branch }),
  });
  const rows = data?.data ?? [];
  const sum = (key: keyof GroupLoanRow) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);

  return (
    <>
      <PageHeader crumbs={["Group", "customer Group"]} />

      <Card
        title={`Customer List / ${data?.group.name ?? ""}`}
        actions={
          <>
            <button type="button" className="btn btn-primary btn-sm mr-1" onClick={() => setFilterOpen(true)}><i className="icon-magnifier" /></button>
            <Link href="/groups" className="btn btn-primary btn-sm"><i className="icon-arrow-left" /></Link>
          </>
        }
      >
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/NO.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch" },
            { key: "customer_name", header: "Customer Name", render: (row) => <Link href={`/customers/${row.customer_id}`}>{row.customer_name}</Link> },
            { key: "phone", header: "Phone number" },
            { key: "gender", header: "Gender" },
            { key: "total_loan", header: "Total loan", render: (row) => money(row.total_loan) },
            { key: "paid_amount", header: "Paid amount", render: (row) => money(row.paid_amount) },
            { key: "remain", header: "Remain", render: (row) => money(row.remain) },
            { key: "restoration", header: "Restoration", render: (row) => money(row.restoration) },
            { key: "write_off", header: "Write-off", render: (row) => money(row.write_off) },
            { key: "status", header: "Status", render: (row) => <Badge tone={(row.status_badge ?? "default") as BadgeTone}>{row.status}</Badge> },
          ]}
          footer={
            <tr>
              <td><b>TOTAL:</b></td>
              <td /><td /><td /><td />
              <td><b>{money(sum("total_loan"))}</b></td>
              <td><b>{money(sum("paid_amount"))}</b></td>
              <td><b>{money(sum("remain"))}</b></td>
              <td />
              <td><b>{money(sum("write_off"))}</b></td>
              <td />
            </tr>
          }
        />
      </Card>

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter" submitLabel="Filter" onSubmit={() => { setBranch(draftBranch); setFilterOpen(false); }}>
        <Field label="Branch" className="col-md-12 px-0">
          <SelectBox inputId="group-branch" placeholder="Select Branch" optionsUrl="options/branches" query={{ with_all: 1 }} value={draftBranch} onChange={(value) => setDraftBranch(value ?? "")} />
        </Field>
      </Modal>
    </>
  );
}
