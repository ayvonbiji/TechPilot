import "server-only";
import { createClient } from "./supabase/server";
import { formatDateTime } from "./dates";
import type { Profile } from "./types";
import type { NotificationItem } from "@/components/notifications/notification-list";

/** The signed-in user's notifications (RLS: own rows only), newest first. */
export async function loadNotifications(profile: Profile, mode: "staff" | "portal"): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id,kind,title,body,read_at,created_at,ticket_id,workspaces(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const fmt = { tz: profile.timezone, dateFormat: profile.date_format, timeFormat: profile.time_format };
  return ((data ?? []) as unknown as { id: string; kind: string; title: string; body: string; read_at: string | null; created_at: string; ticket_id: string | null; workspaces: { name: string } | null }[]).map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    read: Boolean(n.read_at),
    when: formatDateTime(n.created_at, fmt),
    href: n.ticket_id ? (mode === "portal" ? `/portal/tickets/${n.ticket_id}` : `/tickets/${n.ticket_id}`) : null,
    workspace: n.workspaces?.name ?? null,
  }));
}
