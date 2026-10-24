import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { TYPE_LABELS, type WorkspaceType } from "@/lib/workspace";
import { Panel } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Platform overview" };

/**
 * Platform owner view: every workspace with counts only, no ticket contents.
 * Platform admins are granted in SQL (insert into public.platform_admins), never from the app.
 */
export default async function PlatformPage() {
  const user = await requireUser();
  const profile = await getProfile();
  const supabase = await createClient();
  const { data: admin } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) notFound();
  const { data } = await supabase.rpc("platform_overview");
  const rows = (data ?? []) as { id: string; name: string; type: WorkspaceType; created_at: string; members: number; tickets: number; open_tickets: number }[];
  const fmt = { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format };
  const totals = rows.reduce((t, r) => ({ ws: t.ws + 1, members: t.members + Number(r.members), tickets: t.tickets + Number(r.tickets) }), { ws: 0, members: 0, tickets: 0 });

  return (
    <>
      <PageHeader title="Platform overview" description="All workspaces on this installation. Counts only; ticket contents stay private to each workspace." />
      <dl className="mb-5 grid grid-cols-3 gap-4">
        {[["Workspaces", totals.ws], ["Memberships", totals.members], ["Tickets", totals.tickets]].map(([k, v]) => (
          <Panel key={k} className="px-5 py-4"><dt className="text-[12px] text-muted">{k}</dt><dd className="text-2xl font-semibold tabular-nums">{v}</dd></Panel>
        ))}
      </dl>
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[12px] text-muted">
                <th scope="col" className="py-2.5 pl-5 pr-3 font-medium">Workspace</th>
                <th scope="col" className="py-2.5 pr-3 font-medium">Type</th>
                <th scope="col" className="py-2.5 pr-3 text-right font-medium">Members</th>
                <th scope="col" className="py-2.5 pr-3 text-right font-medium">Tickets</th>
                <th scope="col" className="py-2.5 pr-3 text-right font-medium">Open</th>
                <th scope="col" className="py-2.5 pr-5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 pl-5 pr-3 font-medium">{r.name}</td>
                  <td className="py-2.5 pr-3 text-muted">{TYPE_LABELS[r.type]}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.members}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.tickets}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{r.open_tickets}</td>
                  <td className="py-2.5 pr-5 text-[12px] text-muted">{formatDateTime(r.created_at, fmt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
