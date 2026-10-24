import { Clock, Flame } from "lucide-react";
import { LedLabel, type LedTone } from "@/components/shared/led";
import { cn } from "@/lib/utils";
import {
  priorityLabel,
  relativeTime,
  SLA_LABELS,
  statusLabel,
  ticketSla,
  type SlaState,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets";

const STATUS_TONE: Record<TicketStatus, LedTone> = {
  open: "accent",
  in_progress: "warn",
  waiting_customer: "info",
  waiting_third_party: "info",
  resolved: "ok",
  closed: "idle",
};

export function TicketStatusLabel({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <LedLabel tone={STATUS_TONE[status]} pulse={status === "in_progress"} className={className}>
      {statusLabel(status)}
    </LedLabel>
  );
}

export function TicketPriorityLabel({ priority, className }: { priority: TicketPriority; className?: string }) {
  if (priority === "critical") {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white", className)}>
        <Flame className="h-3 w-3" aria-hidden /> Critical
      </span>
    );
  }
  const tone: LedTone = priority === "high" ? "danger" : priority === "medium" ? "info" : "idle";
  return (
    <LedLabel tone={tone} className={className}>
      {priorityLabel(priority)}
    </LedLabel>
  );
}

const SLA_STYLE: Record<SlaState, string> = {
  none: "text-subtle",
  on_track: "text-muted",
  at_risk: "bg-warn-soft text-warn font-medium",
  breached: "bg-danger-soft text-danger font-semibold",
  met: "text-ok",
  missed: "text-danger",
};

/** Compact SLA indicator for lists: the nearest live deadline, or the final result. */
export function SlaChip({ ticket, now }: { ticket: Ticket; now?: number }) {
  const sla = ticketSla(ticket, now);
  const live = [sla.response, sla.resolution].filter((t) => ["breached", "at_risk", "on_track"].includes(t.state) && t.due);
  const nearest = live.sort((a, b) => Date.parse(a.due!) - Date.parse(b.due!))[0];
  if (!nearest) {
    const done = sla.resolution.state === "met" || sla.resolution.state === "missed" ? sla.resolution : null;
    if (!done) return <span className="text-[12px] text-subtle">—</span>;
    return <span className={cn("text-[12px]", SLA_STYLE[done.state])}>{SLA_LABELS[done.state]}</span>;
  }
  const which = nearest === sla.response ? "Response" : "Resolution";
  return (
    <span
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[12px]", SLA_STYLE[nearest.state])}
      title={`${which} target ${nearest.state === "breached" ? "passed" : "due"} ${new Date(nearest.due!).toLocaleString()} (calendar time)`}
    >
      <Clock className="h-3 w-3" aria-hidden />
      <span className="sr-only">{which} </span>
      {nearest.state === "breached" ? `Overdue ${relativeTime(nearest.due!, now).replace(" ago", "")}` : relativeTime(nearest.due!, now)}
    </span>
  );
}

const STATUS_PILL: Record<TicketStatus, string> = {
  open: "bg-accent-soft text-accent",
  in_progress: "bg-violet-soft text-violet",
  waiting_customer: "bg-warn-soft text-warn",
  waiting_third_party: "bg-warn-soft text-warn",
  resolved: "bg-ok-soft text-ok",
  closed: "bg-surface-2 text-muted",
};
const PRIORITY_PILL: Record<TicketPriority, string> = {
  low: "bg-ok-soft text-ok",
  medium: "bg-warn-soft text-warn",
  high: "bg-danger-soft text-danger",
  critical: "bg-danger text-white",
};

/** Tinted pill variants used in dashboard tables. */
export function StatusPill({ status }: { status: TicketStatus }) {
  const short = status === "waiting_customer" ? "Waiting: customer" : status === "waiting_third_party" ? "Waiting: third party" : statusLabel(status);
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium", STATUS_PILL[status])}>{short}</span>;
}

export function PriorityPill({ priority }: { priority: TicketPriority }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium", PRIORITY_PILL[priority])}>{priorityLabel(priority)}</span>;
}
