import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { requireStaff } from "@/lib/workspace";
import { loadNotifications } from "@/lib/notification-data";
import { sweepSla } from "@/lib/ticket-data";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const m = await requireStaff();
  const profile = await getProfile();
  await sweepSla(m.workspace.id);
  const items = await loadNotifications(profile, "staff");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description="Across all your workspaces. Opening one marks it as read." />
      <NotificationList items={items} />
    </div>
  );
}
