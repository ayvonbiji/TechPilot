import { NextResponse, type NextRequest } from "next/server";
import { getProfile, getUser } from "@/lib/auth";
import { getCurrentMembership, isStaffRole } from "@/lib/workspace";
import { getClients, getPeople, loadMetricTickets } from "@/lib/ticket-data";
import { resolvePeriod } from "@/lib/period";
import { slaTarget, statusLabel, priorityLabel } from "@/lib/tickets";
import { toCsv } from "@/lib/reports";

/** CSV of tickets created or resolved in the period, with SLA results. Staff only. */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const m = await getCurrentMembership();
  if (!isStaffRole(m.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  const profile = await getProfile();
  const sp = request.nextUrl.searchParams;
  const period = resolvePeriod(sp.get("range") ?? undefined, sp.get("from") ?? undefined, sp.get("to") ?? undefined, profile.timezone);
  const [metric, people, clients] = await Promise.all([
    loadMetricTickets(m.workspace.id, { client: sp.get("client") ?? undefined, assignee: sp.get("assignee") ?? undefined }),
    getPeople(m.workspace.id),
    getClients(m.workspace.id),
  ]);
  if (metric.error) return NextResponse.json({ error: "Couldn't export" }, { status: 500 });
  const names = new Map(people.map((p) => [p.id, p.name]));
  const clientNames = new Map(clients.map((c) => [c.id, c.name]));
  const inPeriod = (iso: string | null) => !!iso && Date.parse(iso) >= period.from && Date.parse(iso) < period.to;
  const now = Date.now();
  const rows = metric.tickets
    .filter((t) => inPeriod(t.created_at) || inPeriod(t.resolved_at))
    .map((t) => ({
      reference: t.reference,
      subject: t.subject,
      client: t.client_id ? clientNames.get(t.client_id) ?? "" : "",
      category: t.category,
      priority: priorityLabel(t.priority),
      status: statusLabel(t.status),
      technician: t.assignee_id ? names.get(t.assignee_id) ?? "Former member" : "",
      created_at: t.created_at,
      first_response_due_at: t.first_response_due_at ?? "",
      first_responded_at: t.first_responded_at ?? "",
      first_response_sla: slaTarget(t.created_at, t.first_response_due_at, t.first_responded_at, now).state,
      resolution_due_at: t.resolution_due_at ?? "",
      resolved_at: t.resolved_at ?? "",
      resolution_sla: slaTarget(t.created_at, t.resolution_due_at, t.resolved_at ?? t.closed_at, now).state,
      closed_at: t.closed_at ?? "",
    }));
  const csv = toCsv(rows, Object.keys(rows[0] ?? { reference: "", subject: "", client: "", category: "", priority: "", status: "", technician: "", created_at: "", first_response_due_at: "", first_responded_at: "", first_response_sla: "", resolution_due_at: "", resolved_at: "", resolution_sla: "", closed_at: "" }));
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="service-report_${period.startDate}_to_${period.endDate}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
