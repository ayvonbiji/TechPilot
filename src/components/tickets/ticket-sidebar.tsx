"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BookOpen, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, errorProps } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { changeTicketStatus, setTicketField, updateTicketDetails } from "@/lib/actions/tickets";
import { ticketEditSchema } from "@/lib/validation/schemas";
import {
  nextStatuses,
  relativeTime,
  SLA_LABELS,
  statusLabel,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  ticketSla,
  type SlaTarget,
  type Ticket,
  type TicketStatus,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name: string;
}

function SlaRow({ label, target, fmt }: { label: string; target: SlaTarget; fmt: (iso: string) => string }) {
  const tone = {
    none: "text-subtle",
    on_track: "text-foreground",
    at_risk: "text-warn",
    breached: "text-danger",
    met: "text-ok",
    missed: "text-danger",
  }[target.state];
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px]">
        <span className={cn("font-medium", tone)}>{SLA_LABELS[target.state]}</span>
        {target.due && (
          <span className="block text-[12px] text-muted">
            {target.doneAt ? `Done ${fmt(target.doneAt)}, target ${fmt(target.due)}` : `Due ${fmt(target.due)} (${relativeTime(target.due)})`}
          </span>
        )}
      </dd>
    </div>
  );
}

export function TicketSidebar({
  ticket,
  isAdmin,
  meId,
  staff,
  clients,
  articles,
  requesterOptions,
  fmtTimes,
}: {
  ticket: Ticket;
  isAdmin: boolean;
  meId: string;
  staff: Option[];
  clients: Option[];
  articles: Option[];
  requesterOptions: (Option & { email: string })[];
  fmtTimes: Record<string, string>;
}) {
  const [pending, start] = useTransition();
  const [resolving, setResolving] = useState<TicketStatus | null>(null);
  const [summary, setSummary] = useState(ticket.resolution_summary);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const fmt = (iso: string) => fmtTimes[iso] ?? new Date(iso).toLocaleString();
  const sla = ticketSla(ticket);
  const options = nextStatuses(ticket.status, isAdmin);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        after?.();
      } else toast.error(res.error ?? "Something went wrong");
    });

  const setStatus = (to: string) => {
    if (!to) return;
    if (to === "resolved") {
      setSummaryError(null);
      setResolving("resolved");
      return;
    }
    run(() => changeTicketStatus(ticket.id, { status: to, resolution_summary: "" }));
  };

  return (
    <aside className="space-y-4">
      <Panel className="p-4">
        <dl className="space-y-3.5">
          <div>
            <dt><label htmlFor="ts-status" className="text-[12px] text-muted">Status</label></dt>
            <dd className="mt-1">
              <Select id="ts-status" value="" disabled={pending || options.length === 0} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{statusLabel(ticket.status)}</option>
                {options.map((s) => (
                  <option key={s} value={s}>
                    {ticket.status === "resolved" || ticket.status === "closed" ? (s === "in_progress" ? "Reopen (in progress)" : `Move to ${statusLabel(s).toLowerCase()}`) : `Move to ${statusLabel(s).toLowerCase()}`}
                  </option>
                ))}
              </Select>
              {ticket.status === "closed" && !isAdmin && <p className="mt-1 text-[12px] text-muted">Only admins can reopen closed tickets.</p>}
            </dd>
          </div>
          <div>
            <dt><label htmlFor="ts-priority" className="text-[12px] text-muted">Priority</label></dt>
            <dd className="mt-1">
              <Select id="ts-priority" value={ticket.priority} disabled={pending} onChange={(e) => run(() => setTicketField(ticket.id, "priority", e.target.value))}>
                {TICKET_PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </dd>
          </div>
          <div>
            <dt className="flex items-center justify-between">
              <label htmlFor="ts-assignee" className="text-[12px] text-muted">Technician</label>
              {ticket.assignee_id !== meId && staff.some((s) => s.id === meId) && (
                <button type="button" className="cursor-pointer text-[12px] text-accent hover:underline" disabled={pending} onClick={() => run(() => setTicketField(ticket.id, "assignee_id", meId))}>
                  Assign to me
                </button>
              )}
            </dt>
            <dd className="mt-1">
              <Select id="ts-assignee" value={ticket.assignee_id ?? ""} disabled={pending} onChange={(e) => run(() => setTicketField(ticket.id, "assignee_id", e.target.value || null))}>
                <option value="">Unassigned</option>
                {ticket.assignee_id && !staff.some((s) => s.id === ticket.assignee_id) && <option value={ticket.assignee_id}>Former member</option>}
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </dd>
          </div>
          {(clients.length > 0 || ticket.client_id) && (
            <div>
              <dt><label htmlFor="ts-client" className="text-[12px] text-muted">Client</label></dt>
              <dd className="mt-1">
                <Select id="ts-client" value={ticket.client_id ?? ""} disabled={pending} onChange={(e) => run(() => setTicketField(ticket.id, "client_id", e.target.value || null))}>
                  <option value="">No client (internal)</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[12px] text-muted">Requester</dt>
            <dd className="mt-0.5 text-[13px]">
              {ticket.requester_name || <span className="text-subtle">Not specified</span>}
              {ticket.requester_email && <span className="block text-[12px] text-muted">{ticket.requester_email}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Category</dt>
            <dd className="mt-0.5 text-[13px]">{ticket.category}</dd>
          </div>
        </dl>
        <div className="mt-4 flex gap-2 border-t border-border pt-3">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Pencil /> Edit details</Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer /> Print</Button>
        </div>
      </Panel>

      <Panel className="p-4">
        <h2 className="text-sm font-semibold">Service level</h2>
        <dl className="mt-3 space-y-3">
          <SlaRow label="First response" target={sla.response} fmt={fmt} />
          <SlaRow label="Resolution" target={sla.resolution} fmt={fmt} />
        </dl>
        <p className="mt-3 text-[11px] text-subtle">Calendar-time targets (24×7), set by this workspace&apos;s SLA policy for the ticket&apos;s priority{ticket.client_id ? " and client" : ""}.</p>
      </Panel>

      <Panel className="p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><BookOpen className="h-4 w-4 text-muted" aria-hidden /> Knowledge article</h2>
        <label htmlFor="ts-kb" className="sr-only">Linked knowledge article</label>
        <Select id="ts-kb" className="mt-2" value={ticket.kb_article_id ?? ""} disabled={pending} onChange={(e) => run(() => setTicketField(ticket.id, "kb_article_id", e.target.value || null))}>
          <option value="">No article linked</option>
          {articles.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
          {ticket.kb_article_id && <Link href={`/knowledge/${ticket.kb_article_id}`} className="text-accent hover:underline">Open article</Link>}
          <Link href={`/knowledge/new?ticket=${ticket.id}`} className="text-accent hover:underline">Write an article from this ticket</Link>
        </div>
      </Panel>

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        {resolving && (
          <DialogContent title={`Resolve ${ticket.reference}`}>
            <form
              noValidate
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!summary.trim()) return setSummaryError("Describe how the issue was resolved");
                run(() => changeTicketStatus(ticket.id, { status: "resolved", resolution_summary: summary.trim() }), () => setResolving(null));
              }}
            >
              <Field label="Resolution summary" htmlFor="ts-summary" required error={summaryError ?? undefined} hint="The customer sees this in the portal.">
                <Textarea id="ts-summary" rows={5} value={summary} onChange={(e) => setSummary(e.target.value)} autoFocus {...errorProps("ts-summary", summaryError ?? undefined)} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setResolving(null)}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending ? "Resolving…" : "Resolve ticket"}</Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>

      <EditDetailsDialog open={editing} onClose={() => setEditing(false)} ticket={ticket} requesterOptions={requesterOptions} meId={meId} />
    </aside>
  );
}

function EditDetailsDialog({
  open,
  onClose,
  ticket,
  requesterOptions,
  meId,
}: {
  open: boolean;
  onClose: () => void;
  ticket: Ticket;
  requesterOptions: (Option & { email: string })[];
  meId: string;
}) {
  const initialRequester = ticket.requester_id ?? (ticket.requester_name || ticket.requester_email ? "other" : "");
  const [values, setValues] = useState({
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    requester: initialRequester,
    requester_name: ticket.requester_id ? "" : ticket.requester_name,
    requester_email: ticket.requester_id ? "" : ticket.requester_email,
  });
  const { pending, fieldErrors, formError, submit } = useActionForm(ticketEditSchema);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));
  const knownIds = new Set([meId, ...requesterOptions.map((r) => r.id)]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && (
        <DialogContent title={`Edit ${ticket.reference}`} wide>
          <form
            noValidate
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const isUser = values.requester !== "" && values.requester !== "other";
              submit(
                {
                  subject: values.subject,
                  description: values.description,
                  category: values.category,
                  requester_id: isUser ? values.requester : "",
                  requester_name: values.requester === "other" ? values.requester_name : "",
                  requester_email: values.requester === "other" ? values.requester_email : "",
                },
                (input) => updateTicketDetails(ticket.id, input),
                { onSuccess: onClose },
              );
            }}
          >
            <FormError message={formError} />
            <Field label="Subject" htmlFor="ed-subject" required error={fieldErrors.subject}>
              <Input id="ed-subject" value={values.subject} onChange={set("subject")} maxLength={200} {...errorProps("ed-subject", fieldErrors.subject)} />
            </Field>
            <Field label="Description" htmlFor="ed-description" error={fieldErrors.description}>
              <Textarea id="ed-description" value={values.description} onChange={set("description")} rows={6} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="ed-category" required error={fieldErrors.category}>
                <Input id="ed-category" list="ed-categories" value={values.category} onChange={set("category")} maxLength={60} />
                <datalist id="ed-categories">{TICKET_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Requester" htmlFor="ed-requester" error={fieldErrors.requester_id}>
                <Select id="ed-requester" value={values.requester} onChange={set("requester")}>
                  <option value="">Not specified</option>
                  <option value={meId}>Me</option>
                  {requesterOptions.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.email})</option>)}
                  {ticket.requester_id && !knownIds.has(ticket.requester_id) && <option value={ticket.requester_id}>{ticket.requester_name || "Former member"}</option>}
                  <option value="other">Someone without an account…</option>
                </Select>
              </Field>
            </div>
            {values.requester === "other" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Requester name" htmlFor="ed-rname" error={fieldErrors.requester_name}>
                  <Input id="ed-rname" value={values.requester_name} onChange={set("requester_name")} maxLength={120} />
                </Field>
                <Field label="Requester email" htmlFor="ed-remail" error={fieldErrors.requester_email}>
                  <Input id="ed-remail" type="email" value={values.requester_email} onChange={set("requester_email")} {...errorProps("ed-remail", fieldErrors.requester_email)} />
                </Field>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
