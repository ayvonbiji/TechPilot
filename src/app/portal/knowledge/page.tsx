import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { getCurrentMembership } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { first, sanitizeSearch, truncate } from "@/lib/utils";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Help articles" };

export default async function PortalKnowledge({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const m = await getCurrentMembership();
  const q = sanitizeSearch(first(sp.q));
  const supabase = await createClient();
  // RLS returns only articles marked Public in this workspace.
  let query = supabase.from("troubleshooting_records").select("id,title,summary,symptoms,category").eq("workspace_id", m.workspace.id).eq("visibility", "public").order("title").limit(100);
  if (q) query = query.or(`search.wfts(english)."${q}",title.ilike."%${q}%"`);
  const { data } = await query;
  const articles = (data ?? []) as { id: string; title: string; summary: string; symptoms: string; category: string }[];
  return (
    <>
      <h1 className="text-[1.6rem] font-semibold leading-tight">Help articles</h1>
      <p className="mt-1 mb-5 text-sm text-muted">Fixes and how-tos shared by the support team. If these don&apos;t help, raise a request.</p>
      <form action="/portal/knowledge" className="mb-4">
        <label htmlFor="kb-q" className="sr-only">Search help articles</label>
        <input id="kb-q" name="q" defaultValue={first(sp.q)} placeholder="Search, e.g. printer or VPN" maxLength={100} className="h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm" />
      </form>
      <Panel>
        {articles.length === 0 ? (
          <EmptyState icon={BookOpen} title={q ? "No articles match" : "No help articles yet"} description={q ? "Try different words, or raise a request." : "The support team hasn't published any articles yet."} />
        ) : (
          <ul className="divide-y divide-border">
            {articles.map((a) => (
              <li key={a.id}>
                <Link href={`/portal/knowledge/${a.id}`} className="block px-5 py-3.5 hover:bg-surface-2">
                  <span className="block font-medium">{a.title}</span>
                  <span className="mt-0.5 block text-[13px] text-muted">{truncate((a.summary || a.symptoms).replace(/\s+/g, " "), 180)}</span>
                  <span className="mt-1 block text-[12px] text-subtle">{a.category}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
