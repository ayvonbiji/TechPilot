"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Textarea, errorProps } from "@/components/ui/input";
import { changeTicketStatus } from "@/lib/actions/tickets";
import { canTransition, statusLabel, TICKET_STATUSES, type Ticket, type TicketStatus } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import { SlaChip, TicketPriorityLabel } from "./ticket-badges";

interface BoardProps {
  tickets: Ticket[];
  isAdmin: boolean;
  names: Record<string, string>;
  clients: Record<string, string>;
  closedShown: number;
}

export function TicketBoard({ tickets: initial, isAdmin, names, clients, closedShown }: BoardProps) {
  const [tickets, setTickets] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<TicketStatus | null>(null);
  const [resolveFor, setResolveFor] = useState<Ticket | null>(null);
  const [summary, setSummary] = useState("");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [now] = useState(() => Date.now());

  function move(t: Ticket, to: TicketStatus, resolution?: string) {
    if (t.status === to) return;
    if (!canTransition(t.status, to, isAdmin)) {
      toast.error(
        t.status === "closed" && !isAdmin
          ? "Only workspace admins can reopen a closed ticket."
          : `A ticket can't move from ${statusLabel(t.status)} to ${statusLabel(to)}.`,
      );
      return;
    }
    if (to === "resolved" && !resolution) {
      setSummary(t.resolution_summary);
      setSummaryError(null);
      setResolveFor(t);
      return;
    }
    const before = tickets;
    setTickets((list) => list.map((x) => (x.id === t.id ? { ...x, status: to } : x)));
    start(async () => {
      const res = await changeTicketStatus(t.id, { status: to, resolution_summary: resolution ?? "" });
      if (res.ok) {
        toast.success(`${t.reference} moved to ${statusLabel(to)}`);
        setResolveFor(null);
      } else {
        setTickets(before);
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0" role="region" aria-label="Ticket board" tabIndex={0}>
        <div className="grid min-w-[1100px] grid-cols-6 gap-3">
          {TICKET_STATUSES.map((col) => {
            const items = tickets.filter((t) => t.status === col.value);
            const dragged = tickets.find((t) => t.id === dragging);
            const allowed = dragged ? canTransition(dragged.status, col.value, isAdmin) : true;
            return (
              <section
                key={col.value}
                aria-label={col.label}
                onDragOver={(e) => {
                  if (!dragged || !allowed) return;
                  e.preventDefault();
                  setOver(col.value);
                }}
                onDragLeave={() => setOver((o) => (o === col.value ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  if (dragged) move(dragged, col.value);
                  setDragging(null);
                }}
                className={cn(
                  "flex min-h-64 flex-col rounded-xl border bg-surface-2/60 transition-colors",
                  over === col.value ? "border-accent bg-accent-soft/50" : "border-border",
                  dragged && !allowed && "opacity-50",
                )}
              >
                <header className="flex items-center justify-between px-3 py-2.5">
                  <h2 className="text-[13px] font-semibold">{col.short}</h2>
                  <span className="rounded-full bg-surface px-2 text-[12px] tabular-nums text-muted">{items.length}</span>
                </header>
                <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
                  {items.map((t) => (
                    <li
                      key={t.id}
                      draggable
                      onDragStart={(e) => {
                        setDragging(t.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", t.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      className={cn(
                        "cursor-grab rounded-lg border border-border bg-surface p-2.5 shadow-panel active:cursor-grabbing",
                        dragging === t.id && "opacity-50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted">{t.reference}</span>
                        <TicketPriorityLabel priority={t.priority} className="text-[11px]" />
                      </div>
                      <Link href={`/tickets/${t.id}`} className="mt-1 block text-[13px] font-medium leading-snug hover:text-accent">
                        {t.subject}
                      </Link>
                      <div className="mt-1.5 text-[12px] text-muted">
                        {t.client_id && clients[t.client_id] ? <span className="block truncate">{clients[t.client_id]}</span> : null}
                        <span className="block truncate">{t.assignee_id ? names[t.assignee_id] ?? "Former member" : "Unassigned"}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <SlaChip ticket={t} now={now} />
                        <label className="sr-only" htmlFor={`move-${t.id}`}>
                          Move {t.reference} to
                        </label>
                        <select
                          id={`move-${t.id}`}
                          value=""
                          disabled={pending}
                          onChange={(e) => e.target.value && move(t, e.target.value as TicketStatus)}
                          className="max-w-[7.5rem] cursor-pointer rounded-md border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted"
                        >
                          <option value="">Move to…</option>
                          {TICKET_STATUSES.filter((s) => s.value !== t.status && canTransition(t.status, s.value, isAdmin)).map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.short}
                            </option>
                          ))}
                        </select>
                      </div>
                    </li>
                  ))}
                  {items.length === 0 && <li className="px-1 py-6 text-center text-[12px] text-subtle">No tickets</li>}
                </ul>
                {col.value === "closed" && closedShown > 0 && (
                  <p className="px-3 pb-2 text-[11px] text-subtle">Showing the {closedShown} most recent</p>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <Dialog open={!!resolveFor} onOpenChange={(o) => !o && setResolveFor(null)}>
        {resolveFor && (
          <DialogContent title={`Resolve ${resolveFor.reference}`} description={resolveFor.subject}>
            <form
              noValidate
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!summary.trim()) {
                  setSummaryError("Describe how the issue was resolved");
                  return;
                }
                move(resolveFor, "resolved", summary.trim());
              }}
            >
              <Field label="Resolution summary" htmlFor="board-summary" required error={summaryError ?? undefined} hint="Shown to the customer in the portal.">
                <Textarea id="board-summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} autoFocus {...errorProps("board-summary", summaryError ?? undefined)} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setResolveFor(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Resolving…" : "Resolve ticket"}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
      <p className="sr-only">Drag a card to another column, or use its Move to menu.</p>
    </>
  );
}
