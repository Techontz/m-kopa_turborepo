"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api, ApiError } from "@/lib/api";

import { toastError, toastSuccess } from "../toast";
import type { Customer } from "../types";
import { FaceLivenessScanner, type ScanResult } from "./FaceLivenessScanner";
import { faceVerifyForm } from "./liveness";

export const FACE_SUCCESS_TOAST = "Face verification complete. This customer's KYC is now complete.";

/**
 * Runs the liveness scanner and records the scan (POST /customers/{id}/face-verify).
 * "Complete face verification" stays disabled until a capture exists and its report passed.
 */
export function FaceVerification({ customerId, onVerified }: { customerId: number; onVerified: (customer: Customer | null) => void }) {
  const client = useQueryClient();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const canComplete = Boolean(scan?.capture) && scan?.report.status === "passed" && !submitting;

  const complete = async () => {
    if (!scan || scan.report.status !== "passed") {
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      const response = await api.post<{ data: Customer }>(`customers/${customerId}/face-verify`, faceVerifyForm(scan.capture, scan.report));
      await client.invalidateQueries();
      toastSuccess(FACE_SUCCESS_TOAST);
      onVerified(response?.data ?? null);
    } catch (error) {
      const message = error instanceof ApiError ? error.firstError : "Face verification could not be recorded.";
      setServerError(message);
      toastError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <FaceLivenessScanner
        onResult={(result) => {
          setScan(result);
          setServerError(null);
        }}
        disabled={submitting}
      />
      {serverError && <div className="field-error mt-2">{serverError}</div>}
      <div className="mf-wizard-actions">
        <span />
        <button type="button" className="btn btn-primary" disabled={!canComplete} onClick={() => void complete()}>
          {submitting ? "Please wait..." : "Complete face verification"}
        </button>
      </div>
    </div>
  );
}
