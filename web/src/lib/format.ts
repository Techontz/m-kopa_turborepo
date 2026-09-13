/** "1,858,000" — the live system's amount format. */
export function money(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount).toLocaleString("en-US") : "0";
}

/** "30%" without trailing zeros. */
export function percent(value: number | string | null | undefined): string {
  return `${Number(value ?? 0).toString().replace(/\.0+$/, "")}%`;
}

export function date(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
