import type { Metadata } from "next";
import Link from "next/link";
import { Award, GraduationCap, Plus } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, todayIn } from "@/lib/dates";
import { labelFor, PROFICIENCY_LEVELS, SKILL_CATEGORIES, SKILL_STATUSES } from "@/lib/constants";
import { first } from "@/lib/utils";
import type { Skill } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Badge, DemoBadge, type BadgeTone } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { SkillDialog } from "@/components/learning/skill-dialog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Learning tracker" };

const STATUS_TONE: Record<Skill["status"], BadgeTone> = { not_started: "neutral", learning: "accent", practising: "info", completed: "ok" };

/** Five pips showing current level, with the target pip outlined. */
function LevelPips({ current, target }: { current: number; target: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Level ${current} of target ${target}`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn(
            "h-2 w-4 rounded-sm",
            n <= current ? "bg-accent" : n <= target ? "border border-accent/50 bg-accent-soft" : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

function progressOf(list: Skill[]) {
  const target = list.reduce((n, s) => n + s.target_level, 0);
  const current = list.reduce((n, s) => n + Math.min(s.current_level, s.target_level), 0);
  return { current, target, pct: target ? Math.round((current / target) * 100) : 0 };
}

export default async function LearningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const profile = await getProfile();
  const today = todayIn(profile.timezone);
  const supabase = await createClient();
  const kind = first(sp.kind);
  const status = first(sp.status);
  const q = (first(sp.q) ?? "").trim().toLowerCase().slice(0, 100);

  const { data, error } = await supabase.from("skills").select("*").order("created_at");
  const all = (data ?? []) as Skill[];
  const skills = all.filter(
    (s) =>
      (!kind || s.kind === kind) &&
      (!status || s.status === status) &&
      (!q || `${s.name} ${s.notes} ${s.resources}`.toLowerCase().includes(q)),
  );
  const overall = progressOf(all.filter((s) => s.kind === "skill"));
  const certs = all.filter((s) => s.kind === "certification");
  const counts = Object.fromEntries(SKILL_STATUSES.map((st) => [st.value, all.filter((s) => s.status === st.value).length]));
  const filtered = Boolean(kind || status || q);

  return (
    <>
      <PageHeader
        title="Learning tracker"
        description="Skills and certifications on your path into IT support, networking, systems, cloud and security."
        actions={
          <>
            <Button asChild variant="secondary"><Link href="?new=certification" scroll={false}><Award /> Add certification</Link></Button>
            <Button asChild><Link href="?new=skill" scroll={false}><Plus /> Add skill</Link></Button>
          </>
        }
      />

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          Your tracker couldn&apos;t be loaded. Refresh to try again.
        </p>
      )}

      <Panel className="mb-5 grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium">Overall skill progress toward your targets</p>
            <p className="text-sm font-semibold tabular-nums">{overall.pct}%</p>
          </div>
          <Progress className="mt-2 h-2" value={overall.current} max={Math.max(overall.target, 1)} label="Overall skill progress" />
          <p className="mt-2 text-[12px] text-muted">{overall.current} of {overall.target} target levels reached across {all.length - certs.length} skills</p>
        </div>
        <dl className="grid grid-cols-5 gap-4 text-center">
          {SKILL_STATUSES.map((st) => (
            <div key={st.value}>
              <dt className="text-[12px] text-muted">{st.label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{counts[st.value]}</dd>
            </div>
          ))}
          <div>
            <dt className="text-[12px] text-muted">Certs earned</dt>
            <dd className="text-lg font-semibold tabular-nums">{certs.filter((c) => c.status === "completed").length}/{certs.length}</dd>
          </div>
        </dl>
      </Panel>

      <FilterBar
        className="mb-5"
        searchPlaceholder="Search skills"
        filters={[
          { name: "kind", label: "Type", options: [{ value: "skill", label: "Skills" }, { value: "certification", label: "Certifications" }] },
          { name: "status", label: "Status", options: SKILL_STATUSES },
        ]}
      />

      {all.length === 0 ? (
        <Panel>
          <EmptyState
            icon={GraduationCap}
            title="Start your roadmap"
            description="Add a skill from any stage below, set where you are now and where you want to be."
            action={<Button asChild><Link href="?new=skill" scroll={false}><Plus /> Add your first skill</Link></Button>}
          />
        </Panel>
      ) : null}

      <h2 className="mb-3 text-[15px] font-semibold">Roadmap</h2>
      <ol className="space-y-3">
        {SKILL_CATEGORIES.map((cat, i) => {
          const items = skills.filter((s) => s.category === cat);
          if (filtered && !items.length) return null;
          if (cat === "Other" && !items.length) return null;
          const p = progressOf(items.filter((s) => s.kind === "skill"));
          return (
            <li key={cat}>
              <Panel>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-[12px] font-semibold text-muted" aria-hidden>
                    {cat === "Other" ? "+" : i + 1}
                  </span>
                  <h3 className="min-w-0 flex-1 text-sm font-semibold">{cat}</h3>
                  {items.some((s) => s.kind === "skill") && (
                    <div className="flex w-full items-center gap-3 sm:w-48">
                      <Progress value={p.current} max={Math.max(p.target, 1)} tone={p.pct === 100 ? "ok" : "accent"} label={`${cat} progress`} />
                      <span className="w-9 text-right text-[12px] tabular-nums text-muted">{p.pct}%</span>
                    </div>
                  )}
                  <Button asChild variant="ghost" size="sm"><Link href={`?new=skill&category=${encodeURIComponent(cat)}`} scroll={false} aria-label={`Add a skill to ${cat}`}><Plus /> Add</Link></Button>
                </div>
                {items.length > 0 ? (
                  <ul className="divide-y divide-border border-t border-border">
                    {items.map((s) => (
                      <li key={s.id}>
                        <Link href={`?edit=${s.id}`} scroll={false} className="grid gap-2 px-5 py-3 hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5">
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              {s.kind === "certification" && <Award className="h-4 w-4 shrink-0 text-warn" aria-label="Certification" />}
                              <span className="truncate text-sm font-medium">{s.name}</span>
                              {s.is_demo && <DemoBadge />}
                            </span>
                            {s.notes && <span className="mt-0.5 block truncate text-[12px] text-muted">{s.notes}</span>}
                          </span>
                          <span className="flex items-center gap-2 text-[12px] text-muted">
                            <LevelPips current={s.current_level} target={s.target_level} />
                            <span className="w-20">{labelFor(PROFICIENCY_LEVELS, s.current_level)}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge tone={STATUS_TONE[s.status]}>{labelFor(SKILL_STATUSES, s.status)}</Badge>
                            {s.completed_on && <span className="text-[12px] text-muted">{formatDate(s.completed_on, profile.date_format)}</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Panel>
            </li>
          );
        })}
      </ol>

      <SkillDialog skills={all} today={today} />
    </>
  );
}
