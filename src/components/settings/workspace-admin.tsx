"use client";

import { useState, useTransition } from "react";
import { Link2, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/card";
import { Field, Input, Select, errorProps } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormError } from "@/components/shared/form-error";
import { CopyButton } from "@/components/shared/copy-button";
import { useActionForm } from "@/components/shared/use-action-form";
import {
  deleteWorkspace,
  inviteMember,
  removeMember,
  revokeInvitation,
  setMemberRole,
  updateWorkspace,
} from "@/lib/actions/workspaces";
import { inviteSchema, workspaceUpdateSchema } from "@/lib/validation/schemas";
import { WorkspaceMark } from "@/components/layout/workspace-switcher";

type Role = "owner" | "admin" | "agent" | "client";
const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Administrator", agent: "Technician", client: "Client" };

export interface WorkspaceInfo {
  id: string;
  name: string;
  type: "personal" | "freelance" | "organisation";
  ticket_prefix: string;
  brand_color: string | null;
  logo_url: string | null;
}

export function GeneralSettings({ ws }: { ws: WorkspaceInfo }) {
  const [values, setValues] = useState({
    name: ws.name,
    ticket_prefix: ws.ticket_prefix,
    brand_color: ws.brand_color ?? "",
    logo_url: ws.logo_url ?? "",
  });
  const { pending, fieldErrors, formError, submit } = useActionForm(workspaceUpdateSchema);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const preview = { name: values.name || ws.name, type: ws.type, brand_color: /^#[0-9a-f]{6}$/i.test(values.brand_color) ? values.brand_color : null, logo_url: values.logo_url.startsWith("https://") ? values.logo_url : null };

  return (
    <Panel>
      <PanelHeader title="General and branding" description="Branding appears in the workspace switcher and on the client portal." />
      <PanelBody>
        <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(values, updateWorkspace); }}>
          <FormError message={formError} />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="Name" htmlFor="name" required error={fieldErrors.name}>
              <Input id="name" value={values.name} onChange={set("name")} maxLength={80} {...errorProps("name", fieldErrors.name)} />
            </Field>
            <Field label="Ticket prefix" htmlFor="ticket_prefix" error={fieldErrors.ticket_prefix} hint="Applies to new tickets only.">
              <Input id="ticket_prefix" value={values.ticket_prefix} onChange={(e) => setValues((v) => ({ ...v, ticket_prefix: e.target.value.toUpperCase() }))} maxLength={6} className="font-mono" {...errorProps("ticket_prefix", fieldErrors.ticket_prefix)} />
            </Field>
            <Field label="Brand colour" htmlFor="brand_color" error={fieldErrors.brand_color} hint="Optional, e.g. #1f6feb">
              <div className="flex gap-2">
                <input type="color" aria-label="Pick brand colour" value={preview.brand_color ?? "#2f5bea"} onChange={(e) => setValues((v) => ({ ...v, brand_color: e.target.value }))} className="h-9 w-11 cursor-pointer rounded-lg border border-border-strong bg-surface p-1" />
                <Input id="brand_color" value={values.brand_color} onChange={set("brand_color")} maxLength={7} className="font-mono" {...errorProps("brand_color", fieldErrors.brand_color)} />
              </div>
            </Field>
            <Field label="Logo URL" htmlFor="logo_url" error={fieldErrors.logo_url} hint="Optional https:// link to a square image.">
              <Input id="logo_url" value={values.logo_url} onChange={set("logo_url")} {...errorProps("logo_url", fieldErrors.logo_url)} />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] text-muted"><WorkspaceMark ws={preview} /> Preview</span>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

export interface RosterRow {
  user_id: string;
  display_name: string;
  email: string;
  role: Role;
  joined_at: string;
}

export function MembersPanel({ roster, me, myRole }: { roster: RosterRow[]; me: string; myRole: Role }) {
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<RosterRow | null>(null);
  const owners = roster.filter((r) => r.role === "owner").length;

  const canEdit = (r: RosterRow) => r.user_id !== me && r.role !== "client" && (myRole === "owner" || (myRole === "admin" && r.role === "agent"));
  const roleOptions: Role[] = myRole === "owner" ? ["owner", "admin", "agent"] : ["agent"];

  return (
    <Panel>
      <PanelHeader title="Members" description={`${roster.length} member${roster.length === 1 ? "" : "s"}`} />
      <ul className="divide-y divide-border">
        {roster.map((r) => (
          <li key={r.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {r.display_name || r.email}
                {r.user_id === me && <span className="ml-2 text-[12px] font-normal text-muted">You</span>}
              </span>
              <span className="block truncate text-[12px] text-muted">{r.email}</span>
            </span>
            {canEdit(r) ? (
              <Select
                aria-label={`Role for ${r.display_name || r.email}`}
                value={r.role}
                disabled={pending}
                className="w-40"
                onChange={(e) =>
                  start(async () => {
                    const res = await setMemberRole(r.user_id, e.target.value);
                    if (res.ok) toast.success(res.message ?? "Role updated");
                    else toast.error(res.error);
                  })
                }
              >
                {(roleOptions.includes(r.role) ? roleOptions : [r.role, ...roleOptions]).map((o) => (
                  <option key={o} value={o}>{ROLE_LABEL[o]}</option>
                ))}
              </Select>
            ) : (
              <Badge tone={r.role === "owner" ? "accent" : r.role === "client" ? "info" : "neutral"}>{ROLE_LABEL[r.role]}</Badge>
            )}
            {r.user_id !== me && (myRole === "owner" || (myRole === "admin" && (r.role === "agent" || r.role === "client"))) && !(r.role === "owner" && owners === 1) && (
              <Button variant="danger-ghost" size="icon-sm" aria-label={`Remove ${r.display_name || r.email}`} onClick={() => setRemoving(r)}>
                <UserMinus />
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.display_name || removing?.email}?`}
        description="They lose access to this workspace immediately. Records they created stay in the workspace."
        confirmLabel="Remove member"
        pending={pending}
        onConfirm={() =>
          start(async () => {
            if (!removing) return;
            const res = await removeMember(removing.user_id);
            if (res.ok) toast.success("Member removed");
            else toast.error(res.error);
            setRemoving(null);
          })
        }
      />
    </Panel>
  );
}

export interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  created_at: string;
}

export function InvitePanel({ myRole, pendingInvites }: { myRole: Role; pendingInvites: PendingInvite[] }) {
  const [values, setValues] = useState({ email: "", role: "agent" });
  const [link, setLink] = useState<{ url: string; email: string } | null>(null);
  const [revoking, startRevoke] = useTransition();
  const { pending, fieldErrors, formError, submit } = useActionForm(inviteSchema);

  return (
    <Panel>
      <PanelHeader title="Invite people" description="Technicians work tickets; administrators also manage members and settings." />
      <PanelBody className="space-y-4">
        <form
          noValidate
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const email = values.email.trim().toLowerCase();
            submit(values, inviteMember, {
              onSuccess: (res) => {
                setLink({ url: res.data!.link, email });
                setValues((v) => ({ ...v, email: "" }));
              },
            });
          }}
        >
          <Field label="Email" htmlFor="invite-email" error={fieldErrors.email}>
            <Input id="invite-email" type="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} {...errorProps("email", fieldErrors.email)} />
          </Field>
          <Field label="Role" htmlFor="invite-role" error={fieldErrors.role}>
            <Select id="invite-role" value={values.role} onChange={(e) => setValues((v) => ({ ...v, role: e.target.value }))}>
              <option value="agent">Technician</option>
              {myRole === "owner" && <option value="admin">Administrator</option>}
            </Select>
          </Field>
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create invite link"}</Button>
        </form>
        <FormError message={formError} />
        {link && (
          <div className="rounded-lg border border-ok/30 bg-ok-soft p-3 text-[13px]" role="status">
            <p className="font-medium">Invite link for {link.email}</p>
            <p className="mt-0.5 text-muted">
              Email sending isn&apos;t set up yet, so send this link yourself. It works once, only for {link.email}, and expires in 7 days. It won&apos;t be shown again.
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
              <Link2 className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <code className="min-w-0 flex-1 truncate font-mono text-[12px]" data-testid="invite-link">{link.url}</code>
              <CopyButton text={link.url} label="Copy invite link" showLabel className="bg-surface-2 hover:bg-border" />
            </div>
          </div>
        )}
        {pendingInvites.length > 0 && (
          <div>
            <h3 className="mb-2 text-[13px] font-medium">Pending invitations</h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {pendingInvites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{i.email}</span>
                  <Badge>{ROLE_LABEL[i.role]}</Badge>
                  <span className="hidden text-[12px] text-muted sm:inline">expires {new Date(i.expires_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoking}
                    onClick={() =>
                      startRevoke(async () => {
                        const res = await revokeInvitation(i.id);
                        if (res.ok) toast.success("Invitation revoked");
                        else toast.error(res.error);
                      })
                    }
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}

export function DeleteWorkspacePanel({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { pending, fieldErrors, formError, submit } = useActionForm(null);
  return (
    <Panel className="border-danger/30">
      <PanelBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-danger">Delete workspace</p>
          <p className="text-sm text-muted">Permanently deletes the workspace, its clients and its shared records for every member.</p>
        </div>
        <Button variant="danger" onClick={() => setOpen(true)}><Trash2 /> Delete workspace</Button>
      </PanelBody>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setText(""); }}
        title={`Delete ${name}?`}
        confirmLabel="Delete workspace permanently"
        pending={pending}
        description={
          <div className="space-y-3">
            <p>Every member loses access and all of the workspace&apos;s data is deleted. Personal workspaces are not affected.</p>
            <FormError message={formError && !fieldErrors.confirm ? formError : null} />
            <Field label={`Type ${name} to confirm`} htmlFor="confirm-ws" error={fieldErrors.confirm}>
              <Input id="confirm-ws" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" {...errorProps("confirm", fieldErrors.confirm)} />
            </Field>
          </div>
        }
        onConfirm={() => submit(text, (input) => deleteWorkspace(String(input)))}
      />
    </Panel>
  );
}
