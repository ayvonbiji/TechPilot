-- Workspace isolation, roles and invitations.
-- Cast: O = owner, G = agent, C = client user, X = outsider, L = legacy user
-- (created before the workspace migration).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'agent@example.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'outsider@example.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'client@example.com');

create or replace function pg_temp.act(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
end $$;

-- Raises unless the statement fails with one of the given SQLSTATEs.
create or replace function pg_temp.expect_fail(stmt text, codes text[], label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = any (codes) then return; end if;
    raise exception 'FAIL %: wrong error % (%)', label, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL %: statement succeeded but should have failed', label;
end $$;

-- ------------------------------------------------------------ backfill
do $$ begin
  assert not exists (
    select 1 from auth.users u
    where (select count(*) from public.workspaces w where w.created_by = u.id and w.type = 'personal') <> 1
  ), 'every user has exactly one personal workspace';
  assert (select r.workspace_id = w.id from public.troubleshooting_records r
          join public.workspaces w on w.created_by = r.user_id and w.type = 'personal'
          where r.title = 'Legacy record'), 'legacy record attached to personal workspace';
  assert (select workspace_id is not null from public.notes where title = 'Legacy note'), 'legacy note attached';
  assert exists (select 1 from public.tasks where title = 'Legacy task'), 'legacy task untouched';
  assert exists (select 1 from public.profiles where display_name = 'Legacy'), 'legacy profile untouched';
  raise notice 'PASS existing users and data are backfilled without loss';
end $$;

set role authenticated;
select pg_temp.act('99999999-9999-9999-9999-999999999999');
do $$ begin
  assert (select count(*) from public.troubleshooting_records) = 1, 'legacy user still sees own record';
  assert (select count(*) from public.notes) = 1, 'legacy user still sees own note';
  raise notice 'PASS legacy user keeps access to their own records';
end $$;

-- ------------------------------------------------------------ workspace creation
select pg_temp.act('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select public.create_workspace('Acme IT', 'organisation', 'acme') as ws \gset
select set_config('test.ws', :'ws', false);
do $$ begin
  assert (select ticket_prefix from public.workspaces where id = current_setting('test.ws')::uuid) = 'ACME', 'prefix uppercased';
  assert public.member_role(current_setting('test.ws')::uuid) = 'owner', 'creator is owner';
  raise notice 'PASS creating a workspace makes the creator its owner';
end $$;
select pg_temp.expect_fail($$select public.create_workspace('Mine', 'personal')$$, array['22023'], 'second personal workspace');

insert into public.clients (id, workspace_id, name)
  values ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', current_setting('test.ws')::uuid, 'Northwind Traders');

-- ------------------------------------------------------------ invitations
select public.create_invitation(current_setting('test.ws')::uuid, 'Agent@Example.com', 'agent') as agent_token \gset
select public.create_invitation(current_setting('test.ws')::uuid, 'client@example.com', 'client', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee') as client_token \gset
select set_config('test.agent_token', :'agent_token', false);
select set_config('test.client_token', :'client_token', false);

do $$ begin
  assert (select count(*) from public.invitations where token_hash = current_setting('test.agent_token')) = 0, 'raw token is never stored';
  raise notice 'PASS invitation tokens are stored only as hashes';
end $$;

select pg_temp.expect_fail(format($$select public.create_invitation(%L, 'x@example.com', 'agent')$$,
  (select id from public.workspaces where created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and type = 'personal')),
  array['22023'], 'invite into a personal workspace');

-- The outsider can't accept someone else's invitation.
select pg_temp.act('cccccccc-cccc-cccc-cccc-cccccccccccc');
select pg_temp.expect_fail(format('select public.accept_invitation(%L)', current_setting('test.agent_token')), array['42501'], 'accept invitation for another email');
select pg_temp.expect_fail($$select public.accept_invitation('not-a-real-token')$$, array['22023'], 'accept bogus token');
do $$ begin
  assert (select status from public.peek_invitation(current_setting('test.agent_token'))) = 'pending', 'peek shows status';
  raise notice 'PASS invitations can only be accepted by the invited email';
end $$;

select pg_temp.act('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select public.accept_invitation(current_setting('test.agent_token'));
select pg_temp.expect_fail(format('select public.accept_invitation(%L)', current_setting('test.agent_token')), array['22023'], 'accept twice');
-- Agents can't invite anyone.
select pg_temp.expect_fail(format($$select public.create_invitation(%L, 'y@example.com', 'agent')$$, current_setting('test.ws')), array['42501'], 'agent invites');

select pg_temp.act('dddddddd-dddd-dddd-dddd-dddddddddddd');
select public.accept_invitation(current_setting('test.client_token'));
do $$ begin
  assert public.member_role(current_setting('test.ws')::uuid) = 'client', 'client role';
  assert public.client_of(current_setting('test.ws')::uuid) = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'bound to client';
  raise notice 'PASS agents and client users join through invitations with the invited role';
end $$;

-- Expired invitations are rejected.
reset role;
insert into auth.users (id, email) values ('f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0', 'late@example.com');
insert into public.invitations (workspace_id, email, role, token_hash, expires_at)
  values (current_setting('test.ws')::uuid, 'late@example.com', 'agent', encode(extensions.digest('late-token', 'sha256'), 'hex'), now() - interval '1 day');
set role authenticated;
select pg_temp.act('f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0');
select pg_temp.expect_fail($$select public.accept_invitation('late-token')$$, array['22023'], 'expired invitation');

-- ------------------------------------------------------------ shared knowledge base
select pg_temp.act('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into public.troubleshooting_records (user_id, workspace_id, title, category, symptoms, solution)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', current_setting('test.ws')::uuid, 'Team record', 'Networking', 's', 'f');
insert into public.troubleshooting_records (user_id, title, category, symptoms, solution)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Owner private record', 'Networking', 's', 'f');

select pg_temp.act('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
do $$ begin
  assert exists (select 1 from public.troubleshooting_records where title = 'Team record'), 'agent sees team record';
  assert not exists (select 1 from public.troubleshooting_records where title = 'Owner private record'), 'agent must not see owner personal record';
  assert not exists (select 1 from public.troubleshooting_records where title = 'Legacy record'), 'agent must not see other users records';
end $$;
insert into public.troubleshooting_records (user_id, workspace_id, title, category, symptoms, solution)
  values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', current_setting('test.ws')::uuid, 'Agent record', 'Networking', 's', 'f');
do $$
declare n int;
begin
  update public.troubleshooting_records set title = 'hijacked' where title = 'Team record';
  get diagnostics n = row_count;
  assert n = 0, 'agent must not edit the owner''s record';
  raise notice 'PASS staff share the workspace knowledge base; personal records stay private';
end $$;

select pg_temp.act('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
do $$
declare n int;
begin
  update public.troubleshooting_records set lessons_learned = 'reviewed' where title = 'Agent record';
  get diagnostics n = row_count;
  assert n = 1, 'owner (admin) can edit an agent record';
  raise notice 'PASS workspace admins can maintain team records';
end $$;

select pg_temp.act('dddddddd-dddd-dddd-dddd-dddddddddddd');
do $$ begin
  assert (select count(*) from public.troubleshooting_records) = 0, 'client user sees no internal knowledge base';
  assert (select count(*) from public.notes) = 0, 'client user sees no notes';
end $$;
select pg_temp.expect_fail(format($$insert into public.troubleshooting_records (user_id, workspace_id, title, category, symptoms) values (%L, %L, 'x', 'Networking', 's')$$,
  'dddddddd-dddd-dddd-dddd-dddddddddddd', current_setting('test.ws')), array['42501'], 'client writes to knowledge base');

select pg_temp.act('cccccccc-cccc-cccc-cccc-cccccccccccc');
do $$ begin
  assert not exists (select 1 from public.workspaces where id = current_setting('test.ws')::uuid), 'outsider cannot see workspace';
  assert (select count(*) from public.workspace_members where workspace_id = current_setting('test.ws')::uuid) = 0, 'outsider cannot see members';
  assert (select count(*) from public.clients) = 0, 'outsider cannot see clients';
  assert not exists (select 1 from public.troubleshooting_records where title in ('Team record', 'Agent record')), 'outsider cannot see team records';
end $$;
select pg_temp.expect_fail(format($$insert into public.troubleshooting_records (user_id, workspace_id, title, category, symptoms) values (%L, %L, 'x', 'Networking', 's')$$,
  'cccccccc-cccc-cccc-cccc-cccccccccccc', current_setting('test.ws')), array['42501'], 'outsider writes into workspace');
do $$ begin raise notice 'PASS clients and outsiders cannot read or write internal records'; end $$;

-- ------------------------------------------------------------ membership visibility and tampering
select pg_temp.act('dddddddd-dddd-dddd-dddd-dddddddddddd');
do $$ begin
  assert (select count(*) from public.workspace_roster(current_setting('test.ws')::uuid)) = 0, 'client cannot read the roster';
  assert (select count(*) from public.workspace_members where workspace_id = current_setting('test.ws')::uuid) = 1, 'client sees only own membership';
  assert (select count(*) from public.clients) = 1, 'client sees only own client';
end $$;
do $$
declare n int;
begin
  update public.clients set name = 'pwned';
  get diagnostics n = row_count;
  assert n = 0, 'client user must not edit the client record';
end $$;

select pg_temp.act('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
do $$ begin
  assert (select count(*) from public.workspace_members where workspace_id = current_setting('test.ws')::uuid) = 3, 'staff see the roster';
  assert (select count(*) from public.invitations) = 0, 'agents cannot read invitations';
  assert (select count(*) from public.audit_log) = 0, 'agents cannot read audit log';
end $$;
select pg_temp.expect_fail(format($$insert into public.workspace_members (workspace_id, user_id, role) values (%L, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'owner')$$, current_setting('test.ws')), array['42501'], 'direct membership insert');
select pg_temp.expect_fail(format($$update public.workspace_members set role = 'owner' where workspace_id = %L$$, current_setting('test.ws')), array['42501'], 'direct role update');
select pg_temp.expect_fail(format($$select public.set_member_role(%L, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner')$$, current_setting('test.ws')), array['42501'], 'agent promotes self');
select pg_temp.expect_fail(format($$select public.remove_member(%L, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$, current_setting('test.ws')), array['42501'], 'agent removes owner');
select pg_temp.expect_fail(format($$select public.delete_workspace(%L)$$, current_setting('test.ws')), array['42501'], 'agent deletes workspace');
do $$
declare n int;
begin
  update public.workspaces set name = 'x' where id = current_setting('test.ws')::uuid;
  get diagnostics n = row_count;
  assert n = 0, 'agent must not rename the workspace';
end $$;
do $$ begin
  assert (select count(*) from public.workspace_roster(current_setting('test.ws')::uuid)) = 3, 'staff can read the roster';
end $$;
do $$ begin raise notice 'PASS roles cannot be escalated and members cannot be added outside invitations'; end $$;

select pg_temp.act('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select pg_temp.expect_fail(format($$update public.workspaces set ticket_seq = 999 where id = %L$$, current_setting('test.ws')), array['42501'], 'owner edits ticket counter');
update public.workspaces set name = 'Acme IT Services', brand_color = '#1f6feb' where id = current_setting('test.ws')::uuid;
select pg_temp.expect_fail(format($$select public.remove_member(%L, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')$$, current_setting('test.ws')), array['22023'], 'sole owner leaves');
select pg_temp.expect_fail('select public.delete_own_account()', array['22023'], 'sole owner deletes account while others are members');
do $$ begin
  assert (select count(*) from public.audit_log where workspace_id = current_setting('test.ws')::uuid) >= 4, 'audit entries recorded';
  assert (select count(*) from public.invitations where workspace_id = current_setting('test.ws')::uuid) >= 2, 'admins can read invitations';
  raise notice 'PASS owners manage settings but cannot orphan a workspace; actions are audited';
end $$;

-- ------------------------------------------------------------ leaving removes access
select pg_temp.act('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select public.remove_member(current_setting('test.ws')::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
do $$ begin
  assert not exists (select 1 from public.troubleshooting_records where title in ('Team record', 'Agent record')), 'former agent loses access, even to own team record';
  assert not exists (select 1 from public.workspaces where id = current_setting('test.ws')::uuid), 'former agent cannot see workspace';
  raise notice 'PASS leaving a workspace removes access to its records';
end $$;

-- ------------------------------------------------------------ deleting a workspace
select pg_temp.act('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select public.delete_workspace(current_setting('test.ws')::uuid);
reset role;
do $$ begin
  assert not exists (select 1 from public.workspaces where id = current_setting('test.ws')::uuid), 'workspace deleted';
  assert not exists (select 1 from public.clients where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'), 'clients cascade';
  assert not exists (select 1 from public.troubleshooting_records where title = 'Team record'), 'team records cascade';
  assert exists (select 1 from public.troubleshooting_records where title = 'Owner private record'), 'personal records survive';
  raise notice 'PASS deleting a workspace removes only that workspace''s data';
end $$;

\echo 'All workspace tests passed.'
