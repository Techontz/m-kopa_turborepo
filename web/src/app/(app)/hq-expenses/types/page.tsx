"use client";

import { ExpenseTypesRegister } from "@/components/finance/ExpenseTypesRegister";

export default function HqExpenseTypesPage() {
  return <ExpenseTypesRegister scope="hq" crumbs={["Headquater Expenses"]} title="Expenses" field="exp_desc" managePermission="hq.manage" />;
}
