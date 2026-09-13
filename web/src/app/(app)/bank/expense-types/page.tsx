"use client";

import { ExpenseTypesRegister } from "@/components/finance/ExpenseTypesRegister";

export default function BankExpenseTypesPage() {
  return <ExpenseTypesRegister scope="bank" crumbs={["Bank", "Register Bank Expenses"]} title="Expenses" field="expenses_name" managePermission="bank.manage" />;
}
