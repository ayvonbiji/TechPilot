"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bucket } from "@/lib/service-metrics";

function Tip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] shadow-pop">
      <p className="font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          {p.name}: <span className="font-medium text-foreground tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Tickets created vs resolved per bucket. Two validated series colours; legend and a data table for screen readers. */
export function CreatedResolvedChart({ data, caption }: { data: Bucket[]; caption: string }) {
  const max = Math.max(3, ...data.map((d) => Math.max(d.created, d.resolved)));
  return (
    <figure>
      <div className="h-60 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} dy={6} />
            <YAxis allowDecimals={false} domain={[0, max]} tickLine={false} axisLine={false} tick={{ fill: "var(--subtle)", fontSize: 11 }} width={44} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<Tip />} />
            <Legend verticalAlign="top" align="right" height={28} iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
            <Bar name="Created" dataKey="created" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar name="Resolved" dataKey="resolved" fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead><tr><th>Period</th><th>Created</th><th>Resolved</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.key}><td>{d.label}</td><td>{d.created}</td><td>{d.resolved}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
