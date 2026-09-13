"use client";

import { useState } from "react";

import { currentMonth, HeaderButton } from "@/components/hrm/common";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { money } from "@/lib/format";
import { todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface DayRow {
  employee_id: number;
  employee: string;
  employee_number: string | null;
  branch: string | null;
  check_in: string | null;
  check_out: string | null;
  hours: number;
  status: string;
  remarks: string | null;
}

interface SummaryRow {
  employee_id: number;
  employee: string;
  branch: string | null;
  present: number;
  late: number;
  absent: number;
  leave: number;
  hours: number;
  attendance_rate: number;
}

const TONES: Record<string, "success" | "warning" | "danger" | "info"> = { present: "success", late: "warning", absent: "danger", leave: "info" };
const EMPTY = { empl_id: "", date: todayIso(), check_in: "", check_out: "", status: "present", remarks: "" };

export default function AttendancePage() {
  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const [date, setDate] = useState(todayIso());
  const [month, setMonth] = useState(currentMonth());
  const [branch, setBranch] = useState("all");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const { data: day, isLoading } = useApi<{ date: string; work_start_time: string; rows: DayRow[] }>(tab === "daily" ? "hrm/attendance" : null, { date, branch_id: branch });
  const { data: summary, isLoading: summaryLoading } = useApi<{ working_days: number; rows: SummaryRow[] }>(tab === "monthly" ? "hrm/attendance/summary" : null, { month, branch_id: branch });

  const checkIn = useAction<{ empl_id?: number }>("post", "hrm/attendance/check-in");
  const checkOut = useAction<{ empl_id?: number }>("post", "hrm/attendance/check-out");
  const save = useAction<typeof EMPTY>("post", "hrm/attendance");
  const isToday = date === todayIso();

  return (
    <>
      <PageHeader crumbs={["HRM", "Attendance"]} />

      <Card
        title="Staff Attendance"
        actions={
          <>
            <button type="button" className="btn btn-sm btn-success ml-1" onClick={() => checkIn.mutate({})}><i className="icon-login" /> My Check in</button>
            <button type="button" className="btn btn-sm btn-warning ml-1" onClick={() => checkOut.mutate({})}><i className="icon-logout" /> My Check out</button>
            <HeaderButton icon="icon-plus" title="Record attendance" onClick={() => { setForm(EMPTY); setEditing(true); }} />
          </>
        }
      >
        <ul className="nav nav-tabs-new mb-3">
          <li className="nav-item"><a href="#" className={`nav-link ${tab === "daily" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); setTab("daily"); }}>Daily</a></li>
          <li className="nav-item"><a href="#" className={`nav-link ${tab === "monthly" ? "active" : ""}`} onClick={(e) => { e.preventDefault(); setTab("monthly"); }}>Monthly Summary</a></li>
        </ul>
        <div className="row">
          {tab === "daily" ? (
            <Field label="Date:" className="col-lg-3 col-6">
              <input type="date" className="form-control" value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </Field>
          ) : (
            <Field label="Month:" className="col-lg-3 col-6">
              <input type="month" className="form-control" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </Field>
          )}
          <Field label="Branch:" className="col-lg-3 col-6">
            <SelectBox optionsUrl="options/branches" query={{ with_all: 1 }} value={branch} onChange={(value) => setBranch(value ?? "all")} />
          </Field>
          <div className="col-lg-6 col-12 pt-4">
            {tab === "daily" ? <small>Work starts at {day?.work_start_time}; check-in after that time is marked late.</small> : <small>Working days (Mon–Sat): {summary?.working_days}</small>}
          </div>
        </div>

        {tab === "daily" ? (
          <DataTable
            rows={day?.rows}
            loading={isLoading}
            rowKey={(row) => row.employee_id}
            columns={[
              { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "employee_number", header: "Empl/ID" },
              { key: "employee", header: "Staff name", className: "text-uppercase" },
              { key: "branch", header: "Branch" },
              { key: "check_in", header: "Check in" },
              { key: "check_out", header: "Check out" },
              { key: "hours", header: "Hours" },
              { key: "status", header: "Status", render: (row) => <Badge tone={TONES[row.status]}>{row.status.toUpperCase()}</Badge> },
              { key: "remarks", header: "Remarks" },
              {
                key: "action",
                header: "Action",
                sortable: false,
                className: "text-nowrap",
                render: (row) => (
                  <>
                    {isToday && !row.check_in && <button type="button" className="btn btn-sm btn-success mr-1" title="Check in" onClick={() => checkIn.mutate({ empl_id: row.employee_id })}><i className="icon-login" /></button>}
                    {isToday && row.check_in && !row.check_out && <button type="button" className="btn btn-sm btn-warning mr-1" title="Check out" onClick={() => checkOut.mutate({ empl_id: row.employee_id })}><i className="icon-logout" /></button>}
                    <button type="button" className="btn btn-sm btn-primary" title="Edit" onClick={() => { setForm({ empl_id: String(row.employee_id), date, check_in: row.check_in ?? "", check_out: row.check_out ?? "", status: row.status, remarks: row.remarks ?? "" }); setEditing(true); }}><i className="icon-pencil" /></button>
                  </>
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            rows={summary?.rows}
            loading={summaryLoading}
            rowKey={(row) => row.employee_id}
            columns={[
              { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "employee", header: "Staff name", className: "text-uppercase" },
              { key: "branch", header: "Branch" },
              { key: "present", header: "Present" },
              { key: "late", header: "Late" },
              { key: "absent", header: "Absent" },
              { key: "leave", header: "Leave" },
              { key: "hours", header: "Hours", render: (row) => money(row.hours) },
              { key: "attendance_rate", header: "Attendance %", render: (row) => `${row.attendance_rate}%` },
            ]}
          />
        )}
      </Card>

      <Modal open={editing} onClose={() => setEditing(false)} title="Record Attendance" size="lg" submitLabel="Save" submitting={save.isPending} onSubmit={() => save.mutate(form, { onSuccess: () => setEditing(false) })}>
        <div className="row">
          <Field label="Staff:" className="col-md-6" error={save.fieldError("empl_id")}>
            <SelectBox placeholder="Select Staff" optionsUrl="options/employees" value={form.empl_id} onChange={(value) => setForm({ ...form, empl_id: value ?? "" })} />
          </Field>
          <Field label="Date:" className="col-md-6" error={save.fieldError("date")}>
            <input type="date" className="form-control" max={todayIso()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </Field>
          <Field label="Status:" className="col-md-4" error={save.fieldError("status")}>
            <select className="form-control" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
            </select>
          </Field>
          <Field label="Check in:" className="col-md-4" error={save.fieldError("check_in")}>
            <input type="time" className="form-control" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} />
          </Field>
          <Field label="Check out:" className="col-md-4" error={save.fieldError("check_out")}>
            <input type="time" className="form-control" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} />
          </Field>
          <Field label="Remarks:" className="col-md-12" error={save.fieldError("remarks")}>
            <input className="form-control" placeholder="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
