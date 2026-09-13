"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { RecordCallModal, SendSmsModal, TicketModal, UpdateTicketModal } from "@/components/crm/CrmModals";
import { StatTile } from "@/components/crm/Tabs";
import { FOLLOW_UP_TONE, PRIORITY_TONE, TICKET_STATUS_TONE, type Interaction, type Ticket } from "@/components/crm/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Customer360 {
  customer: { id: number; name: string; code: string | null; phone: string; gender: string; status: string; status_label: string; branch: string | null; officer: string | null; registered_at: string | null };
  totals: { loans: number; outstanding: number; paid: number };
  loans: Array<{ id: number; loan_number: string; amount: number; total_payable: number; outstanding: number; status: string; status_label: string; status_badge: string; end_date: string | null }>;
  payments: Array<{ id: number; date: string; amount: number; method: string }>;
  timeline: Interaction[];
  tickets: Ticket[];
  sms: Array<{ id: number; phone: string; message: string; created_at: string }>;
}

const CUSTOMER_TONE: Record<string, BadgeTone> = { open: "success", pending: "warning", out: "danger", close: "info" };

export default function CrmCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useApi<Customer360>(`crm/customers/${id}`);
  const [modal, setModal] = useState<"call" | "sms" | "ticket" | null>(null);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);

  if (isLoading || !data) {
    return <div className="mf-loading">Loading...</div>;
  }

  const { customer } = data;

  return (
    <>
      <PageHeader crumbs={["CRM", "Customer"]} />

      <Card>
        <div className="row">
          <div className="col-md-4">
            <h5 className="mb-1">{customer.name}</h5>
            <div>{customer.code}</div>
            <Badge tone={CUSTOMER_TONE[customer.status] ?? "default"}>{customer.status_label}</Badge>
          </div>
          <div className="col-md-4">
            <div><b>Phone number:</b> {customer.phone}</div>
            <div><b>Branch:</b> {customer.branch}</div>
            <div><b>Loan Officer:</b> {customer.officer ?? "-"}</div>
            <div><b>Create Date:</b> {customer.registered_at}</div>
          </div>
          <div className="col-md-4 text-right">
            <button type="button" className="btn btn-sm btn-primary mr-1 mb-1" onClick={() => setModal("call")}><i className="icon-call-out" /> Record Call</button>
            <button type="button" className="btn btn-sm btn-danger mr-1 mb-1" onClick={() => setModal("sms")}><i className="icon-envelope" /> Send SMS</button>
            <button type="button" className="btn btn-sm btn-warning mr-1 mb-1" onClick={() => setModal("ticket")}><i className="icon-note" /> Customer Report</button>
            <Link href="/crm" className="btn btn-sm btn-secondary mb-1">Back</Link>
          </div>
        </div>
      </Card>

      <Card>
        <div className="row clearfix">
          <StatTile tone="primary" icon="icon-list" value={data.totals.loans} label="All Loans" />
          <StatTile tone="danger" icon="icon-wallet" value={money(data.totals.outstanding)} label="Outstanding Balance" />
          <StatTile tone="success" icon="icon-wallet" value={money(data.totals.paid)} label="Total Paid" />
          <StatTile tone="warning" icon="icon-call-in" value={data.timeline.length} label="CRM Contacts" />
        </div>
      </Card>

      <div className="row">
        <div className="col-lg-7">
          <Card title="Loans">
            <DataTable
              rows={data.loans}
              rowKey={(row) => row.id}
              searchable={false}
              columns={[
                { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
                { key: "loan_number", header: "Loan No." },
                { key: "amount", header: "Amount", render: (row) => money(row.amount) },
                { key: "total_payable", header: "Total Payable", render: (row) => money(row.total_payable) },
                { key: "outstanding", header: "Outstanding", render: (row) => money(row.outstanding) },
                { key: "end_date", header: "End Date" },
                { key: "status", header: "Status", render: (row) => <Badge tone={row.status_badge as BadgeTone}>{row.status_label}</Badge> },
              ]}
            />
          </Card>
        </div>
        <div className="col-lg-5">
          <Card title="Recent Repayments">
            <DataTable
              rows={data.payments}
              rowKey={(row) => row.id}
              searchable={false}
              columns={[
                { key: "date", header: "Date" },
                { key: "amount", header: "Amount", render: (row) => money(row.amount) },
                { key: "method", header: "Method" },
              ]}
            />
          </Card>
        </div>
      </div>

      <Card title="Customer Timeline">
        {data.timeline.length === 0 ? (
          <p className="text-center mb-0">No calls or messages recorded</p>
        ) : (
          <ul className="list-unstyled mb-0">
            {data.timeline.map((item) => (
              <li key={item.id} className="border-bottom py-2">
                <div className="d-flex justify-content-between flex-wrap">
                  <span>
                    <i className={item.type === "call" ? "icon-call-in" : "icon-envelope"} />{" "}
                    <Badge tone={item.type === "call" ? "info" : "success"}>{item.type === "call" ? `${item.type_label} ${item.direction_label}` : item.type_label}</Badge>{" "}
                    {item.outcome_label && <b>{item.outcome_label}</b>}
                  </span>
                  <small className="text-muted">{item.created_at} · {item.employee ?? "-"}</small>
                </div>
                {item.notes && <div style={{ whiteSpace: "pre-wrap" }}>{item.notes}</div>}
                {item.follow_up_status && (
                  <small>
                    Follow-up: <Badge tone={FOLLOW_UP_TONE[item.follow_up_status]}>{item.follow_up_date}</Badge>
                    {item.follow_up_notes && ` — ${item.follow_up_notes}`}
                  </small>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Customer Reports">
        <DataTable
          rows={data.tickets}
          rowKey={(row) => row.id}
          searchable={false}
          columns={[
            { key: "ticket_number", header: "Report No." },
            { key: "created_at", header: "Date" },
            { key: "category_label", header: "Category" },
            { key: "subject", header: "Subject" },
            { key: "priority", header: "Priority", render: (row) => <Badge tone={PRIORITY_TONE[row.priority]}>{row.priority}</Badge> },
            { key: "status", header: "Status", render: (row) => <Badge tone={TICKET_STATUS_TONE[row.status]}>{row.status_label}</Badge> },
            { key: "resolution", header: "Resolution" },
            { key: "action", header: "Action", sortable: false, render: (row) => <button type="button" className="btn btn-sm btn-icon btn-primary" onClick={() => setEditingTicket(row)}><i className="icon-pencil" /></button> },
          ]}
        />
      </Card>

      <Card title="SMS History">
        <DataTable
          rows={data.sms}
          rowKey={(row) => row.id}
          searchable={false}
          columns={[
            { key: "created_at", header: "Date" },
            { key: "phone", header: "Phone Number" },
            { key: "message", header: "Message" },
          ]}
        />
      </Card>

      <RecordCallModal open={modal === "call"} onClose={() => setModal(null)} customerId={customer.id} />
      <SendSmsModal open={modal === "sms"} onClose={() => setModal(null)} customerId={customer.id} />
      <TicketModal open={modal === "ticket"} onClose={() => setModal(null)} customerId={customer.id} />
      <UpdateTicketModal ticket={editingTicket} onClose={() => setEditingTicket(null)} />
    </>
  );
}
