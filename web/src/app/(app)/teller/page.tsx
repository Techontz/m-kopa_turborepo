"use client";

import { useRouter } from "next/navigation";

import { TellerCashCard } from "@/components/payments/TellerCashCard";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";

/** Teller → Teller Dashboard (live admin/teller_dashboard): customer search, plus the teller's cash awaiting bank deposit (Documents). */
export default function TellerDashboardPage() {
  const router = useRouter();
  const { can } = useAuth();

  return (
    <>
      <PageHeader crumbs={["Teller", "Teller Dashboard"]} />

      <Card title="Search Customer">
        <div className="d-flex justify-content-center p-t-20 p-b-20">
          <SelectBox width={345} placeholder="Search Customer" optionsUrl="options/customers" query={{ with_code: 1 }} onChange={(value) => value && router.push(`/teller/${value}`)} />
        </div>
      </Card>

      {can("payments.cash") && <TellerCashCard />}
    </>
  );
}
