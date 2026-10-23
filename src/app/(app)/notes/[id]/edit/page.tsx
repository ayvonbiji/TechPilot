import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { Note } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { NoteForm } from "@/components/notes/note-form";

export const metadata: Metadata = { title: "Edit note" };

export default async function EditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data }, cats] = await Promise.all([
    supabase.from("notes").select("*").eq("id", id).maybeSingle(),
    supabase.from("notes").select("category").limit(2000),
  ]);
  if (!data) notFound();
  const categories = Array.from(new Set((cats.data ?? []).map((c: { category: string }) => c.category)));
  return (
    <>
      <Link href={`/notes/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to note
      </Link>
      <PageHeader title="Edit note" />
      <NoteForm note={data as Note} categories={categories} />
    </>
  );
}
