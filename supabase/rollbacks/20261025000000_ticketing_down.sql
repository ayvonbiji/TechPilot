-- =============================================================================
-- ROLLBACK for 20261025000000_ticketing.sql
--
-- Use only to undo the ticketing upgrade, together with redeploying the app
-- version from before it. Workspaces, members, clients and personal data stay.
--
-- WARNING: this permanently deletes every ticket, comment, ticket history entry,
-- SLA policy, notification, automation rule and client-technician assignment,
-- plus the new client contact fields and knowledge-base summary/problem fields.
-- Knowledge-base articles using a category introduced by the upgrade are moved
-- to 'Other technical issues' so the original category rule can be restored.
-- Take a backup first (Database → Backups, or pg_dump).
-- =============================================================================

begin;

drop table if exists public.notifications cascade;
drop table if exists public.automation_rules cascade;
drop table if exists public.ticket_events cascade;
drop table if exists public.ticket_comments cascade;
drop table if exists public.tickets cascade;
drop table if exists public.sla_policies cascade;
drop table if exists public.client_technicians cascade;

drop trigger if exists workspaces_seed_sla on public.workspaces;
drop trigger if exists clients_audit on public.clients;

drop function if exists public.sla_sweep(uuid);
drop function if exists public.sla_sweep_all();
drop function if exists public.sla_sweep_workspace(uuid);
drop function if exists public.member_names(uuid);
drop function if exists public.platform_overview();
drop function if exists public.audit_change();
drop function if exists public.require_staff_target();
drop function if exists public.ticket_comments_after_insert();
drop function if exists public.ticket_comments_before_insert();
drop function if exists public.tickets_after_update();
drop function if exists public.tickets_before_update();
drop function if exists public.tickets_after_insert();
drop function if exists public.tickets_before_insert();
drop function if exists public.client_of_user(uuid, uuid);
drop function if exists public.ticket_transition_allowed(text, text);
drop function if exists public.status_label(text);
drop function if exists public.notify(uuid, uuid, uuid, text, text, text, text);
drop function if exists public.is_staff_user(uuid, uuid);
drop function if exists public.display_name_of(uuid);
drop function if exists public.workspaces_after_insert();
drop function if exists public.seed_default_sla(uuid);

-- Original audit writer.
create or replace function public.write_audit(ws uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (workspace_id, actor_id, action, entity, entity_id, details)
  values (ws, auth.uid(), p_action, coalesce(p_entity, ''), p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;
revoke all on function public.write_audit(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
drop function if exists public.current_actor();

-- Knowledge base: original policies, columns and categories.
drop policy if exists troubleshooting_records_select on public.troubleshooting_records;
drop policy if exists troubleshooting_records_update on public.troubleshooting_records;
drop policy if exists troubleshooting_records_delete on public.troubleshooting_records;
create policy troubleshooting_records_select on public.troubleshooting_records
  for select to authenticated using (public.is_staff(workspace_id));
create policy troubleshooting_records_update on public.troubleshooting_records
  for update to authenticated using (((select auth.uid()) = user_id and public.is_staff(workspace_id)) or public.is_ws_admin(workspace_id))
  with check (public.is_staff(workspace_id));
create policy troubleshooting_records_delete on public.troubleshooting_records
  for delete to authenticated using (((select auth.uid()) = user_id and public.is_staff(workspace_id)) or public.is_ws_admin(workspace_id));

drop index if exists public.troubleshooting_records_id_ws_key;
alter table public.troubleshooting_records drop column if exists visibility;
alter table public.troubleshooting_records drop column if exists problem_description;
alter table public.troubleshooting_records drop column if exists summary;

update public.troubleshooting_records set category = 'Other technical issues' where category not in (
  'Windows troubleshooting', 'Hardware and peripherals', 'Networking', 'TCP/IP, DNS and DHCP', 'Printers and scanners',
  'Software installation', 'Microsoft 365', 'Windows Server and Active Directory', 'Remote support', 'Basic cybersecurity',
  'Other technical issues');
alter table public.troubleshooting_records drop constraint if exists troubleshooting_records_category_check;
alter table public.troubleshooting_records add constraint troubleshooting_records_category_check check (category in (
  'Windows troubleshooting', 'Hardware and peripherals', 'Networking', 'TCP/IP, DNS and DHCP', 'Printers and scanners',
  'Software installation', 'Microsoft 365', 'Windows Server and Active Directory', 'Remote support', 'Basic cybersecurity',
  'Other technical issues'));

alter table public.clients drop column if exists service_notes;
alter table public.clients drop column if exists primary_contact_email;
alter table public.clients drop column if exists primary_contact_name;

commit;
