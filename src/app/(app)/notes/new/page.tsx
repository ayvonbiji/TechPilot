import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { requireStaff } from "@/lib/workspace";
import { PageHeader } from "@/components/shared/page-header";
import { NoteForm } from "@/components/notes/note-form";

export const metadata: Metadata = { title: "New note" };

export default async function NewNotePage() {
  await requireUser();
  const { workspace } = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("notes").select("category").eq("workspace_id", workspace.id).limit(2000);
  const categories = Array.from(new Set((data ?? []).map((c: { category: string }) => c.category)));
  return (
    <>
      <Link href="/notes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Notes
      </Link>
      <PageHeader title="New note" />
      <NoteForm categories={categories} />
    </>
  );
}
