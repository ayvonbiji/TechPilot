import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isIsoDate, longDate, todayIn } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { WorkLogForm } from "@/components/worklog/worklog-form";

export const metadata: Metadata = { title: "New work log entry" };

export default async function NewWorkLogPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: raw } = await searchParams;
  const profile = await getProfile();
  const date = raw && isIsoDate(raw) ? raw : todayIn(profile.timezone);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("work_logs").select("id").eq("log_date", date).maybeSingle();
  if (existing) redirect(`/worklog/${existing.id}/edit`);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/worklog" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Work log
      </Link>
      <PageHeader title="New entry" description={longDate(date)} />
      <WorkLogForm defaultDate={date} />
    </div>
  );
}
