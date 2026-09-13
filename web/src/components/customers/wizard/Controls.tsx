"use client";

import { useId, type ReactNode } from "react";
import Select, { components, type InputProps, type SingleValue } from "react-select";

import { fieldDomId } from "./errors";
import { NO_AUTOFILL } from "./noAutofill";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

/** react-select input with autofill disabled and a unique, non-semantic name. */
function NoAutofillInput(props: InputProps<ComboOption, false>) {
  const name = (props.selectProps as unknown as { comboName?: string }).comboName;
  return <components.Input {...props} {...NO_AUTOFILL} name={name} />;
}

interface ComboProps {
  field: string;
  value: string | number | null | undefined;
  options: ComboOption[];
  onChange: (value: string | null) => void;
  placeholder: string;
  /** Shown when the list itself is empty (says who can fix missing data). */
  emptyMessage?: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  isClearable?: boolean;
  invalid?: boolean;
}

/** Searchable combobox used by every wizard select. */
export function Combo({ field, value, options, onChange, placeholder, emptyMessage, isDisabled, isLoading, isClearable = true, invalid }: ComboProps) {
  const unique = useId().replace(/[^A-Za-z0-9]/g, "");
  const selected = options.find((option) => option.value === String(value ?? "")) ?? null;
  const extra = { comboName: `mfx-${unique}` };

  return (
    <Select<ComboOption, false>
      {...extra}
      instanceId={`combo-${field}`}
      inputId={fieldDomId(field)}
      className={`mf-select ${invalid ? "is-invalid" : ""}`}
      classNamePrefix="mf-select"
      options={options}
      value={selected}
      onChange={(option: SingleValue<ComboOption>) => onChange(option ? option.value : null)}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isLoading={isLoading}
      isClearable={isClearable}
      components={{ Input: NoAutofillInput }}
      aria-invalid={invalid || undefined}
      noOptionsMessage={({ inputValue }) => (inputValue || options.length > 0 ? "No results found" : emptyMessage ?? "No results found")}
      formatOptionLabel={(option, meta) =>
        meta.context === "menu" && option.hint ? (
          <span>
            {option.label} <small className="mf-option-hint">{option.hint}</small>
          </span>
        ) : (
          option.label
        )
      }
    />
  );
}

interface CellProps {
  field?: string;
  label: ReactNode;
  required?: boolean;
  error?: string;
  help?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Compact form cell: label with red asterisk, control, small red error below. */
export function Cell({ field, label, required, error, help, className = "", children }: CellProps) {
  return (
    <div className={`mf-cell ${className}`} data-error={error ? "true" : undefined} data-field={field}>
      <label className="mf-cell-label" htmlFor={field ? fieldDomId(field) : undefined}>
        {label}
        {required && <span className="mf-req" aria-hidden="true"> *</span>}
      </label>
      {children}
      {help && <div className="mf-cell-help">{help}</div>}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

/** Small uppercase group heading on a hairline rule. */
export function GroupHeading({ children, required, aside }: { children: ReactNode; required?: boolean; aside?: ReactNode }) {
  return (
    <div className="mf-group-heading">
      <span>
        {children}
        {required && <span className="mf-req" aria-hidden="true"> *</span>}
      </span>
      {aside}
    </div>
  );
}
