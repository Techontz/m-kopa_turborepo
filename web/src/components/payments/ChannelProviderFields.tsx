"use client";

import { useQuery } from "@tanstack/react-query";

import { Field } from "@/components/ui/Field";
import { SelectBox } from "@/components/ui/SelectBox";
import { api } from "@/lib/api";

export type PaymentChannel = "BANK" | "MNO";

const PROVIDER_LABELS: Record<PaymentChannel, { label: string; placeholder: string }> = {
  BANK: { label: "Bank:", placeholder: "Select Bank" },
  MNO: { label: "Network:", placeholder: "Select Network" },
};

interface Props {
  channel: string;
  provider: string;
  onChange: (value: { channel: PaymentChannel; provider: string }) => void;
  fieldError: (field: string) => string | undefined;
  className?: string;
}

/**
 * Channel (BANK or MNO) and its provider, from the company's own short list (Settings → Payment Channels). Names only — not the
 * company's fund bank accounts, and not the Master Data bank list used for customers.
 */
export function ChannelProviderFields({ channel, provider, onChange, fieldError, className = "col-md-4" }: Props) {
  const current: PaymentChannel = channel === "MNO" ? "MNO" : "BANK";

  return (
    <>
      <Field label="Channel:" required className={className} error={fieldError("channel")}>
        <select className="form-control" value={current} onChange={(e) => onChange({ channel: e.target.value as PaymentChannel, provider: "" })}>
          <option value="BANK">BANK</option>
          <option value="MNO">MNO</option>
        </select>
      </Field>
      <ProviderSelect channel={current} value={provider} onChange={(value) => onChange({ channel: current, provider: value })} error={fieldError("provider")} className={className} />
    </>
  );
}

/** The Bank / Network dropdown of one channel, from the company's Payment Channels. */
export function ProviderSelect({ channel, value, onChange, error, className = "col-md-4" }: { channel: PaymentChannel; value: string; onChange: (value: string) => void; error?: string; className?: string }) {
  const list = PROVIDER_LABELS[channel];
  const { data: options, isLoading } = useQuery({
    queryKey: ["settings/payment-providers/options", channel],
    queryFn: () => api.get<{ data: Array<{ value: string; label: string }> }>("settings/payment-providers/options", { channel }).then((response) => response.data),
  });

  return (
    <Field label={list.label} required className={className} error={error}>
      <SelectBox placeholder={isLoading ? "Loading…" : list.placeholder} options={options ?? []} value={value} onChange={(selected) => onChange(selected ?? "")} />
      {!isLoading && options?.length === 0 && <small className="text-muted">None registered yet — add them in Settings → Payment Channels.</small>}
    </Field>
  );
}
