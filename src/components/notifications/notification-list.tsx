"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Bell, CircleCheck, Lock, MessageSquare, TriangleAlert, UserRound, ArrowRightLeft, Flame } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { clearReadNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  when: string;
  href: string | null;
  workspace: string | null;
}

const ICONS: Record<string, typeof Bell> = {
  ticket_created: Bell,
  ticket_assigned: UserRound,
  priority_changed: Flame,
  status_changed: ArrowRightLeft,
  customer_reply: MessageSquare,
  staff_reply: MessageSquare,
  internal_note: Lock,
  sla_warning: AlarmClock,
  sla_breach: TriangleAlert,
  ticket_resolved: CircleCheck,
  ticket_closed: CircleCheck,
};

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const unread = items.filter((i) => !i.read).length;
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.message) toast.success(r.message);
      } else toast.error(r.error ?? "Something went wrong");
    });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" role="status">{unread ? `${unread} unread` : "You're all caught up"}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={pending || !unread} onClick={() => run(markAllNotificationsRead)}>Mark all as read</Button>
          <Button variant="ghost" size="sm" disabled={pending || items.every((i) => !i.read)} onClick={() => run(clearReadNotifications)}>Clear read</Button>
        </div>
      </div>
      <Panel>
        {items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="Ticket assignments, replies, status changes and SLA alerts will appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const Icon = ICONS[n.kind] ?? Bell;
              const content = (
                <>
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", n.kind === "sla_breach" ? "bg-danger-soft text-danger" : n.kind === "sla_warning" ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted")}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm", !n.read && "font-semibold")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block truncate text-[13px] text-muted">{n.body}</span>}
                    <span className="mt-0.5 block text-[12px] text-subtle">{n.workspace ? `${n.workspace}, ` : ""}{n.when}</span>
                  </span>
                  {!n.read && <span className="led mt-2 text-accent" aria-label="Unread" />}
                </>
              );
              return (
                <li key={n.id} className={cn(!n.read && "bg-accent-soft/30")}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={(e) => {
                        if (n.read) return;
                        e.preventDefault();
                        start(async () => {
                          await markNotificationRead(n.id);
                          router.push(n.href!);
                        });
                      }}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-surface-2"
                    >
                      {content}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => !n.read && run(() => markNotificationRead(n.id))} className="flex w-full cursor-pointer items-start gap-3 px-5 py-3 text-left hover:bg-surface-2">
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <p className="mt-3 text-[12px] text-subtle">Notifications appear here in the app. This version doesn&apos;t send notification emails.</p>
    </>
  );
}
