import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Inbox, Search, Wrench } from "lucide-react";
import { requireStaff } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { getClients } from "@/lib/ticket-data";
import { first, sanitizeSearch, truncate } from "@/lib/utils";
import type { Ticket } from "@/lib/tickets";
import { Panel, PanelHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusPill } from "@/components/tickets/ticket-badges";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Search" };

/** One search across the current workspace's tickets, clients and knowledge base. RLS limits every query. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { workspace } = await requireStaff();
  const raw = (first(sp.q) ?? "").trim().slice(0, 100);
  const q = sanitizeSearch(raw);
  const shared = workspace.type !== "personal";

  let tickets: Ticket[] = [];
  let articles: { id: string; title: string; summary: string; symptoms: string; category: string }[] = [];
  let clients: { id: string; name: string; is_active: boolean }[] = [];
  if (q) {
    const supabase = await createClient();
    const ref = q.replace(/\s+/g, "").toUpperCase();
    const [t, a, allClients] = await Promise.all([
      supabase
        .from("tickets")
        .select("*")
        .eq("workspace_id", workspace.id)
        .or(`reference.ilike."%${ref}%",subject.ilike."%${q}%",search.wfts(english)."${q}"`)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("troubleshooting_records")
        .select("id,title,summary,symptoms,category")
        .eq("workspace_id", workspace.id)
        .or(`search.wfts(english)."${q}",title.ilike."%${q}%",commands_used.ilike."%${q}%"`)
        .limit(10),
      shared ? getClients(workspace.id) : Promise.resolve([]),
    ]);
    tickets = (t.data ?? []) as Ticket[];
    articles = (a.data ?? []) as typeof articles;
    const needle = q.toLowerCase();
    clients = allClients.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 10);
  }
  const total = tickets.length + articles.length + clients.length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Search" description={`Tickets${shared ? ", clients" : ""} and knowledge base in ${workspace.name}.`} />
      <form action="/search" role="search" className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <label htmlFor="search-page-q" className="sr-only">Search</label>
        <input id="search-page-q" name="q" type="search" defaultValue={raw} maxLength={100} autoFocus placeholder="Ticket number, subject, client or article" className="h-11 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-sm" />
      </form>

      {!q ? null : total === 0 ? (
        <Panel><EmptyState icon={Search} title={`Nothing found for "${raw}"`} description="Try a ticket number like NW-00012, part of a subject, or a client name." /></Panel>
      ) : (
        <div className="space-y-5">
          <p className="text-[13px] text-muted" role="status">{total} result{total === 1 ? "" : "s"}</p>
          {tickets.length > 0 && (
            <Panel>
              <PanelHeader title={<span className="flex items-center gap-2"><Inbox className="h-4 w-4 text-muted" aria-hidden /> Tickets</span>} />
              <ul className="divide-y divide-border">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2">
                      <span className="w-20 shrink-0 font-mono text-[12px] text-muted">{t.reference}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.subject}</span>
                      <StatusPill status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {clients.length > 0 && (
            <Panel>
              <PanelHeader title={<span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted" aria-hidden /> Clients</span>} />
              <ul className="divide-y divide-border">
                {clients.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}`} className="block px-5 py-2.5 text-sm font-medium hover:bg-surface-2">
                      {c.name}{!c.is_active && <span className="ml-2 text-[12px] font-normal text-muted">(inactive)</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          {articles.length > 0 && (
            <Panel>
              <PanelHeader title={<span className="flex items-center gap-2"><Wrench className="h-4 w-4 text-muted" aria-hidden /> Knowledge base</span>} />
              <ul className="divide-y divide-border">
                {articles.map((a) => (
                  <li key={a.id}>
                    <Link href={`/knowledge/${a.id}`} className="block px-5 py-2.5 hover:bg-surface-2">
                      <span className="block text-sm font-medium">{a.title}</span>
                      <span className="block truncate text-[12px] text-muted">{a.category}: {truncate((a.summary || a.symptoms).replace(/\s+/g, " "), 140)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
