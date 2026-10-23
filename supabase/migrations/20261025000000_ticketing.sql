-- =============================================================================
-- TechPilot ITSM — ticketing, SLA, notifications, automation, KB visibility
--
-- ADDITIVE ONLY. Requires 20261024000000_workspaces.sql.
-- No table or column is dropped. Two things are replaced, not removed:
--   * the knowledge-base category CHECK is widened (every old value stays valid)
--   * the knowledge-base RLS policies gain the new visibility rule
-- Existing knowledge-base rows get visibility 'workspace', which is exactly how
-- they are shared today, so nobody gains or loses access by running this.
--
-- SLA deadlines are CALENDAR-TIME targets (24×7). Business hours are not applied;
-- the app labels deadlines accordingly.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Clients: contact and service fields, assigned technicians
-- ---------------------------------------------------------------------------

alter table public.clients add column if not exists primary_contact_name text not null default ''
  check (char_length(primary_contact_name) <= 120);
alter table public.clients add column if not exists primary_contact_email text not null default ''
  check (char_length(primary_contact_email) <= 254);
alter table public.clients add column if not exists service_notes text not null default ''
  check (char_length(service_notes) <= 5000);

create table public.client_technicians (
  client_id     uuid not null,
  workspace_id  uuid not null,
  user_id       uuid not null,
  created_at    timestamptz not null default now(),
  primary key (client_id, user_id),
  foreign key (client_id, workspace_id) references public.clients (id, workspace_id) on delete cascade,
  foreign key (workspace_id, user_id) references public.workspace_members (workspace_id, user_id) on delete cascade
);
create index client_technicians_user_idx on public.client_technicians (workspace_id, user_id);

-- ---------------------------------------------------------------------------
-- Knowledge base: summary, problem description, visibility, wider categories
-- ---------------------------------------------------------------------------

alter table public.troubleshooting_records add column if not exists summary text not null default ''
  check (char_length(summary) <= 500);
alter table public.troubleshooting_records add column if not exists problem_description text not null default ''
  check (char_length(problem_description) <= 10000);
alter table public.troubleshooting_records add column if not exists visibility text not null default 'workspace'
  check (visibility in ('private', 'workspace', 'public'));

alter table public.troubleshooting_records drop constraint if exists troubleshooting_records_category_check;
alter table public.troubleshooting_records add constraint troubleshooting_records_category_check check (category in (
  -- current categories
  'Windows troubleshooting', 'Computer hardware concepts', 'Networking and TCP/IP', 'DNS and DHCP',
  'Printers and peripherals', 'Windows Server', 'Active Directory and Group Policy', 'Microsoft 365',
  'Linux', 'Cloud fundamentals', 'Cybersecurity', 'General IT support',
  -- earlier categories, still valid for existing records
  'Hardware and peripherals', 'Networking', 'TCP/IP, DNS and DHCP', 'Printers and scanners',
  'Software installation', 'Windows Server and Active Directory', 'Remote support', 'Basic cybersecurity',
  'Other technical issues'));

-- Lets tickets reference an article in the same workspace only.
create unique index if not exists troubleshooting_records_id_ws_key on public.troubleshooting_records (id, workspace_id);

-- Visibility: private = author only; workspace = the workspace's staff;
-- public = staff plus that workspace's customers (in the portal). Never anonymous.
drop policy if exists troubleshooting_records_select on public.troubleshooting_records;
drop policy if exists troubleshooting_records_update on public.troubleshooting_records;
drop policy if exists troubleshooting_records_delete on public.troubleshooting_records;

create policy troubleshooting_records_select on public.troubleshooting_records
  for select to authenticated using (
    (public.is_staff(workspace_id) and (visibility <> 'private' or user_id = (select auth.uid())))
    or (visibility = 'public' and public.client_of(workspace_id) is not null)
  );
create policy troubleshooting_records_update on public.troubleshooting_records
  for update to authenticated using (
    ((select auth.uid()) = user_id and public.is_staff(workspace_id))
    or (public.is_ws_admin(workspace_id) and visibility <> 'private')
  ) with check (public.is_staff(workspace_id));
create policy troubleshooting_records_delete on public.troubleshooting_records
  for delete to authenticated using (
    ((select auth.uid()) = user_id and public.is_staff(workspace_id))
    or (public.is_ws_admin(workspace_id) and visibility <> 'private')
  );

-- ---------------------------------------------------------------------------
-- SLA policies (per workspace, optionally overridden per client)
-- ---------------------------------------------------------------------------

create table public.sla_policies (
  id                      uuid primary key default gen_random_uuid(),
  workspace_id            uuid not null references public.workspaces (id) on delete cascade,
  client_id               uuid,
  priority                text not null check (priority in ('low', 'medium', 'high', 'critical')),
  first_response_minutes  integer check (first_response_minutes between 1 and 525600),
  resolution_minutes      integer check (resolution_minutes between 1 and 525600),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  foreign key (client_id, workspace_id) references public.clients (id, workspace_id) on delete cascade,
  unique nulls not distinct (workspace_id, client_id, priority)
);
create trigger sla_policies_set_updated_at before update on public.sla_policies
  for each row execute function public.set_updated_at();

-- Sensible starting targets; admins change them in Settings.
create or replace function public.seed_default_sla(ws uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.sla_policies (workspace_id, client_id, priority, first_response_minutes, resolution_minutes)
  values (ws, null, 'critical', 60, 240), (ws, null, 'high', 240, 1440),
         (ws, null, 'medium', 480, 4320), (ws, null, 'low', 1440, 7200)
  on conflict do nothing;
$$;

create or replace function public.workspaces_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_sla(new.id);
  return new;
end;
$$;
create trigger workspaces_seed_sla after insert on public.workspaces
  for each row execute function public.workspaces_after_insert();

do $$ begin
  perform public.seed_default_sla(id) from public.workspaces;
end $$;

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------

create table public.tickets (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid not null references public.workspaces (id) on delete cascade,
  number                 integer not null,
  reference              text not null,
  subject                text not null check (char_length(subject) between 1 and 200),
  description            text not null default '' check (char_length(description) <= 20000),
  category               text not null default 'General support' check (char_length(category) between 1 and 60),
  priority               text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status                 text not null default 'open'
                         check (status in ('open', 'in_progress', 'waiting_customer', 'waiting_third_party', 'resolved', 'closed')),
  requester_id           uuid references auth.users (id) on delete set null,
  requester_name         text not null default '' check (char_length(requester_name) <= 120),
  requester_email        text not null default '' check (char_length(requester_email) <= 254),
  client_id              uuid,
  assignee_id            uuid references auth.users (id) on delete set null,
  kb_article_id          uuid,
  resolution_summary     text not null default '' check (char_length(resolution_summary) <= 10000),
  first_response_due_at  timestamptz,
  resolution_due_at      timestamptz,
  first_responded_at     timestamptz,
  resolved_at            timestamptz,
  closed_at              timestamptz,
  reopened_count         integer not null default 0,
  created_by             uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  search                 tsvector generated always as (
                           setweight(to_tsvector('simple', coalesce(reference, '')), 'A') ||
                           setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
                           setweight(to_tsvector('english', coalesce(description, '')), 'B')
                         ) stored,
  unique (workspace_id, number),
  unique (id, workspace_id),
  foreign key (client_id, workspace_id) references public.clients (id, workspace_id) on delete set null (client_id),
  foreign key (kb_article_id, workspace_id) references public.troubleshooting_records (id, workspace_id) on delete set null (kb_article_id)
);

create index tickets_ws_status_idx    on public.tickets (workspace_id, status);
create index tickets_ws_created_idx   on public.tickets (workspace_id, created_at desc);
create index tickets_ws_assignee_idx  on public.tickets (workspace_id, assignee_id);
create index tickets_ws_client_idx    on public.tickets (workspace_id, client_id);
create index tickets_ws_due_idx       on public.tickets (workspace_id, resolution_due_at);
create index tickets_search_idx       on public.tickets using gin (search);
create index tickets_creator_idx      on public.tickets (created_by, created_at);

create table public.ticket_comments (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null,
  workspace_id     uuid not null,
  author_id        uuid references auth.users (id) on delete set null,
  author_name      text not null default '',
  author_is_staff  boolean not null default false,
  body             text not null check (char_length(body) between 1 and 20000),
  is_internal      boolean not null default false,
  created_at       timestamptz not null default now(),
  foreign key (ticket_id, workspace_id) references public.tickets (id, workspace_id) on delete cascade
);
create index ticket_comments_ticket_idx on public.ticket_comments (ticket_id, created_at);
create index ticket_comments_author_idx on public.ticket_comments (author_id, created_at);

create table public.ticket_events (
  id            bigint generated always as identity primary key,
  ticket_id     uuid not null,
  workspace_id  uuid not null,
  actor_id      uuid references auth.users (id) on delete set null,
  actor_name    text not null default '',
  kind          text not null check (kind in ('created', 'status', 'priority', 'assignee', 'client', 'category', 'kb_link', 'sla')),
  from_value    text,
  to_value      text,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now(),
  foreign key (ticket_id, workspace_id) references public.tickets (id, workspace_id) on delete cascade
);
create index ticket_events_ticket_idx on public.ticket_events (ticket_id, created_at);

-- ---------------------------------------------------------------------------
-- Notifications and automation rules
-- ---------------------------------------------------------------------------

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  workspace_id  uuid references public.workspaces (id) on delete cascade,
  ticket_id     uuid references public.tickets (id) on delete cascade,
  kind          text not null check (kind in (
                  'ticket_created', 'ticket_assigned', 'priority_changed', 'status_changed', 'customer_reply',
                  'staff_reply', 'internal_note', 'sla_warning', 'sla_breach', 'ticket_resolved', 'ticket_closed')),
  title         text not null check (char_length(title) <= 300),
  body          text not null default '' check (char_length(body) <= 1000),
  dedupe_key    text not null,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.automation_rules (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  is_active       boolean not null default true,
  match_category  text check (char_length(match_category) between 1 and 60),
  match_priority  text check (match_priority in ('low', 'medium', 'high', 'critical')),
  action          text not null check (action in ('assign', 'notify')),
  target_user_id  uuid not null,
  position        integer not null default 0,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (workspace_id, target_user_id) references public.workspace_members (workspace_id, user_id) on delete cascade
);
create index automation_rules_ws_idx on public.automation_rules (workspace_id, position);
create trigger automation_rules_set_updated_at before update on public.automation_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- The signed-in user, or null if there is none or the account is being deleted
-- (so history rows never point at a user that no longer exists).
create or replace function public.current_actor()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where id = auth.uid();
$$;

-- Audit writer from the workspaces migration, now safe during cascading deletes:
-- skips rows for a workspace that is being deleted and drops a vanished actor.
create or replace function public.write_audit(ws uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if ws is not null and not exists (select 1 from public.workspaces where id = ws) then return; end if;
  insert into public.audit_log (workspace_id, actor_id, action, entity, entity_id, details)
  values (ws, public.current_actor(), p_action, coalesce(p_entity, ''), p_entity_id, coalesce(p_details, '{}'::jsonb));
end;
$$;

create or replace function public.display_name_of(uid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1), 'Someone')
  from auth.users u left join public.profiles p on p.id = u.id
  where u.id = uid;
$$;

create or replace function public.is_staff_user(ws uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.workspace_members
                 where workspace_id = ws and user_id = uid and role in ('owner', 'admin', 'agent'));
$$;

-- Insert one notification. Skips the person who caused it, non-members and duplicates.
create or replace function public.notify(uid uuid, ws uuid, t uuid, p_kind text, p_title text, p_body text, p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The person who caused an event isn't told about it, except SLA notices,
  -- which the sweep raises while that person is looking at the tickets.
  if uid is null or (uid is not distinct from auth.uid() and p_kind not in ('sla_warning', 'sla_breach')) then return; end if;
  if not exists (select 1 from public.workspace_members where workspace_id = ws and user_id = uid) then return; end if;
  insert into public.notifications (user_id, workspace_id, ticket_id, kind, title, body, dedupe_key)
  values (uid, ws, t, p_kind, left(p_title, 300), left(coalesce(p_body, ''), 1000), p_key)
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

-- The people responsible for a ticket: its technician, otherwise the client's
-- assigned technicians, otherwise the workspace owners/admins.
create or replace function public.ticket_watchers(t public.tickets)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if t.assignee_id is not null then
    return next t.assignee_id;
    return;
  end if;
  if t.client_id is not null and exists (select 1 from public.client_technicians where client_id = t.client_id) then
    return query select user_id from public.client_technicians where client_id = t.client_id;
    return;
  end if;
  return query select user_id from public.workspace_members where workspace_id = t.workspace_id and role in ('owner', 'admin');
end;
$$;

create or replace function public.status_label(s text)
returns text
language sql
immutable
as $$
  select case s when 'open' then 'Open' when 'in_progress' then 'In progress'
    when 'waiting_customer' then 'Waiting for customer' when 'waiting_third_party' then 'Waiting for third party'
    when 'resolved' then 'Resolved' when 'closed' then 'Closed' else s end;
$$;

-- Apply the SLA policy (client-specific first, then the workspace default) to a ticket row.
create or replace function public.apply_sla(t public.tickets)
returns public.tickets
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.sla_policies;
begin
  select * into p from public.sla_policies
    where workspace_id = t.workspace_id and priority = t.priority
      and (client_id = t.client_id or client_id is null)
    order by client_id nulls last limit 1;
  t.first_response_due_at := case when p.first_response_minutes is null then null
                                  else t.created_at + make_interval(mins => p.first_response_minutes) end;
  t.resolution_due_at := case when p.resolution_minutes is null then null
                              else t.created_at + make_interval(mins => p.resolution_minutes) end;
  return t;
end;
$$;

-- Allowed status changes. Reopening a closed ticket is checked separately (admins only).
create or replace function public.ticket_transition_allowed(old_s text, new_s text)
returns boolean
language sql
immutable
as $$
  select old_s = new_s or (old_s, new_s) in (
    ('open', 'in_progress'), ('open', 'waiting_customer'), ('open', 'waiting_third_party'), ('open', 'resolved'),
    ('in_progress', 'waiting_customer'), ('in_progress', 'waiting_third_party'), ('in_progress', 'resolved'),
    ('waiting_customer', 'in_progress'), ('waiting_customer', 'resolved'),
    ('waiting_third_party', 'in_progress'), ('waiting_third_party', 'resolved'),
    ('resolved', 'closed'), ('resolved', 'in_progress'),
    ('closed', 'in_progress'));
$$;

-- ---------------------------------------------------------------------------
-- Ticket triggers: numbering, protected fields, workflow, SLA, history, notifications
-- ---------------------------------------------------------------------------

create or replace function public.tickets_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r text := public.member_role(new.workspace_id);
  seq integer;
  prefix text;
  rule_user uuid;
begin
  -- uid is null only for a database administrator working directly in SQL.
  if uid is not null and r is null then raise exception 'You are not a member of this workspace' using errcode = '42501'; end if;
  if uid is not null and (select count(*) from public.tickets where created_by = uid and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many tickets created in the last hour. Try again later.' using errcode = '54000';
  end if;

  if r is not distinct from 'client' then
    -- Customers can only raise tickets for their own organisation, as themselves.
    new.client_id := public.client_of(new.workspace_id);
    new.requester_id := uid;
    new.requester_name := public.display_name_of(uid);
    new.requester_email := coalesce((select email from auth.users where id = uid), '');
    new.assignee_id := null;
    new.kb_article_id := null;
    new.resolution_summary := '';
  else
    if new.requester_id is not null and not exists (
      select 1 from public.workspace_members where workspace_id = new.workspace_id and user_id = new.requester_id
    ) then
      raise exception 'The requester must belong to this workspace' using errcode = '22023';
    end if;
    if new.requester_id is not null then
      new.requester_name := coalesce(nullif(new.requester_name, ''), public.display_name_of(new.requester_id));
    end if;
    -- A customer requester's tickets always belong to that customer's organisation.
    if new.requester_id is not null and public.client_of_user(new.workspace_id, new.requester_id) is not null then
      new.client_id := public.client_of_user(new.workspace_id, new.requester_id);
    end if;
  end if;

  new.status := 'open';
  new.first_responded_at := null;
  new.resolved_at := null;
  new.closed_at := null;
  new.reopened_count := 0;
  new.created_by := uid;
  new.created_at := now();
  new.updated_at := now();

  -- Unique, gap-free number per workspace (row lock on the workspace serialises inserts).
  update public.workspaces set ticket_seq = ticket_seq + 1 where id = new.workspace_id
    returning ticket_seq, ticket_prefix into seq, prefix;
  new.number := seq;
  new.reference := prefix || '-' || lpad(seq::text, 5, '0');

  -- Automation: first matching active "assign" rule, if nobody is assigned yet.
  if new.assignee_id is null then
    select a.target_user_id into rule_user from public.automation_rules a
      where a.workspace_id = new.workspace_id and a.is_active and a.action = 'assign'
        and (a.match_category is null or lower(a.match_category) = lower(new.category))
        and (a.match_priority is null or a.match_priority = new.priority)
        and public.is_staff_user(a.workspace_id, a.target_user_id)
      order by a.position, a.created_at limit 1;
    new.assignee_id := rule_user;
  end if;

  if new.assignee_id is not null and not public.is_staff_user(new.workspace_id, new.assignee_id) then
    raise exception 'Tickets can only be assigned to technicians of this workspace' using errcode = '22023';
  end if;

  new := public.apply_sla(new);
  return new;
end;
$$;

create or replace function public.client_of_user(ws uuid, uid uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select client_id from public.workspace_members where workspace_id = ws and user_id = uid and role = 'client';
$$;

create trigger tickets_before_insert before insert on public.tickets
  for each row execute function public.tickets_before_insert();

create or replace function public.tickets_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  w uuid;
  rule record;
  actor text := coalesce(public.display_name_of(auth.uid()), '');
begin
  insert into public.ticket_events (ticket_id, workspace_id, actor_id, actor_name, kind, to_value, is_public)
  values (new.id, new.workspace_id, public.current_actor(), actor, 'created', new.status, true);
  if new.assignee_id is not null then
    insert into public.ticket_events (ticket_id, workspace_id, actor_id, actor_name, kind, to_value)
    values (new.id, new.workspace_id, public.current_actor(), actor, 'assignee', new.assignee_id::text);
    perform public.notify(new.assignee_id, new.workspace_id, new.id, 'ticket_assigned',
      new.reference || ' assigned to you: ' || new.subject, '', 'assigned:' || new.id || ':' || new.assignee_id || ':created');
  end if;
  for w in select public.ticket_watchers(new) loop
    perform public.notify(w, new.workspace_id, new.id, 'ticket_created',
      'New ticket ' || new.reference || ': ' || new.subject,
      'Priority ' || new.priority || coalesce(', from ' || nullif(new.requester_name, ''), ''), 'created:' || new.id);
  end loop;
  -- Automation: "notify" rules.
  for rule in
    select a.id, a.target_user_id from public.automation_rules a
    where a.workspace_id = new.workspace_id and a.is_active and a.action = 'notify'
      and (a.match_category is null or lower(a.match_category) = lower(new.category))
      and (a.match_priority is null or a.match_priority = new.priority)
  loop
    perform public.notify(rule.target_user_id, new.workspace_id, new.id, 'ticket_created',
      'New ' || new.priority || ' ticket ' || new.reference || ': ' || new.subject, 'Matched an automation rule',
      'rule:' || rule.id || ':' || new.id);
  end loop;
  return new;
end;
$$;

create trigger tickets_after_insert after insert on public.tickets
  for each row execute function public.tickets_after_insert();

create or replace function public.tickets_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Nested updates come from the database itself: a customer reply moving the
  -- ticket back into progress, or a foreign key being cleared when a user,
  -- client or article is deleted. Changes with no signed-in user come from a
  -- database administrator (e.g. the Supabase SQL editor); API requests always
  -- carry a user. Both skip the staff-only checks below (the workflow still applies).
  system_change boolean := pg_trigger_depth() > 1 or auth.uid() is null;
  r text := public.member_role(old.workspace_id);
begin
  -- Identity and history fields never change.
  new.workspace_id := old.workspace_id;
  new.number := old.number;
  new.reference := old.reference;
  new.created_by := old.created_by;
  new.created_at := old.created_at;

  if not system_change then
    if r is null or r = 'client' then raise exception 'Only staff can change tickets' using errcode = '42501'; end if;
    -- Timestamps are managed here, not by callers.
    new.first_responded_at := old.first_responded_at;
    new.resolved_at := old.resolved_at;
    new.closed_at := old.closed_at;
    new.reopened_count := old.reopened_count;
    new.first_response_due_at := old.first_response_due_at;
    new.resolution_due_at := old.resolution_due_at;
  end if;

  if new.status <> old.status then
    if not public.ticket_transition_allowed(old.status, new.status) then
      raise exception 'A ticket can''t move from % to %', public.status_label(old.status), public.status_label(new.status)
        using errcode = '22023';
    end if;
    if old.status = 'closed' and not system_change and r not in ('owner', 'admin') then
      raise exception 'Only workspace admins can reopen a closed ticket' using errcode = '42501';
    end if;
    if new.status = 'resolved' and btrim(new.resolution_summary) = '' then
      raise exception 'Add a resolution summary before resolving the ticket' using errcode = '22023';
    end if;
    if new.status = 'resolved' then new.resolved_at := now(); end if;
    if new.status = 'closed' then new.closed_at := now(); new.resolved_at := coalesce(old.resolved_at, now()); end if;
    if old.status in ('resolved', 'closed') and new.status not in ('resolved', 'closed') then
      new.resolved_at := null;
      new.closed_at := null;
      new.reopened_count := old.reopened_count + 1;
    end if;
  end if;

  if new.assignee_id is distinct from old.assignee_id and new.assignee_id is not null
     and not public.is_staff_user(old.workspace_id, new.assignee_id) then
    raise exception 'Tickets can only be assigned to technicians of this workspace' using errcode = '22023';
  end if;
  if new.requester_id is distinct from old.requester_id and new.requester_id is not null and not exists (
    select 1 from public.workspace_members where workspace_id = old.workspace_id and user_id = new.requester_id
  ) then
    raise exception 'The requester must belong to this workspace' using errcode = '22023';
  end if;

  if new.priority <> old.priority or new.client_id is distinct from old.client_id then
    new := public.apply_sla(new);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger tickets_before_update before update on public.tickets
  for each row execute function public.tickets_before_update();

create or replace function public.tickets_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.current_actor();
  actor text := coalesce(public.display_name_of(actor_id), '');
  w uuid;
  stamp text := extract(epoch from clock_timestamp())::bigint::text;
begin
  if new.status <> old.status then
    insert into public.ticket_events (ticket_id, workspace_id, actor_id, actor_name, kind, from_value, to_value, is_public)
    values (new.id, new.workspace_id, actor_id, actor, 'status', old.status, new.status, true);
    if new.status in ('resolved', 'closed') then
      perform public.notify(new.requester_id, new.workspace_id, new.id,
        case new.status when 'resolved' then 'ticket_resolved' else 'ticket_closed' end,
        new.reference || ' ' || lower(public.status_label(new.status)) || ': ' || new.subject,
        left(new.resolution_summary, 300), 'status:' || new.id || ':' || new.status || ':' || stamp);
    else
      perform public.notify(new.requester_id, new.workspace_id, new.id, 'status_changed',
        new.reference || ' is now ' || lower(public.status_label(new.status)), new.subject,
        'status:' || new.id || ':' || new.status || ':' || stamp);
    end if;
    for w in select public.ticket_watchers(new) loop
      perform public.notify(w, new.workspace_id, new.id, 'status_changed',
        new.reference || ' is now ' || lower(public.status_label(new.status)), new.subject,
        'status:' || new.id || ':' || new.status || ':' || stamp);
    end loop;
  end if;

  if new.priority <> old.priority then
    insert into public.ticket_events (ticket_id, workspace_id, actor_id, actor_name, kind, from_value, to_value, is_public)
    values (new.id, new.workspace_id, actor_id, actor, 'priority', old.priority, new.priority, true);
    for w in select public.ticket_watchers(new) loop
      perform public.notify(w, new.workspace_id, new.id, 'priority_changed',
        new.reference || ' priority changed to ' || new.priority, new.subject,
        'priority:' || new.id || ':' || new.priority || ':' || stamp);
    end loop;
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.ticket_events (ticket_id, workspace_id, actor_id, actor_name, kind, from_value, to_value)
    values (new.id, new.workspace_id, actor_id, actor, 'assignee', old.assignee_id::text, new.assignee_id::text);
    perform public.notify(new.assignee_id, new.workspace_id, new.id, 'ticket_assigned',
      new.reference || ' assigned to you: ' || new.subject, 'Priority ' || new.priority,
      'assigned:' || new.id || ':' || new.assignee_id || ':' || stamp);
  end if;

  if new.client_id is distinct from old.client_id then
    insert into public.ticket_events (ticket_id, workspace_id, actor_id, actor_name, kind, from_value, to_value)
    values (new.id, new.workspace_id, actor_id, actor, 'client', old.client_id::text, new.client_id::text);
  end if;
  if new.category <> old.category then
    insert into public.ticket_events (ticket_id, workspace_id, actor_id, actor_name, kind, from_value, to_value)
    values (new.id, new.workspace_id, actor_id, actor, 'category', old.category, new.category);
  end if;
  if new.kb_article_id is distinct from old.kb_article_id then
    insert into public.ticket_events (ticket_id, workspace_id, actor_id, actor_name, kind, from_value, to_value)
    values (new.id, new.workspace_id, actor_id, actor, 'kb_link', old.kb_article_id::text, new.kb_article_id::text);
  end if;
  return new;
end;
$$;

create trigger tickets_after_update after update on public.tickets
  for each row execute function public.tickets_after_update();

-- ---------------------------------------------------------------------------
-- Comment triggers: author stamping, customer rules, first response, notifications
-- ---------------------------------------------------------------------------

create or replace function public.ticket_comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  t public.tickets;
  r text;
begin
  select * into t from public.tickets where id = new.ticket_id;
  if t.id is null then raise exception 'Ticket not found' using errcode = '22023'; end if;
  r := public.member_role(t.workspace_id);
  if uid is null or r is null then raise exception 'Not allowed' using errcode = '42501'; end if;
  if r = 'client' then
    if t.client_id is distinct from public.client_of(t.workspace_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
    if new.is_internal then raise exception 'Customers cannot add internal notes' using errcode = '42501'; end if;
    if t.status = 'closed' then raise exception 'This ticket is closed. Create a new ticket instead.' using errcode = '22023'; end if;
  end if;
  if (select count(*) from public.ticket_comments where author_id = uid and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Too many replies in the last hour. Try again later.' using errcode = '54000';
  end if;
  new.workspace_id := t.workspace_id;
  new.author_id := uid;
  new.author_name := public.display_name_of(uid);
  new.author_is_staff := r <> 'client';
  new.created_at := now();
  return new;
end;
$$;

create trigger ticket_comments_before_insert before insert on public.ticket_comments
  for each row execute function public.ticket_comments_before_insert();

create or replace function public.ticket_comments_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tickets;
  w uuid;
begin
  select * into t from public.tickets where id = new.ticket_id;
  if new.author_is_staff and not new.is_internal then
    -- First public reply from staff = first response (for SLA).
    if t.first_responded_at is null then
      update public.tickets set first_responded_at = new.created_at where id = t.id;
    end if;
    perform public.notify(t.requester_id, t.workspace_id, t.id, 'staff_reply',
      'New reply on ' || t.reference || ': ' || t.subject, left(new.body, 300), 'comment:' || new.id);
  elsif new.is_internal then
    for w in select public.ticket_watchers(t) loop
      perform public.notify(w, t.workspace_id, t.id, 'internal_note',
        'Internal note on ' || t.reference, left(new.body, 300), 'comment:' || new.id);
    end loop;
  else
    -- Customer reply: move waiting/resolved tickets back into progress.
    if t.status in ('waiting_customer', 'resolved') then
      update public.tickets set status = 'in_progress' where id = t.id;
    end if;
    for w in select public.ticket_watchers(t) loop
      perform public.notify(w, t.workspace_id, t.id, 'customer_reply',
        'Customer replied on ' || t.reference || ': ' || t.subject, left(new.body, 300), 'comment:' || new.id);
    end loop;
  end if;

  return new;
end;
$$;

create trigger ticket_comments_after_insert after insert on public.ticket_comments
  for each row execute function public.ticket_comments_after_insert();

-- ---------------------------------------------------------------------------
-- Validation triggers for technicians and automation targets; audit
-- ---------------------------------------------------------------------------

create or replace function public.require_staff_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if tg_table_name = 'client_technicians' then
    target := (to_jsonb(new) ->> 'user_id')::uuid;
  else
    target := (to_jsonb(new) ->> 'target_user_id')::uuid;
  end if;
  if not public.is_staff_user(new.workspace_id, target) then
    raise exception 'Choose a technician, administrator or owner of this workspace' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger client_technicians_staff before insert or update on public.client_technicians
  for each row execute function public.require_staff_target();
create trigger automation_rules_staff before insert or update on public.automation_rules
  for each row execute function public.require_staff_target();

create or replace function public.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  ws uuid := (rec ->> 'workspace_id')::uuid;
  eid uuid;
begin
  -- Only record changes people make. Rows written by other triggers (default
  -- SLA seeding, cascades) are covered by the parent action's own audit entry.
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;
  begin
    eid := (rec ->> 'id')::uuid;
  exception when others then
    eid := null;
  end;
  perform public.write_audit(ws, tg_table_name || '.' || lower(tg_op), tg_table_name, eid,
    case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
         else rec end);
  return coalesce(new, old);
end;
$$;

create trigger clients_audit after insert or update or delete on public.clients
  for each row execute function public.audit_change();
create trigger sla_policies_audit after insert or update or delete on public.sla_policies
  for each row execute function public.audit_change();
create trigger automation_rules_audit after insert or update or delete on public.automation_rules
  for each row execute function public.audit_change();
create trigger client_technicians_audit after insert or delete on public.client_technicians
  for each row execute function public.audit_change();

-- ---------------------------------------------------------------------------
-- SLA sweep: warnings and breaches as notifications (no duplicates)
-- ---------------------------------------------------------------------------

-- "Approaching" = less than 25% of the target time remains (minimum 15 minutes).
create or replace function public.sla_sweep_workspace(ws uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tickets;
  w uuid;
  n integer := 0;
  span interval;
begin
  for t in
    select * from public.tickets
    where workspace_id = ws and status not in ('resolved', 'closed')
      and ((first_responded_at is null and first_response_due_at is not null) or resolution_due_at is not null)
  loop
    -- First response
    if t.first_responded_at is null and t.first_response_due_at is not null then
      span := greatest((t.first_response_due_at - t.created_at) * 0.25, interval '15 minutes');
      if now() > t.first_response_due_at then
        for w in select public.ticket_watchers(t) loop
          perform public.notify(w, ws, t.id, 'sla_breach', 'First-response target missed on ' || t.reference,
            t.subject, 'sla:response:breach:' || t.id);
        end loop;
        if not exists (select 1 from public.ticket_events where ticket_id = t.id and kind = 'sla' and to_value = 'response_breached') then
          insert into public.ticket_events (ticket_id, workspace_id, kind, to_value) values (t.id, ws, 'sla', 'response_breached');
          n := n + 1;
        end if;
      elsif now() > t.first_response_due_at - span then
        for w in select public.ticket_watchers(t) loop
          perform public.notify(w, ws, t.id, 'sla_warning', 'First response due soon on ' || t.reference,
            t.subject, 'sla:response:warning:' || t.id);
        end loop;
      end if;
    end if;
    -- Resolution
    if t.resolution_due_at is not null then
      span := greatest((t.resolution_due_at - t.created_at) * 0.25, interval '15 minutes');
      if now() > t.resolution_due_at then
        for w in select public.ticket_watchers(t) loop
          perform public.notify(w, ws, t.id, 'sla_breach', 'Resolution target missed on ' || t.reference,
            t.subject, 'sla:resolution:breach:' || t.id);
        end loop;
        if not exists (select 1 from public.ticket_events where ticket_id = t.id and kind = 'sla' and to_value = 'resolution_breached') then
          insert into public.ticket_events (ticket_id, workspace_id, kind, to_value) values (t.id, ws, 'sla', 'resolution_breached');
          n := n + 1;
        end if;
      elsif now() > t.resolution_due_at - span then
        for w in select public.ticket_watchers(t) loop
          perform public.notify(w, ws, t.id, 'sla_warning', 'Resolution due soon on ' || t.reference,
            t.subject, 'sla:resolution:warning:' || t.id);
        end loop;
      end if;
    end if;
  end loop;
  return n;
end;
$$;

-- Called by the app when staff open the overview or ticket list.
create or replace function public.sla_sweep(ws uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff(ws) then return 0; end if;
  return public.sla_sweep_workspace(ws);
end;
$$;

-- For an optional pg_cron schedule (see docs/DEPLOYMENT.md). Not callable from the API.
create or replace function public.sla_sweep_all()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  n integer := 0;
begin
  for ws in select distinct workspace_id from public.tickets where status not in ('resolved', 'closed') loop
    n := n + public.sla_sweep_workspace(ws);
  end loop;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read helpers
-- ---------------------------------------------------------------------------

-- Names (no emails) of people a member may see: staff see everyone in the
-- workspace; customers see staff and people from their own organisation.
create or replace function public.member_names(ws uuid)
returns table (user_id uuid, display_name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, public.display_name_of(m.user_id), m.role
  from public.workspace_members m
  where m.workspace_id = ws
    and (public.is_staff(ws)
         or (public.client_of(ws) is not null and (m.role <> 'client' or m.client_id = public.client_of(ws))));
$$;

-- Platform owner overview: every workspace with counts. Platform admins only.
create or replace function public.platform_overview()
returns table (id uuid, name text, type text, created_at timestamptz, members bigint, tickets bigint, open_tickets bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.name, w.type, w.created_at,
         (select count(*) from public.workspace_members m where m.workspace_id = w.id),
         (select count(*) from public.tickets t where t.workspace_id = w.id),
         (select count(*) from public.tickets t where t.workspace_id = w.id and t.status not in ('resolved', 'closed'))
  from public.workspaces w
  where public.is_platform_admin()
  order by w.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.client_technicians enable row level security;
alter table public.sla_policies       enable row level security;
alter table public.tickets            enable row level security;
alter table public.ticket_comments    enable row level security;
alter table public.ticket_events      enable row level security;
alter table public.notifications      enable row level security;
alter table public.automation_rules   enable row level security;

-- Tickets: staff see the workspace's tickets; customers see their organisation's.
create policy tickets_select on public.tickets for select to authenticated using (
  public.is_staff(workspace_id) or (client_id is not null and client_id = public.client_of(workspace_id))
);
create policy tickets_insert on public.tickets for insert to authenticated with check (
  public.is_staff(workspace_id) or public.client_of(workspace_id) is not null
);
create policy tickets_update on public.tickets for update to authenticated
  using (public.is_staff(workspace_id)) with check (public.is_staff(workspace_id));
-- No delete policy: tickets are closed, never deleted (history is preserved).

-- Comments: internal notes are staff-only by policy, not by the UI.
create policy ticket_comments_select on public.ticket_comments for select to authenticated using (
  public.is_staff(workspace_id)
  or (not is_internal and exists (
        select 1 from public.tickets t
        where t.id = ticket_comments.ticket_id and t.client_id is not null and t.client_id = public.client_of(t.workspace_id)))
);
create policy ticket_comments_insert on public.ticket_comments for insert to authenticated with check (
  author_id = (select auth.uid())
  and (public.is_staff(workspace_id)
       or (not is_internal and exists (
             select 1 from public.tickets t
             where t.id = ticket_comments.ticket_id and t.client_id = public.client_of(t.workspace_id))))
);
-- Comments are append-only: no update or delete policies.

create policy ticket_events_select on public.ticket_events for select to authenticated using (
  public.is_staff(workspace_id)
  or (is_public and exists (
        select 1 from public.tickets t
        where t.id = ticket_events.ticket_id and t.client_id is not null and t.client_id = public.client_of(t.workspace_id)))
);

create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

create policy sla_policies_select on public.sla_policies for select to authenticated using (public.is_staff(workspace_id));
create policy sla_policies_write on public.sla_policies for all to authenticated
  using (public.is_ws_admin(workspace_id)) with check (public.is_ws_admin(workspace_id));

create policy automation_rules_select on public.automation_rules for select to authenticated using (public.is_staff(workspace_id));
create policy automation_rules_write on public.automation_rules for all to authenticated
  using (public.is_ws_admin(workspace_id)) with check (public.is_ws_admin(workspace_id));

create policy client_technicians_select on public.client_technicians for select to authenticated using (public.is_staff(workspace_id));
create policy client_technicians_write on public.client_technicians for all to authenticated
  using (public.is_ws_admin(workspace_id)) with check (public.is_ws_admin(workspace_id));

-- Clients can now be deactivated by staff but only deleted by admins (unchanged);
-- customers still read only their own organisation (policy from the workspaces migration).

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

revoke all on public.client_technicians, public.sla_policies, public.tickets, public.ticket_comments,
              public.ticket_events, public.notifications, public.automation_rules from anon, authenticated;

grant select, insert on public.tickets to authenticated;
grant update (subject, description, category, priority, status, requester_id, requester_name, requester_email,
              client_id, assignee_id, kb_article_id, resolution_summary) on public.tickets to authenticated;
grant select, insert on public.ticket_comments to authenticated;
grant select on public.ticket_events to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.sla_policies, public.automation_rules, public.client_technicians to authenticated;

do $$
declare
  f text;
begin
  foreach f in array array['sla_sweep(uuid)', 'member_names(uuid)', 'platform_overview()']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'seed_default_sla(uuid)', 'workspaces_after_insert()', 'display_name_of(uuid)', 'is_staff_user(uuid, uuid)',
    'notify(uuid, uuid, uuid, text, text, text, text)', 'ticket_watchers(public.tickets)', 'apply_sla(public.tickets)',
    'tickets_before_insert()', 'tickets_after_insert()', 'tickets_before_update()', 'tickets_after_update()',
    'ticket_comments_before_insert()', 'ticket_comments_after_insert()', 'require_staff_target()', 'audit_change()',
    'sla_sweep_workspace(uuid)', 'sla_sweep_all()', 'client_of_user(uuid, uuid)', 'current_actor()',
    'write_audit(uuid, text, text, uuid, jsonb)']
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end;
$$;
