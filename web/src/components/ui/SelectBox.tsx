"use client";

import { useQuery } from "@tanstack/react-query";
import Select from "react-select";

import { api, type Query } from "@/lib/api";

export interface Option {
  value: string;
  label: string;
}

/** A labelled section of options (react-select renders the label as a group heading). */
export interface OptionGroup {
  label: string;
  options: Option[];
}

interface SelectBoxProps {
  value?: string | number | null;
  onChange: (value: string | null) => void;
  options?: (Option | OptionGroup)[];
  /** API path returning { data: Option[] } — used for dependent / remote dropdowns. */
  optionsUrl?: string;
  query?: Query;
  placeholder?: string;
  isDisabled?: boolean;
  isClearable?: boolean;
  width?: number | string;
  name?: string;
  inputId?: string;
}

/** Searchable select styled like the live system's Select2 boxes. */
export function SelectBox({ value, onChange, options, optionsUrl, query, placeholder = "Select", isDisabled, isClearable, width, name, inputId }: SelectBoxProps) {
  const enabled = Boolean(optionsUrl) && !isDisabled;
  const { data: remote = [], isLoading } = useQuery({
    queryKey: ["options", optionsUrl, query],
    queryFn: () => api.get<{ data: (Option | OptionGroup)[] }>(optionsUrl as string, query).then((response) => response.data),
    enabled,
    staleTime: 60 * 1000,
  });

  const list: (Option | OptionGroup)[] = options ?? remote;
  const flat = list.flatMap((entry) => ("options" in entry ? entry.options : [entry]));
  const selected = flat.find((option) => String(option.value) === String(value ?? "")) ?? null;

  return (
    <div style={{ width: width ?? "100%" }}>
      <Select
        instanceId={inputId ?? name ?? placeholder}
        inputId={inputId}
        name={name}
        className="mf-select"
        classNamePrefix="mf-select"
        options={list}
        value={selected}
        onChange={(option) => onChange(option && "value" in option ? option.value : null)}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isClearable={isClearable}
        isLoading={enabled && isLoading}
        noOptionsMessage={() => "No results found"}
      />
    </div>
  );
}
