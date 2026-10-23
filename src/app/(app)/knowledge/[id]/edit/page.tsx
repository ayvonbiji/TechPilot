import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { requireStaff } from "@/lib/workspace";
import type { TroubleshootingRecord } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { RecordForm } from "@/components/knowledge/record-form";

export const metadata: Metadata = { title: "Edit record" };

export default async function EditRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const { workspace } = await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("troubleshooting_records").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const record = data as TroubleshootingRecord;
  return (
    <>
      <Link href={`/knowledge/${id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to record
      </Link>
      <PageHeader title="Edit record" />
      <RecordForm record={record} showVisibility={workspace.type !== "personal"} />
    </>
  );
}
