import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentMembership } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/ui/card";
import { Markdown } from "@/components/shared/markdown";

export const metadata: Metadata = { title: "Help article" };

const SECTIONS = [
  ["problem_description", "The problem"],
  ["symptoms", "Symptoms"],
  ["solution", "Solution"],
  ["verification_steps", "Check it worked"],
] as const;

/** Customer view of a public article: the practical sections, not internal diagnostics. */
export default async function PortalArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const m = await getCurrentMembership();
  const supabase = await createClient();
  const { data } = await supabase
    .from("troubleshooting_records")
    .select("id,title,summary,problem_description,symptoms,solution,verification_steps,category,visibility,workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.visibility !== "public" || data.workspace_id !== m.workspace.id) notFound();
  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/portal/knowledge" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Help articles
      </Link>
      <p className="text-[13px] text-muted">{data.category}</p>
      <h1 className="mt-1 text-[1.5rem] font-semibold leading-tight">{data.title}</h1>
      {data.summary && <p className="mt-2 text-sm text-muted">{data.summary}</p>}
      <Panel className="mt-5 divide-y divide-border">
        {SECTIONS.filter(([k]) => String(data[k] ?? "").trim()).map(([k, label]) => (
          <section key={k} className="px-5 py-4">
            <h2 className="text-sm font-semibold">{label}</h2>
            <Markdown breaks className="mt-1.5 text-sm">{String(data[k])}</Markdown>
          </section>
        ))}
      </Panel>
      <p className="mt-4 text-sm">
        Still stuck? <Link href="/portal/new" className="text-accent hover:underline">Raise a request</Link>
      </p>
    </article>
  );
}
