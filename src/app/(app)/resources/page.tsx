import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark as BookmarkIcon, ExternalLink, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { BOOKMARK_CATEGORIES } from "@/lib/constants";
import { deleteBookmark } from "@/lib/actions/bookmarks";
import { first } from "@/lib/utils";
import type { Bookmark } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import { BookmarkDialog } from "@/components/resources/bookmark-dialog";
import { StarterResourcesButton } from "@/components/resources/starter-button";

export const metadata: Metadata = { title: "Resources" };

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  await requireUser();
  const supabase = await createClient();
  const category = first(sp.category);
  const q = (first(sp.q) ?? "").trim().toLowerCase().slice(0, 100);
  const { data, error } = await supabase.from("bookmarks").select("*").order("title");
  const all = (data ?? []) as Bookmark[];
  const list = all.filter(
    (b) => (!category || b.category === category) && (!q || `${b.title} ${b.url} ${b.notes}`.toLowerCase().includes(q)),
  );
  const groups = BOOKMARK_CATEGORIES.map((c) => ({ category: c, items: list.filter((b) => b.category === c) })).filter((g) => g.items.length);

  return (
    <>
      <PageHeader
        title="Resources"
        description="Documentation, tutorials, tools and certification material you want to come back to."
        actions={
          <>
            <StarterResourcesButton />
            <Button asChild><Link href="?new=1" scroll={false}><Plus /> Save a link</Link></Button>
          </>
        }
      />
      <FilterBar
        className="mb-5"
        searchPlaceholder="Search links"
        filters={[{ name: "category", label: "Category", options: BOOKMARK_CATEGORIES.map((c) => ({ value: c, label: c })) }]}
      />
      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          Links couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}
      {groups.length === 0 ? (
        <Panel>
          {all.length ? (
            <EmptyState icon={BookmarkIcon} title="No links match" description="Try other words, or clear the filters." />
          ) : (
            <EmptyState
              icon={BookmarkIcon}
              title="No saved links yet"
              description="Save the docs and courses you use most, or start with a short list of verified recommendations."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <StarterResourcesButton variant="primary" />
                  <Button asChild variant="secondary"><Link href="?new=1" scroll={false}><Plus /> Save a link</Link></Button>
                </div>
              }
            />
          )}
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {groups.map((g) => (
            <Panel key={g.category}>
              <PanelHeader title={g.category} description={`${g.items.length} link${g.items.length === 1 ? "" : "s"}`} />
              <ul className="divide-y divide-border">
                {g.items.map((b) => (
                  <li key={b.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <a href={b.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1.5 text-sm font-medium hover:text-accent">
                        {b.title}
                        <ExternalLink className="h-3.5 w-3.5 text-subtle group-hover:text-accent" aria-hidden />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                      <p className="text-[12px] text-subtle">{host(b.url)}</p>
                      {b.notes && <p className="mt-1 text-[13px] text-muted">{b.notes}</p>}
                    </div>
                    {b.is_demo && <DemoBadge />}
                    <div className="flex shrink-0">
                      <Button asChild variant="ghost" size="icon-sm"><Link href={`?edit=${b.id}`} scroll={false} aria-label={`Edit ${b.title}`}><Pencil /></Link></Button>
                      <DeleteButton action={deleteBookmark.bind(null, b.id)} itemLabel={`"${b.title}"`} iconOnly />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
      <BookmarkDialog bookmarks={all} />
    </>
  );
}
