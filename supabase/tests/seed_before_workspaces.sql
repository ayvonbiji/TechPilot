-- Data that exists in production before the workspace migration runs.
-- Used to prove the migration backfills without losing anything.
\set ON_ERROR_STOP on
insert into auth.users (id, email, raw_user_meta_data) values
  ('99999999-9999-9999-9999-999999999999', 'legacy@example.com', '{"display_name":"Legacy"}');
insert into public.troubleshooting_records (user_id, title, category, symptoms, solution)
  values ('99999999-9999-9999-9999-999999999999', 'Legacy record', 'Networking', 'old symptoms', 'old fix');
insert into public.notes (user_id, title, content)
  values ('99999999-9999-9999-9999-999999999999', 'Legacy note', 'old content');
insert into public.tasks (user_id, title) values ('99999999-9999-9999-9999-999999999999', 'Legacy task');
