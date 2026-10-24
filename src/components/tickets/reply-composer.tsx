"use client";

import { useState, useTransition } from "react";
import { Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { FormError } from "@/components/shared/form-error";
import { addTicketComment, changeTicketStatus } from "@/lib/actions/tickets";
import { nextStatuses, statusLabel, type TicketStatus } from "@/lib/tickets";
import { cn } from "@/lib/utils";

/**
 * Reply box. Staff choose between a public reply (the customer sees it) and an
 * internal note (staff only, enforced by the database). Customers only reply.
 */
export function ReplyComposer({
  ticketId,
  status,
  mode,
  isAdmin = false,
  disabledReason,
}: {
  ticketId: string;
  status: TicketStatus;
  mode: "staff" | "customer";
  isAdmin?: boolean;
  disabledReason?: string;
}) {
  const [tab, setTab] = useState<"public" | "internal">("public");
  const [body, setBody] = useState("");
  const [after, setAfter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const internal = mode === "staff" && tab === "internal";
  const statusOptions = mode === "staff" ? nextStatuses(status, isAdmin).filter((s) => s === "waiting_customer" || s === "in_progress" || s === "waiting_third_party") : [];

  if (disabledReason) {
    return <p className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted">{disabledReason}</p>;
  }

  return (
    <form
      noValidate
      className={cn("rounded-xl border bg-surface", internal ? "border-warn/50" : "border-border")}
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) {
          setError("Write a message first.");
          return;
        }
        setError(null);
        start(async () => {
          const res = await addTicketComment(ticketId, { body, is_internal: internal });
          if (!res.ok) {
            setError(res.error);
            return;
          }
          toast.success(res.message ?? "Sent");
          setBody("");
          if (after) {
            const s = await changeTicketStatus(ticketId, { status: after, resolution_summary: "" });
            if (!s.ok) toast.error(s.error);
            setAfter("");
          }
        });
      }}
    >
      {mode === "staff" && (
        <div role="tablist" aria-label="Message type" className="flex gap-1 border-b border-border px-2 pt-2">
          {(["public", "internal"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px inline-flex cursor-pointer items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-[13px] font-medium",
                tab === t ? (t === "internal" ? "border-warn text-warn" : "border-accent text-foreground") : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {t === "internal" ? <><Lock className="h-3.5 w-3.5" aria-hidden /> Internal note</> : <><Send className="h-3.5 w-3.5" aria-hidden /> Reply to customer</>}
            </button>
          ))}
        </div>
      )}
      <div className={cn("p-3", internal && "bg-warn-soft/60")}>
        <label htmlFor={`reply-${ticketId}`} className="sr-only">
          {internal ? "Internal note" : "Reply"}
        </label>
        <Textarea
          id={`reply-${ticketId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={20000}
          placeholder={internal ? "Only staff can see this note." : mode === "customer" ? "Add more details or reply to the support team…" : "Write a reply the customer will see…"}
          className="bg-surface"
        />
        {error && <div className="mt-2"><FormError message={error} /></div>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] text-muted">
            {internal ? "Visible to technicians and admins only." : mode === "staff" ? "The customer can see this reply." : "Markdown is supported."}
          </p>
          <div className="flex items-center gap-2">
            {statusOptions.length > 0 && (
              <>
                <label htmlFor={`after-${ticketId}`} className="text-[12px] text-muted">Then set status</label>
                <Select id={`after-${ticketId}`} value={after} onChange={(e) => setAfter(e.target.value)} className="h-8 w-auto text-[13px]">
                  <option value="">Keep {statusLabel(status).toLowerCase()}</option>
                  {statusOptions.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </Select>
              </>
            )}
            <Button type="submit" size="sm" variant={internal ? "secondary" : "primary"} disabled={pending}>
              {pending ? "Sending…" : internal ? "Add note" : "Send reply"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
