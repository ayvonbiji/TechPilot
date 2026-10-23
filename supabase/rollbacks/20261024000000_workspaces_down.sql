-- =============================================================================
-- ROLLBACK for 20261024000000_workspaces.sql
--
-- Use only if the workspace upgrade must be undone shortly after deploying it,
-- together with redeploying the previous app version (main before the merge).
--
-- WARNING: this deletes every freelance/organisation workspace, their clients,
-- memberships, invitations and audit log, and any knowledge-base records or notes
-- that were created inside those workspaces. Personal data is kept: records and
-- notes in personal workspaces stay with their authors.
-- Take a backup first (Database → Backups, or pg_dump).
-- =============================================================================

begin;

-- Remove team-only knowledge (it has no owner-private equivalent).
delete from public.troubleshooting_records r
  using public.workspaces w where r.workspace_id = w.id and w.type <> 'personal';
delete from public.notes n
  using public.workspaces w where n.workspace_id = w.id and w.type <> 'personal';

-- Restore owner-only policies on the two shared tables.
do $$
declare
  t text;
begin
  foreach t in array array['troubleshooting_records', 'notes']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end;
$$;

drop trigger if exists troubleshooting_default_workspace on public.troubleshooting_records;
drop trigger if exists notes_default_workspace on public.notes;
alter table public.troubleshooting_records drop column if exists workspace_id;
alter table public.notes drop column if exists workspace_id;

-- Original sign-up trigger body (profile only).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), ''), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Original account deletion.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

drop function if exists public.workspace_roster(uuid);
drop function if exists public.delete_workspace(uuid);
drop function if exists public.remove_member(uuid, uuid);
drop function if exists public.set_member_role(uuid, uuid, text, uuid);
drop function if exists public.accept_invitation(text);
drop function if exists public.peek_invitation(text);
drop function if exists public.revoke_invitation(uuid);
drop function if exists public.create_invitation(uuid, text, text, uuid);
drop function if exists public.create_workspace(text, text, text);
drop function if exists public.default_personal_workspace();
drop function if exists public.ensure_personal_workspace(uuid);
drop function if exists public.write_audit(uuid, text, text, uuid, jsonb);

drop table if exists public.audit_log;
drop table if exists public.invitations;
drop table if exists public.platform_admins;
drop table if exists public.workspace_members;
drop table if exists public.clients;
drop table if exists public.workspaces;

drop function if exists public.is_platform_admin();
drop function if exists public.client_of(uuid);
drop function if exists public.is_ws_admin(uuid);
drop function if exists public.is_staff(uuid);
drop function if exists public.is_member(uuid);
drop function if exists public.member_role(uuid);

commit;
