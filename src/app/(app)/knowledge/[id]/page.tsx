import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { deleteRecord } from "@/lib/actions/knowledge";
import type { TroubleshootingRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { DemoBadge } from "@/components/ui/badge";
import { LedLabel } from "@/components/shared/led";
import { TagList } from "@/components/shared/tag-list";
import { CopyButton } from "@/components/shared/copy-button";
import { DeleteButton } from "@/components/shared/delete-button";
import { Markdown } from "@/components/shared/markdown";

export const metadata: Metadata = { title: "Troubleshooting record" };

const SECTIONS: { key: keyof TroubleshootingRecord; label: string; mono?: boolean }[] = [
  { key: "symptoms", label: "Symptoms" },
  { key: "possible_causes", label: "Possible causes" },
  { key: "diagnostic_steps", label: "Diagnostic steps" },
  { key: "commands_used", label: "Commands and tools", mono: true },
  { key: "solution", label: "Solution" },
  { key: "verification_steps", label: "Verification" },
  { key: "lessons_learned", label: "Lessons learned" },
];

function toMarkdown(r: TroubleshootingRecord) {
  const parts = [`# ${r.title}`, `Category: ${r.category}  \nStatus: ${r.status}`];
  for (const s of SECTIONS) {
    const v = String(r[s.key] ?? "").trim();
    if (v) parts.push(`## ${s.label}\n\n${s.mono ? "```\n" + v + "\n```" : v}`);
  }
  if (r.tags.length) parts.push(`Tags: ${r.tags.map((t) => `#${t}`).join(" ")}`);
  return parts.join("\n\n");
}

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("troubleshooting_records").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as TroubleshootingRecord;
  const filled = SECTIONS.filter((s) => String(r[s.key] ?? "").trim());
  const fmt = { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format };

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/knowledge" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Knowledge base
      </Link>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
          <LedLabel tone={r.status === "resolved" ? "ok" : "warn"} pulse={r.status === "investigating"}>
            {r.status === "resolved" ? "Resolved" : "Investigating"}
          </LedLabel>
          <Link href={`/knowledge?category=${encodeURIComponent(r.category)}`} className="hover:text-foreground">{r.category}</Link>
          {r.is_demo && <DemoBadge />}
        </div>
        <h1 className="mt-2 text-[1.6rem] font-semibold leading-tight tracking-[-0.01em]">{r.title}</h1>
        <p className="mt-1 text-[13px] text-subtle">
          Created {formatDateTime(r.created_at, fmt)}
          {r.updated_at !== r.created_at && <>, edited {formatDateTime(r.updated_at, fmt)}</>}
        </p>
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm"><Link href={`/knowledge/${r.id}/edit`}><Pencil /> Edit</Link></Button>
          <CopyButton text={toMarkdown(r)} label="Copy as Markdown" showLabel className="h-8 border border-border-strong bg-surface px-3 text-[13px] text-foreground hover:bg-surface-2" />
          <DeleteButton action={deleteRecord.bind(null, r.id)} itemLabel="this record" redirectTo="/knowledge" />
        </div>
      </header>

      <Panel>
        <ol className="divide-y divide-border">
          {filled.map((s, i) => {
            const value = String(r[s.key]).trim();
            return (
              <li key={s.key} className="grid gap-2 px-5 py-4 sm:grid-cols-[28px_minmax(0,1fr)] sm:gap-4">
                <span className="hidden h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-[12px] font-medium text-muted sm:flex" aria-hidden>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{s.label}</h2>
                  {s.mono ? (
                    <div className="relative mt-2">
                      <pre className="overflow-x-auto rounded-lg bg-code-bg px-4 py-3 pr-12 font-mono text-[13px] leading-relaxed text-code-fg">{value}</pre>
                      <CopyButton text={value} label="Copy commands" className="absolute right-2 top-2 bg-white/10 text-code-fg hover:bg-white/20" />
                    </div>
                  ) : (
                    <Markdown breaks className="mt-1.5 text-sm">{value}</Markdown>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>
      {r.tags.length > 0 && (
        <div className="mt-4">
          <TagList tags={r.tags} hrefBase="/knowledge" />
        </div>
      )}
    </article>
  );
}
