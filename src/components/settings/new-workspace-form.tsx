"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/card";
import { Field, Input, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { createWorkspace } from "@/lib/actions/workspaces";
import { workspaceCreateSchema } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "freelance", label: "Freelance", icon: Briefcase, text: "You support several independent clients. Each client's tickets, assets and billing stay separate." },
  { value: "organisation", label: "Organisation", icon: Building2, text: "An IT team or company. Invite technicians and administrators, and give client users a support portal." },
] as const;

function suggestPrefix(name: string) {
  const letters = name.toUpperCase().replace(/[^A-Z ]/g, "").trim();
  const words = letters.split(/\s+/).filter(Boolean);
  const p = words.length > 1 ? words.map((w) => w[0]).join("") : letters.replace(/\s/g, "");
  return p.slice(0, 4).padEnd(2, "X");
}

export function NewWorkspaceForm() {
  const router = useRouter();
  const [values, setValues] = useState({ name: "", type: "freelance", ticket_prefix: "" });
  const [prefixTouched, setPrefixTouched] = useState(false);
  const { pending, fieldErrors, formError, submit } = useActionForm(workspaceCreateSchema);

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(values, createWorkspace, { onSuccess: () => router.push("/dashboard") });
      }}
    >
      <FormError message={formError} />
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">Type</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const on = values.type === t.value;
            return (
              <label key={t.value} className={cn("cursor-pointer rounded-xl border p-4 transition-colors", on ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-border-strong")}>
                <input type="radio" name="type" value={t.value} checked={on} onChange={() => setValues((v) => ({ ...v, type: t.value }))} className="sr-only" />
                <span className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-accent" aria-hidden /> {t.label}</span>
                <span className="mt-1 block text-[13px] text-muted">{t.text}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <Panel>
        <PanelBody className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Field label="Workspace name" htmlFor="name" required error={fieldErrors.name} hint={values.type === "freelance" ? "Usually your business name." : "Usually the company or team name."}>
            <Input
              id="name"
              value={values.name}
              maxLength={80}
              autoFocus
              onChange={(e) => {
                const name = e.target.value;
                setValues((v) => ({ ...v, name, ticket_prefix: prefixTouched ? v.ticket_prefix : name.trim() ? suggestPrefix(name) : "" }));
              }}
              {...errorProps("name", fieldErrors.name)}
            />
          </Field>
          <Field label="Ticket prefix" htmlFor="ticket_prefix" required error={fieldErrors.ticket_prefix} hint={values.ticket_prefix ? `Tickets will look like ${values.ticket_prefix.toUpperCase()}-000001` : "2–6 letters"}>
            <Input
              id="ticket_prefix"
              value={values.ticket_prefix}
              maxLength={6}
              className="font-mono uppercase"
              onChange={(e) => {
                setPrefixTouched(true);
                setValues((v) => ({ ...v, ticket_prefix: e.target.value.toUpperCase() }));
              }}
              {...errorProps("ticket_prefix", fieldErrors.ticket_prefix)}
            />
          </Field>
        </PanelBody>
      </Panel>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create workspace"}</Button>
      </div>
    </form>
  );
}
