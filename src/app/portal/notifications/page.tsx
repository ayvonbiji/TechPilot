import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { loadNotifications } from "@/lib/notification-data";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Updates" };

export default async function PortalNotificationsPage() {
  const profile = await getProfile();
  const items = await loadNotifications(profile, "portal");
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-[1.6rem] font-semibold leading-tight">Updates</h1>
      <p className="mb-5 text-sm text-muted">Replies and status changes on your organisation&apos;s requests.</p>
      <NotificationList items={items} />
    </div>
  );
}
