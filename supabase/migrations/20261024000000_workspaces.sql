-- =============================================================================
-- TechPilot ITSM — Phase 2: workspaces, membership, roles, invitations
--
-- ADDITIVE ONLY. No existing table or column is dropped or renamed.
-- Existing users each get a personal workspace; existing knowledge-base records
-- and notes are attached to it and stay private exactly as before.
-- Safe to run on a live database; wrap in a backup first (see docs/DEPLOYMENT.md).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id             uuid primary key default gen_random_uuid(),
  type           text not null check (type in ('personal', 'freelance', 'organisation')),
  name           text not null check (char_length(name) between 1 and 80),
  ticket_prefix  text not null default 'TP' check (ticket_prefix ~ '^[A-Z]{2,6}$'),
  ticket_seq     integer not null default 0 check (ticket_seq >= 0),
  brand_color    text check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_url       text check (logo_url ~* '^https://[^\s]+$' and char_length(logo_url) <= 1024),
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Exactly one personal workspace per user.
create unique index workspaces_one_personal_per_user on public.workspaces (created_by) where type = 'personal';

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- Customer organisations served by a workspace (expanded in Phase 4).
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  email         text not null default '' check (char_length(email) <= 254),
  phone         text not null default '' check (char_length(phone) <= 40),
  address       text not null default '' check (char_length(address) <= 500),
  notes         text not null default '' check (char_length(notes) <= 5000),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, workspace_id)
);

create index clients_workspace_idx on public.clients (workspace_id, name);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null check (role in ('owner', 'admin', 'agent', 'client')),
  client_id     uuid,
  joined_at     timestamptz not null default now(),
  primary key (workspace_id, user_id),
  -- A client user is always bound to exactly one client of the same workspace.
  foreign key (client_id, workspace_id) references public.clients (id, workspace_id) on delete cascade,
  check ((role = 'client') = (client_id is not null))
);

create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  email         text not null check (email = lower(email) and char_length(email) between 3 and 254),
  role          text not null check (role in ('admin', 'agent', 'client')),
  client_id     uuid,
  token_hash    text not null unique,
  invited_by    uuid references auth.users (id) on delete set null,
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_at   timestamptz,
  accepted_by   uuid references auth.users (id) on delete set null,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  foreign key (client_id, workspace_id) references public.clients (id, workspace_id) on delete cascade,
  check ((role = 'client') = (client_id is not null))
);

create index invitations_workspace_idx on public.invitations (workspace_id, created_at desc);

create table public.audit_log (
  id            bigint generated always as identity primary key,
  workspace_id  uuid references public.workspaces (id) on delete cascade,
  actor_id      uuid references auth.users (id) on delete set null,
  action        text not null check (char_length(action) between 1 and 80),
  entity        text not null default '' check (char_length(entity) <= 80),
  entity_id     uuid,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index audit_log_workspace_idx on public.audit_log (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Authorisation helpers (security definer so policies don't recurse into RLS)
-- ---------------------------------------------------------------------------

create or replace function public.member_role(ws uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.workspace_members where workspace_id = ws and user_id = auth.uid();
$$;

create or replace function public.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.workspace_members where workspace_id = ws and user_id = auth.uid());
$$;

create or replace function public.is_staff(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner', 'admin', 'agent')
  );
$$;

create or replace function public.is_ws_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function public.client_of(ws uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select client_id from public.workspace_members where workspace_id = ws and user_id = auth.uid() and role = 'client';
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.write_audit(ws uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (workspace_id, actor_id, action, entity, entity_id, details)
  values (ws, auth.uid(), p_action, coalesce(p_entity, ''), p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- Personal workspace for every user (new and existing)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_personal_workspace(uid uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  select id into ws from public.workspaces where created_by = uid and type = 'personal';
  if ws is null then
    insert into public.workspaces (type, name, created_by) values ('personal', 'Personal', uid) returning id into ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner')
      on conflict do nothing;
  end if;
  return ws;
end;
$$;

-- Extend the sign-up trigger: profile (as before) + personal workspace.
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
  perform public.ensure_personal_workspace(new.id);
  return new;
end;
$$;

-- Backfill existing users.
do $$ begin
  perform public.ensure_personal_workspace(id) from auth.users;
end $$;

-- ---------------------------------------------------------------------------
-- Knowledge base and notes become workspace-aware (shareable with staff)
-- ---------------------------------------------------------------------------

alter table public.troubleshooting_records add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.notes add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

update public.troubleshooting_records r set workspace_id = w.id
  from public.workspaces w where r.workspace_id is null and w.created_by = r.user_id and w.type = 'personal';
update public.notes n set workspace_id = w.id
  from public.workspaces w where n.workspace_id is null and w.created_by = n.user_id and w.type = 'personal';

create index if not exists troubleshooting_workspace_idx on public.troubleshooting_records (workspace_id, created_at desc);
create index if not exists notes_workspace_idx on public.notes (workspace_id, updated_at desc);

-- Rows inserted without a workspace (e.g. by the previous app version during a
-- rolling deploy) land in the author's personal workspace.
create or replace function public.default_personal_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.workspace_id is null then
    new.workspace_id := public.ensure_personal_workspace(new.user_id);
  end if;
  return new;
end;
$$;

create trigger troubleshooting_default_workspace
  before insert on public.troubleshooting_records
  for each row execute function public.default_personal_workspace();
create trigger notes_default_workspace
  before insert on public.notes
  for each row execute function public.default_personal_workspace();

-- Replace the owner-only policies. Access now follows current membership:
-- staff of the workspace read and add; authors edit their own rows while they
-- remain staff; workspace admins can edit or remove any row. A personal
-- workspace has a single member, so personal records stay private as before.
-- Someone who leaves an organisation loses access to its records.
drop policy if exists troubleshooting_records_select_own on public.troubleshooting_records;
drop policy if exists troubleshooting_records_insert_own on public.troubleshooting_records;
drop policy if exists troubleshooting_records_update_own on public.troubleshooting_records;
drop policy if exists troubleshooting_records_delete_own on public.troubleshooting_records;
drop policy if exists notes_select_own on public.notes;
drop policy if exists notes_insert_own on public.notes;
drop policy if exists notes_update_own on public.notes;
drop policy if exists notes_delete_own on public.notes;

do $$
declare
  t text;
begin
  foreach t in array array['troubleshooting_records', 'notes']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_staff(workspace_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id and (workspace_id is null or public.is_staff(workspace_id)))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (((select auth.uid()) = user_id and public.is_staff(workspace_id)) or public.is_ws_admin(workspace_id)) with check (public.is_staff(workspace_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (((select auth.uid()) = user_id and public.is_staff(workspace_id)) or public.is_ws_admin(workspace_id))',
      t || '_delete', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS for the new tables
-- ---------------------------------------------------------------------------

alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.clients           enable row level security;
alter table public.platform_admins   enable row level security;
alter table public.invitations       enable row level security;
alter table public.audit_log         enable row level security;

create policy workspaces_select on public.workspaces
  for select to authenticated using (public.is_member(id) or public.is_platform_admin());
-- Admins may edit name, prefix and branding only (column grants below).
create policy workspaces_update on public.workspaces
  for update to authenticated using (public.is_ws_admin(id)) with check (public.is_ws_admin(id));

-- Members: staff see the whole roster; client users see only themselves.
create policy workspace_members_select on public.workspace_members
  for select to authenticated using (
    user_id = (select auth.uid()) or public.is_staff(workspace_id) or public.is_platform_admin()
  );

-- Clients: staff manage; a client user can read only their own client record.
create policy clients_select on public.clients
  for select to authenticated using (public.is_staff(workspace_id) or id = public.client_of(workspace_id));
create policy clients_insert on public.clients
  for insert to authenticated with check (public.is_staff(workspace_id));
create policy clients_update on public.clients
  for update to authenticated using (public.is_staff(workspace_id)) with check (public.is_staff(workspace_id));
create policy clients_delete on public.clients
  for delete to authenticated using (public.is_ws_admin(workspace_id));

create policy platform_admins_select on public.platform_admins
  for select to authenticated using (user_id = (select auth.uid()));

create policy invitations_select on public.invitations
  for select to authenticated using (public.is_ws_admin(workspace_id));

create policy audit_log_select on public.audit_log
  for select to authenticated using (public.is_ws_admin(workspace_id) or public.is_platform_admin());

-- Privileges. Membership, invitations and audit rows are written only through
-- the functions below, never by direct inserts from the API.
revoke all on public.workspaces, public.workspace_members, public.clients, public.platform_admins,
              public.invitations, public.audit_log from anon;
revoke all on public.workspaces, public.workspace_members, public.platform_admins,
              public.invitations, public.audit_log from authenticated;
grant select on public.workspaces, public.workspace_members, public.platform_admins,
              public.invitations, public.audit_log to authenticated;
grant update (name, ticket_prefix, brand_color, logo_url) on public.workspaces to authenticated;
grant select, insert, update, delete on public.clients to authenticated;

-- ---------------------------------------------------------------------------
-- Workspace operations (all checks happen here, inside the database)
-- ---------------------------------------------------------------------------

create or replace function public.create_workspace(p_name text, p_type text, p_prefix text default 'TP')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ws uuid;
begin
  if uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if p_type not in ('freelance', 'organisation') then raise exception 'Invalid workspace type' using errcode = '22023'; end if;
  if (select count(*) from public.workspaces where created_by = uid) >= 20 then
    raise exception 'Workspace limit reached' using errcode = '54000';
  end if;
  insert into public.workspaces (type, name, ticket_prefix, created_by)
  values (p_type, trim(p_name), upper(coalesce(nullif(trim(p_prefix), ''), 'TP')), uid)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, 'owner');
  perform public.write_audit(ws, 'workspace.created', 'workspace', ws, jsonb_build_object('type', p_type));
  return ws;
end;
$$;

create or replace function public.create_invitation(ws uuid, p_email text, p_role text, p_client uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
  inv uuid;
  r text := public.member_role(ws);
begin
  if r is null or r not in ('owner', 'admin') then raise exception 'Only workspace admins can invite' using errcode = '42501'; end if;
  if (select type from public.workspaces where id = ws) = 'personal' then
    raise exception 'Personal workspaces cannot have other members' using errcode = '22023';
  end if;
  if p_role = 'admin' and r <> 'owner' then raise exception 'Only owners can invite admins' using errcode = '42501'; end if;
  if exists (
    select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
    where m.workspace_id = ws and lower(u.email) = lower(trim(p_email))
  ) then
    raise exception 'That person is already a member' using errcode = '23505';
  end if;
  -- Supersede any pending invitation for the same email.
  update public.invitations set revoked_at = now()
    where workspace_id = ws and email = lower(trim(p_email)) and accepted_at is null and revoked_at is null;
  token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (workspace_id, email, role, client_id, token_hash, invited_by)
  values (ws, lower(trim(p_email)), p_role, p_client, encode(extensions.digest(token, 'sha256'), 'hex'), auth.uid())
  returning id into inv;
  perform public.write_audit(ws, 'invitation.created', 'invitation', inv, jsonb_build_object('email', lower(trim(p_email)), 'role', p_role));
  return token; -- shown once to the admin; only the hash is stored
end;
$$;

create or replace function public.revoke_invitation(inv uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
begin
  select workspace_id into ws from public.invitations where id = inv;
  if ws is null or not public.is_ws_admin(ws) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.invitations set revoked_at = now() where id = inv and accepted_at is null;
  perform public.write_audit(ws, 'invitation.revoked', 'invitation', inv, '{}'::jsonb);
end;
$$;

-- What an invitee can see before accepting (no other workspace data).
create or replace function public.peek_invitation(p_token text)
returns table (workspace_name text, workspace_type text, role text, email text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select w.name, w.type, i.role, i.email,
         case when i.accepted_at is not null then 'accepted'
              when i.revoked_at is not null then 'revoked'
              when i.expires_at < now() then 'expired'
              else 'pending' end
  from public.invitations i join public.workspaces w on w.id = i.workspace_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  my_email text;
  i public.invitations%rowtype;
begin
  if uid is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  select * into i from public.invitations
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if i.id is null or i.revoked_at is not null or i.accepted_at is not null or i.expires_at < now() then
    raise exception 'This invitation is invalid or has expired' using errcode = '22023';
  end if;
  select lower(email) into my_email from auth.users where id = uid;
  if my_email is distinct from i.email then
    raise exception 'This invitation was sent to a different email address' using errcode = '42501';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role, client_id)
  values (i.workspace_id, uid, i.role, i.client_id)
  on conflict (workspace_id, user_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = uid where id = i.id;
  perform public.write_audit(i.workspace_id, 'invitation.accepted', 'invitation', i.id, jsonb_build_object('role', i.role));
  return i.workspace_id;
end;
$$;

create or replace function public.set_member_role(ws uuid, p_user uuid, p_role text, p_client uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := public.member_role(ws);
  target text;
begin
  select role into target from public.workspace_members where workspace_id = ws and user_id = p_user;
  if target is null then raise exception 'Member not found' using errcode = '22023'; end if;
  if me is null or me not in ('owner', 'admin') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_role not in ('owner', 'admin', 'agent', 'client') then raise exception 'Invalid role' using errcode = '22023'; end if;
  -- Only owners can create or change owners and admins.
  if (p_role in ('owner', 'admin') or target in ('owner', 'admin')) and me <> 'owner' then
    raise exception 'Only owners can change admins or owners' using errcode = '42501';
  end if;
  if target = 'owner' and p_role <> 'owner'
     and (select count(*) from public.workspace_members where workspace_id = ws and role = 'owner') = 1 then
    raise exception 'A workspace needs at least one owner' using errcode = '22023';
  end if;
  update public.workspace_members
    set role = p_role, client_id = case when p_role = 'client' then p_client else null end
    where workspace_id = ws and user_id = p_user;
  perform public.write_audit(ws, 'member.role_changed', 'user', p_user, jsonb_build_object('from', target, 'to', p_role));
end;
$$;

create or replace function public.remove_member(ws uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := public.member_role(ws);
  target text;
begin
  select role into target from public.workspace_members where workspace_id = ws and user_id = p_user;
  if target is null then raise exception 'Member not found' using errcode = '22023'; end if;
  if (select type from public.workspaces where id = ws) = 'personal' then
    raise exception 'You cannot leave your personal workspace' using errcode = '22023';
  end if;
  -- Anyone may leave; admins may remove agents/clients; owners may remove anyone.
  if p_user <> auth.uid() then
    if me is null or me not in ('owner', 'admin') then raise exception 'Not allowed' using errcode = '42501'; end if;
    if target in ('owner', 'admin') and me <> 'owner' then raise exception 'Only owners can remove admins or owners' using errcode = '42501'; end if;
  end if;
  if target = 'owner' and (select count(*) from public.workspace_members where workspace_id = ws and role = 'owner') = 1 then
    raise exception 'A workspace needs at least one owner. Transfer ownership first.' using errcode = '22023';
  end if;
  delete from public.workspace_members where workspace_id = ws and user_id = p_user;
  perform public.write_audit(ws, case when p_user = auth.uid() then 'member.left' else 'member.removed' end, 'user', p_user, jsonb_build_object('role', target));
end;
$$;

create or replace function public.delete_workspace(ws uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.member_role(ws) is distinct from 'owner' then raise exception 'Only owners can delete a workspace' using errcode = '42501'; end if;
  if (select type from public.workspaces where id = ws) = 'personal' then
    raise exception 'Your personal workspace is removed only with your account' using errcode = '22023';
  end if;
  delete from public.workspaces where id = ws;
end;
$$;

-- Account deletion now refuses to orphan a shared workspace.
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
  if exists (
    select 1 from public.workspace_members m
    where m.user_id = uid and m.role = 'owner'
      and (select count(*) from public.workspace_members o where o.workspace_id = m.workspace_id and o.role = 'owner') = 1
      and (select count(*) from public.workspace_members a where a.workspace_id = m.workspace_id) > 1
  ) then
    raise exception 'You are the only owner of a workspace with other members. Transfer ownership or delete it first.' using errcode = '22023';
  end if;
  -- Workspaces where the user is the sole member go with them.
  delete from public.workspaces w
    where exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = uid)
      and (select count(*) from public.workspace_members a where a.workspace_id = w.id) = 1;
  delete from auth.users where id = uid;
end;
$$;


-- Names and emails of a workspace's members, for its staff only.
create or replace function public.workspace_roster(ws uuid)
returns table (user_id uuid, display_name text, email text, role text, client_id uuid, joined_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, coalesce(p.display_name, ''), u.email::text, m.role, m.client_id, m.joined_at
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.id = m.user_id
  where m.workspace_id = ws and public.is_staff(ws)
  order by case m.role when 'owner' then 0 when 'admin' then 1 when 'agent' then 2 else 3 end, m.joined_at;
$$;

-- Function privileges: callable by signed-in users only (each checks roles itself).
do $$
declare
  f text;
begin
  foreach f in array array[
    'member_role(uuid)', 'is_member(uuid)', 'is_staff(uuid)', 'is_ws_admin(uuid)', 'client_of(uuid)',
    'is_platform_admin()', 'create_workspace(text, text, text)', 'create_invitation(uuid, text, text, uuid)',
    'revoke_invitation(uuid)', 'peek_invitation(text)', 'accept_invitation(text)',
    'set_member_role(uuid, uuid, text, uuid)', 'remove_member(uuid, uuid)', 'delete_workspace(uuid)',
    'delete_own_account()', 'workspace_roster(uuid)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- The invite page shows the workspace name to the link holder before sign-in.
grant execute on function public.peek_invitation(text) to anon;

-- Internal helpers: not callable from the API at all.
revoke all on function public.write_audit(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.ensure_personal_workspace(uuid) from public, anon, authenticated;
revoke all on function public.default_personal_workspace() from public, anon, authenticated;
