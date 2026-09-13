"use client";

import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";

/** Customer → Customer profile (live admin/update_customer_info_data): pick a customer to open the profile. */
export default function CustomerSearchPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader crumbs={["customer", "Search customer"]} />
      <Card title="Search Customer">
        <div className="row">
          <div className="col-md-6">
            <SelectBox inputId="customer-search" placeholder="Select customer" optionsUrl="options/customers" query={{ with_code: 1 }} onChange={(value) => value && router.push(`/customers/${value}`)} />
          </div>
        </div>
      </Card>
    </>
  );
}
