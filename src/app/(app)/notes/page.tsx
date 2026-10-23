import type { Metadata } from "next";
import Link from "next/link";
import { Plus, SquareTerminal, Star } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { requireStaff } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { formatDate, localDateOf } from "@/lib/dates";
import { first, sanitizeSearch, truncate } from "@/lib/utils";
import type { Note } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { TagList } from "@/components/shared/tag-list";
import { FavoriteButton } from "@/components/notes/favorite-button";
import { ImportLibraryButton } from "@/components/notes/import-library-button";

export const metadata: Metadata = { title: "Notes & commands" };

function excerpt(md: string) {
  return truncate(
    md
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_`|-]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    180,
  );
}

export default async function NotesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const profile = await getProfile();
  const { workspace } = await requireStaff();
  const supabase = await createClient();
  const q = sanitizeSearch(first(sp.q));
  const category = first(sp.category);
  const fav = first(sp.fav);
  const tag = sanitizeSearch(first(sp.tag), 30).toLowerCase();
  const sort = first(sp.sort) ?? "updated";

  let query = supabase.from("notes").select("id,title,content,category,tags,is_favorite,is_demo,updated_at").eq("workspace_id", workspace.id).limit(500);
  if (q) query = query.or(`title.ilike."%${q}%",content.ilike."%${q}%",search.wfts(english)."${q}"`);
  if (category) query = query.eq("category", category.slice(0, 60));
  if (fav === "1") query = query.eq("is_favorite", true);
  if (tag) query = query.contains("tags", [tag]);
  if (sort === "title") query = query.order("title", { ascending: true });
  else if (sort === "created") query = query.order("created_at", { ascending: false });
  else query = query.order("is_favorite", { ascending: false }).order("updated_at", { ascending: false });

  const [{ data, error }, catRes] = await Promise.all([query, supabase.from("notes").select("category").eq("workspace_id", workspace.id).limit(2000)]);
  const notes = (data ?? []) as Note[];
  const categories = Array.from(new Set((catRes.data ?? []).map((c: { category: string }) => c.category))).sort();
  const total = catRes.data?.length ?? 0;
  const hasLibrary = categories.includes("Command reference");
  const filtered = Boolean(q || category || fav || tag);

  return (
    <>
      <PageHeader
        title="Notes & commands"
        description="Your technical notebook. Commands are reference material only; nothing here is ever run."
        actions={
          <>
            {!hasLibrary && <ImportLibraryButton autoRun />}
            <Button asChild><Link href="/notes/new"><Plus /> New note</Link></Button>
          </>
        }
      />
      <FilterBar
        className="mb-4"
        searchPlaceholder="Search notes and commands"
        filters={[
          { name: "category", label: "Category", options: categories.map((c) => ({ value: c, label: c })) },
          { name: "fav", label: "Favourites", options: [{ value: "1", label: "Favourites only" }] },
        ]}
        sort={{
          name: "sort",
          label: "Sort order",
          options: [
            { value: "updated", label: "Sort: recently edited" },
            { value: "created", label: "Sort: newest first" },
            { value: "title", label: "Sort: title A–Z" },
          ],
        }}
      />
      {tag && (
        <p className="mb-3 text-sm text-muted">
          Tagged <span className="font-medium text-foreground">#{tag}</span>{" "}
          <Link href="/notes" className="text-accent hover:underline">Show all</Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          Notes couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}
      {notes.length === 0 ? (
        <Panel>
          {filtered ? (
            <EmptyState icon={fav ? Star : SquareTerminal} title="No notes match" description="Try other words, or clear the filters." />
          ) : (
            <EmptyState
              icon={SquareTerminal}
              title="No notes yet"
              description="Import reference notes for ipconfig, ping, tracert, nslookup, netstat, sfc, DISM and PowerShell, or start your own."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ImportLibraryButton variant="primary" />
                  <Button asChild variant="secondary"><Link href="/notes/new"><Plus /> New note</Link></Button>
                </div>
              }
            />
          )}
        </Panel>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-muted" role="status">
            {filtered ? `${notes.length} of ${total} notes` : `${total} note${total === 1 ? "" : "s"}`}
          </p>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {notes.map((n) => (
              <li key={n.id}>
                <Panel className="flex h-full flex-col transition-colors hover:border-border-strong">
                  <div className="flex items-start gap-2 px-4 pt-3.5">
                    <Link href={`/notes/${n.id}`} className="min-w-0 flex-1">
                      <h2 className={`text-[15px] font-semibold leading-snug ${n.category === "Command reference" ? "font-mono text-[14px]" : ""}`}>{n.title}</h2>
                    </Link>
                    <FavoriteButton id={n.id} value={n.is_favorite} title={n.title} />
                  </div>
                  <Link href={`/notes/${n.id}`} className="flex-1 px-4 pb-3">
                    <p className="mt-1 line-clamp-3 text-[13px] text-muted">{excerpt(n.content) || "Empty note"}</p>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5 text-[12px] text-muted">
                    <span className="font-medium text-foreground/80">{n.category}</span>
                    <span>{formatDate(localDateOf(n.updated_at, profile.timezone), profile.date_format)}</span>
                    {n.is_demo && <DemoBadge />}
                  </div>
                  {n.tags.length > 0 && (
                    <div className="px-4 pb-3">
                      <TagList tags={n.tags.slice(0, 5)} hrefBase="/notes" />
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
