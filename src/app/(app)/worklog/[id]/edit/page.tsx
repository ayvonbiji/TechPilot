import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { longDate } from "@/lib/dates";
import { deleteWorkLog } from "@/lib/actions/worklog";
import type { WorkLog } from "@/lib/types";
import { PageHeader } from "@/components/shared/page-header";
import { DeleteButton } from "@/components/shared/delete-button";
import { WorkLogForm } from "@/components/worklog/worklog-form";

export const metadata: Metadata = { title: "Edit work log entry" };

export default async function EditWorkLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("work_logs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const entry = data as WorkLog;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/worklog" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Work log
      </Link>
      <PageHeader
        title="Edit entry"
        description={longDate(entry.log_date)}
        actions={<DeleteButton action={deleteWorkLog.bind(null, entry.id)} itemLabel="this entry" redirectTo="/worklog" />}
      />
      <WorkLogForm entry={entry} defaultDate={entry.log_date} />
    </div>
  );
}
