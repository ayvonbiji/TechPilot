"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { PrivacyNotice } from "@/components/shared/privacy-notice";
import { useActionForm } from "@/components/shared/use-action-form";
import { createRecord, updateRecord } from "@/lib/actions/knowledge";
import { setTicketField } from "@/lib/actions/tickets";
import { KB_CATEGORIES, KB_STATUSES, KB_VISIBILITY } from "@/lib/constants";
import { KB_TEMPLATES } from "@/lib/kb-templates";
import { troubleshootingSchema } from "@/lib/validation/schemas";
import type { TroubleshootingRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

type Values = {
  title: string;
  summary: string;
  visibility: string;
  problem_description: string;
  category: string;
  status: string;
  symptoms: string;
  possible_causes: string;
  diagnostic_steps: string;
  commands_used: string;
  solution: string;
  verification_steps: string;
  lessons_learned: string;
  tags: string;
};

const BLANK: Values = {
  title: "",
  summary: "",
  visibility: "workspace",
  problem_description: "",
  category: KB_CATEGORIES[0],
  status: "resolved",
  symptoms: "",
  possible_causes: "",
  diagnostic_steps: "",
  commands_used: "",
  solution: "",
  verification_steps: "",
  lessons_learned: "",
  tags: "",
};

const SECTIONS: { key: keyof Values; label: string; hint: string; rows: number; mono?: boolean }[] = [
  { key: "problem_description", label: "Problem description", hint: "The problem in a sentence or two, as a user would describe it.", rows: 3 },
  { key: "symptoms", label: "Symptoms", hint: "What was observed, in general terms.", rows: 4 },
  { key: "possible_causes", label: "Possible causes", hint: "What could explain the symptoms.", rows: 3 },
  { key: "diagnostic_steps", label: "Diagnostic steps", hint: "What you checked, in order, and what you found.", rows: 5 },
  { key: "commands_used", label: "Commands or tools used", hint: "One per line. Reference only — nothing here is run.", rows: 3, mono: true },
  { key: "solution", label: "Solution", hint: "What fixed it.", rows: 4 },
  { key: "verification_steps", label: "Verification steps", hint: "How you confirmed it was fixed.", rows: 3 },
  { key: "lessons_learned", label: "Lessons learned", hint: "What you'd do faster next time.", rows: 3 },
];

export function RecordForm({
  record,
  prefill,
  showVisibility = true,
  linkTicketId,
}: {
  record?: TroubleshootingRecord;
  /** Starting values, e.g. drafted from a resolved ticket. */
  prefill?: Partial<Values>;
  /** Visibility only matters in shared workspaces. */
  showVisibility?: boolean;
  /** Link the new article to this ticket after saving. */
  linkTicketId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(
    record
      ? {
          title: record.title,
          summary: record.summary ?? "",
          visibility: record.visibility ?? "workspace",
          problem_description: record.problem_description ?? "",
          category: record.category,
          status: record.status,
          symptoms: record.symptoms,
          possible_causes: record.possible_causes,
          diagnostic_steps: record.diagnostic_steps,
          commands_used: record.commands_used,
          solution: record.solution,
          verification_steps: record.verification_steps,
          lessons_learned: record.lessons_learned,
          tags: record.tags.join(", "),
        }
      : { ...BLANK, ...prefill },
  );
  const [template, setTemplate] = useState("blank");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState(false);
  const { pending, fieldErrors, formError, submit } = useActionForm(troubleshootingSchema);

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  function applyTemplate(id: string) {
    const t = KB_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const dirty = SECTIONS.some((s) => values[s.key]);
    if (dirty && !window.confirm("Replace the text in the sections with this template?")) return;
    setTemplate(id);
    setValues((v) => {
      const next: Values = { ...v };
      SECTIONS.forEach((s) => (next[s.key] = ""));
      Object.entries(t.values).forEach(([k, val]) => {
        if (typeof val === "string") (next as Record<string, string>)[k] = val;
      });
      return next;
    });
  }

  return (
    <form
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirmed) {
          setConfirmError(true);
          document.getElementById("privacy-confirm")?.focus();
          return;
        }
        submit(values, (input) => (record ? updateRecord(record.id, input) : createRecord(input)), {
          onSuccess: async (res) => {
            if (linkTicketId && res.data?.id) {
              await setTicketField(linkTicketId, "kb_article_id", res.data.id);
              router.push(`/tickets/${linkTicketId}`);
              return;
            }
            router.push(`/knowledge/${res.data?.id ?? record?.id ?? ""}`);
          },
        });
      }}
    >
      <div className="space-y-6">
        <FormError message={formError} />
        <Panel>
          <PanelBody className="space-y-4">
            <Field label="Title" htmlFor="title" required error={fieldErrors.title}>
              <Input id="title" value={values.title} onChange={set("title")} maxLength={200} placeholder="e.g. Laptop connects to Wi-Fi but has no internet" {...errorProps("title", fieldErrors.title)} />
            </Field>
            <Field label="Summary" htmlFor="summary" hint="One or two sentences shown in search results." error={fieldErrors.summary}>
              <Input id="summary" value={values.summary} onChange={set("summary")} maxLength={500} {...errorProps("summary", fieldErrors.summary)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="category" required error={fieldErrors.category}>
                <Select id="category" value={values.category} onChange={set("category")}>
                  {KB_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  {!(KB_CATEGORIES as readonly string[]).includes(values.category) && <option value={values.category}>{values.category} (earlier category)</option>}
                </Select>
              </Field>
              <Field label="Status" htmlFor="status" error={fieldErrors.status}>
                <Select id="status" value={values.status} onChange={set("status")}>
                  {KB_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="From diagnosis to resolution" description="Fill in what applies. Symptoms are required; a resolved record also needs the solution." />
          <PanelBody className="space-y-5">
            {SECTIONS.map((s, i) => (
              <div key={s.key} className="grid gap-3 sm:grid-cols-[28px_minmax(0,1fr)]">
                <span className="hidden h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-[12px] font-medium text-muted sm:flex" aria-hidden>
                  {i + 1}
                </span>
                <Field label={s.label} htmlFor={s.key} hint={s.hint} error={fieldErrors[s.key]} required={s.key === "symptoms" || (s.key === "solution" && values.status === "resolved")}>
                  <Textarea
                    id={s.key}
                    value={values[s.key]}
                    onChange={set(s.key)}
                    rows={s.rows}
                    className={cn(s.mono && "font-mono text-[13px]")}
                    spellCheck={!s.mono}
                    {...errorProps(s.key, fieldErrors[s.key])}
                  />
                </Field>
              </div>
            ))}
          </PanelBody>
        </Panel>
      </div>

      <aside className="space-y-4">
        {!record && (
          <Panel>
            <PanelHeader title="Template" />
            <PanelBody className="space-y-2">
              {KB_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  aria-pressed={template === t.id}
                  className={cn(
                    "block w-full cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors",
                    template === t.id ? "border-accent bg-accent-soft" : "border-border hover:border-border-strong",
                  )}
                >
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="block text-[12px] text-muted">{t.description}</span>
                </button>
              ))}
            </PanelBody>
          </Panel>
        )}
        <Panel className="lg:sticky lg:top-20">
          <PanelBody className="space-y-4">
            <Field label="Tags" htmlFor="tags" hint="Comma-separated, e.g. dns, wifi, driver" error={fieldErrors.tags}>
              <Input id="tags" value={values.tags} onChange={set("tags")} {...errorProps("tags", fieldErrors.tags)} />
            </Field>
            {showVisibility && (
              <fieldset>
                <legend className="text-[13px] font-medium">Who can see it</legend>
                <div className="mt-2 space-y-1.5">
                  {KB_VISIBILITY.map((o) => (
                    <label key={o.value} className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2", values.visibility === o.value ? "border-accent bg-accent-soft/50" : "border-border")}>
                      <input type="radio" name="visibility" value={o.value} checked={values.visibility === o.value} onChange={set("visibility")} className="mt-1 accent-[var(--accent)]" />
                      <span>
                        <span className="block text-sm font-medium">{o.label}</span>
                        <span className="block text-[12px] text-muted">{o.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <PrivacyNotice />
            <label className={cn("flex items-start gap-2.5 text-[13px]", confirmError && !confirmed && "text-danger")}>
              <input
                id="privacy-confirm"
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                checked={confirmed}
                onChange={(e) => {
                  setConfirmed(e.target.checked);
                  setConfirmError(false);
                }}
              />
              <span>This record contains no confidential company or customer information.</span>
            </label>
            {confirmError && !confirmed && <p className="text-[13px] text-danger" role="alert">Confirm this before saving.</p>}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={pending}>{pending ? "Saving…" : "Save record"}</Button>
              <Button asChild variant="secondary"><Link href={record ? `/knowledge/${record.id}` : "/knowledge"}>Cancel</Link></Button>
            </div>
          </PanelBody>
        </Panel>
      </aside>
    </form>
  );
}
