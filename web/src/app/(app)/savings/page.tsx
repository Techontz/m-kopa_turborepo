"use client";

import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";

export default function SavingSearchPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader crumbs={["Saving Deposit", "Search customer"]} />

      <Card title="Search Customer">
        <div className="row">
          <div className="col-lg-4 col-12" />
          <div className="col-lg-4 col-12">
            <SelectBox placeholder="Select customer" optionsUrl="options/customers" onChange={(value) => value && router.push(`/savings/${value}`)} />
          </div>
          <div className="col-lg-4 col-12" />
        </div>
      </Card>
    </>
  );
}
