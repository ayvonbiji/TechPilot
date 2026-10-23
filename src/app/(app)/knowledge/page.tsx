import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { requireStaff } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { formatDate, localDateOf } from "@/lib/dates";
import { ALL_KB_CATEGORIES, KB_CATEGORIES, KB_STATUSES, KB_VISIBILITY } from "@/lib/constants";
import { VisibilityBadge } from "@/components/knowledge/visibility-badge";
import { first, sanitizeSearch, truncate } from "@/lib/utils";
import type { TroubleshootingRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { LedLabel } from "@/components/shared/led";
import { TagList } from "@/components/shared/tag-list";

export const metadata: Metadata = { title: "Troubleshooting knowledge base" };

const SORTS = [
  { value: "newest", label: "Sort: newest first" },
  { value: "oldest", label: "Sort: oldest first" },
  { value: "updated", label: "Sort: recently edited" },
  { value: "title", label: "Sort: title A–Z" },
] as const;

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const profile = await getProfile();
  const { workspace } = await requireStaff();
  const supabase = await createClient();
  const q = sanitizeSearch(first(sp.q));
  const category = first(sp.category);
  const status = first(sp.status);
  const tag = sanitizeSearch(first(sp.tag), 30).toLowerCase();
  const sort = first(sp.sort) ?? "newest";

  let query = supabase
    .from("troubleshooting_records")
    .select("id,title,summary,visibility,category,status,symptoms,solution,tags,created_at,updated_at,is_demo")
    .eq("workspace_id", workspace.id)
    .limit(500);
  if (q) {
    // Full-text search across every section, plus substring matches on title,
    // commands and tags (full-text alone misses things like "/flushdns").
    query = query.or(
      `search.wfts(english)."${q}",title.ilike."%${q}%",commands_used.ilike."%${q}%",symptoms.ilike."%${q}%"`,
    );
  }
  if (category && (ALL_KB_CATEGORIES as readonly string[]).includes(category)) query = query.eq("category", category);
  const visibility = first(sp.visibility);
  if (visibility && ["private", "workspace", "public"].includes(visibility)) query = query.eq("visibility", visibility);
  if (status && KB_STATUSES.some((s) => s.value === status)) query = query.eq("status", status);
  if (tag) query = query.contains("tags", [tag]);
  if (sort === "oldest") query = query.order("created_at", { ascending: true });
  else if (sort === "updated") query = query.order("updated_at", { ascending: false });
  else if (sort === "title") query = query.order("title", { ascending: true });
  else query = query.order("created_at", { ascending: false });

  const [{ data, error }, countRes] = await Promise.all([
    query,
    supabase.from("troubleshooting_records").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
  ]);
  const records = (data ?? []) as TroubleshootingRecord[];
  const total = countRes.count ?? 0;
  const filtered = Boolean(q || category || status || tag);

  return (
    <>
      <PageHeader
        title="Troubleshooting knowledge base"
        description={workspace.type === "personal" ? "Problems you've worked through, documented from symptoms to verified fix." : `Shared with the technicians in ${workspace.name}.`}
        actions={<Button asChild><Link href="/knowledge/new"><Plus /> New record</Link></Button>}
      />
      <FilterBar
        className="mb-4"
        searchPlaceholder="Search symptoms, causes, commands, solutions"
        filters={[
          { name: "category", label: "Category", options: KB_CATEGORIES.map((c) => ({ value: c, label: c })) },
          { name: "status", label: "Status", options: KB_STATUSES },
          ...(workspace.type === "personal" ? [] : [{ name: "visibility", label: "Visibility", options: KB_VISIBILITY.map((v) => ({ value: v.value, label: v.label })) }]),
        ]}
        sort={{ name: "sort", label: "Sort order", options: SORTS }}
      />
      {tag && (
        <p className="mb-3 text-sm text-muted">
          Tagged <span className="font-medium text-foreground">#{tag}</span>{" "}
          <Link href="/knowledge" className="text-accent hover:underline">Show all</Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          Records couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}
      {records.length === 0 ? (
        <Panel>
          {filtered ? (
            <EmptyState icon={BookOpen} title="No records match" description="Try other words, or clear the filters." />
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Your knowledge base is empty"
              description="Each record you write is a fix you won't have to work out twice. Templates help you structure it."
              action={<Button asChild><Link href="/knowledge/new"><Plus /> Write your first record</Link></Button>}
            />
          )}
        </Panel>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-muted" role="status">
            {filtered ? `${records.length} of ${total} records` : `${total} record${total === 1 ? "" : "s"}`}
          </p>
          <ul className="grid gap-3">
            {records.map((r) => (
              <li key={r.id}>
                <Panel className="transition-colors hover:border-border-strong">
                  <Link href={`/knowledge/${r.id}`} className="block px-5 py-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-[15px] font-semibold">{r.title}</h2>
                      {r.is_demo && <DemoBadge />}
                      {workspace.type !== "personal" && r.visibility && <VisibilityBadge visibility={r.visibility} />}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                      <LedLabel tone={r.status === "resolved" ? "ok" : "warn"} pulse={r.status === "investigating"}>
                        {r.status === "resolved" ? "Resolved" : "Investigating"}
                      </LedLabel>
                      <span>{r.category}</span>
                      <span>{formatDate(localDateOf(r.created_at, profile.timezone), profile.date_format)}</span>
                    </div>
                    {(r.summary || r.symptoms) && <p className="mt-2 line-clamp-2 text-sm text-muted">{truncate((r.summary || r.symptoms).replace(/\s+/g, " "), 240)}</p>}
                  </Link>
                  {r.tags.length > 0 && (
                    <div className="px-5 pb-4">
                      <TagList tags={r.tags} hrefBase="/knowledge" />
                    </div>
                  )}
                </Panel>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
