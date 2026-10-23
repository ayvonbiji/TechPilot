-- Ticketing security tests: organisation isolation, customer access, internal
-- notes, workflow, protected fields, SLA, automation, notifications, KB visibility.
-- Cast (all fictional):
--   O  = owner of "Northwind Support"      G  = technician (agent) there
--   G2 = second technician (deleted later) CA = customer of client Alpha
--   CB = customer of client Beta           P  = owner of another workspace
--   X  = outsider with only a personal workspace
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('e0000000-0000-0000-0000-00000000000a', 'owner.nw@example.com', '{"display_name":"Olivia Owner"}'),
  ('e0000000-0000-0000-0000-00000000000b', 'tech.nw@example.com', '{"display_name":"Gita Tech"}'),
  ('e0000000-0000-0000-0000-00000000000c', 'tech2.nw@example.com', '{"display_name":"Gary Tech"}'),
  ('e0000000-0000-0000-0000-00000000000d', 'cust.alpha@example.com', '{"display_name":"Cara Alpha"}'),
  ('e0000000-0000-0000-0000-00000000000e', 'cust.beta@example.com', '{"display_name":"Ben Beta"}'),
  ('e0000000-0000-0000-0000-00000000000f', 'owner.other@example.com', '{"display_name":"Pat Other"}'),
  ('e0000000-0000-0000-0000-000000000010', 'outsider@example.org', '{"display_name":"Xavier"}');

create or replace function pg_temp.act(uid text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', uid, false); end $$;

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

create or replace function pg_temp.v(k text) returns uuid language sql as $$ select current_setting('t.' || k)::uuid $$;

-- ------------------------------------------------------------ setup as the owner
set role authenticated;
select pg_temp.act('e0000000-0000-0000-0000-00000000000a');
select public.create_workspace('Northwind Support', 'organisation', 'NW') as ws \gset
select set_config('t.ws', :'ws', false);
insert into public.clients (workspace_id, name) values (:'ws', 'Alpha Bakery') returning id as alpha \gset
insert into public.clients (workspace_id, name) values (:'ws', 'Beta Clinic') returning id as beta \gset
select set_config('t.alpha', :'alpha', false), set_config('t.beta', :'beta', false);

select public.create_invitation(:'ws', 'tech.nw@example.com', 'agent') as tok_g \gset
select public.create_invitation(:'ws', 'tech2.nw@example.com', 'agent') as tok_g2 \gset
select public.create_invitation(:'ws', 'cust.alpha@example.com', 'client', :'alpha') as tok_ca \gset
select public.create_invitation(:'ws', 'cust.beta@example.com', 'client', :'beta') as tok_cb \gset
select pg_temp.act('e0000000-0000-0000-0000-00000000000b'); select public.accept_invitation(:'tok_g');
select pg_temp.act('e0000000-0000-0000-0000-00000000000c'); select public.accept_invitation(:'tok_g2');
select pg_temp.act('e0000000-0000-0000-0000-00000000000d'); select public.accept_invitation(:'tok_ca');
select pg_temp.act('e0000000-0000-0000-0000-00000000000e'); select public.accept_invitation(:'tok_cb');

select pg_temp.act('e0000000-0000-0000-0000-00000000000f');
select public.create_workspace('Other MSP', 'freelance', 'OM') as ws2 \gset
select set_config('t.ws2', :'ws2', false);

do $$ begin
  assert (select count(*) from public.sla_policies where workspace_id = pg_temp.v('ws2')) = 4, 'default SLA seeded';
  raise notice 'PASS new workspaces get default SLA targets';
end $$;

-- ------------------------------------------------------------ creating tickets
select pg_temp.act('e0000000-0000-0000-0000-00000000000b');
insert into public.tickets (workspace_id, subject, priority, status, client_id)
  values (pg_temp.v('ws'), 'Server down', 'critical', 'closed', pg_temp.v('alpha')) returning id as t1 \gset
insert into public.tickets (workspace_id, subject, client_id)
  values (pg_temp.v('ws'), 'Printer jam', pg_temp.v('beta')) returning id as t2 \gset
select set_config('t.t1', :'t1', false), set_config('t.t2', :'t2', false);

do $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = pg_temp.v('t1');
  assert t.number = 1 and t.reference = 'NW-00001', 'first ticket numbered NW-00001';
  assert t.status = 'open', 'new tickets always start open';
  assert t.first_response_due_at = t.created_at + interval '60 minutes', 'critical first-response target 60 min';
  assert t.resolution_due_at = t.created_at + interval '240 minutes', 'critical resolution target 4 h';
  assert (select number from public.tickets where id = pg_temp.v('t2')) = 2, 'second ticket numbered 2';
  assert exists (select 1 from public.ticket_events where ticket_id = t.id and kind = 'created'), 'created event';
  raise notice 'PASS tickets get unique sequential numbers, start open and get SLA deadlines';
end $$;

-- Customer raises a ticket and tries to set staff-only fields.
select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
insert into public.tickets (workspace_id, subject, client_id, assignee_id, status, resolution_summary)
  values (pg_temp.v('ws'), 'Card reader broken', pg_temp.v('beta'), 'e0000000-0000-0000-0000-00000000000b', 'resolved', 'hacked')
  returning id as t3 \gset
select set_config('t.t3', :'t3', false);
reset role;
do $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = pg_temp.v('t3');
  assert t.client_id = pg_temp.v('alpha'), 'customer ticket forced to own organisation';
  assert t.assignee_id is null and t.status = 'open' and t.resolution_summary = '', 'staff-only fields ignored';
  assert t.requester_id = 'e0000000-0000-0000-0000-00000000000d' and t.requester_name = 'Cara Alpha', 'requester is the customer';
  raise notice 'PASS customers can only raise tickets for their own organisation';
end $$;

-- ------------------------------------------------------------ isolation
set role authenticated;
select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from public.tickets) = 2, 'Alpha customer sees Alpha tickets only';
  assert not exists (select 1 from public.tickets where client_id = pg_temp.v('beta')), 'no Beta tickets';
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000e');
do $$ begin
  assert (select count(*) from public.tickets) = 1 and (select subject from public.tickets) = 'Printer jam', 'Beta sees Beta only';
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000f');
do $$ begin assert (select count(*) from public.tickets) = 0, 'other workspace sees nothing'; end $$;
select pg_temp.act('e0000000-0000-0000-0000-000000000010');
do $$ begin
  assert (select count(*) from public.tickets) = 0, 'outsider sees nothing';
  perform pg_temp.expect_fail(format($f$insert into public.tickets (workspace_id, subject) values (%L, 'x')$f$, pg_temp.v('ws')),
    array['42501'], 'outsider creating a ticket in someone else''s workspace');
  raise notice 'PASS organisations and customers are isolated from each other';
end $$;

-- ------------------------------------------------------------ comments and internal notes
select pg_temp.act('e0000000-0000-0000-0000-00000000000b');
update public.tickets set assignee_id = 'e0000000-0000-0000-0000-00000000000b' where id = pg_temp.v('t3');
insert into public.ticket_comments (ticket_id, body, is_internal) values (pg_temp.v('t3'), 'Customer seems frustrated; check warranty', true);
do $$ begin
  assert (select first_responded_at is null from public.tickets where id = pg_temp.v('t3')), 'internal note is not a first response';
end $$;
insert into public.ticket_comments (ticket_id, body) values (pg_temp.v('t3'), 'Thanks, we are looking into it.');
do $$ begin
  assert (select first_responded_at is not null from public.tickets where id = pg_temp.v('t3')), 'public reply sets first response';
end $$;

select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from public.ticket_comments where ticket_id = pg_temp.v('t3')) = 1, 'customer sees only the public reply';
  assert not exists (select 1 from public.ticket_comments where is_internal), 'no internal notes visible';
  perform pg_temp.expect_fail(format($f$insert into public.ticket_comments (ticket_id, body, is_internal) values (%L, 'sneaky', true)$f$, pg_temp.v('t3')),
    array['42501'], 'customer adding an internal note');
  assert not exists (select 1 from public.ticket_events where kind = 'assignee'), 'customer does not see internal history';
  assert exists (select 1 from public.ticket_events where ticket_id = pg_temp.v('t3') and kind = 'created'), 'customer sees public history';
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000e');
do $$ begin
  perform pg_temp.expect_fail(format($f$insert into public.ticket_comments (ticket_id, body) values (%L, 'hi')$f$, pg_temp.v('t3')),
    array['42501'], 'customer commenting on another organisation''s ticket');
  assert (select count(*) from public.ticket_comments) = 0, 'Beta customer sees no Alpha comments';
  raise notice 'PASS internal notes are hidden from customers; replies stay within the organisation';
end $$;

-- Comments are append-only.
select pg_temp.act('e0000000-0000-0000-0000-00000000000b');
do $$ begin
  perform pg_temp.expect_fail('update public.ticket_comments set body = ''edited''', array['42501'], 'editing a comment');
  perform pg_temp.expect_fail('delete from public.ticket_comments', array['42501'], 'deleting a comment');
  raise notice 'PASS comments cannot be edited or deleted';
end $$;

-- ------------------------------------------------------------ workflow and protected fields
do $$ begin
  perform pg_temp.expect_fail(format($f$update public.tickets set status = 'closed' where id = %L$f$, pg_temp.v('t1')),
    array['22023'], 'open straight to closed');
  perform pg_temp.expect_fail(format($f$update public.tickets set status = 'resolved' where id = %L$f$, pg_temp.v('t1')),
    array['22023'], 'resolving without a summary');
end $$;
update public.tickets set status = 'in_progress' where id = pg_temp.v('t1');
update public.tickets set status = 'waiting_third_party' where id = pg_temp.v('t1');
update public.tickets set status = 'resolved', resolution_summary = 'Replaced failed PSU' where id = pg_temp.v('t1');
do $$ begin
  assert (select resolved_at is not null from public.tickets where id = pg_temp.v('t1')), 'resolved_at set';
  perform pg_temp.expect_fail(format($f$update public.tickets set workspace_id = %L where id = %L$f$, pg_temp.v('ws2'), pg_temp.v('t1')),
    array['42501'], 'moving a ticket to another workspace');
  perform pg_temp.expect_fail(format($f$update public.tickets set reference = 'NW-99999' where id = %L$f$, pg_temp.v('t1')),
    array['42501'], 'changing the ticket number');
  perform pg_temp.expect_fail(format($f$update public.tickets set resolved_at = now() - interval '1 year' where id = %L$f$, pg_temp.v('t1')),
    array['42501'], 'back-dating a resolution');
  perform pg_temp.expect_fail(format($f$delete from public.tickets where id = %L$f$, pg_temp.v('t1')), array['42501'], 'deleting a ticket');
  perform pg_temp.expect_fail(format($f$update public.tickets set assignee_id = 'e0000000-0000-0000-0000-00000000000d' where id = %L$f$, pg_temp.v('t2')),
    array['22023'], 'assigning to a customer');
  perform pg_temp.expect_fail(format($f$update public.tickets set assignee_id = 'e0000000-0000-0000-0000-000000000010' where id = %L$f$, pg_temp.v('t2')),
    array['22023'], 'assigning to an outsider');
  raise notice 'PASS status changes follow the workflow; numbers, timestamps and workspace are protected';
end $$;

-- Customer reply on a resolved ticket reopens it.
select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
insert into public.ticket_comments (ticket_id, body) values (pg_temp.v('t1'), 'It failed again this morning');
do $$
declare t public.tickets;
begin
  select * into t from public.tickets where id = pg_temp.v('t1');
  assert t.status = 'in_progress' and t.reopened_count = 1 and t.resolved_at is null, 'customer reply reopened the ticket';
  -- RLS filters a customer's update to zero rows.
  update public.tickets set priority = 'low', status = 'closed' where id = pg_temp.v('t1');
  assert (select priority from public.tickets where id = pg_temp.v('t1')) = 'critical', 'priority unchanged';
  assert (select status from public.tickets where id = pg_temp.v('t1')) = 'in_progress', 'status unchanged';
  raise notice 'PASS customer replies reopen resolved tickets; customers cannot change tickets';
end $$;

-- Closing and reopening: technicians close, only admins reopen closed tickets.
select pg_temp.act('e0000000-0000-0000-0000-00000000000b');
update public.tickets set status = 'resolved' where id = pg_temp.v('t1');
update public.tickets set status = 'closed' where id = pg_temp.v('t1');
do $$ begin
  perform pg_temp.expect_fail(format($f$update public.tickets set status = 'in_progress' where id = %L$f$, pg_temp.v('t1')),
    array['42501'], 'technician reopening a closed ticket');
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
do $$ begin
  perform pg_temp.expect_fail(format($f$insert into public.ticket_comments (ticket_id, body) values (%L, 'again')$f$, pg_temp.v('t1')),
    array['22023'], 'customer replying to a closed ticket');
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000a');
update public.tickets set status = 'in_progress' where id = pg_temp.v('t1');
do $$ begin
  assert (select reopened_count from public.tickets where id = pg_temp.v('t1')) = 2, 'admin reopened';
  raise notice 'PASS only admins reopen closed tickets; customers cannot reply to closed tickets';
end $$;

-- ------------------------------------------------------------ notifications
do $$ begin
  -- t1 went to "in progress" twice: by the customer's reply, then by the owner's reopen.
  -- The owner is told about the first, not about their own action.
  assert (select count(*) from public.notifications where kind = 'status_changed' and title like 'NW-00001 is now in progress%'
    and user_id = 'e0000000-0000-0000-0000-00000000000a') = 1, 'actor not notified of their own change';
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000b');
update public.tickets set assignee_id = 'e0000000-0000-0000-0000-00000000000c' where id = pg_temp.v('t2');
select pg_temp.act('e0000000-0000-0000-0000-00000000000c');
do $$ begin
  assert exists (select 1 from public.notifications where kind = 'ticket_assigned' and ticket_id = pg_temp.v('t2')), 'assignee notified';
  perform pg_temp.expect_fail('update public.notifications set title = ''x''', array['42501'], 'editing a notification title');
  update public.notifications set read_at = now() where ticket_id = pg_temp.v('t2');
  assert not exists (select 1 from public.notifications where read_at is null and ticket_id = pg_temp.v('t2')), 'mark as read';
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert exists (select 1 from public.notifications where kind = 'staff_reply'), 'customer told about staff reply';
  assert not exists (select 1 from public.notifications where user_id <> 'e0000000-0000-0000-0000-00000000000d'), 'sees only own notifications';
  assert not exists (select 1 from public.notifications where kind = 'internal_note'), 'never told about internal notes';
  raise notice 'PASS notifications reach the right people, never the actor, and only their owner can read them';
end $$;

-- ------------------------------------------------------------ SLA sweep
reset role;
select pg_temp.act('');  -- a database administrator, no signed-in user
update public.tickets set first_response_due_at = now() - interval '5 minutes', first_responded_at = null
  where id = pg_temp.v('t2');
set role authenticated;
select pg_temp.act('e0000000-0000-0000-0000-00000000000c');
select public.sla_sweep(pg_temp.v('ws'));
select public.sla_sweep(pg_temp.v('ws'));
do $$ begin
  assert (select count(*) from public.notifications where kind = 'sla_breach' and ticket_id = pg_temp.v('t2')
          and title like 'First-response%') = 1, 'one breach notification despite two sweeps';
  assert (select count(*) from public.ticket_events where ticket_id = pg_temp.v('t2') and to_value = 'response_breached') = 1, 'one breach event';
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert public.sla_sweep(pg_temp.v('ws')) = 0, 'customers cannot run the sweep';
  raise notice 'PASS SLA breaches are recorded once and alerted without duplicates';
end $$;

-- Client-specific SLA override; technicians can't change SLA policies.
select pg_temp.act('e0000000-0000-0000-0000-00000000000b');
do $$ begin
  update public.sla_policies set resolution_minutes = 1 where workspace_id = pg_temp.v('ws');
  assert (select min(resolution_minutes) from public.sla_policies where workspace_id = pg_temp.v('ws')) > 1, 'technician cannot edit SLA';
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000a');
insert into public.sla_policies (workspace_id, client_id, priority, first_response_minutes, resolution_minutes)
  values (pg_temp.v('ws'), pg_temp.v('alpha'), 'critical', 30, 120);
insert into public.tickets (workspace_id, subject, priority, client_id) values (pg_temp.v('ws'), 'Alpha outage', 'critical', pg_temp.v('alpha'))
  returning id as t4 \gset
insert into public.tickets (workspace_id, subject, priority, client_id) values (pg_temp.v('ws'), 'Beta outage', 'critical', pg_temp.v('beta'))
  returning id as t5 \gset
select set_config('t.t4', :'t4', false), set_config('t.t5', :'t5', false);
do $$ begin
  assert (select first_response_due_at - created_at from public.tickets where id = pg_temp.v('t4')) = interval '30 minutes', 'Alpha override used';
  assert (select first_response_due_at - created_at from public.tickets where id = pg_temp.v('t5')) = interval '60 minutes', 'Beta uses default';
  update public.tickets set priority = 'low' where id = pg_temp.v('t5');
  assert (select resolution_due_at - created_at from public.tickets where id = pg_temp.v('t5')) = interval '7200 minutes', 'deadline follows new priority';
  raise notice 'PASS SLA targets follow client overrides and priority changes; only admins edit them';
end $$;

-- ------------------------------------------------------------ automation
select pg_temp.act('e0000000-0000-0000-0000-00000000000b');
do $$ begin
  perform pg_temp.expect_fail(format($f$insert into public.automation_rules (workspace_id, name, action, target_user_id) values (%L, 'x', 'assign', 'e0000000-0000-0000-0000-00000000000b')$f$, pg_temp.v('ws')),
    array['42501'], 'technician creating an automation rule');
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000a');
do $$ begin
  perform pg_temp.expect_fail(format($f$insert into public.automation_rules (workspace_id, name, action, target_user_id) values (%L, 'x', 'assign', 'e0000000-0000-0000-0000-00000000000d')$f$, pg_temp.v('ws')),
    array['22023'], 'rule targeting a customer');
end $$;
insert into public.automation_rules (workspace_id, name, match_category, action, target_user_id)
  values (pg_temp.v('ws'), 'Printers to Gita', 'Printers', 'assign', 'e0000000-0000-0000-0000-00000000000b');
insert into public.automation_rules (workspace_id, name, match_priority, action, target_user_id)
  values (pg_temp.v('ws'), 'Tell Olivia about critical', 'critical', 'notify', 'e0000000-0000-0000-0000-00000000000a');
select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
insert into public.tickets (workspace_id, subject, category, priority) values (pg_temp.v('ws'), 'Toner smudges', 'Printers', 'critical')
  returning id as t6 \gset
select set_config('t.t6', :'t6', false);
reset role;
do $$ begin
  assert (select assignee_id from public.tickets where id = pg_temp.v('t6')) = 'e0000000-0000-0000-0000-00000000000b', 'auto-assigned by category';
  assert exists (select 1 from public.notifications where user_id = 'e0000000-0000-0000-0000-00000000000a'
                 and ticket_id = pg_temp.v('t6') and dedupe_key like 'rule:%'), 'notify rule fired';
  assert exists (select 1 from public.notifications where user_id = 'e0000000-0000-0000-0000-00000000000b'
                 and ticket_id = pg_temp.v('t6') and kind = 'ticket_assigned'), 'auto-assignee notified';
  assert (select actor_name from public.ticket_events where ticket_id = pg_temp.v('t6') and kind = 'assignee') = 'Automation (Printers to Gita)',
    'history credits the automation rule, not the customer';
  assert (select actor_id from public.ticket_events where ticket_id = pg_temp.v('t6') and kind = 'assignee') is null, 'no human actor';
  raise notice 'PASS automation assigns and notifies; only admins manage rules, targeting staff only';
end $$;

-- ------------------------------------------------------------ knowledge base visibility
set role authenticated;
select pg_temp.act('e0000000-0000-0000-0000-00000000000b');
insert into public.troubleshooting_records (user_id, workspace_id, title, category, symptoms, solution, visibility, status) values
  ('e0000000-0000-0000-0000-00000000000b', pg_temp.v('ws'), 'Private draft', 'General IT support', 's', 'f', 'private', 'resolved'),
  ('e0000000-0000-0000-0000-00000000000b', pg_temp.v('ws'), 'Team article', 'DNS and DHCP', 's', 'f', 'workspace', 'resolved'),
  ('e0000000-0000-0000-0000-00000000000b', pg_temp.v('ws'), 'Public article', 'Printers and peripherals', 's', 'f', 'public', 'resolved');
select pg_temp.act('e0000000-0000-0000-0000-00000000000a');
do $$ begin
  assert not exists (select 1 from public.troubleshooting_records where title = 'Private draft'), 'admin cannot see a private article';
  assert exists (select 1 from public.troubleshooting_records where title = 'Team article'), 'staff see workspace articles';
  update public.troubleshooting_records set summary = 'edited by admin' where title = 'Team article';
  assert (select summary from public.troubleshooting_records where title = 'Team article') = 'edited by admin', 'admin edits team article';
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000c');
do $$ begin
  update public.troubleshooting_records set summary = 'hijack' where title = 'Team article';
  assert (select summary from public.troubleshooting_records where title = 'Team article') = 'edited by admin', 'technician cannot edit others'' articles';
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select array_agg(title) from public.troubleshooting_records) = array['Public article'], 'customer sees only public articles';
  perform pg_temp.expect_fail(format($f$insert into public.troubleshooting_records (user_id, workspace_id, title, category, symptoms) values ('e0000000-0000-0000-0000-00000000000d', %L, 'x', 'Linux', 's')$f$, pg_temp.v('ws')),
    array['42501'], 'customer writing an article');
end $$;
select pg_temp.act('e0000000-0000-0000-0000-000000000010');
do $$ begin
  assert not exists (select 1 from public.troubleshooting_records where workspace_id = pg_temp.v('ws')), 'outsiders see no articles, even public ones';
  raise notice 'PASS knowledge base visibility: private, team and public (portal) are enforced';
end $$;

-- Ticket can only link an article from its own workspace.
select pg_temp.act('e0000000-0000-0000-0000-00000000000f');
insert into public.troubleshooting_records (user_id, workspace_id, title, category, symptoms)
  values ('e0000000-0000-0000-0000-00000000000f', pg_temp.v('ws2'), 'Other MSP article', 'Linux', 's') returning id as foreign_kb \gset
select pg_temp.act('e0000000-0000-0000-0000-00000000000b');
select set_config('t.fkb', :'foreign_kb', false);
do $$ begin
  perform pg_temp.expect_fail(format($f$update public.tickets set kb_article_id = %L where id = %L$f$, current_setting('t.fkb'), pg_temp.v('t2')),
    array['23503'], 'linking another workspace''s article');
  raise notice 'PASS tickets can only link knowledge articles from their own workspace';
end $$;

-- ------------------------------------------------------------ names, technicians per client
select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
do $$ begin
  assert exists (select 1 from public.member_names(pg_temp.v('ws')) where display_name = 'Gita Tech'), 'customer sees technician names';
  assert not exists (select 1 from public.member_names(pg_temp.v('ws')) where display_name = 'Ben Beta'), 'customer cannot see other organisations'' people';
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000b');
do $$ begin
  perform pg_temp.expect_fail(format($f$insert into public.client_technicians (client_id, workspace_id, user_id) values (%L, %L, 'e0000000-0000-0000-0000-00000000000b')$f$, pg_temp.v('alpha'), pg_temp.v('ws')),
    array['42501'], 'technician assigning themselves to a client');
end $$;
select pg_temp.act('e0000000-0000-0000-0000-00000000000a');
insert into public.client_technicians (client_id, workspace_id, user_id) values (pg_temp.v('alpha'), pg_temp.v('ws'), 'e0000000-0000-0000-0000-00000000000b');
do $$ begin
  perform pg_temp.expect_fail(format($f$insert into public.client_technicians (client_id, workspace_id, user_id) values (%L, %L, 'e0000000-0000-0000-0000-00000000000d')$f$, pg_temp.v('alpha'), pg_temp.v('ws')),
    array['22023'], 'assigning a customer as a technician');
  assert exists (select 1 from public.audit_log where action = 'client_technicians.insert' and workspace_id = pg_temp.v('ws')), 'audited';
  raise notice 'PASS client technician assignments are admin-only, staff-only and audited';
end $$;

-- ------------------------------------------------------------ platform owner
do $$ begin assert (select count(*) from public.platform_overview()) = 0, 'non-platform-admin sees nothing'; end $$;
reset role;
insert into public.platform_admins (user_id) values ('e0000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ begin
  assert (select count(*) from public.platform_overview() where name = 'Northwind Support') = 1, 'platform admin sees workspaces';
  raise notice 'PASS platform overview is limited to platform owners';
end $$;

-- ------------------------------------------------------------ rate limit
select pg_temp.act('e0000000-0000-0000-0000-000000000010');
select id as xws from public.workspaces where type = 'personal' and created_by = 'e0000000-0000-0000-0000-000000000010' \gset
select set_config('t.xws', :'xws', false);
do $$ begin
  for i in 1..60 loop
    insert into public.tickets (workspace_id, subject) values (pg_temp.v('xws'), 'bulk ' || i);
  end loop;
  perform pg_temp.expect_fail(format($f$insert into public.tickets (workspace_id, subject) values (%L, 'one too many')$f$, pg_temp.v('xws')),
    array['54000'], 'more than 60 tickets an hour');
  raise notice 'PASS ticket creation is rate limited per user';
end $$;

-- ------------------------------------------------------------ deletions keep working
select pg_temp.act('e0000000-0000-0000-0000-00000000000c');
select public.delete_own_account();
reset role;
do $$ begin
  assert (select assignee_id from public.tickets where id = pg_temp.v('t2')) is null, 'deleted technician unassigned';
  assert exists (select 1 from public.ticket_events where ticket_id = pg_temp.v('t2') and kind = 'assignee'), 'history kept';
  raise notice 'PASS deleting a technician''s account unassigns their tickets and keeps history';
end $$;
-- A customer who raised tickets and replied can still delete their account;
-- the tickets and conversation stay with the organisation.
set role authenticated;
select pg_temp.act('e0000000-0000-0000-0000-00000000000d');
select public.delete_own_account();
reset role;
select pg_temp.act('');
do $$ begin
  assert not exists (select 1 from auth.users where id = 'e0000000-0000-0000-0000-00000000000d'), 'customer account deleted';
  assert (select created_by from public.tickets where id = pg_temp.v('t3')) is null, 'creator cleared';
  assert (select requester_name from public.tickets where id = pg_temp.v('t3')) = 'Cara Alpha', 'requester name kept for the record';
  assert exists (select 1 from public.ticket_comments where ticket_id = pg_temp.v('t1') and author_name = 'Cara Alpha'), 'customer replies kept';
  raise notice 'PASS deleting a customer who raised tickets keeps the tickets and conversation';
end $$;
-- Created_by can't be reassigned by staff.
set role authenticated;
select pg_temp.act('e0000000-0000-0000-0000-00000000000a');
do $$ begin
  perform pg_temp.expect_fail(format($f$update public.tickets set created_by = 'e0000000-0000-0000-0000-00000000000a' where id = %L$f$, pg_temp.v('t2')),
    array['42501'], 'reassigning a ticket''s creator');
end $$;

select pg_temp.act('e0000000-0000-0000-0000-00000000000f');
insert into public.clients (workspace_id, name) values (pg_temp.v('ws2'), 'Gamma') returning id as gamma \gset
insert into public.tickets (workspace_id, subject, client_id) values (pg_temp.v('ws2'), 'Gamma issue', :'gamma');
select public.delete_workspace(pg_temp.v('ws2'));
reset role;
do $$ begin
  assert not exists (select 1 from public.tickets where workspace_id = pg_temp.v('ws2')), 'workspace tickets removed';
  assert exists (select 1 from public.tickets where workspace_id = pg_temp.v('ws')), 'other workspace untouched';
  raise notice 'PASS deleting a workspace removes its clients and tickets only';
end $$;

\echo 'All ticketing tests passed.'
