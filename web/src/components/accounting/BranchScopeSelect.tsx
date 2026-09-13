"use client";

import { SelectBox, type Option } from "@/components/ui/SelectBox";
import { useApi } from "@/lib/hooks";

/** Branch dropdown for ledger screens: ALL (consolidated), HQ (company-level accounts) and each visible branch. */
export function BranchScopeSelect({ value, onChange, withHq = true }: { value: string; onChange: (value: string) => void; withHq?: boolean }) {
  const { data: branches = [] } = useApi<Option[]>("options/branches");
  const options: Option[] = [{ value: "all", label: "ALL" }, ...(withHq ? [{ value: "hq", label: "HQ (COMPANY)" }] : []), ...branches];

  return <SelectBox placeholder="Select Branch" options={options} value={value} onChange={(selected) => onChange(selected ?? "all")} />;
}
