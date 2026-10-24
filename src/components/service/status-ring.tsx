"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface RingSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  href: string;
}

/**
 * Current tickets by status. Segment order matches the validated colour order
 * (each colour is checked against its neighbours). Counts are always printed in
 * the legend, so colour is never the only way to read it.
 */
export function StatusRing({ slices, closed }: { slices: RingSlice[]; closed: number }) {
  const total = slices.reduce((n, s) => n + s.value, 0);
  const data = total ? slices.filter((s) => s.value > 0) : [{ key: "none", label: "No tickets", value: 1, color: "var(--border)", href: "#" }];
  return (
    <figure className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col xl:flex-row xl:gap-5">
      <div className="relative h-40 w-40 shrink-0 xl:h-32 xl:w-32" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="100%" startAngle={90} endAngle={-270} paddingAngle={total && data.length > 1 ? 1.5 : 0} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.key} fill={d.color} />)}
            </Pie>
            {total > 0 && (
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[13px] shadow-pop">
                      <span className="font-medium">{payload[0].name}</span>: <span className="tabular-nums">{payload[0].value}</span>
                    </div>
                  ) : null
                }
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[1.7rem] font-semibold xl:text-2xl leading-none tabular-nums">{total}</span>
          <span className="mt-1 text-[12px] text-muted">Total</span>
        </div>
      </div>
      <figcaption className="w-full min-w-0">
        <ul className="space-y-2">
          {slices.map((s) => (
            <li key={s.key}>
              <a href={s.href} className="flex items-center gap-2.5 rounded-md px-1 py-0.5 text-[13px] hover:bg-surface-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="flex-1 whitespace-nowrap text-muted">{s.label}</span>
                <span className="font-semibold tabular-nums">{s.value}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 px-1 text-[12px] text-subtle">{closed} closed ticket{closed === 1 ? "" : "s"} not shown</p>
      </figcaption>
      <table className="sr-only">
        <caption>Tickets by status</caption>
        <tbody>{slices.map((s) => <tr key={s.key}><th scope="row">{s.label}</th><td>{s.value}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
