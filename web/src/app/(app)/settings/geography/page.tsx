"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { FileField } from "@/components/ui/FileField";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAction, useApi } from "@/lib/hooks";

interface GeographyStatus {
  regions: number;
  districts: number;
  wards: number;
  perRegion: { id: number; name: string; districts: number; wards: number }[];
}

interface ImportResult {
  message: string;
  data: {
    rows: number;
    imported: number;
    regionsCreated: number;
    districtsCreated: number;
    wardsCreated: number;
    rejected: { line: number; reason: string }[];
  };
}

/** Settings → Geography: Tanzania Region → District → Ward on file, and the idempotent CSV import. */
export default function GeographyPage() {
  const { data: status, isLoading } = useApi<GeographyStatus>("master-data/geography");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult["data"] | null>(null);
  const upload = useAction<FormData, ImportResult>("post", "master-data/geography/import");

  const submit = () => {
    if (!file) {
      upload.setErrors({ file: ["Choose the CSV file to import."] });
      return;
    }
    const body = new FormData();
    body.append("file", file);
    upload.mutate(body, {
      onSuccess: (response) => {
        setResult(response.data);
        setFile(null);
      },
    });
  };

  return (
    <>
      <PageHeader crumbs={["Setting", "Geography"]} />

      <div className="row clearfix">
        {(["regions", "districts", "wards"] as const).map((level) => (
          <div className="col-md-4" key={level}>
            <Card>
              <div className="text-center">
                <h3 className="mb-0">{isLoading ? "…" : (status?.[level] ?? 0).toLocaleString()}</h3>
                <span className="text-muted text-uppercase">{level}</span>
              </div>
            </Card>
          </div>
        ))}
      </div>

      <Card title="Import Geography">
        <p className="text-muted mb-2">
          CSV with the header <code>region,district,ward,street</code>. Each row finds or creates its region, district and ward, so importing the same file again adds nothing. Rows missing a level are rejected and listed below.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="row">
            <div className="col-md-8 mb-2">
              <FileField file={file} onChange={setFile} accept=".csv,text/csv" extensions={["csv", "txt"]} maxMb={10} placeholder="Choose CSV file" error={upload.fieldError("file")} />
            </div>
            <div className="col-md-4 mb-2">
              <button type="submit" className="btn btn-primary" disabled={upload.isPending}><i className="icon-cloud-upload" /> {upload.isPending ? "Importing..." : "Import"}</button>
            </div>
          </div>
        </form>
        {result && (
          <div className="mt-2">
            <p className="mb-2">
              Read {result.rows} rows: {result.imported} imported, {result.rejected.length} rejected. Created {result.regionsCreated} regions, {result.districtsCreated} districts and {result.wardsCreated} wards.
            </p>
            {result.rejected.length > 0 && (
              <DataTable rows={result.rejected} rowKey={(row) => row.line} columns={[{ key: "line", header: "Line" }, { key: "reason", header: "Reason" }]} />
            )}
          </div>
        )}
      </Card>

      <Card title="Regions On File">
        <DataTable
          rows={status?.perRegion}
          loading={isLoading}
          rowKey={(row) => row.id}
          pageSize={50}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "name", header: "Region" },
            { key: "districts", header: "Districts" },
            { key: "wards", header: "Wards" },
          ]}
        />
      </Card>
    </>
  );
}
