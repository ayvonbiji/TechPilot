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

  return (
    <tr className="align-middle">
      <th scope="row" className="py-2.5 pl-4 pr-3 text-left text-[13px] font-medium">{priorityLabel(row.priority)}</th>
      {editing ? (
        <>
          <td className="py-2 pr-3"><DurationInput id={`fr-${row.priority}-${clientId ?? "ws"}`} label={`${priorityLabel(row.priority)} first response`} value={first} onChange={setFirst} /></td>
          <td className="py-2 pr-3"><DurationInput id={`rs-${row.priority}-${clientId ?? "ws"}`} label={`${priorityLabel(row.priority)} resolution`} value={res} onChange={setRes} /></td>
          <td className="py-2 pr-4 text-right">
            <div className="flex justify-end gap-1">
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
          </td>
        </>
      ) : (
        <>
          <td className="py-2.5 pr-3 text-[13px]">{formatMinutes(effective.first)}</td>
          <td className="py-2.5 pr-3 text-[13px]">{formatMinutes(effective.resolution)}</td>
          <td className="py-2.5 pr-4 text-right text-[12px]">
            {clientId && (row.override ? <span className="mr-2 text-accent">Client override</span> : <span className="mr-2 text-subtle">Workspace default</span>)}
            {canEdit && (
              <span className="inline-flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{clientId && !row.override ? "Override" : "Edit"}</Button>
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
          </td>
        </>
      )}
    </tr>
  );
}

/** SLA targets per priority, for the workspace (clientId null) or one client. */
export function SlaEditor({ rows, clientId, canEdit }: { rows: SlaRow[]; clientId: string | null; canEdit: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[12px] text-muted">
            <th scope="col" className="py-2 pl-4 pr-3 font-medium">Priority</th>
            <th scope="col" className="py-2 pr-3 font-medium">First response</th>
            <th scope="col" className="py-2 pr-3 font-medium">Resolution</th>
            <th scope="col" className="py-2 pr-4"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <RowEditor key={`${r.priority}-${r.override?.first}-${r.override?.resolution}-${r.base.first}-${r.base.resolution}`} row={r} clientId={clientId} canEdit={canEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
