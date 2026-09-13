"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

interface MasterDataItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  parentId?: number;
}

interface ListDefinition {
  slug: string;
  label: string;
  parent?: string;
}

/** The registration lists administrators manage (slugs match the API). */
const LISTS: ListDefinition[] = [
  { slug: "banks", label: "Banks" },
  { slug: "mobile-money-providers", label: "Mobile Money Providers" },
  { slug: "id-types", label: "ID Types" },
  { slug: "marital-statuses", label: "Marital Statuses" },
  { slug: "document-types", label: "Document Types" },
  { slug: "pension-funds", label: "Pension Funds" },
  { slug: "government-bodies", label: "Government Bodies (Wizara / Taasisi)" },
  { slug: "government-departments", label: "Government Departments (Idara)", parent: "government-bodies" },
  { slug: "government-cadres", label: "Government Cadres (Cheo)", parent: "government-departments" },
  { slug: "private-sectors", label: "Private Sectors (Sekta)" },
  { slug: "private-employers", label: "Private Employers (Taasisi / Kampuni)", parent: "private-sectors" },
  { slug: "private-departments", label: "Private Departments (Idara)", parent: "private-sectors" },
  { slug: "private-cadres", label: "Private Cadres (Cheo)", parent: "private-departments" },
  { slug: "business-sectors", label: "Business Sectors (Sekta ya Biashara)" },
  { slug: "business-types", label: "Business Types (Aina ya Biashara)", parent: "business-sectors" },
  { slug: "colleges", label: "Colleges (Vyuo)" },
  { slug: "courses", label: "Courses (Kozi)", parent: "colleges" },
];

interface ItemForm {
  name: string;
  code: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
  parentId: number | null;
}

const labelOf = (slug: string) => LISTS.find((list) => list.slug === slug)?.label ?? slug;

/** Parent picker for a child list: the parent list's rows (and its own parent filter when that is a child list too). */
function ParentPicker({ list, value, onChange, placeholder }: { list: ListDefinition; value: number | null; onChange: (id: number | null) => void; placeholder: string }) {
  const { data: parents = [] } = useApi<MasterDataItem[]>(list.parent ? `master-data/${list.parent}` : null, { includeInactive: 1 });

  return (
    <SelectBox
      options={parents.map((parent) => ({ value: String(parent.id), label: parent.name }))}
      value={value}
      onChange={(id) => onChange(id ? Number(id) : null)}
      placeholder={placeholder}
      isClearable
    />
  );
}

function ItemEditor({ list, item, defaultParentId, onDone }: { list: ListDefinition; item: MasterDataItem | null; defaultParentId: number | null; onDone: () => void }) {
  const [form, setForm] = useState<ItemForm>({
    name: item?.name ?? "",
    code: item?.code ?? "",
    description: item?.description ?? "",
    sortOrder: String(item?.sortOrder ?? 0),
    isActive: item?.isActive ?? true,
    parentId: item?.parentId ?? defaultParentId,
  });
  const save = useAction<Omit<ItemForm, "sortOrder"> & { sortOrder: number }>(item ? "put" : "post", item ? `master-data/${list.slug}/${item.id}` : `master-data/${list.slug}`);

  return (
    <Modal
      open
      onClose={onDone}
      title={`${item ? "Edit" : "Add"} / ${list.label}`}
      size="lg"
      submitLabel={item ? "Update" : "Save"}
      submitting={save.isPending}
      onSubmit={() => save.mutate({ ...form, sortOrder: Number(form.sortOrder || 0) }, { onSuccess: onDone })}
    >
      <div className="row">
        {list.parent && (
          <Field label={`${labelOf(list.parent)}:`} required className="col-md-12" error={save.fieldError("parentId")}>
            <ParentPicker list={list} value={form.parentId} onChange={(parentId) => setForm({ ...form, parentId })} placeholder={`Select ${labelOf(list.parent)}`} />
          </Field>
        )}
        <Field label="Name:" required className="col-md-6" error={save.fieldError("name")}>
          <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Code:" className="col-md-6" error={save.fieldError("code")}>
          <input className="form-control" value={form.code} placeholder="Left blank, it is made from the name" onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </Field>
        <Field label="Description:" className="col-md-12" error={save.fieldError("description")}>
          <textarea className="form-control" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Sort order:" className="col-md-6" error={save.fieldError("sortOrder")}>
          <input type="number" min={0} className="form-control" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
        </Field>
        <Field label="Status:" required className="col-md-6" error={save.fieldError("isActive")}>
          <select className="form-control" value={form.isActive ? "1" : "0"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "1" })}>
            <option value="1">ACTIVE</option>
            <option value="0">INACTIVE</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

/** Settings → Master Data: banks, providers, ID types and the institution registers used by customer registration. */
export default function MasterDataPage() {
  const [slug, setSlug] = useState("banks");
  const [parentId, setParentId] = useState<number | null>(null);
  const [editing, setEditing] = useState<MasterDataItem | "new" | null>(null);
  const list = LISTS.find((item) => item.slug === slug) ?? LISTS[0];
  const { data: rows, isLoading } = useApi<MasterDataItem[]>(`master-data/${list.slug}`, { includeInactive: 1, parent_id: list.parent ? parentId : undefined });
  const { data: parents = [] } = useApi<MasterDataItem[]>(list.parent ? `master-data/${list.parent}` : null, { includeInactive: 1 });
  const remove = useAction<{ id: number }>("delete", (body) => `master-data/${list.slug}/${body.id}`);
  const parentName = (id?: number) => parents.find((parent) => parent.id === id)?.name ?? "-";

  return (
    <>
      <PageHeader crumbs={["Setting", "Master Data"]} />
      <Card title="Master Data">
        <div className="row">
          <Field label="List:" className="col-md-5">
            <SelectBox
              options={LISTS.map((item) => ({ value: item.slug, label: item.label }))}
              value={slug}
              onChange={(value) => {
                setSlug(value ?? "banks");
                setParentId(null);
              }}
              placeholder="Select list"
            />
          </Field>
          {list.parent && (
            <Field label={`${labelOf(list.parent)}:`} className="col-md-5">
              <ParentPicker list={list} value={parentId} onChange={setParentId} placeholder={`All — or select ${labelOf(list.parent)}`} />
            </Field>
          )}
          <div className="col-md-2 mb-2 d-flex align-items-end">
            <button type="button" className="btn btn-primary btn-block" onClick={() => setEditing("new")}><i className="icon-plus" /> Add</button>
          </div>
        </div>
      </Card>

      <Card title={`${list.label} List`}>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          pageSize={25}
          columns={[
            { key: "sortOrder", header: "Order" },
            { key: "name", header: "Name" },
            { key: "code", header: "Code", render: (row) => <small className="text-muted">{row.code}</small> },
            ...(list.parent ? [{ key: "parent", header: labelOf(list.parent), value: (row: MasterDataItem) => parentName(row.parentId) }] : []),
            { key: "description", header: "Description", value: (row) => row.description ?? "" },
            {
              key: "isActive",
              header: "Status",
              value: (row) => (row.isActive ? "ACTIVE" : "INACTIVE"),
              render: (row) => <Badge tone={row.isActive ? "success" : "danger"}>{row.isActive ? "ACTIVE" : "INACTIVE"}</Badge>,
            },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Edit" onClick={() => setEditing(row)}><i className="icon-pencil" /></button>
                  <button type="button" className="btn btn-sm btn-icon btn-danger" title="Delete" onClick={async () => (await confirmAction(`Delete ${row.name}?`)) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>

      {editing && <ItemEditor key={`${list.slug}-${editing === "new" ? "new" : editing.id}`} list={list} item={editing === "new" ? null : editing} defaultParentId={parentId} onDone={() => setEditing(null)} />}
    </>
  );
}
