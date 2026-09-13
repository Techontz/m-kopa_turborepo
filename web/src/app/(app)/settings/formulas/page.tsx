"use client";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

interface Formula {
  id: number;
  code: string;
  name: string;
  is_enabled: boolean;
}

export default function FormulasPage() {
  const { data: formulas, isLoading } = useApi<Formula[]>("settings/formulas");
  const enable = useAction<{ id: number }>("post", (body) => `settings/formulas/${body.id}/enable`);
  const disable = useAction<{ id: number }>("delete", (body) => `settings/formulas/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Setting", "Interest Formula"]} />
      <div className="row clearfix">
        <div className="col-lg-6">
          <Card title="Interest Formula">
            <DataTable
              rows={formulas}
              loading={isLoading}
              rowKey={(row) => row.id}
              columns={[
                { key: "sn", header: "S/no", render: (_, index) => `${index + 1}.`, sortable: false },
                { key: "name", header: "Formula Name" },
                {
                  key: "action",
                  header: "Action",
                  sortable: false,
                  render: (row) => <button type="button" className="btn btn-info btn-sm" disabled={enable.isPending} onClick={() => enable.mutate({ id: row.id })}><i className="icon-pencil" /></button>,
                },
              ]}
            />
          </Card>
        </div>
        <div className="col-lg-6">
          <Card title="Interest Formula">
            <DataTable
              rows={formulas?.filter((formula) => formula.is_enabled)}
              loading={isLoading}
              rowKey={(row) => row.id}
              columns={[
                { key: "sn", header: "S/no", render: (_, index) => `${index + 1}.`, sortable: false },
                { key: "name", header: "Formula Name" },
                {
                  key: "action",
                  header: "Action",
                  sortable: false,
                  render: (row) => <button type="button" className="btn btn-danger btn-sm" onClick={async () => (await confirmAction("Are You Sure?")) && disable.mutate({ id: row.id })}><i className="icon-trash" /></button>,
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
