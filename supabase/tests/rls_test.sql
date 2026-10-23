-- Row Level Security and constraint tests.
-- Run with: ./supabase/tests/run.sh   (needs a local PostgreSQL 15+)
-- Every check raises an exception on failure, so psql stops at the first problem.
\set ON_ERROR_STOP on
\set QUIET on

-- Two fictional test users
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@example.com', '{"display_name":"Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@example.com', '{}');

do $$ begin
  assert (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Alex',
    'profile trigger should copy display_name';
  assert (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'sam',
    'profile trigger should fall back to email prefix';
  raise notice 'PASS profiles are created on sign-up';
end $$;

-- ---------------------------------------------------------------- user A
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.tasks (title, priority, due_date) values ('Learn DHCP', 'high', current_date);
insert into public.troubleshooting_records (title, category, symptoms, solution, tags)
  values ('No network after sleep', 'Networking', 'Adapter shows limited connectivity', 'Disabled power saving on the adapter', '{wifi,power}');
insert into public.notes (title, content) values ('ipconfig', 'Shows IP configuration. Use /flushdns to clear the DNS resolver cache.');
insert into public.work_logs (log_date, tasks_performed) values (current_date, 'Practised printer installation');
insert into public.skills (name, category) values ('Subnetting', 'Networking fundamentals');
insert into public.bookmarks (title, url, category) values ('Microsoft Learn', 'https://learn.microsoft.com/', 'Official documentation');

do $$ begin
  assert (select count(*) from public.tasks) = 1, 'A sees own task';
  assert (select user_id from public.tasks limit 1) = '11111111-1111-1111-1111-111111111111', 'user_id defaults to auth.uid()';
  raise notice 'PASS owner can insert and read; user_id defaults to the caller';
end $$;

-- A cannot create rows for B
do $$ begin
  begin
    insert into public.tasks (user_id, title) values ('22222222-2222-2222-2222-222222222222', 'sneaky');
    raise exception 'FAIL: inserted a task for another user';
  exception when insufficient_privilege then
    raise notice 'PASS cannot insert rows owned by another user';
  end;
end $$;

-- completed_at is maintained by the trigger
update public.tasks set status = 'completed' where title = 'Learn DHCP';
do $$ begin
  assert (select completed_at is not null from public.tasks where title = 'Learn DHCP'), 'completed_at set';
end $$;
update public.tasks set status = 'pending' where title = 'Learn DHCP';
do $$ begin
  assert (select completed_at is null from public.tasks where title = 'Learn DHCP'), 'completed_at cleared';
  raise notice 'PASS completed_at follows status';
end $$;

-- Full-text search columns work
do $$ begin
  assert (select count(*) from public.troubleshooting_records
          where search @@ websearch_to_tsquery('english', 'power saving')) = 1, 'kb search';
  assert (select count(*) from public.notes where search @@ websearch_to_tsquery('english', 'resolver cache')) = 1, 'notes search';
  raise notice 'PASS full-text search';
end $$;

-- Constraints
do $$ begin
  begin
    insert into public.tasks (title, priority) values ('x', 'urgent');
    raise exception 'FAIL: invalid priority accepted';
  exception when check_violation then null; end;
  begin
    insert into public.bookmarks (title, url, category) values ('bad', 'javascript:alert(1)', 'Useful tools');
    raise exception 'FAIL: non-http url accepted';
  exception when check_violation then null; end;
  begin
    insert into public.tasks (title) values ('');
    raise exception 'FAIL: empty title accepted';
  exception when check_violation then null; end;
  begin
    insert into public.work_logs (log_date) values (current_date);
    raise exception 'FAIL: duplicate work log date accepted';
  exception when unique_violation then null; end;
  raise notice 'PASS check and unique constraints';
end $$;

-- ---------------------------------------------------------------- user B
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
declare n int;
begin
  assert (select count(*) from public.tasks) = 0, 'B must not see A tasks';
  assert (select count(*) from public.troubleshooting_records) = 0, 'B must not see A records';
  assert (select count(*) from public.notes) = 0, 'B must not see A notes';
  assert (select count(*) from public.work_logs) = 0, 'B must not see A logs';
  assert (select count(*) from public.skills) = 0, 'B must not see A skills';
  assert (select count(*) from public.bookmarks) = 0, 'B must not see A bookmarks';
  assert (select count(*) from public.profiles) = 1, 'B sees only own profile';

  update public.tasks set title = 'hacked';
  get diagnostics n = row_count;
  assert n = 0, 'B must not update A tasks';
  delete from public.notes;
  get diagnostics n = row_count;
  assert n = 0, 'B must not delete A notes';
  update public.profiles set display_name = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  assert n = 0, 'B must not update A profile';
  raise notice 'PASS users are fully isolated from each other';
end $$;

-- B cannot move its own row to A
insert into public.tasks (title) values ('B task');
do $$ begin
  begin
    update public.tasks set user_id = '11111111-1111-1111-1111-111111111111' where title = 'B task';
    raise exception 'FAIL: reassigned a row to another user';
  exception when insufficient_privilege then
    raise notice 'PASS cannot reassign rows to another user';
  end;
end $$;

-- ---------------------------------------------------------------- anon
reset request.jwt.claim.sub;
set role anon;
do $$ begin
  begin
    perform 1 from public.tasks;
    raise exception 'FAIL: anon can read tasks';
  exception when insufficient_privilege then null; end;
  begin
    perform public.delete_own_account();
    raise exception 'FAIL: anon can call delete_own_account';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS anonymous role has no access';
end $$;

-- ---------------------------------------------------------------- delete account
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.delete_own_account();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'auth user removed';
  assert not exists (select 1 from public.tasks where user_id = '11111111-1111-1111-1111-111111111111'), 'tasks cascaded';
  assert not exists (select 1 from public.notes where user_id = '11111111-1111-1111-1111-111111111111'), 'notes cascaded';
  assert not exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'profile cascaded';
  assert exists (select 1 from public.tasks where user_id = '22222222-2222-2222-2222-222222222222'), 'other user untouched';
  raise notice 'PASS account deletion removes only the caller''s data';
end $$;

\echo 'All RLS tests passed.'
