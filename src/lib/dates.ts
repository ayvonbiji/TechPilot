import type { DateFormat, TimeFormat } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function safeTz(tz: string | undefined): string {
  return tz && isValidTimeZone(tz) ? tz : "UTC";
}

/** Calendar date (yyyy-MM-dd) of an instant in a timezone. */
export function localDateOf(instant: Date | string, tz?: string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTz(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function todayIn(tz?: string): string {
  return localDateOf(new Date(), tz);
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = parseIso(value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseIso(iso);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayIndex(iso: string): number {
  const { y, m, d } = parseIso(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[weekdayIndex(iso)];
}

/** Monday-to-Sunday week containing the given date. */
export function weekRange(iso: string): { start: string; end: string } {
  const offset = (weekdayIndex(iso) + 6) % 7;
  const start = addDays(iso, -offset);
  return { start, end: addDays(start, 6) };
}

export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

/** UTC instant at which the given local calendar date starts in tz. */
export function startOfLocalDay(iso: string, tz?: string): Date {
  const zone = safeTz(tz);
  const { y, m, d } = parseIso(iso);
  const guess = Date.UTC(y, m - 1, d);
  let ms = guess - tzOffsetMs(guess, zone);
  ms = guess - tzOffsetMs(ms, zone);
  return new Date(ms);
}

/** Half-open UTC range [from, to) covering local dates start..end inclusive. */
export function utcRangeForDates(start: string, end: string, tz?: string) {
  return {
    from: startOfLocalDay(start, tz).toISOString(),
    to: startOfLocalDay(addDays(end, 1), tz).toISOString(),
  };
}

export function formatDate(iso: string | null | undefined, format: DateFormat = "dd MMM yyyy"): string {
  if (!iso) return "—";
  const { y, m, d } = parseIso(iso);
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  switch (format) {
    case "dd/MM/yyyy":
      return `${dd}/${mm}/${y}`;
    case "MM/dd/yyyy":
      return `${mm}/${dd}/${y}`;
    case "yyyy-MM-dd":
      return `${y}-${mm}-${dd}`;
    default:
      return `${dd} ${MONTHS[m - 1]} ${y}`;
  }
}

export function formatDateTime(
  instant: string | null | undefined,
  opts: { tz?: string; dateFormat?: DateFormat; timeFormat?: TimeFormat } = {},
): string {
  if (!instant) return "—";
  const zone = safeTz(opts.tz);
  const date = formatDate(localDateOf(instant, zone), opts.dateFormat);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: opts.timeFormat === "12h",
  }).format(new Date(instant));
  return `${date}, ${time}`;
}

export function longDate(iso: string): string {
  const { y, m, d } = parseIso(iso);
  return `${weekdayName(iso)}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function shortDay(iso: string): string {
  return weekdayName(iso).slice(0, 3);
}

export function greetingFor(tz?: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: safeTz(tz), hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** ISO timestamp for N days before now. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Current time in ms. A function so server components can take one consistent reading. */
export function nowMs(): number {
  return Date.now();
}

/** "just now", "10 minutes ago", "3 hours ago", "2 days ago"; falls back to a date after a week. */
export function timeAgo(iso: string, now: number, fallback: string): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return fallback;
}
