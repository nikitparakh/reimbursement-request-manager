/**
 * Centralized formatting helpers so dates, currency, and relative times read
 * consistently across pages, tables, popovers, and PDFs.
 *
 * Locale defaults to en-US to match how the seed data is written and how prior
 * pages displayed values; pass a `locale` arg to override per-call.
 */

const DEFAULT_LOCALE = "en-US";
const DEFAULT_CURRENCY = "USD";

export function formatCurrency(
  value: number | string | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(
  date: Date | string | number | null | undefined,
  locale: string = DEFAULT_LOCALE
): string {
  if (date === null || date === undefined) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(
  date: Date | string | number | null | undefined,
  locale: string = DEFAULT_LOCALE
): string {
  if (date === null || date === undefined) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

const RELATIVE_THRESHOLDS: Array<{ limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { limit: 60, divisor: 1, unit: "second" },
  { limit: 3600, divisor: 60, unit: "minute" },
  { limit: 86_400, divisor: 3600, unit: "hour" },
  { limit: 604_800, divisor: 86_400, unit: "day" },
  { limit: 2_419_200, divisor: 604_800, unit: "week" },
  { limit: 29_030_400, divisor: 2_592_000, unit: "month" },
  { limit: Number.POSITIVE_INFINITY, divisor: 31_536_000, unit: "year" },
];

export function formatRelativeTime(
  date: Date | string | number | null | undefined,
  locale: string = DEFAULT_LOCALE,
  now: Date = new Date()
): string {
  if (date === null || date === undefined) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  const diffSeconds = Math.round((d.getTime() - now.getTime()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 30) return "just now";
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const { limit, divisor, unit } of RELATIVE_THRESHOLDS) {
    if (absSeconds < limit) {
      return formatter.format(Math.round(diffSeconds / divisor), unit);
    }
  }
  return formatter.format(Math.round(diffSeconds / 31_536_000), "year");
}
