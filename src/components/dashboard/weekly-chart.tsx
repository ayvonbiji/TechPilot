"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface DayPoint {
  date: string;
  day: string;
  completed: number;
  logged: boolean;
  isToday: boolean;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: DayPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] shadow-pop">
      <p className="font-medium">{p.date}</p>
      <p className="text-muted">
        {p.completed} task{p.completed === 1 ? "" : "s"} completed
      </p>
      <p className="text-muted">{p.logged ? "Work log written" : "No work log"}</p>
    </div>
  );
}

export function WeeklyChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(3, ...data.map((d) => d.completed));
  return (
    <figure>
      <div className="h-52 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -24 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              dy={6}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, max]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--subtle)", fontSize: 11 }}
              width={44}
            />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip />} />
            <Bar dataKey="completed" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Work-log marker row: one light per day, like a port strip. */}
      <div className="mt-2 grid grid-cols-7 pl-5 pr-1" aria-hidden>
        {data.map((d) => (
          <div key={d.date} className="flex justify-center" title={d.logged ? "Work log written" : "No work log"}>
            <span className={`led ${d.logged ? "text-ok" : "text-border-strong"}`} />
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex items-center gap-4 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden /> Tasks completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="led text-ok" aria-hidden /> Work log written
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Tasks completed and work logs over the last 7 days</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Tasks completed</th>
            <th>Work log</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{d.date}</td>
              <td>{d.completed}</td>
              <td>{d.logged ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
