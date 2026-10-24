import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getCurrentMembership, getMemberships, ROLE_LABELS, TYPE_LABELS } from "@/lib/workspace";
import { SwitchList } from "./switch-list";

export const metadata: Metadata = { title: "Switch workspace" };

/** Workspace chooser that works for every role, including customer accounts. */
export default async function SwitchPage() {
  await requireUser();
  const [memberships, current] = await Promise.all([getMemberships(), getCurrentMembership()]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Switch workspace</h1>
      <p className="mt-1 text-sm text-muted">Each workspace keeps its own tickets, clients and data.</p>
      <SwitchList
        currentId={current.workspace.id}
        items={memberships.map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          detail: m.role === "client" ? "Support portal" : `${TYPE_LABELS[m.workspace.type]}, ${ROLE_LABELS[m.role].toLowerCase()}`,
          portal: m.role === "client",
        }))}
      />
    </main>
  );
}
