"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { LoanCategoryFields, toLoanCategoryForm, type LoanCategory, type LoanCategoryForm } from "@/components/settings/LoanCategoryFields";
import { Card } from "@/components/ui/Card";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAction, useApi } from "@/lib/hooks";

function EditForm({ category }: { category: LoanCategory }) {
  const router = useRouter();
  const [form, setForm] = useState<LoanCategoryForm>(() => toLoanCategoryForm(category));
  const update = useAction<LoanCategoryForm>("put", `settings/loan-categories/${category.id}`);

  return (
    <form onSubmit={(e) => { e.preventDefault(); update.mutate(form, { onSuccess: () => router.push("/settings/loan-categories") }); }}>
      <LoanCategoryFields form={form} setForm={setForm} fieldError={update.fieldError} currentCustomerType={category.customer_type} />
      <div className="text-center m-t-20">
        <button type="submit" className="btn btn-primary" disabled={update.isPending}><i className="icon-drawer" />Update</button>
      </div>
    </form>
  );
}

/** Live admin/edit_loan_category/:id. */
export default function EditLoanCategoryPage() {
  const { id } = useParams<{ id: string }>();
  const { data: category, isLoading } = useApi<LoanCategory>(`settings/loan-categories/${id}`);

  return (
    <>
      <PageHeader crumbs={["Edit Loan Category"]} />
      <Card title="Loan Category" actions={<Link href="/settings/loan-categories" className="btn btn-primary"><i className="icon-arrow-left-circle" /></Link>}>
        {isLoading || !category ? <Loading /> : <EditForm key={category.id} category={category} />}
      </Card>
    </>
  );
}
