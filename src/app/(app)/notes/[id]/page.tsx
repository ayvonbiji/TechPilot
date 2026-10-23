import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { deleteNote } from "@/lib/actions/notes";
import type { Note } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/badge";
import { Markdown } from "@/components/shared/markdown";
import { TagList } from "@/components/shared/tag-list";
import { DeleteButton } from "@/components/shared/delete-button";
import { CopyButton } from "@/components/shared/copy-button";
import { FavoriteButton } from "@/components/notes/favorite-button";

export const metadata: Metadata = { title: "Note" };

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const n = data as Note;
  const fmt = { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format };

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/notes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Notes
      </Link>
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
          <Link href={`/notes?category=${encodeURIComponent(n.category)}`} className="hover:text-foreground">{n.category}</Link>
          <span>Edited {formatDateTime(n.updated_at, fmt)}</span>
          {n.is_demo && <DemoBadge />}
        </div>
        <div className="mt-2 flex items-start gap-2">
          <h1 className="flex-1 text-[1.6rem] font-semibold leading-tight tracking-[-0.01em]">{n.title}</h1>
          <FavoriteButton id={n.id} value={n.is_favorite} title={n.title} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm"><Link href={`/notes/${n.id}/edit`}><Pencil /> Edit</Link></Button>
          <CopyButton text={n.content} label="Copy Markdown" showLabel className="h-8 border border-border-strong bg-surface px-3 text-[13px] text-foreground hover:bg-surface-2" />
          <DeleteButton action={deleteNote.bind(null, n.id)} itemLabel="this note" redirectTo="/notes" />
        </div>
      </header>
      <Panel className="px-5 py-5 sm:px-7">
        {n.content.trim() ? <Markdown>{n.content}</Markdown> : <p className="text-sm text-muted">This note is empty.</p>}
      </Panel>
      {n.tags.length > 0 && <div className="mt-4"><TagList tags={n.tags} hrefBase="/notes" /></div>}
    </article>
  );
}
