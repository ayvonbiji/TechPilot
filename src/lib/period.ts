import { addDays, isIsoDate, startOfLocalDay, todayIn } from "./dates";
import type { Granularity } from "./service-metrics";

export interface ResolvedPeriod {
  range: string;
  startDate: string;
  endDate: string;
  from: number;
  to: number;
  granularity: Granularity;
}

export const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
] as const;

/** Date range from URL params, interpreted in the user's time zone. */
export function resolvePeriod(range: string | undefined, fromParam: string | undefined, toParam: string | undefined, tz: string, fallback = "30d"): ResolvedPeriod {
  const today = todayIn(tz);
  let startDate: string;
  let endDate = today;
  let r = range ?? fallback;
  if (r === "custom" && fromParam && toParam && isIsoDate(fromParam) && isIsoDate(toParam) && fromParam <= toParam) {
    startDate = fromParam;
    endDate = toParam;
  } else {
    if (!RANGES.some((x) => x.value === r)) r = fallback;
    const days = Number(r.replace("d", ""));
    startDate = addDays(today, -(days - 1));
  }
  const span = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
  return {
    range: r,
    startDate,
    endDate,
    from: startOfLocalDay(startDate, tz).getTime(),
    to: startOfLocalDay(addDays(endDate, 1), tz).getTime(),
    granularity: span <= 31 ? "day" : span <= 120 ? "week" : "month",
  };
}
