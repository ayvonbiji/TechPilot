import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireStaff } from "@/lib/workspace";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_STATUSES } from "@/lib/tickets";
import { first } from "@/lib/utils";
import { Panel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { NewClientButton } from "@/components/clients/client-admin";

export const metadata: Metadata = { title: "Clients" };

interface Row {
  id: string;
  name: string;
  is_active: boolean;
  primary_contact_name: string;
  primary_contact_email: string;
  email: string;
  created_at: string;
}

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { workspace } = await requireStaff();
  if (workspace.type === "personal") {
    return (
      <>
        <PageHeader title="Clients" />
        <Panel>
          <EmptyState
            icon={Building2}
            title="Clients live in a freelance or organisation workspace"
            description="Create one to manage customer organisations, give them a portal and track their tickets separately."
            action={<Button asChild><Link href="/workspaces/new">New workspace</Link></Button>}
          />
        </Panel>
      </>
    );
  }
  const supabase = await createClient();
  const status = first(sp.status) ?? "active";
  const q = (first(sp.q) ?? "").trim().toLowerCase().slice(0, 100);
  const [clientsRes, openRes, techRes, membersRes] = await Promise.all([
    supabase.from("clients").select("id,name,is_active,primary_contact_name,primary_contact_email,email,created_at").eq("workspace_id", workspace.id).order("name"),
    supabase.from("tickets").select("client_id").eq("workspace_id", workspace.id).in("status", ACTIVE_STATUSES).not("client_id", "is", null).limit(5000),
    supabase.from("client_technicians").select("client_id").eq("workspace_id", workspace.id),
    supabase.from("workspace_members").select("client_id").eq("workspace_id", workspace.id).eq("role", "client"),
  ]);
  const count = (rows: { client_id: string | null }[] | null) => {
    const m = new Map<string, number>();
    (rows ?? []).forEach((r) => r.client_id && m.set(r.client_id, (m.get(r.client_id) ?? 0) + 1));
    return m;
  };
  const open = count(openRes.data);
  const techs = count(techRes.data);
  const members = count(membersRes.data);
  const all = (clientsRes.data ?? []) as Row[];
  const rows = all.filter(
    (c) =>
      (status === "all" || (status === "active" ? c.is_active : !c.is_active)) &&
      (!q || `${c.name} ${c.primary_contact_name} ${c.primary_contact_email} ${c.email}`.toLowerCase().includes(q)),
  );

  return (
    <>
      <PageHeader title="Clients" description="Customer organisations you support. Each one's tickets, people and reports are kept separate." actions={<NewClientButton />} />
      <FilterBar
        className="mb-4"
        searchPlaceholder="Search clients"
        filters={[{ name: "status", label: "Status", emptyLabel: "Active clients", options: [{ value: "inactive", label: "Inactive" }, { value: "all", label: "All clients" }] }]}
      />
      <Panel>
        {rows.length === 0 ? (
          all.length ? (
            <EmptyState icon={Building2} title="No clients match" description="Try another search or status." />
          ) : (
            <EmptyState icon={Building2} title="No clients yet" description="Add the organisations you support. You can then invite their staff to the customer portal." action={<NewClientButton />} />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted">
                  <th scope="col" className="py-2.5 pl-5 pr-3 font-medium">Organisation</th>
                  <th scope="col" className="py-2.5 pr-3 font-medium">Primary contact</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-medium">Open tickets</th>
                  <th scope="col" className="py-2.5 pr-3 text-right font-medium">Portal users</th>
                  <th scope="col" className="py-2.5 pr-5 text-right font-medium">Technicians</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2/60">
                    <td className="py-3 pl-5 pr-3">
                      <Link href={`/clients/${c.id}`} className="font-medium hover:text-accent">{c.name}</Link>
                      {!c.is_active && <Badge className="ml-2">Inactive</Badge>}
                    </td>
                    <td className="py-3 pr-3 text-[13px] text-muted">
                      {c.primary_contact_name || "—"}
                      {c.primary_contact_email && <span className="block text-[12px]">{c.primary_contact_email}</span>}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {open.get(c.id) ? <Link href={`/tickets?client=${c.id}`} className="font-medium hover:text-accent">{open.get(c.id)}</Link> : <span className="text-subtle">0</span>}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums text-muted">{members.get(c.id) ?? 0}</td>
                    <td className="py-3 pr-5 text-right tabular-nums text-muted">{techs.get(c.id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
