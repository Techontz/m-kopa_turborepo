"use client";

import { TellerCashCard } from "@/components/payments/TellerCashCard";
import { PageHeader } from "@/components/ui/PageHeader";

/** Teller → Bank Deposit: bank the collected cash (deposit slip) and follow each slip until Finance verifies it. */
export default function TellerBankDepositPage() {
  return (
    <>
      <PageHeader crumbs={["Teller", "Bank Deposit"]} />
      <TellerCashCard />
    </>
  );
}
