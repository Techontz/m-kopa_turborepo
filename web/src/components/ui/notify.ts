"use client";

import Swal from "sweetalert2";

import { ApiError } from "@/lib/api";

/** SweetAlert dialogs matching the live system exactly: white card, big icon, "Yes!" button (styled in polish.css). */
export function notifySuccess(title: string): void {
  void Swal.fire({ title, icon: "success", confirmButtonText: "Yes!" });
}

export function notifyError(error: unknown): void {
  const title = error instanceof ApiError ? error.firstError : error instanceof Error ? error.message : "Something went wrong";
  void Swal.fire({ title, icon: "warning", confirmButtonText: "Yes!" });
}

/** Native-style confirmation ("Are you sure?") used before destructive actions. */
export async function confirmAction(title = "Are you sure?", text?: string): Promise<boolean> {
  const result = await Swal.fire({ title, text, icon: "warning", showCancelButton: true, confirmButtonText: "Yes", cancelButtonText: "Cancel" });
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
