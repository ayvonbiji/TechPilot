"use client";

import { useState, useTransition } from "react";
import { Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { createAutomationRule, deleteAutomationRule, setAutomationRuleActive } from "@/lib/actions/automation";
import { automationRuleSchema } from "@/lib/validation/schemas";
import { priorityLabel, TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/tickets";
import { cn } from "@/lib/utils";

export interface RuleRow {
  id: string;
  name: string;
  is_active: boolean;
  match_category: string | null;
  match_priority: string | null;
  action: "assign" | "notify";
  target_user_id: string;
}

function describe(r: RuleRow, names: Record<string, string>) {
  const when = [r.match_category ? `category is ${r.match_category}` : null, r.match_priority ? `priority is ${priorityLabel(r.match_priority)}` : null].filter(Boolean);
  const who = names[r.target_user_id] ?? "a former member";
  return `When a ticket is created${when.length ? ` and ${when.join(" and ")}` : ""}, ${r.action === "assign" ? `assign it to ${who}` : `notify ${who}`}.`;
}

export function AutomationRules({ rules, staff }: { rules: RuleRow[]; staff: { id: string; name: string }[] }) {
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  const [values, setValues] = useState({ name: "", match_category: "", match_priority: "", action: "assign", target_user_id: "" });
  const { pending, fieldErrors, formError, submit } = useActionForm(automationRuleSchema);
  const [busy, start] = useTransition();
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Saved");
      else toast.error(r.error ?? "Something went wrong");
    });

  return (
    <div className="space-y-5">
      {rules.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Zap className={cn("h-4 w-4 shrink-0", r.is_active ? "text-accent" : "text-subtle")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", !r.is_active && "text-muted")}>{r.name}{!r.is_active && " (off)"}</p>
                <p className="text-[13px] text-muted">{describe(r, names)}</p>
              </div>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setAutomationRuleActive(r.id, !r.is_active))}>{r.is_active ? "Turn off" : "Turn on"}</Button>
              <Button variant="danger-ghost" size="icon-sm" disabled={busy} aria-label={`Delete rule ${r.name}`} onClick={() => run(() => deleteAutomationRule(r.id))}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No rules yet. Rules run once, when a ticket is created; the first matching assign rule wins.</p>
      )}

      <form
        noValidate
        className="space-y-3 rounded-lg border border-dashed border-border-strong p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit({ ...values, is_active: true }, createAutomationRule, { onSuccess: () => setValues({ name: "", match_category: "", match_priority: "", action: "assign", target_user_id: "" }) });
        }}
      >
        <p className="text-sm font-medium">New rule</p>
        <FormError message={formError} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rule name" htmlFor="ar-name" required error={fieldErrors.name} className="sm:col-span-2">
            <Input id="ar-name" value={values.name} onChange={set("name")} maxLength={80} placeholder="e.g. Printer tickets to Priya" {...errorProps("ar-name", fieldErrors.name)} />
          </Field>
          <Field label="When category is" htmlFor="ar-cat" hint="Leave empty for any category" error={fieldErrors.match_category}>
            <Input id="ar-cat" list="ar-cats" value={values.match_category} onChange={set("match_category")} maxLength={60} />
            <datalist id="ar-cats">{TICKET_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="And priority is" htmlFor="ar-pri" error={fieldErrors.match_priority}>
            <Select id="ar-pri" value={values.match_priority} onChange={set("match_priority")}>
              <option value="">Any priority</option>
              {TICKET_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="Then" htmlFor="ar-action" error={fieldErrors.action}>
            <Select id="ar-action" value={values.action} onChange={set("action")}>
              <option value="assign">Assign the ticket to</option>
              <option value="notify">Notify</option>
            </Select>
          </Field>
          <Field label="Team member" htmlFor="ar-target" required error={fieldErrors.target_user_id}>
            <Select id="ar-target" value={values.target_user_id} onChange={set("target_user_id")} {...errorProps("ar-target", fieldErrors.target_user_id)}>
              <option value="">Choose…</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Adding…" : "Add rule"}</Button>
        </div>
      </form>
    </div>
  );
}
