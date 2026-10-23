-- =============================================================================
-- IT Engineer Companion — initial schema
--
-- Run this once in the Supabase SQL editor (or with `supabase db push`).
-- Every personal table:
--   * has a user_id that references auth.users and defaults to auth.uid()
--   * has Row Level Security enabled with owner-only policies
--   * is only reachable by the `authenticated` role (never `anon`)
-- Passwords are never stored here; Supabase Auth owns credentials.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one row per auth user, created automatically on sign-up)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 80),
  theme         text not null default 'system' check (theme in ('light', 'dark', 'system')),
  timezone      text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  date_format   text not null default 'dd MMM yyyy'
                check (date_format in ('dd MMM yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd')),
  time_format   text not null default '24h' check (time_format in ('12h', '24h')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically whenever a user signs up.
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 200),
  description       text not null default '' check (char_length(description) <= 5000),
  category          text not null default 'General' check (char_length(category) between 1 and 60),
  priority          text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status            text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  due_date          date,
  completion_notes  text not null default '' check (char_length(completion_notes) <= 5000),
  completed_at      timestamptz,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index tasks_user_status_idx    on public.tasks (user_id, status);
create index tasks_user_due_idx       on public.tasks (user_id, due_date);
create index tasks_user_completed_idx on public.tasks (user_id, completed_at);
create index tasks_user_created_idx   on public.tasks (user_id, created_at desc);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- Keep completed_at in sync with status so reports never rely on guesswork.
create or replace function public.tasks_sync_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' or new.completed_at is null then
      new.completed_at = coalesce(new.completed_at, now());
    end if;
  else
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger tasks_sync_completed_at
  before insert or update of status, completed_at on public.tasks
  for each row execute function public.tasks_sync_completed_at();

-- ---------------------------------------------------------------------------
-- Troubleshooting knowledge base
-- ---------------------------------------------------------------------------

create table public.troubleshooting_records (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title               text not null check (char_length(title) between 1 and 200),
  category            text not null check (category in (
                        'Windows troubleshooting',
                        'Hardware and peripherals',
                        'Networking',
                        'TCP/IP, DNS and DHCP',
                        'Printers and scanners',
                        'Software installation',
                        'Microsoft 365',
                        'Windows Server and Active Directory',
                        'Remote support',
                        'Basic cybersecurity',
                        'Other technical issues')),
  status              text not null default 'resolved' check (status in ('investigating', 'resolved')),
  symptoms            text not null default '' check (char_length(symptoms) <= 10000),
  possible_causes     text not null default '' check (char_length(possible_causes) <= 10000),
  diagnostic_steps    text not null default '' check (char_length(diagnostic_steps) <= 10000),
  commands_used       text not null default '' check (char_length(commands_used) <= 10000),
  solution            text not null default '' check (char_length(solution) <= 10000),
  verification_steps  text not null default '' check (char_length(verification_steps) <= 10000),
  lessons_learned     text not null default '' check (char_length(lessons_learned) <= 10000),
  tags                text[] not null default '{}' check (cardinality(tags) <= 20),
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  search              tsvector generated always as (
                        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                        setweight(to_tsvector('english', coalesce(symptoms, '') || ' ' || coalesce(solution, '')), 'B') ||
                        setweight(to_tsvector('english',
                          coalesce(possible_causes, '') || ' ' || coalesce(diagnostic_steps, '') || ' ' ||
                          coalesce(commands_used, '') || ' ' || coalesce(verification_steps, '') || ' ' ||
                          coalesce(lessons_learned, '')), 'C')
                      ) stored
);

create index troubleshooting_user_created_idx  on public.troubleshooting_records (user_id, created_at desc);
create index troubleshooting_user_category_idx on public.troubleshooting_records (user_id, category);
create index troubleshooting_search_idx        on public.troubleshooting_records using gin (search);
create index troubleshooting_tags_idx          on public.troubleshooting_records using gin (tags);

create trigger troubleshooting_set_updated_at
  before update on public.troubleshooting_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notes and command library
-- ---------------------------------------------------------------------------

create table public.notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  content      text not null default '' check (char_length(content) <= 50000),
  category     text not null default 'General' check (char_length(category) between 1 and 60),
  tags         text[] not null default '{}' check (cardinality(tags) <= 20),
  is_favorite  boolean not null default false,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  search       tsvector generated always as (
                 setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                 setweight(to_tsvector('english', coalesce(content, '')), 'B')
               ) stored
);

create index notes_user_updated_idx  on public.notes (user_id, updated_at desc);
create index notes_user_category_idx on public.notes (user_id, category);
create index notes_search_idx        on public.notes using gin (search);
create index notes_tags_idx          on public.notes using gin (tags);

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Daily work logs (one entry per user per day)
-- ---------------------------------------------------------------------------

create table public.work_logs (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date               date not null,
  tasks_performed        text not null default '' check (char_length(tasks_performed) <= 10000),
  problems_investigated  text not null default '' check (char_length(problems_investigated) <= 10000),
  solutions_outcomes     text not null default '' check (char_length(solutions_outcomes) <= 10000),
  skills_learned         text not null default '' check (char_length(skills_learned) <= 10000),
  challenges             text not null default '' check (char_length(challenges) <= 10000),
  follow_up_actions      text not null default '' check (char_length(follow_up_actions) <= 10000),
  reflections            text not null default '' check (char_length(reflections) <= 10000),
  is_demo                boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, log_date)
);

create index work_logs_user_date_idx on public.work_logs (user_id, log_date desc);

create trigger work_logs_set_updated_at
  before update on public.work_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Learning goals: skills and certifications
-- ---------------------------------------------------------------------------

create table public.skills (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 120),
  kind               text not null default 'skill' check (kind in ('skill', 'certification')),
  category           text not null check (category in (
                       'Computer hardware',
                       'Windows desktop support',
                       'Networking fundamentals',
                       'Windows Server',
                       'Active Directory and Group Policy',
                       'Microsoft 365',
                       'Linux fundamentals',
                       'Cloud fundamentals',
                       'Cybersecurity basics',
                       'IT documentation and communication',
                       'Other')),
  current_level      smallint not null default 0 check (current_level between 0 and 5),
  target_level       smallint not null default 3 check (target_level between 1 and 5),
  status             text not null default 'not_started'
                     check (status in ('not_started', 'learning', 'practising', 'completed')),
  notes              text not null default '' check (char_length(notes) <= 5000),
  resources          text not null default '' check (char_length(resources) <= 5000),
  completed_on       date,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index skills_user_category_idx on public.skills (user_id, category);
create index skills_user_updated_idx  on public.skills (user_id, updated_at desc);

create trigger skills_set_updated_at
  before update on public.skills
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Bookmarks / resources
-- ---------------------------------------------------------------------------

create table public.bookmarks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  url         text not null check (char_length(url) <= 2048 and url ~* '^https?://[^\s]+$'),
  category    text not null check (category in (
                'Official documentation',
                'Technical tutorials',
                'Training resources',
                'Useful tools',
                'Certification preparation')),
  notes       text not null default '' check (char_length(notes) <= 2000),
  is_demo     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index bookmarks_user_category_idx on public.bookmarks (user_id, category);

create trigger bookmarks_set_updated_at
  before update on public.bookmarks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: owners only, authenticated role only
-- ---------------------------------------------------------------------------

alter table public.profiles                enable row level security;
alter table public.tasks                   enable row level security;
alter table public.troubleshooting_records enable row level security;
alter table public.notes                   enable row level security;
alter table public.work_logs               enable row level security;
alter table public.skills                  enable row level security;
alter table public.bookmarks               enable row level security;

-- Profiles: a user can read and update only their own row.
-- Inserts happen through the signup trigger; deletes cascade from auth.users.
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- The same four owner-only policies for every personal table.
do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'troubleshooting_records', 'notes', 'work_logs', 'skills', 'bookmarks']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_own', t);
  end loop;
end;
$$;

-- Privileges: nothing for anonymous visitors; authenticated users get table
-- access that RLS then narrows to their own rows.
revoke all on public.profiles, public.tasks, public.troubleshooting_records, public.notes,
              public.work_logs, public.skills, public.bookmarks from anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks, public.troubleshooting_records, public.notes,
              public.work_logs, public.skills, public.bookmarks to authenticated;

-- ---------------------------------------------------------------------------
-- Self-service account deletion (no service-role key needed in the app)
-- Deleting the auth user cascades to every table above.
-- ---------------------------------------------------------------------------

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

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
