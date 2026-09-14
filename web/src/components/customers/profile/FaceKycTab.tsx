"use client";

import { useRef, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { confirmAction } from "@/components/ui/notify";
import { backendUrl } from "@/lib/api";
import { useApi } from "@/lib/hooks";

import { Detail, formatDateTime } from "../common";
import { FaceVerification } from "../face/FaceVerification";
import type { Customer, FaceScanResource } from "../types";
import { DetailCard } from "./DetailsTab";
import { faceAuditRecord, faceChecklist, featuredScan, formatDuration, imageQualityMeters, scoreTone } from "./detailSections";

function Meter({ label, score, passed }: { label: string; score: number | null; passed?: boolean | null }) {
  const tone = passed === false ? "danger" : scoreTone(score);
  return (
    <div className="mf-meter-row">
      <div className="mf-meter-head">
        <span className="mf-meter-label">{label}</span>
        <span className="mf-meter-value">
          {score === null ? "—" : `${score}/100`}
          {passed !== undefined && (
            <span className={`mf-pass ${passed === null ? "is-unknown" : passed ? "is-pass" : "is-fail"}`} title={passed === null ? "Not recorded" : passed ? "Passed" : "Not met"}>
              <i className={`fa ${passed === null ? "fa-minus" : passed ? "fa-check" : "fa-times"}`} aria-hidden="true" />
              <span className="sr-only">{passed === null ? "Not recorded" : passed ? "Passed" : "Not met"}</span>
            </span>
          )}
        </span>
      </div>
      <div className="mf-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? undefined}>
        <div className={`mf-meter-fill tone-${tone}`} style={{ width: `${score ?? 0}%` }} />
      </div>
    </div>
  );
}

function downloadAudit(customer: Customer, scan: FaceScanResource) {
  const record = faceAuditRecord(customer, scan, new Date().toISOString());
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `face-scan-audit-${customer.customerNumber ?? customer.id}-scan-${scan.id}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function FaceKycTab({ customer, canManage, onVerified }: { customer: Customer; canManage: boolean; onVerified: () => void }) {
  const { data: scans, isLoading } = useApi<FaceScanResource[]>(`customers/${customer.id}/face-scans`);
  const [scanning, setScanning] = useState<null | "rescan" | "replace">(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewing, setViewing] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);

  const scan = (scans ?? []).find((item) => item.id === selectedId) ?? featuredScan(scans);
  const imageUrl = scan?.imageUrl ? backendUrl(scan.imageUrl) : null;

  const openScanner = async (mode: "rescan" | "replace") => {
    if (mode === "replace" && !(await confirmAction("Replace this customer's face image? A new scan becomes the active face; earlier scans stay in the history."))) {
      return;
    }
    setScanning(mode);
    setTimeout(() => scannerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const scanner = canManage && scanning && (
    <div ref={scannerRef}>
      <DetailCard
        title={scanning === "replace" ? "Replace Face" : "Rescan Face"}
        action={
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setScanning(null)}>
            Cancel
          </button>
        }
      >
        <FaceVerification
          customerId={customer.id}
          onVerified={() => {
            setScanning(null);
            setSelectedId(null);
            onVerified();
          }}
        />
      </DetailCard>
    </div>
  );

  if (isLoading) {
    return <p className="mf-loading">Loading...</p>;
  }

  if (!scan) {
    return (
      <div className="mf-detail-cards">
        {scanner || (
          <section className="mf-detail-card mf-empty-state">
            <i className="icon-camera" aria-hidden="true" />
            <h3>No face scan on file</h3>
            <p>{customer.faceVerifiedAt ? `Face verified ${formatDateTime(customer.faceVerifiedAt)}, but no scan record is stored.` : "This customer has not completed face verification yet."}</p>
            {canManage && (
              <button type="button" className="btn btn-info" onClick={() => void openScanner("rescan")}>
                <i className="icon-camera" /> Run face verification
              </button>
            )}
          </section>
        )}
      </div>
    );
  }

  const passed = scan.status === "passed";
  const meters = imageQualityMeters(scan);
  const checks = faceChecklist(scan);
  const passedCount = checks.filter((check) => check.passed).length;

  return (
    <div className="mf-detail-cards">
      {scanner}

      <DetailCard
        title="Face Verification Summary"
        className="mf-face-summary"
        action={
          <span className="mf-detail-badges">
            {scan.isActive ? <Badge tone="info">Active scan</Badge> : <Badge tone="default">Earlier scan</Badge>}
          </span>
        }
      >
        <div className="mf-face-summary-body">
          <button type="button" className="mf-face-photo" onClick={() => setViewing(true)} disabled={!imageUrl} aria-label="Enlarge face capture">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- authorised API image stream
              <img src={imageUrl} alt={`Face capture for ${customer.fullName}`} />
            ) : (
              <i className="icon-user" aria-hidden="true" />
            )}
          </button>
          <div className="mf-face-summary-info">
            <dl className="mf-dl mf-detail-dl mf-dl-2">
              <Detail label="Verification Status">
                <Badge tone={passed ? "success" : "danger"}>{passed ? "Passed" : "Failed"}</Badge>
                {scan.isActive && customer.faceVerifiedAt && <Badge tone="success">Verified</Badge>}
              </Detail>
              <Detail label="Verification Date">{formatDateTime(scan.scannedAt)}</Detail>
              <Detail label="Operator">{scan.scannedByName}</Detail>
              <Detail label="Scan">#{scan.id}</Detail>
            </dl>
            <Meter label="Quality Score" score={scan.qualityScore ?? null} />
            <div className="mf-face-toolbar">
              {canManage && (
                <>
                  <button type="button" className="btn btn-sm btn-info" disabled={scanning !== null} onClick={() => void openScanner("rescan")}>
                    <i className="icon-refresh" /> Rescan Face
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-primary" disabled={scanning !== null} onClick={() => void openScanner("replace")}>
                    <i className="icon-user-follow" /> Replace Face
                  </button>
                </>
              )}
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!imageUrl} onClick={() => setViewing(true)}>
                <i className="icon-size-fullscreen" /> View Full Image
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => downloadAudit(customer, scan)}>
                <i className="icon-cloud-download" /> Download Audit
              </button>
            </div>
          </div>
        </div>
      </DetailCard>

      <DetailCard title="Capture Information" compact>
        <dl className="mf-dl mf-detail-dl">
          <Detail label="Capture Device">{scan.captureDevice}</Detail>
          <Detail label="Capture Resolution">{scan.captureResolution}</Detail>
          <Detail label="Scan Duration">{formatDuration(scan.captureDurationMs)}</Detail>
          <Detail label="Scanner Version">{scan.scannerVersion}</Detail>
          <Detail label="Recorded IP">{scan.ipAddress}</Detail>
          <Detail label="Source">{scan.userAgent ? <span className="mf-truncate" title={scan.userAgent}>{scan.userAgent}</span> : ""}</Detail>
        </dl>
      </DetailCard>

      <DetailCard title="Verification Results" compact>
        <dl className="mf-dl mf-detail-dl">
          <Detail label="Liveness Result"><Badge tone={scan.livenessPassed ? "success" : "danger"}>{scan.livenessPassed ? "Passed" : "Failed"}</Badge></Detail>
          <Detail label="Pose Result"><Badge tone={scan.poseSequenceCompleted ? "success" : "danger"}>{scan.poseSequenceCompleted ? "Completed" : "Incomplete"}</Badge></Detail>
          <Detail label="Measured Quality">{scan.qualityScore === null || scan.qualityScore === undefined ? "" : `${scan.qualityScore}/100`}</Detail>
          <Detail label="Checks Passed">{`${passedCount} of ${checks.length}`}</Detail>
          {scan.reason && <Detail label="Reason">{scan.reason}</Detail>}
        </dl>
      </DetailCard>

      <DetailCard title="Image Quality" compact>
        <div className="mf-meter-list">
          {meters.map((meter) => (
            <Meter key={meter.key} label={meter.label} score={meter.score} passed={meter.passed} />
          ))}
        </div>
      </DetailCard>

      <DetailCard title="Verification Checks" compact action={<span className="mf-detail-card-meta">{passedCount}/{checks.length} passed</span>}>
        <ul className="mf-checklist">
          {checks.map((check) => (
            <li key={check.key} className={check.passed === null ? "is-unknown" : check.passed ? "is-pass" : "is-fail"}>
              <i className={`fa ${check.passed === null ? "fa-minus-circle" : check.passed ? "fa-check-circle" : "fa-times-circle"}`} aria-hidden="true" />
              <span>{check.label}</span>
              <span className="sr-only">{check.passed === null ? "not recorded" : check.passed ? "passed" : "not met"}</span>
            </li>
          ))}
        </ul>
      </DetailCard>

      <DetailCard title="Scan History" action={<span className="mf-detail-card-meta">{(scans ?? []).length} on file</span>}>
        <div className="table-responsive">
          <table className="table table-custom mf-table mb-0">
            <thead className="thead-info">
              <tr><th>Capture</th><th>Result</th><th>Quality</th><th>Checks</th><th>Device</th><th>Scanned</th><th /></tr>
            </thead>
            <tbody>
              {(scans ?? []).map((row) => {
                const failed = faceChecklist(row).filter((check) => check.passed === false);
                return (
                  <tr key={row.id} className={row.id === scan.id ? "mf-row-selected" : ""}>
                    <td>
                      {row.imageUrl && (
                        <a href={backendUrl(row.imageUrl)} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image stream */}
                          <img src={backendUrl(row.imageUrl)} alt={`Scan ${row.id}`} className="mf-avatar" style={{ borderRadius: 4, width: 56, height: 42 }} />
                        </a>
                      )}
                    </td>
                    <td>
                      <Badge tone={row.status === "passed" ? "success" : "danger"}>{row.status === "passed" ? "Passed" : "Failed"}</Badge> {row.isActive && <Badge tone="info">Active</Badge>}
                    </td>
                    <td className="text-nowrap">
                      {row.qualityScore}/100
                      <small className="d-block text-muted">light {row.brightnessScore} · sharp {row.blurScore} · distance {row.distanceScore} · centre {row.centeringScore} · eyes {row.eyesOpenScore}</small>
                    </td>
                    <td>{failed.length === 0 ? <span className="text-success">All 11 passed</span> : <small className="text-danger">Not met: {failed.map((check) => check.label).join(", ")}</small>}</td>
                    <td><small>{[row.captureDevice, row.captureResolution, row.scannerVersion].filter(Boolean).join(" · ")}</small></td>
                    <td className="text-nowrap">{formatDateTime(row.scannedAt)}<small className="d-block text-muted">{row.scannedByName}</small></td>
                    <td>
                      {row.id !== scan.id && (
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedId(row.id)}>View</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DetailCard>

      <Modal open={viewing} onClose={() => setViewing(false)} title={`Face capture · scan #${scan.id}`} size="lg">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- authorised API image stream
          <img src={imageUrl} alt={`Full face capture for ${customer.fullName}`} className="mf-face-full" />
        )}
        <div className="mt-2">
          <a href={imageUrl ?? "#"} target="_blank" rel="noreferrer">Open in a new tab</a>
        </div>
      </Modal>
    </div>
  );
}
