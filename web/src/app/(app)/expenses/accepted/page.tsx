"use client";

import { useState } from "react";

import { BranchExpensesTable } from "@/components/finance/BranchExpensesTable";
import { FilterModal, HeaderButton, type Filters } from "@/components/finance/FilterModal";
import type { ExpenseRequest } from "@/components/finance/types";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useApi } from "@/lib/hooks";

export default function AcceptedExpensesPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [filtering, setFiltering] = useState(false);
  const { data: rows, isLoading } = useApi<ExpenseRequest[]>("expenses/requests", { scope: "branch", status: "accepted", ...filters });

  return (
    <>
      <PageHeader crumbs={["Accepted Expenses"]} />
      <Card title="Accepted Expenses List" actions={<HeaderButton onClick={() => setFiltering(true)} />}>
        <BranchExpensesTable rows={rows} loading={isLoading} />
      </Card>
      <FilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} withBranch branchesOnly />
    </>
  );
}
