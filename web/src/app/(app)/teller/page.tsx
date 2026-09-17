"use client";

import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";

/** Teller → Loan Repayment (live admin/teller_dashboard): find the customer to record a repayment. Banking the cash is Teller → Bank Deposit. */
export default function TellerDashboardPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader crumbs={["Teller", "Loan Repayment"]} />

      <Card title="Search Customer">
        <div className="d-flex justify-content-center p-t-20 p-b-20">
          <SelectBox width={345} placeholder="Search Customer" optionsUrl="options/customers" query={{ with_code: 1 }} onChange={(value) => value && router.push(`/teller/${value}`)} />
        </div>
      </Card>
    </>
  );
}
