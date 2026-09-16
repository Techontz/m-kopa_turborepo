import type { Payment } from "./types";

/**
 * Total of the selected teller receipts from their server-recorded amounts, summed in whole cents to avoid float drift.
 * The API rejects a bank deposit slip whose amount differs from this total.
 */
export function receiptsTotal(receipts: Pick<Payment, "id" | "amount">[], ids: number[]): number {
  return receipts.filter((receipt) => ids.includes(receipt.id)).reduce((cents, receipt) => cents + Math.round(Number(receipt.amount) * 100), 0) / 100;
}
