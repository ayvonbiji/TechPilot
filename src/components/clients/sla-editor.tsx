"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { clearClientSla, saveSlaTarget } from "@/lib/actions/clients";
import { formatMinutes, priorityLabel, type TicketPriority } from "@/lib/tickets";

export interface SlaRow {
  priority: TicketPriority;
  base: { first: number | null; resolution: number | null };
  override?: { first: number | null; resolution: number | null } | null;
}

type Unit = "min" | "h" | "d";
const FACTOR: Record<Unit, number> = { min: 1, h: 60, d: 1440 };

function split(min: number | null): { amount: string; unit: Unit } {
  if (min === null) return { amount: "", unit: "h" };
  if (min % 1440 === 0) return { amount: String(min / 1440), unit: "d" };
  if (min % 60 === 0) return { amount: String(min / 60), unit: "h" };
  return { amount: String(min), unit: "min" };
}

function DurationInput({ id, label, value, onChange }: { id: string; label: string; value: { amount: string; unit: Unit }; onChange: (v: { amount: string; unit: Unit }) => void }) {
  return (
    <div className="flex gap-1.5">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Input id={id} inputMode="numeric" value={value.amount} onChange={(e) => onChange({ ...value, amount: e.target.value.replace(/[^\d]/g, "") })} placeholder="None" className="h-8 w-20 text-[13px]" />
      <label htmlFor={`${id}-unit`} className="sr-only">{label} unit</label>
      <Select id={`${id}-unit`} value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value as Unit })} className="h-8 w-24 text-[13px]">
        <option value="min">minutes</option>
        <option value="h">hours</option>
        <option value="d">days</option>
      </Select>
    </div>
  );
}

function RowEditor({ row, clientId, canEdit }: { row: SlaRow; clientId: string | null; canEdit: boolean }) {
  const effective = row.override ?? row.base;
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(split(effective.first));
  const [res, setRes] = useState(split(effective.resolution));
  const [pending, start] = useTransition();
  const toMin = (v: { amount: string; unit: Unit }) => (v.amount === "" ? null : Number(v.amount) * FACTOR[v.unit]);
  const id = `${row.priority}-${clientId ?? "ws"}`;
  const label = priorityLabel(row.priority);

  return (
    <li data-priority={row.priority} className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
      <span className="text-[13px] font-medium">{label}</span>
      {editing ? (
        <>
          <div>
            <span className="mb-1 block text-[12px] text-muted sm:hidden">First response</span>
            <DurationInput id={`fr-${id}`} label={`${label} first response`} value={first} onChange={setFirst} />
          </div>
          <div>
            <span className="mb-1 block text-[12px] text-muted sm:hidden">Resolution</span>
            <DurationInput id={`rs-${id}`} label={`${label} resolution`} value={res} onChange={setRes} />
          </div>
          <div className="flex gap-1 sm:justify-end">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveSlaTarget(clientId, { priority: row.priority, first_response_minutes: toMin(first), resolution_minutes: toMin(res) });
                  if (r.ok) {
                    toast.success(r.message ?? "Saved");
                    setEditing(false);
                  } else toast.error(r.error);
                })
              }
            >
              Save
            </Button>
          </div>
        </>
      ) : (
        <>
          <span className="text-[13px]"><span className="text-muted sm:hidden">First response: </span>{formatMinutes(effective.first)}</span>
          <span className="text-[13px]"><span className="text-muted sm:hidden">Resolution: </span>{formatMinutes(effective.resolution)}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] sm:justify-end">
            {clientId && (row.override ? <span className="text-accent">Client override</span> : <span className="text-subtle">Workspace default</span>)}
            {canEdit && (
              <span className="inline-flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-label={`${clientId && !row.override ? "Override" : "Edit"} ${label} targets`}>
                  {clientId && !row.override ? "Override" : "Edit"}
                </Button>
                {clientId && row.override && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await clearClientSla(clientId, row.priority);
                        if (r.ok) toast.success(r.message ?? "Removed");
                        else toast.error(r.error);
                      })
                    }
                  >
                    Use default
                  </Button>
                )}
              </span>
            )}
          </span>
        </>
      )}
    </li>
  );
}

/** SLA targets per priority, for the workspace (clientId null) or one client. Wraps on narrow screens. */
export function SlaEditor({ rows, clientId, canEdit }: { rows: SlaRow[]; clientId: string | null; canEdit: boolean }) {
  return (
    <div>
      <div className="hidden border-b border-border px-4 py-2 text-[12px] text-muted sm:grid sm:grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-x-4" aria-hidden>
        <span>Priority</span>
        <span>First response</span>
        <span>Resolution</span>
        <span />
      </div>
      <ul className="divide-y divide-border" aria-label="SLA targets by priority">
        {rows.map((r) => (
          <RowEditor key={`${r.priority}-${r.override?.first}-${r.override?.resolution}-${r.base.first}-${r.base.resolution}`} row={r} clientId={clientId} canEdit={canEdit} />
        ))}
      </ul>
    </div>
  );
}
