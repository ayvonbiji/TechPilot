"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { createTicket } from "@/lib/actions/tickets";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/tickets";
import { ticketCreateSchema } from "@/lib/validation/schemas";

interface PersonOption {
  id: string;
  name: string;
  email: string;
  role: string;
  clientId: string | null;
}

export function NewTicketForm({
  people,
  clients,
  meId,
  defaultClient,
}: {
  people: PersonOption[];
  clients: { id: string; name: string }[];
  meId: string;
  defaultClient?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    subject: "",
    description: "",
    category: "General support",
    priority: "medium",
    client_id: defaultClient ?? "",
    requester: "", // "" = none, "other", or a user id
    requester_name: "",
    requester_email: "",
    assignee_id: "",
  });
  const { pending, fieldErrors, formError, submit } = useActionForm(ticketCreateSchema);
  const staff = people.filter((p) => p.role !== "client");
  const customers = useMemo(
    () => people.filter((p) => p.role === "client" && (!values.client_id || p.clientId === values.client_id)),
    [people, values.client_id],
  );
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <form
      noValidate
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
      onSubmit={(e) => {
        e.preventDefault();
        const requesterIsUser = values.requester !== "" && values.requester !== "other";
        const payload = {
          subject: values.subject,
          description: values.description,
          category: values.category,
          priority: values.priority,
          client_id: values.client_id,
          requester_id: requesterIsUser ? values.requester : "",
          requester_name: values.requester === "other" ? values.requester_name : "",
          requester_email: values.requester === "other" ? values.requester_email : "",
          assignee_id: values.assignee_id,
          kb_article_id: "",
        };
        submit(payload, createTicket, { onSuccess: (res) => router.push(`/tickets/${res.data?.id}`) });
      }}
    >
      <div className="space-y-5">
        <FormError message={formError} />
        <Panel>
          <PanelBody className="space-y-4">
            <Field label="Subject" htmlFor="subject" required error={fieldErrors.subject}>
              <Input id="subject" value={values.subject} onChange={set("subject")} maxLength={200} autoFocus placeholder="e.g. Outlook keeps asking for a password" {...errorProps("subject", fieldErrors.subject)} />
            </Field>
            <Field label="Description" htmlFor="description" error={fieldErrors.description} hint="What's happening, since when, who's affected. Markdown supported.">
              <Textarea id="description" value={values.description} onChange={set("description")} rows={8} {...errorProps("description", fieldErrors.description)} />
            </Field>
          </PanelBody>
        </Panel>
      </div>

      <aside className="space-y-5">
        <Panel>
          <PanelBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority" htmlFor="priority" error={fieldErrors.priority}>
                <Select id="priority" value={values.priority} onChange={set("priority")}>
                  {TICKET_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Select>
              </Field>
              <Field label="Category" htmlFor="category" required error={fieldErrors.category}>
                <Input id="category" list="ticket-categories" value={values.category} onChange={set("category")} maxLength={60} {...errorProps("category", fieldErrors.category)} />
                <datalist id="ticket-categories">{TICKET_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
            </div>
            {clients.length > 0 && (
              <Field label="Client" htmlFor="client_id" error={fieldErrors.client_id}>
                <Select id="client_id" value={values.client_id} onChange={(e) => setValues((v) => ({ ...v, client_id: e.target.value, requester: "" }))}>
                  <option value="">No client (internal)</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Requester" htmlFor="requester" error={fieldErrors.requester_id} hint={customers.length ? undefined : "Customers with portal accounts appear here."}>
              <Select id="requester" value={values.requester} onChange={set("requester")}>
                <option value="">Not specified</option>
                <option value={meId}>Me</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                <option value="other">Someone without an account…</option>
              </Select>
            </Field>
            {values.requester === "other" && (
              <div className="grid gap-3">
                <Field label="Requester name" htmlFor="requester_name" error={fieldErrors.requester_name}>
                  <Input id="requester_name" value={values.requester_name} onChange={set("requester_name")} maxLength={120} />
                </Field>
                <Field label="Requester email" htmlFor="requester_email" error={fieldErrors.requester_email} hint="Optional">
                  <Input id="requester_email" type="email" value={values.requester_email} onChange={set("requester_email")} {...errorProps("requester_email", fieldErrors.requester_email)} />
                </Field>
              </div>
            )}
            <Field label="Technician" htmlFor="assignee_id" error={fieldErrors.assignee_id} hint="Leave unassigned to let automation rules decide.">
              <Select id="assignee_id" value={values.assignee_id} onChange={set("assignee_id")}>
                <option value="">Unassigned</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.id === meId ? `${s.name} (me)` : s.name}</option>)}
              </Select>
            </Field>
          </PanelBody>
        </Panel>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={pending}>{pending ? "Creating…" : "Create ticket"}</Button>
          <Button asChild variant="secondary"><Link href="/tickets">Cancel</Link></Button>
        </div>
      </aside>
    </form>
  );
}
