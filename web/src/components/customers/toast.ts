"use client";

import Swal from "sweetalert2";

/** Non-blocking toasts for the Customer module (SweetAlert2 toast mode, themed like the app's alerts). */
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timerProgressBar: true,
  customClass: { popup: "mf-toast" },
});

export function toastSuccess(title: string): void {
  void Toast.fire({ icon: "success", title, timer: 4000 });
}

export function toastError(title: string): void {
  void Toast.fire({ icon: "warning", title, timer: 6500 });
}

export function toastInfo(title: string): void {
  void Toast.fire({ icon: "info", title, timer: 3500 });
}
