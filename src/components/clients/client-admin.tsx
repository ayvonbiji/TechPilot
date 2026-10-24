"use client";

import { useState, useTransition } from "react";
import { Link2, Plus, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select, errorProps } from "@/components/ui/input";
import { CopyButton } from "@/components/shared/copy-button";
import { FormError } from "@/components/shared/form-error";
import { useActionForm } from "@/components/shared/use-action-form";
import { addClientTechnician, inviteCustomer, removeClientTechnician, setClientActive } from "@/lib/actions/clients";
import { customerInviteSchema } from "@/lib/validation/schemas";
import { NewClientDialog } from "./client-form";

export function NewClientButton() {
  // ?new=1 (e.g. from the dashboard's Add client button) opens the form straight away.
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(() => params.get("new") === "1");
  const close = () => {
    setOpen(false);
    if (params.get("new")) router.replace(pathname, { scroll: false });
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus /> New client</Button>
      <NewClientDialog open={open} onClose={close} />
    </>
  );
}

export function ActiveToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const r = await setClientActive(id, !active);
      if (r.ok) {
        toast.success(r.message ?? "Saved");
        setOpen(false);
      } else toast.error(r.error);
    });
  return (
    <>
      <Button variant={active ? "secondary" : "primary"} disabled={pending} onClick={() => (active ? setOpen(true) : run())}>
        {active ? "Deactivate" : "Reactivate"}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Deactivate ${name}?`}
        description="Existing tickets and history stay. The client won't be offered for new tickets until you reactivate it. Customer accounts keep portal access to their existing tickets."
        confirmLabel="Deactivate"
        pending={pending}
        onConfirm={run}
      />
    </>
  );
}

export function TechniciansEditor({
  clientId,
  assigned,
  staff,
  canEdit,
}: {
  clientId: string;
  assigned: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [pick, setPick] = useState("");
  const [pending, start] = useTransition();
  const available = staff.filter((s) => !assigned.some((a) => a.id === s.id));
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Saved");
      else toast.error(r.error ?? "Something went wrong");
    });
  return (
    <div className="space-y-3">
      {assigned.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {assigned.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              {a.name}
              {canEdit && (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeClientTechnician(clientId, a.id))} aria-label={`Remove ${a.name}`}>
                  <UserMinus /> Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No technicians assigned. New tickets from this client notify the workspace admins.</p>
      )}
      {canEdit && available.length > 0 && (
        <div className="flex gap-2">
          <label htmlFor="add-tech" className="sr-only">Technician to assign</label>
          <Select id="add-tech" value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1">
            <option value="">Choose a technician…</option>
            {available.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Button variant="secondary" disabled={!pick || pending} onClick={() => run(async () => { const r = await addClientTechnician(clientId, pick); if (r.ok) setPick(""); return r; })}>
            <UserPlus /> Assign
          </Button>
        </div>
      )}
    </div>
  );
}

export function CustomerInvite({ clientId }: { clientId: string }) {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<{ url: string; email: string } | null>(null);
  const { pending, fieldErrors, formError, submit } = useActionForm(customerInviteSchema);
  return (
    <div className="space-y-3">
      <form
        noValidate
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const target = email.trim().toLowerCase();
          submit({ email }, (input) => inviteCustomer(clientId, input), {
            onSuccess: (r) => {
              setLink({ url: r.data!.link, email: target });
              setEmail("");
            },
          });
        }}
      >
        <Field label="Invite a customer to the portal" htmlFor="cust-email" error={fieldErrors.email} className="flex-1">
          <Input id="cust-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@client.com" {...errorProps("cust-email", fieldErrors.email)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Creating…" : "Create invite link"}</Button>
      </form>
      <FormError message={formError} />
      {link && (
        <div className="rounded-lg border border-ok/30 bg-ok-soft p-3 text-[13px]" role="status">
          <p className="font-medium">Portal invite for {link.email}</p>
          <p className="mt-0.5 text-muted">Send this link yourself (email sending isn&apos;t set up). It works once, only for {link.email}, and expires in 7 days.</p>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
            <Link2 className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <code className="min-w-0 flex-1 truncate font-mono text-[12px]" data-testid="customer-invite-link">{link.url}</code>
            <CopyButton text={link.url} label="Copy invite link" showLabel className="bg-surface-2 hover:bg-border" />
          </div>
        </div>
      )}
    </div>
  );
}
