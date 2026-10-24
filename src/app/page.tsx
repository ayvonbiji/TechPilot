import { redirect } from "next/navigation";
import { getCurrentMembership, isStaffRole } from "@/lib/workspace";

/** Home: the service desk dashboard in shared workspaces, the personal dashboard otherwise. */
export default async function Home() {
  const m = await getCurrentMembership();
  if (!isStaffRole(m.role)) redirect("/portal");
  redirect(m.workspace.type === "personal" ? "/dashboard" : "/overview");
}
