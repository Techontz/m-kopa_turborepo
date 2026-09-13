"use client";

import Swal from "sweetalert2";

import { ApiError } from "@/lib/api";

/** SweetAlert dialogs matching the live system's flash messages ("Yes!" button). */
export function notifySuccess(title: string): void {
  void Swal.fire({ title, icon: "success", confirmButtonText: "Yes!", confirmButtonColor: "#8cd4f5" });
}

export function notifyError(error: unknown): void {
  const title = error instanceof ApiError ? error.firstError : error instanceof Error ? error.message : "Something went wrong";
  void Swal.fire({ title, icon: "warning", confirmButtonText: "Yes!", confirmButtonColor: "#8cd4f5" });
}

/** Native-style confirmation ("Are you sure?") used before destructive actions. */
export async function confirmAction(title = "Are you sure?", text?: string): Promise<boolean> {
  const result = await Swal.fire({ title, text, icon: "warning", showCancelButton: true, confirmButtonText: "Yes", cancelButtonText: "Cancel", confirmButtonColor: "#dd4b39" });
  return result.isConfirmed;
}

/** Prompt for a required reason (rejections, reversals, modifications). */
export async function promptReason(title: string): Promise<string | null> {
  const result = await Swal.fire({
    title,
    input: "textarea",
    inputPlaceholder: "Enter reason",
    showCancelButton: true,
    confirmButtonText: "Submit",
    inputValidator: (value) => (!value ? "Reason is required" : undefined),
  });
  return result.isConfirmed ? String(result.value) : null;
}
