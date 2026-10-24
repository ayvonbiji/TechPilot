import { RANGES, type ResolvedPeriod } from "@/lib/period";
import { FilterBar, type FilterDef } from "@/components/shared/filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Date-range presets plus a custom from/to form, and any extra filters. All in the URL. */
export function PeriodControls({ period, filters, path, keep }: { period: ResolvedPeriod; filters: FilterDef[]; path: string; keep: Record<string, string | undefined> }) {
  return (
    <div className="no-print mb-5 space-y-2">
      <FilterBar search={false} filters={[{ name: "range", label: "Period", emptyLabel: "Last 30 days", options: [...RANGES.filter((r) => r.value !== "30d"), { value: "custom", label: "Custom dates" }] }, ...filters]} />
      {period.range === "custom" || keep.range === "custom" ? (
        <form action={path} className="flex flex-wrap items-end gap-2 text-sm">
          {Object.entries(keep).map(([k, v]) => (v && !["range", "from", "to"].includes(k) ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <input type="hidden" name="range" value="custom" />
          <label className="flex flex-col gap-1 text-[12px] text-muted">From<Input type="date" name="from" defaultValue={period.startDate} className="w-40" /></label>
          <label className="flex flex-col gap-1 text-[12px] text-muted">To<Input type="date" name="to" defaultValue={period.endDate} className="w-40" /></label>
          <Button type="submit" variant="secondary">Apply</Button>
        </form>
      ) : null}
    </div>
  );
}
