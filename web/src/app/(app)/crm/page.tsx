"use client";

import Link from "next/link";
import { useState } from "react";

import { BulkSmsModal, CompleteFollowUpModal, CrmFilterModal, RecordCallModal, SendSmsModal, TicketModal, UpdateTicketModal } from "@/components/crm/CrmModals";
import { PillTabs, StatTile } from "@/components/crm/Tabs";
import { FOLLOW_UP_TONE, PRIORITY_TONE, TICKET_STATUS_TONE, type CrmSummary, type Interaction, type StaffActivity, type Ticket } from "@/components/crm/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { useApi } from "@/lib/hooks";

type Tab = "log" | "follow_ups" | "reports" | "staff";
type ModalName = "call" | "sms" | "bulk" | "ticket" | "filter" | null;

function CustomerCell({ row }: { row: { customer?: { id: number; name: string; code: string | null } } }) {
  return row.customer ? (
    <Link href={`/crm/customers/${row.customer.id}`}>
      {row.customer.name}
      <br />
      <small className="text-muted">{row.customer.code}</small>
    </Link>
  ) : null;
}

export default function CrmPage() {
  const [tab, setTab] = useState<Tab>("log");
  const [modal, setModal] = useState<ModalName>(null);
  const [callCustomer, setCallCustomer] = useState<number | null>(null);
  const [filters, setFilters] = useState({ branch_id: "", from: "", to: "" });
  const [logType, setLogType] = useState("all");
  const [followStatus, setFollowStatus] = useState("due");
  const [mine, setMine] = useState(false);
  const [ticketStatus, setTicketStatus] = useState("pending");
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [completing, setCompleting] = useState<number | null>(null);

  const { data: summary } = useApi<CrmSummary>("crm/summary");
  const log = useApi<Interaction[]>(tab === "log" ? "crm/interactions" : null, { ...filters, type: logType, mine: mine ? 1 : undefined });
  const followUps = useApi<Interaction[]>(tab === "follow_ups" ? "crm/follow-ups" : null, { branch_id: filters.branch_id, status: followStatus, mine: mine ? 1 : undefined });
  const tickets = useApi<Ticket[]>(tab === "reports" ? "crm/tickets" : null, { ...filters, status: ticketStatus, mine: mine ? 1 : undefined });
  const staff = useApi<StaffActivity[]>(tab === "staff" ? "crm/report" : null, filters);

  const openCall = (customerId: number | null) => {
    setCallCustomer(customerId);
    setModal("call");
  };

  const headerButtons = (
    <div className="text-right mb-2">
      <button type="button" className="btn btn-sm btn-primary mr-1" onClick={() => openCall(null)}><i className="icon-call-out" /> Record Call</button>
      <button type="button" className="btn btn-sm btn-success mr-1" onClick={() => setModal("sms")}><i className="icon-envelope" /> Send SMS</button>
      <button type="button" className="btn btn-sm btn-info mr-1" onClick={() => setModal("bulk")}><i className="icon-envelope-letter" /> Bulk SMS</button>
      <button type="button" className="btn btn-sm btn-warning mr-1" onClick={() => setModal("ticket")}><i className="icon-note" /> Customer Report</button>
      <button type="button" className="btn btn-sm btn-primary" title="Filter" onClick={() => setModal("filter")}><i className="icon-magnifier" /></button>
    </div>
  );

  const mineToggle = (
    <label className="mb-0 ml-3">
      <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Mine only
    </label>
  );

  const staffTotal = (key: keyof StaffActivity) => (staff.data ?? []).reduce((total, row) => total + Number(row[key] || 0), 0);

  return (
    <>
      <PageHeader crumbs={["CRM"]} />

      <Card>
        <div className="row clearfix">
          <StatTile tone="primary" icon="icon-call-in" value={summary?.calls_today ?? 0} label={`Calls Today (Incoming ${summary?.incoming_today ?? 0})`} onClick={() => setTab("log")} />
          <StatTile tone="success" icon="icon-envelope" value={summary?.sms_today ?? 0} label="SMS Today" onClick={() => setTab("log")} />
          <StatTile tone="warning" icon="icon-bell" value={summary?.my_follow_ups_due ?? 0} label={`My Follow-ups Due (Overdue ${summary?.follow_ups_overdue ?? 0})`} onClick={() => setTab("follow_ups")} />
          <StatTile tone="danger" icon="icon-note" value={summary?.open_tickets ?? 0} label="Open Customer Reports" onClick={() => setTab("reports")} />
        </div>
      </Card>

      <div className="card">
        <div className="body">
          <PillTabs<Tab> value={tab} onChange={setTab} tabs={[["log", "Calls & SMS"], ["follow_ups", "Follow-ups"], ["reports", "Customer Reports"], ["staff", "Staff Report"]]} />
        </div>
      </div>

      {tab === "log" && (
        <Card title="Calls & SMS">
          {headerButtons}
          <div className="mb-2 d-flex align-items-center">
            <select className="form-control" style={{ width: 160 }} value={logType} onChange={(e) => setLogType(e.target.value)}>
              <option value="all">All</option>
              <option value="call">Calls</option>
              <option value="sms">SMS</option>
            </select>
            {mineToggle}
          </div>
          <DataTable
            rows={log.data}
            loading={log.isLoading}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "created_at", header: "Date" },
              { key: "customer", header: "Customer", value: (row) => row.customer?.name, render: (row) => <CustomerCell row={row} /> },
              { key: "phone", header: "Phone Number" },
              { key: "type", header: "Type", value: (row) => row.type_label, render: (row) => <Badge tone={row.type === "call" ? "info" : "success"}>{row.type === "call" ? `${row.type_label} ${row.direction_label}` : row.type_label}</Badge> },
              { key: "outcome", header: "Outcome", value: (row) => row.outcome_label },
              { key: "notes", header: "Notes / Message", render: (row) => <span style={{ whiteSpace: "pre-wrap" }}>{row.notes}</span> },
              { key: "follow_up_date", header: "Follow-up", render: (row) => row.follow_up_status && <Badge tone={FOLLOW_UP_TONE[row.follow_up_status]}>{row.follow_up_date}</Badge> },
              { key: "employee", header: "Staff" },
              { key: "branch", header: "Branch" },
            ]}
          />
        </Card>
      )}

      {tab === "follow_ups" && (
        <Card title="Follow-up Reminders">
          {headerButtons}
          <div className="mb-2 d-flex align-items-center">
            <select className="form-control" style={{ width: 160 }} value={followStatus} onChange={(e) => setFollowStatus(e.target.value)}>
              <option value="due">Due</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming</option>
              <option value="done">Done</option>
              <option value="all">All</option>
            </select>
            {mineToggle}
          </div>
          <DataTable
            rows={followUps.data}
            loading={followUps.isLoading}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "follow_up_date", header: "Follow-up Date", render: (row) => row.follow_up_status && <Badge tone={FOLLOW_UP_TONE[row.follow_up_status]}>{row.follow_up_date}</Badge> },
              { key: "customer", header: "Customer", value: (row) => row.customer?.name, render: (row) => <CustomerCell row={row} /> },
              { key: "phone", header: "Phone Number", value: (row) => row.customer?.phone },
              { key: "last", header: "Last Contact", value: (row) => `${row.type_label} ${row.outcome_label ?? ""}`, render: (row) => <>{row.created_at}<br /><small>{row.type_label} {row.outcome_label}</small></> },
              { key: "notes", header: "Notes", render: (row) => <span style={{ whiteSpace: "pre-wrap" }}>{row.follow_up_notes ?? row.notes}</span> },
              { key: "employee", header: "Staff" },
              {
                key: "action",
                header: "Action",
                sortable: false,
                className: "text-nowrap",
                render: (row) => row.follow_up_status !== "done" && (
                  <>
                    <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Record Call" onClick={() => openCall(row.customer?.id ?? null)}><i className="icon-call-out" /></button>
                    <button type="button" className="btn btn-sm btn-icon btn-success" title="Complete" onClick={() => setCompleting(row.id)}><i className="icon-check" /></button>
                  </>
                ),
              },
            ]}
          />
        </Card>
      )}

      {tab === "reports" && (
        <Card title="Customer Reports">
          {headerButtons}
          <div className="mb-2 d-flex align-items-center">
            <select className="form-control" style={{ width: 160 }} value={ticketStatus} onChange={(e) => setTicketStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="all">All</option>
            </select>
            {mineToggle}
          </div>
          <DataTable
            rows={tickets.data}
            loading={tickets.isLoading}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "ticket_number", header: "Report No." },
              { key: "created_at", header: "Date" },
              { key: "customer", header: "Customer", value: (row) => row.customer?.name, render: (row) => <CustomerCell row={row} /> },
              { key: "category_label", header: "Category" },
              { key: "subject", header: "Subject" },
              { key: "priority", header: "Priority", render: (row) => <Badge tone={PRIORITY_TONE[row.priority]}>{row.priority}</Badge> },
              { key: "status", header: "Status", value: (row) => row.status_label, render: (row) => <Badge tone={TICKET_STATUS_TONE[row.status]}>{row.status_label}</Badge> },
              { key: "assignee", header: "Assigned To" },
              { key: "branch", header: "Branch" },
              { key: "action", header: "Action", sortable: false, render: (row) => <button type="button" className="btn btn-sm btn-icon btn-primary" onClick={() => setEditingTicket(row)}><i className="icon-pencil" /></button> },
            ]}
          />
        </Card>
      )}

      {tab === "staff" && (
        <Card title="Staff CRM Report">
          <div className="text-right mb-2">
            <button type="button" className="btn btn-sm btn-primary" title="Filter" onClick={() => setModal("filter")}><i className="icon-magnifier" /></button>
          </div>
          <DataTable
            rows={staff.data}
            loading={staff.isLoading}
            rowKey={(row) => row.employee_id}
            columns={[
              { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "employee", header: "Staff" },
              { key: "branch", header: "Branch" },
              { key: "calls", header: "Calls" },
              { key: "incoming", header: "Incoming" },
              { key: "outgoing", header: "Outgoing" },
              { key: "promised", header: "Promised to pay" },
              { key: "unreached", header: "Not reached" },
              { key: "sms", header: "SMS" },
              { key: "follow_ups_done", header: "Follow-ups Done" },
              { key: "follow_ups_overdue", header: "Overdue", render: (row) => (row.follow_ups_overdue > 0 ? <Badge tone="danger">{row.follow_ups_overdue}</Badge> : 0) },
              { key: "tickets_opened", header: "Reports" },
              { key: "tickets_resolved", header: "Resolved" },
            ]}
            footer={
              <tr>
                <th colSpan={3}>Total</th>
                {(["calls", "incoming", "outgoing", "promised", "unreached", "sms", "follow_ups_done", "follow_ups_overdue", "tickets_opened", "tickets_resolved"] as const).map((key) => <th key={key}>{staffTotal(key)}</th>)}
              </tr>
            }
          />
        </Card>
      )}

      <RecordCallModal open={modal === "call"} onClose={() => setModal(null)} customerId={callCustomer} />
      <SendSmsModal open={modal === "sms"} onClose={() => setModal(null)} />
      <BulkSmsModal open={modal === "bulk"} onClose={() => setModal(null)} />
      <TicketModal open={modal === "ticket"} onClose={() => setModal(null)} />
      <CrmFilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />
      <UpdateTicketModal ticket={editingTicket} onClose={() => setEditingTicket(null)} />
      <CompleteFollowUpModal interactionId={completing} onClose={() => setCompleting(null)} />
    </>
  );
}
