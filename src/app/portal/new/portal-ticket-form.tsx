"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { createPortalTicket } from "@/lib/actions/tickets";
import { TICKET_CATEGORIES } from "@/lib/tickets";
import { portalTicketSchema } from "@/lib/validation/schemas";

const URGENCY = [
  { value: "low", label: "Low: a question or minor annoyance" },
  { value: "medium", label: "Normal: something isn't working right" },
  { value: "high", label: "High: I can't do part of my work" },
  { value: "critical", label: "Critical: work has stopped for several people" },
];

export function PortalTicketForm() {
  const router = useRouter();
  const [values, setValues] = useState({ subject: "", description: "", category: "General support", priority: "medium" });
  const { pending, fieldErrors, formError, submit } = useActionForm(portalTicketSchema);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(values, createPortalTicket, { onSuccess: (r) => router.push(`/portal/tickets/${r.data?.id}`) });
      }}
    >
      <Panel>
        <PanelBody className="space-y-4">
          <FormError message={formError} />
          <Field label="Subject" htmlFor="subject" required error={fieldErrors.subject}>
            <Input id="subject" value={values.subject} onChange={set("subject")} maxLength={200} autoFocus placeholder="e.g. Can't print to the office printer" {...errorProps("subject", fieldErrors.subject)} />
          </Field>
          <Field label="What's happening?" htmlFor="description" required error={fieldErrors.description} hint="When did it start, what have you tried, any error messages. Don't include passwords.">
            <Textarea id="description" value={values.description} onChange={set("description")} rows={7} {...errorProps("description", fieldErrors.description)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Topic" htmlFor="category" error={fieldErrors.category}>
              <Select id="category" value={values.category} onChange={set("category")}>
                {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="How urgent is it?" htmlFor="priority" error={fieldErrors.priority}>
              <Select id="priority" value={values.priority} onChange={set("priority")}>
                {URGENCY.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit request"}</Button>
          </div>
        </PanelBody>
      </Panel>
    </form>
  );
}
