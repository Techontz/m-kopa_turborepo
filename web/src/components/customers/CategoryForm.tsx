"use client";

import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { SelectBox } from "@/components/ui/SelectBox";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

import type { CustomerCategory, FormField, OptionTrees } from "./types";

type Answers = Record<string, string>;

/** Options of a dynamic select given the answers so far (mirrors App\Services\Customers\CategoryFormValidator). */
export function fieldOptions(field: FormField, answers: Answers, trees: OptionTrees | undefined): string[] {
  const source = field.optionSource;
  if (!source || !trees) {
    return [];
  }
  if (source.kind === "fixed") {
    return source.options ?? [];
  }
  let node: unknown = trees[source.tree ?? ""];
  if (source.kind === "flat") {
    return Array.isArray(node) ? (node as string[]) : [];
  }
  for (const step of source.path ?? []) {
    const key = step.field ? answers[step.field] : step.property;
    if (!key || node === null || typeof node !== "object" || !(key in (node as Record<string, unknown>))) {
      return [];
    }
    node = (node as Record<string, unknown>)[key];
  }
  if (node === null || typeof node !== "object") {
    return [];
  }
  const options = source.take === "keys" ? Object.keys(node as Record<string, unknown>) : (node as string[]);
  return [...options, ...(source.extraOptions ?? [])];
}

function dependentKeys(schema: FormField[], changed: string): string[] {
  const direct = schema
    .filter((field) => field.dependsOn === changed || field.optionSource?.path?.some((step) => step.field === changed) || field.requiredWhen?.field === changed)
    .map((field) => field.key);
  return direct.flatMap((key) => [key, ...dependentKeys(schema, key)]);
}

function isVisible(field: FormField, answers: Answers): boolean {
  return !field.requiredWhen || field.requiredWhen.equals.includes(answers[field.requiredWhen.field] ?? "");
}

interface Props {
  customerId: number;
  currentCategoryId?: number | null;
  currentAnswers?: Record<string, string | number> | null;
  submitLabel?: string;
  onSaved?: () => void;
  readOnly?: boolean;
}

/**
 * "Mteja ni Nani?" — choose one of the customer categories and fill its dynamic form (form_schema),
 * with cascading option trees TAASISI / SEKTA / SEKTA_BINAFSI / VYUO / BANKS / MFUKO_HIFADHI.
 */
export function CategoryForm({ customerId, currentCategoryId, currentAnswers, submitLabel = "next", onSaved, readOnly }: Props) {
  const { data: categories } = useApi<CustomerCategory[]>("customers/categories");
  const { data: trees } = useApi<OptionTrees>("customers/categories/option-trees");
  const [categoryId, setCategoryId] = useState<number | null>(currentCategoryId ?? null);
  const [answers, setAnswers] = useState<Answers>(() => Object.fromEntries(Object.entries(currentAnswers ?? {}).map(([key, value]) => [key, String(value)])));
  const save = useAction<{ customer_category_id: number | null; answers: Answers }>("put", `customers/${customerId}/category`);

  const category = categories?.find((item) => item.id === categoryId) ?? null;

  const change = (field: FormField, value: string) => {
    setAnswers((current) => {
      const next = { ...current, [field.key]: value };
      for (const key of dependentKeys(category?.form_schema ?? [], field.key)) {
        delete next[key];
      }
      return next;
    });
  };

  const groups = (category?.form_schema ?? []).reduce<Array<{ title: string; fields: FormField[] }>>((list, field) => {
    const title = field.group ?? category?.section_title ?? "";
    const group = list.find((item) => item.title === title);
    if (group) {
      group.fields.push(field);
    } else {
      list.push({ title, fields: [field] });
    }
    return list;
  }, []);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ customer_category_id: categoryId, answers }, { onSuccess: () => onSaved?.() });
      }}
    >
      <h6>Mteja ni Nani? (Customer Category)</h6>
      {save.fieldError("customer_category_id") && <div className="field-error">{save.fieldError("customer_category_id")}</div>}
      <div className="row">
        {(categories ?? []).map((item) => (
          <div className="col-lg col-md-4 col-sm-6 mb-3" key={item.id}>
            <button
              type="button"
              disabled={readOnly}
              className={`btn btn-block ${item.id === categoryId ? "btn-info" : "btn-outline-secondary"}`}
              style={{ padding: "14px 6px", whiteSpace: "normal" }}
              onClick={() => { setCategoryId(item.id); setAnswers({}); }}
            >
              <span style={{ fontSize: 26, display: "block" }}>{item.icon}</span>
              {item.name}
            </button>
          </div>
        ))}
      </div>

      {category && (
        <>
          <p className="mb-2">
            <b>Risk level:</b> <span className={`badge badge-${category.risk_level === "high" ? "danger" : category.risk_level === "low" ? "success" : "warning"}`}>{category.risk_level}</span>
            <b className="ml-3">Loan limit:</b> {money(category.min_loan_amount)} - {money(category.max_loan_amount)}
            <b className="ml-3">Loan products:</b> {category.loan_categories.map((product) => product.name).join(", ") || "-"}
            <b className="ml-3">Required documents:</b> {category.required_documents.join(", ")}
          </p>
          {groups.map((group) => (
            <div key={group.title}>
              <h6 className="m-t-20">{group.title}</h6>
              <div className="row">
                {group.fields.filter((field) => isVisible(field, answers)).map((field) => {
                  const error = save.fieldError(`answers.${field.key}`);
                  const className = field.fullWidth ? "col-md-12" : "col-md-4";
                  const required = field.required || Boolean(field.requiredWhen);
                  if (field.control === "select") {
                    const options = fieldOptions(field, answers, trees);
                    const parent = field.dependsOn ? category.form_schema.find((item) => item.key === field.dependsOn) : null;
                    const waiting = Boolean(parent && !answers[parent.key]);
                    return (
                      <Field key={field.key} label={`${field.label}:`} required={required} className={className} error={error}>
                        <SelectBox
                          inputId={`answer-${field.key}`}
                          placeholder={waiting ? `-- Chagua ${parent?.label} Kwanza --` : "-- Chagua --"}
                          options={options.map((option) => ({ value: option, label: option }))}
                          value={answers[field.key] ?? ""}
                          isDisabled={readOnly || waiting}
                          onChange={(value) => change(field, value ?? "")}
                        />
                      </Field>
                    );
                  }
                  return (
                    <Field key={field.key} label={`${field.label}:`} required={required} className={className} error={error}>
                      <input
                        className="form-control"
                        type={field.inputType ?? "text"}
                        min={field.inputType === "number" ? 0 : undefined}
                        value={answers[field.key] ?? ""}
                        readOnly={readOnly}
                        onChange={(event) => change(field, event.target.value)}
                        required={field.required}
                      />
                    </Field>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {!readOnly && (
        <div className="text-center m-t-20">
          <button type="submit" className="btn btn-info" disabled={save.isPending || !categoryId}>
            {save.isPending ? "Please wait..." : submitLabel} <i className="icon-arrow-right" />
          </button>
        </div>
      )}
    </form>
  );
}
