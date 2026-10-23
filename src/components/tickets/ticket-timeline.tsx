import { ArrowRightLeft, Lock, MessageSquare, Sparkles, TriangleAlert, UserRound } from "lucide-react";
import { Markdown } from "@/components/shared/markdown";
import { formatDateTime } from "@/lib/dates";
import { priorityLabel, statusLabel, type TicketComment, type TicketEvent } from "@/lib/tickets";
import type { DateFormat, TimeFormat } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Lookup {
  names: Record<string, string>;
  clients: Record<string, string>;
  articles: Record<string, string>;
}

function eventText(e: TicketEvent, l: Lookup): string {
  const name = (id: string | null) => (id ? l.names[id] ?? "a former member" : "nobody");
  switch (e.kind) {
    case "created":
      return "created the ticket";
    case "status":
      return `changed the status from ${statusLabel(e.from_value ?? "")} to ${statusLabel(e.to_value ?? "")}`;
    case "priority":
      return `changed the priority from ${priorityLabel(e.from_value ?? "")} to ${priorityLabel(e.to_value ?? "")}`;
    case "assignee":
      return e.to_value ? `assigned the ticket to ${name(e.to_value)}` : "unassigned the ticket";
    case "client":
      return e.to_value ? `set the client to ${l.clients[e.to_value] ?? "a removed client"}` : "removed the client";
    case "category":
      return `changed the category to ${e.to_value}`;
    case "kb_link":
      return e.to_value ? `linked the article "${l.articles[e.to_value] ?? "an article"}"` : "unlinked the knowledge article";
    case "sla":
      return e.to_value === "response_breached" ? "First-response target was missed" : "Resolution target was missed";
  }
}

/** Conversation and history in time order. Customers receive only public items (enforced by RLS). */
export function TicketTimeline({
  comments,
  events,
  lookup,
  fmt,
  viewer,
}: {
  comments: TicketComment[];
  events: TicketEvent[];
  lookup: Lookup;
  fmt: { tz: string; dateFormat: DateFormat; timeFormat: TimeFormat };
  viewer: "staff" | "customer";
}) {
  const items = [
    ...comments.map((c) => ({ type: "comment" as const, at: c.created_at, c })),
    ...events.filter((e) => e.kind !== "created" || viewer === "staff").map((e) => ({ type: "event" as const, at: e.created_at, e })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  if (!items.length) return <p className="text-sm text-muted">No replies yet.</p>;

  return (
    <ol className="space-y-4" aria-label="Conversation and history">
      {items.map((item) =>
        item.type === "comment" ? (
          <li key={item.c.id}>
            <article
              className={cn(
                "rounded-xl border",
                item.c.is_internal ? "border-warn/40 bg-warn-soft" : item.c.author_is_staff ? "border-border bg-surface" : "border-accent/30 bg-accent-soft/40",
              )}
              aria-label={item.c.is_internal ? "Internal note" : "Reply"}
            >
              <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-inherit px-4 py-2 text-[13px]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  {item.c.is_internal ? <Lock className="h-3.5 w-3.5 text-warn" aria-hidden /> : <MessageSquare className="h-3.5 w-3.5 text-muted" aria-hidden />}
                  {item.c.author_name || "Someone"}
                </span>
                <span className="text-muted">
                  {item.c.is_internal ? "Internal note, staff only" : item.c.author_is_staff ? (viewer === "customer" ? "Support team" : "Public reply") : "Customer"}
                </span>
                <time className="ml-auto text-[12px] text-subtle" dateTime={item.c.created_at}>
                  {formatDateTime(item.c.created_at, fmt)}
                </time>
              </header>
              <div className="px-4 py-3">
                <Markdown breaks className="text-sm">{item.c.body}</Markdown>
              </div>
            </article>
          </li>
        ) : (
          <li key={`e${item.e.id}`} className="flex items-start gap-2.5 px-1 text-[13px] text-muted">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface" aria-hidden>
              {item.e.kind === "sla" ? (
                <TriangleAlert className="h-3 w-3 text-danger" />
              ) : item.e.kind === "assignee" ? (
                <UserRound className="h-3 w-3" />
              ) : item.e.kind === "created" ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <ArrowRightLeft className="h-3 w-3" />
              )}
            </span>
            <p className="min-w-0 flex-1">
              {item.e.kind !== "sla" && <span className="font-medium text-foreground">{item.e.actor_name || "System"} </span>}
              <span className={item.e.kind === "sla" ? "font-medium text-danger" : undefined}>{eventText(item.e, lookup)}</span>
            </p>
            <time className="shrink-0 text-[12px] text-subtle" dateTime={item.e.created_at}>
              {formatDateTime(item.e.created_at, fmt)}
            </time>
          </li>
        ),
      )}
    </ol>
  );
}
